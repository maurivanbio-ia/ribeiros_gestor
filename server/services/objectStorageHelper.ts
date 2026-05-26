import { Client } from '@replit/object-storage';
import fs from 'fs';
import path from 'path';

export interface ObjectItem {
  key: string;
  size: number;
  lastModified: Date | null;
}

export async function listObjects(prefix?: string): Promise<ObjectItem[]> {
  try {
    const client = new Client();
    const result = await client.list(prefix ? { prefix } : {});
    if (!result.ok) return [];
    return (result.value || []).map((f: any) => ({
      key: f.name,
      size: f.size || 0,
      lastModified: null,
    }));
  } catch (err: any) {
    console.warn('[ObjectStorageHelper] Erro ao listar objetos:', err.message);
    return [];
  }
}

/**
 * Faz upload de bytes com retry e backoff exponencial para superar
 * rate-limits transitórios do GCS sidecar ("no allowed resources").
 */
export async function uploadBytesWithRetry(
  key: string,
  data: Buffer,
  options?: { contentType?: string },
  maxAttempts = 5,
): Promise<boolean> {
  // Tentativa 1: FUSE filesystem mount (sem overhead de API)
  try {
    const mountRoot = (process.env.PRIVATE_OBJECT_DIR || '').replace(/\/\.private$/, '');
    if (mountRoot) {
      const fusePath = path.join(mountRoot, key);
      fs.mkdirSync(path.dirname(fusePath), { recursive: true });
      fs.writeFileSync(fusePath, data);
      console.log(`[ObjectStorageHelper] Upload via FUSE: ${fusePath}`);
      return true;
    }
  } catch (_fuseErr) {
    // FUSE não disponível, continua via SDK
  }

  // Tentativa 2: SDK com retry e backoff
  const client = new Client();
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await client.uploadFromBytes(key, data, options || {});
      if (result.ok) return true;
      const errMsg = (result.error as any)?.message || String(result.error) || 'unknown';
      if (attempt < maxAttempts) {
        const delay = attempt * 3000;
        console.warn(`[ObjectStorageHelper] Upload tentativa ${attempt}/${maxAttempts} falhou (${errMsg}), aguardando ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        console.error(`[ObjectStorageHelper] Upload falhou após ${maxAttempts} tentativas: ${errMsg}`);
      }
    } catch (err: any) {
      console.warn(`[ObjectStorageHelper] Erro upload tentativa ${attempt}:`, err.message);
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, attempt * 3000));
    }
  }
  return false;
}

/**
 * Baixa um objeto com:
 * 1. Fallback via FUSE filesystem mount (evita rate-limit de API)
 * 2. Retry próprio com backoff exponencial caso SDK falhe
 */
export async function getObjectBuffer(key: string, maxAttempts = 4): Promise<Buffer | null> {
  // Tentativa 1: FUSE mount (sem overhead de API)
  try {
    const mountRoot = (process.env.PRIVATE_OBJECT_DIR || '').replace(/\/\.private$/, '');
    if (mountRoot) {
      const fusePath = path.join(mountRoot, key);
      if (fs.existsSync(fusePath)) {
        const buf = fs.readFileSync(fusePath);
        console.log(`[ObjectStorageHelper] Servido via FUSE: ${fusePath}`);
        return buf;
      }
    }
  } catch (_) {
    // FUSE não disponível, continua via SDK
  }

  // Tentativa 2: SDK com retry e backoff
  const client = new Client();
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await client.downloadAsBytes(key);
      if (result.ok) return Buffer.from(result.value);
      if (attempt < maxAttempts) {
        const delay = attempt * 3000;
        console.warn(`[ObjectStorageHelper] Download tentativa ${attempt}/${maxAttempts} falhou, aguardando ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    } catch (err: any) {
      console.warn(`[ObjectStorageHelper] Erro tentativa ${attempt}:`, err.message);
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, attempt * 3000));
    }
  }
  return null;
}
