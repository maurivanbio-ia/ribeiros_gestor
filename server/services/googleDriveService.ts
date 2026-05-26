// Google Drive Integration Service for SGAI Backups
// Uses Replit Google Drive connector (conn_google-drive_01K7F6B3STTDYTX8BTMBD5TR58)
// Auth is handled automatically by the Replit connectors SDK

import { ReplitConnectors } from '@replit/connectors-sdk';
import { db } from '../db';
import { arquivos, dropboxSyncLog } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

const BACKUP_FOLDER_NAME = 'SGAI_Backup';
const connectors = new ReplitConnectors();

// ── Direct Google Drive HTTP (bypasses connector proxy nginx limit) ────────────

async function getGoogleDriveAccessToken(): Promise<string> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken || !hostname) {
    throw new Error('Credenciais do Replit não encontradas (REPL_IDENTITY / WEB_REPL_RENEWAL)');
  }

  const connectionSettings = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=google-drive`,
    {
      headers: {
        Accept: 'application/json',
        'X-Replit-Token': xReplitToken,
      },
    }
  )
    .then((res) => res.json())
    .then((data) => data.items?.[0]);

  const token =
    connectionSettings?.settings?.access_token ||
    connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!token) throw new Error('Token de acesso ao Google Drive não disponível. Verifique a integração Google Drive nas configurações do Replit.');
  return token;
}

async function uploadBufferDirect(
  fileName: string,
  uploadBuffer: Buffer,
  uploadMime: string,
  folderId: string
): Promise<string> {
  const accessToken = await getGoogleDriveAccessToken();
  const mb = (uploadBuffer.length / 1024 / 1024).toFixed(1);
  console.log(`[GoogleDrive] Upload direto (resumable): ${fileName} (${mb} MB)`);

  // Step 1: initiate resumable session
  const initRes = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': uploadMime,
        'X-Upload-Content-Length': String(uploadBuffer.length),
      },
      body: JSON.stringify({ name: fileName, parents: [folderId] }),
    }
  );

  if (!initRes.ok) {
    const text = await initRes.text();
    throw new Error(`Falha ao iniciar upload resumable (${initRes.status}): ${text}`);
  }

  const uploadUri = initRes.headers.get('Location');
  if (!uploadUri) throw new Error('Google Drive não retornou URI de upload resumable');

  // Step 2: upload the file (single PUT — no size limit from proxy, only from Google which allows up to 5 TB)
  const uploadRes = await fetch(uploadUri, {
    method: 'PUT',
    headers: {
      'Content-Type': uploadMime,
      'Content-Length': String(uploadBuffer.length),
    },
    body: uploadBuffer,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Falha no upload do arquivo (${uploadRes.status}): ${text}`);
  }

  const result = await uploadRes.json();
  if (!result.id) throw new Error('Google Drive não retornou ID do arquivo após upload');
  console.log(`[GoogleDrive] Upload direto concluído: ${fileName} → ${result.id}`);
  return result.id as string;
}

// ── Low-level helpers ────────────────────────────────────────────────────────

async function driveGet(path: string): Promise<any> {
  const res = await connectors.proxy('google-drive', path, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive GET ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function drivePost(path: string, body: any, contentType = 'application/json'): Promise<any> {
  const res = await connectors.proxy('google-drive', path, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive POST ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function driveDelete(path: string): Promise<void> {
  const res = await connectors.proxy('google-drive', path, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`Google Drive DELETE ${path} failed (${res.status}): ${text}`);
  }
}

// ── Compression helpers ───────────────────────────────────────────────────────

// Mime types that are already compressed — skip gzip for these
const ALREADY_COMPRESSED = new Set([
  'application/pdf',
  'application/zip', 'application/x-zip-compressed',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel', 'application/msword', 'application/vnd.ms-powerpoint',
]);

function isCompressible(mimeType: string): boolean {
  if (ALREADY_COMPRESSED.has(mimeType)) return false;
  if (mimeType.startsWith('image/')) return false;
  if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) return false;
  // Compress text-based formats
  return mimeType.startsWith('text/') || ['application/json', 'application/xml', 'application/rtf'].includes(mimeType);
}

async function gzipBuffer(buf: Buffer): Promise<Buffer> {
  const { promisify } = await import('util');
  const { gzip } = await import('zlib');
  return (promisify(gzip) as (buf: Buffer, opts: any) => Promise<Buffer>)(buf, { level: 9 });
}

export async function gunzipBuffer(buf: Buffer): Promise<Buffer> {
  const { promisify } = await import('util');
  const { gunzip } = await import('zlib');
  return (promisify(gunzip) as (buf: Buffer) => Promise<Buffer>)(buf);
}

// ── Multipart upload (simple, works for files up to proxy limit ~8MB) ────────

async function uploadBufferMultipart(
  fileName: string,
  uploadBuffer: Buffer,
  uploadMime: string,
  folderId: string
): Promise<string> {
  const boundary = `sgai_boundary_${Date.now()}`;
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
  const head =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${uploadMime}\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;
  const body = Buffer.concat([Buffer.from(head, 'utf-8'), uploadBuffer, Buffer.from(tail, 'utf-8')]);

  const res = await connectors.proxy(
    'google-drive',
    `/upload/drive/v3/files?uploadType=multipart`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: body,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Multipart upload falhou (${res.status}): ${text}`);
  }
  const result = await res.json();
  return result.id as string;
}

// ── Upload dispatcher — uses direct resumable upload to bypass proxy nginx limit ──

async function uploadBufferResumable(
  fileName: string,
  uploadBuffer: Buffer,
  uploadMime: string,
  folderId: string
): Promise<string> {
  return uploadBufferDirect(fileName, uploadBuffer, uploadMime, folderId);
}

// ── Folder management ────────────────────────────────────────────────────────

let cachedFolderId: string | null = null;

export async function getOrCreateBackupFolder(): Promise<string> {
  if (cachedFolderId) return cachedFolderId;

  // Search for existing folder
  const query = encodeURIComponent(
    `name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const list = await driveGet(`/drive/v3/files?q=${query}&fields=files(id,name)`);

  if (list.files && list.files.length > 0) {
    cachedFolderId = list.files[0].id;
    console.log(`[GoogleDrive] Pasta de backup encontrada: ${BACKUP_FOLDER_NAME} (${cachedFolderId})`);
    return cachedFolderId!;
  }

  // Create folder if it doesn't exist
  const folder = await drivePost('/drive/v3/files', {
    name: BACKUP_FOLDER_NAME,
    mimeType: 'application/vnd.google-apps.folder',
  });

  cachedFolderId = folder.id;
  console.log(`[GoogleDrive] Pasta de backup criada: ${BACKUP_FOLDER_NAME} (${cachedFolderId})`);
  return cachedFolderId!;
}

// ── File upload using multipart ──────────────────────────────────────────────

export async function uploadToGoogleDrive(
  fileName: string,
  content: string | Buffer
): Promise<{ success: boolean; fileId?: string; error?: string }> {
  try {
    const folderId = await getOrCreateBackupFolder();
    const boundary = `sgai_backup_boundary_${Date.now()}`;
    const fileContent = typeof content === 'string' ? content : content.toString('utf-8');
    const metadata = JSON.stringify({ name: fileName, parents: [folderId] });

    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${fileContent}\r\n` +
      `--${boundary}--`;

    const res = await connectors.proxy(
      'google-drive',
      `/upload/drive/v3/files?uploadType=multipart`,
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multipartBody,
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Upload falhou (${res.status}): ${text}`);
    }

    const result = await res.json();
    console.log(`[GoogleDrive] Backup enviado: ${fileName} (id=${result.id})`);
    return { success: true, fileId: result.id };
  } catch (error: any) {
    console.error('[GoogleDrive] Erro ao enviar backup:', error.message);
    return { success: false, error: error.message };
  }
}

// ── List backups ─────────────────────────────────────────────────────────────

export async function listGoogleDriveBackups(): Promise<{
  success: boolean;
  files?: { id: string; name: string; size: number; modifiedTime: string }[];
  error?: string;
}> {
  try {
    const folderId = await getOrCreateBackupFolder();
    const query = encodeURIComponent(
      `'${folderId}' in parents and trashed=false`
    );
    const data = await driveGet(
      `/drive/v3/files?q=${query}&fields=files(id,name,size,modifiedTime)&orderBy=modifiedTime+desc`
    );

    const files = (data.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      size: parseInt(f.size || '0', 10),
      modifiedTime: f.modifiedTime,
    }));

    return { success: true, files };
  } catch (error: any) {
    console.error('[GoogleDrive] Erro ao listar backups:', error.message);
    return { success: false, error: error.message };
  }
}

// ── Delete old backups ───────────────────────────────────────────────────────

export async function deleteOldGoogleDriveBackups(
  retentionDays: number = 30
): Promise<{ deleted: number; errors: string[] }> {
  const errors: string[] = [];
  let deleted = 0;

  try {
    const listResult = await listGoogleDriveBackups();
    if (!listResult.success || !listResult.files) {
      return { deleted: 0, errors: [listResult.error || 'Falha ao listar arquivos'] };
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    for (const file of listResult.files) {
      const fileDate = new Date(file.modifiedTime);
      if (fileDate < cutoff) {
        try {
          await driveDelete(`/drive/v3/files/${file.id}`);
          deleted++;
          console.log(`[GoogleDrive] Backup antigo removido: ${file.name}`);
        } catch (err: any) {
          errors.push(`Falha ao deletar ${file.name}: ${err.message}`);
        }
      }
    }

    return { deleted, errors };
  } catch (error: any) {
    return { deleted: 0, errors: [error.message] };
  }
}

// ── Folder helpers ───────────────────────────────────────────────────────────

/**
 * Gets or creates a subfolder with `name` inside `parentId`.
 * Returns the folder ID.
 */
async function getOrCreateFolderInParent(name: string, parentId: string): Promise<string> {
  const query = encodeURIComponent(
    `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
  );
  const list = await driveGet(`/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=1`);
  if (list.files && list.files.length > 0) {
    return list.files[0].id as string;
  }
  const folder = await drivePost('/drive/v3/files', {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId],
  });
  return folder.id as string;
}

/**
 * Creates a nested path (e.g. "1. PROJETOS/CODIGO_CLIENTE/1. GESTAO") under `rootId`.
 * Splits by "/" and creates each segment in order.
 */
async function createNestedFolders(pathSegments: string[], rootId: string): Promise<string> {
  let currentId = rootId;
  for (const segment of pathSegments) {
    if (!segment) continue;
    currentId = await getOrCreateFolderInParent(segment, currentId);
  }
  return currentId;
}

function normalizarTextoGD(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_\-. ]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase();
}

// ── Institutional folder structure ───────────────────────────────────────────

const ESTRUTURA_INSTITUCIONAL_GD: string[][] = [
  ['1. ADMINISTRATIVO_E_JURIDICO'],
  ['1. ADMINISTRATIVO_E_JURIDICO', '1.1. CONTRATOS'],
  ['1. ADMINISTRATIVO_E_JURIDICO', '1.2. FINANCEIRO'],
  ['1. ADMINISTRATIVO_E_JURIDICO', '1.2. FINANCEIRO', '1.2.1. LANCAMENTOS'],
  ['1. ADMINISTRATIVO_E_JURIDICO', '1.2. FINANCEIRO', '1.2.2. RECIBOS'],
  ['1. ADMINISTRATIVO_E_JURIDICO', '1.2. FINANCEIRO', '1.2.3. NOTAS_FISCAIS'],
  ['1. ADMINISTRATIVO_E_JURIDICO', '1.3. RECURSOS_HUMANOS'],
  ['1. ADMINISTRATIVO_E_JURIDICO', '1.3. RECURSOS_HUMANOS', '1.3.1. CONTRATOS_FUNCIONARIOS'],
  ['1. ADMINISTRATIVO_E_JURIDICO', '1.3. RECURSOS_HUMANOS', '1.3.2. DOCUMENTOS_PESSOAIS'],
  ['1. ADMINISTRATIVO_E_JURIDICO', '1.3. RECURSOS_HUMANOS', '1.3.3. FOLHA_PAGAMENTO'],
  ['1. ADMINISTRATIVO_E_JURIDICO', '1.4. SST'],
  ['1. ADMINISTRATIVO_E_JURIDICO', '1.4. SST', '1.4.1. ASO_E_EXAMES'],
  ['1. ADMINISTRATIVO_E_JURIDICO', '1.4. SST', '1.4.2. PCMSO_LTCAT_PGR'],
  ['1. ADMINISTRATIVO_E_JURIDICO', '1.4. SST', '1.4.3. EPIS_E_EQUIPAMENTOS'],
  ['1. ADMINISTRATIVO_E_JURIDICO', '1.4. SST', '1.4.4. TREINAMENTOS_SST'],
  ['1. ADMINISTRATIVO_E_JURIDICO', '1.5. TREINAMENTOS_E_CAPACITACAO'],
  ['1. ADMINISTRATIVO_E_JURIDICO', '1.5. TREINAMENTOS_E_CAPACITACAO', '1.5.1. CERTIFICADOS'],
  ['1. ADMINISTRATIVO_E_JURIDICO', '1.5. TREINAMENTOS_E_CAPACITACAO', '1.5.2. MATERIAIS_DIDATICOS'],
  ['1. ADMINISTRATIVO_E_JURIDICO', '1.6. COMPLIANCE_E_LGPD'],
  ['1. ADMINISTRATIVO_E_JURIDICO', '1.6. COMPLIANCE_E_LGPD', '1.6.1. ISO_14001'],
  ['1. ADMINISTRATIVO_E_JURIDICO', '1.6. COMPLIANCE_E_LGPD', '1.6.2. ISO_9001'],
  ['1. ADMINISTRATIVO_E_JURIDICO', '1.6. COMPLIANCE_E_LGPD', '1.6.3. ISO_45001'],
  ['1. ADMINISTRATIVO_E_JURIDICO', '1.6. COMPLIANCE_E_LGPD', '1.6.4. LGPD'],
  ['2. COMERCIAL_E_CLIENTES'],
  ['2. COMERCIAL_E_CLIENTES', '2.1. PROPOSTAS_ENVIADAS'],
  ['2. COMERCIAL_E_CLIENTES', '2.2. PROPOSTAS_APROVADAS'],
  ['2. COMERCIAL_E_CLIENTES', '2.3. LEADS_E_CRM'],
  ['2. COMERCIAL_E_CLIENTES', '2.4. RELACIONAMENTO_E_ATAS'],
  ['2. COMERCIAL_E_CLIENTES', '2.5. FORNECEDORES'],
  ['2. COMERCIAL_E_CLIENTES', '2.5. FORNECEDORES', '2.5.1. CONTRATOS_FORNECEDORES'],
  ['2. COMERCIAL_E_CLIENTES', '2.5. FORNECEDORES', '2.5.2. COTACOES'],
  ['3. PROJETOS'],
  ['4. RECURSOS_E_PATRIMONIO'],
  ['4. RECURSOS_E_PATRIMONIO', '4.1. FROTA'],
  ['4. RECURSOS_E_PATRIMONIO', '4.1. FROTA', '4.1.1. DOCUMENTOS_VEICULOS'],
  ['4. RECURSOS_E_PATRIMONIO', '4.1. FROTA', '4.1.2. MANUTENCOES'],
  ['4. RECURSOS_E_PATRIMONIO', '4.1. FROTA', '4.1.3. SEGUROS'],
  ['4. RECURSOS_E_PATRIMONIO', '4.2. EQUIPAMENTOS'],
  ['4. RECURSOS_E_PATRIMONIO', '4.2. EQUIPAMENTOS', '4.2.1. CERTIFICADOS_CALIBRACAO'],
  ['4. RECURSOS_E_PATRIMONIO', '4.2. EQUIPAMENTOS', '4.2.2. MANUAIS'],
  ['4. RECURSOS_E_PATRIMONIO', '4.2. EQUIPAMENTOS', '4.2.3. NOTAS_FISCAIS'],
  ['5. BASE_TECNICA_E_REFERENCIAS'],
  ['5. BASE_TECNICA_E_REFERENCIAS', '5.1. LEGISLACAO'],
  ['5. BASE_TECNICA_E_REFERENCIAS', '5.2. NORMAS_TECNICAS'],
  ['5. BASE_TECNICA_E_REFERENCIAS', '5.3. ARTIGOS_CIENTIFICOS'],
  ['5. BASE_TECNICA_E_REFERENCIAS', '5.4. MANUAIS_METODOLOGICOS'],
  ['5. BASE_TECNICA_E_REFERENCIAS', '5.5. LINKS_E_REFERENCIAS'],
  ['6. MODELOS_E_PADROES'],
  ['6. MODELOS_E_PADROES', '6.1. TEMPLATES_RELATORIOS'],
  ['6. MODELOS_E_PADROES', '6.2. MODELOS_PLANILHAS'],
  ['6. MODELOS_E_PADROES', '6.3. PADROES_GRAFICOS'],
  ['6. MODELOS_E_PADROES', '6.4. TERMOS_E_FORMULARIOS'],
  ['7. SISTEMAS_E_AUTOMACOES'],
  ['7. SISTEMAS_E_AUTOMACOES', '7.1. WORKFLOWS_N8N'],
  ['7. SISTEMAS_E_AUTOMACOES', '7.2. SCRIPTS_R_PYTHON'],
  ['7. SISTEMAS_E_AUTOMACOES', '7.3. DASHBOARDS'],
  ['7. SISTEMAS_E_AUTOMACOES', '7.4. BACKUPS_SISTEMAS'],
  ['7. SISTEMAS_E_AUTOMACOES', '7.5. ISO_CONFORMIDADE'],
  ['7. SISTEMAS_E_AUTOMACOES', '7.6. NEWSLETTER_E_BLOG'],
  ['8. ARQUIVO_MORTO'],
  ['8. ARQUIVO_MORTO', '8.1. PROJETOS_ENCERRADOS'],
  ['8. ARQUIVO_MORTO', '8.2. CONTRATOS_FINALIZADOS'],
  ['8. ARQUIVO_MORTO', '8.3. COLABORADORES_DESLIGADOS'],
  ['8. ARQUIVO_MORTO', '8.4. DOCUMENTOS_HISTORICOS'],
];

const ESTRUTURA_PROJETO_GD: string[][] = [
  ['1. GESTAO_E_CONTRATOS'],
  ['1. GESTAO_E_CONTRATOS', '1.1. CONTRATO_PRINCIPAL'],
  ['1. GESTAO_E_CONTRATOS', '1.2. ADITIVOS'],
  ['1. GESTAO_E_CONTRATOS', '1.3. AUTORIZACOES'],
  ['2. PLANEJAMENTO_E_CRONOGRAMA'],
  ['2. PLANEJAMENTO_E_CRONOGRAMA', '2.1. CRONOGRAMA'],
  ['2. PLANEJAMENTO_E_CRONOGRAMA', '2.2. PLANOS_DE_TRABALHO'],
  ['2. PLANEJAMENTO_E_CRONOGRAMA', '2.3. ATAS_DE_REUNIAO'],
  ['3. LICENCAS_E_CONDICIONANTES'],
  ['3. LICENCAS_E_CONDICIONANTES', '3.1. LICENCAS_ATIVAS'],
  ['3. LICENCAS_E_CONDICIONANTES', '3.2. CONDICIONANTES'],
  ['3. LICENCAS_E_CONDICIONANTES', '3.3. EVIDENCIAS_E_COMPROVANTES'],
  ['3. LICENCAS_E_CONDICIONANTES', '3.4. PROTOCOLOS'],
  ['4. MONITORAMENTO_E_AMOSTRAS'],
  ['4. MONITORAMENTO_E_AMOSTRAS', '4.1. CAMPO'],
  ['4. MONITORAMENTO_E_AMOSTRAS', '4.1. CAMPO', '4.1.1. FORMULARIOS'],
  ['4. MONITORAMENTO_E_AMOSTRAS', '4.1. CAMPO', '4.1.2. FOTOS'],
  ['4. MONITORAMENTO_E_AMOSTRAS', '4.1. CAMPO', '4.1.3. AMOSTRAS'],
  ['4. MONITORAMENTO_E_AMOSTRAS', '4.2. PROCESSADOS'],
  ['4. MONITORAMENTO_E_AMOSTRAS', '4.2. PROCESSADOS', '4.2.1. PLANILHAS'],
  ['4. MONITORAMENTO_E_AMOSTRAS', '4.2. PROCESSADOS', '4.2.2. BANCO_FINAL'],
  ['4. MONITORAMENTO_E_AMOSTRAS', '4.3. LAUDOS_LABORATORIAIS'],
  ['5. RELATORIOS_E_PARECERES'],
  ['5. RELATORIOS_E_PARECERES', '5.1. MINUTAS'],
  ['5. RELATORIOS_E_PARECERES', '5.2. VERSOES_FINAIS'],
  ['5. RELATORIOS_E_PARECERES', '5.3. PARECERES_TECNICOS'],
  ['6. MAPAS_E_GEOESPACIAL'],
  ['6. MAPAS_E_GEOESPACIAL', '6.1. SHAPEFILES'],
  ['6. MAPAS_E_GEOESPACIAL', '6.2. MAPAS_FINAIS'],
  ['6. MAPAS_E_GEOESPACIAL', '6.3. KMZ_KML'],
  ['7. COMUNICACOES'],
  ['7. COMUNICACOES', '7.1. OFICIOS'],
  ['7. COMUNICACOES', '7.2. EMAILS_RELEVANTES'],
  ['7. COMUNICACOES', '7.3. NOTIFICACOES_ORGAOS'],
  ['8. ENTREGAS_E_FINANCEIRO'],
  ['8. ENTREGAS_E_FINANCEIRO', '8.1. ENVIADOS'],
  ['8. ENTREGAS_E_FINANCEIRO', '8.2. PROTOCOLOS_RECEBIDOS'],
  ['8. ENTREGAS_E_FINANCEIRO', '8.3. RECIBOS'],
  ['8. ENTREGAS_E_FINANCEIRO', '8.4. NOTAS_FISCAIS'],
];

export async function createGoogleDriveInstitutionalStructure(): Promise<{
  success: boolean;
  foldersCreated: number;
  error?: string;
}> {
  try {
    const rootId = await getOrCreateBackupFolder();
    let foldersCreated = 0;

    for (const segments of ESTRUTURA_INSTITUCIONAL_GD) {
      try {
        await createNestedFolders(segments, rootId);
        foldersCreated++;
      } catch (err: any) {
        console.warn(`[GoogleDrive] Falha ao criar pasta ${segments.join('/')}: ${err.message}`);
      }
    }

    console.log(`[GoogleDrive] Estrutura institucional criada: ${foldersCreated} pastas`);
    return { success: true, foldersCreated };
  } catch (error: any) {
    console.error('[GoogleDrive] Erro ao criar estrutura institucional:', error.message);
    return { success: false, foldersCreated: 0, error: error.message };
  }
}

export async function createGoogleDriveEmpreendimentoStructure(
  cliente: string,
  uf: string,
  codigo: string,
  nome: string
): Promise<{ success: boolean; foldersCreated: number; error?: string }> {
  try {
    const rootId = await getOrCreateBackupFolder();
    const projetosId = await getOrCreateFolderInParent('3. PROJETOS', rootId);

    const codigoNorm = normalizarTextoGD(codigo || nome);
    const clienteNorm = normalizarTextoGD(cliente);
    const ufNorm = normalizarTextoGD(uf || 'BR');
    const nomeProjeto = `${codigoNorm}_${clienteNorm}_${ufNorm}`;

    const projetoId = await getOrCreateFolderInParent(nomeProjeto, projetosId);
    let foldersCreated = 1;

    for (const segments of ESTRUTURA_PROJETO_GD) {
      try {
        await createNestedFolders(segments, projetoId);
        foldersCreated++;
      } catch (err: any) {
        console.warn(`[GoogleDrive] Falha ao criar subpasta ${segments.join('/')}: ${err.message}`);
      }
    }

    console.log(`[GoogleDrive] Estrutura do empreendimento ${nomeProjeto}: ${foldersCreated} pastas`);
    return { success: true, foldersCreated };
  } catch (error: any) {
    console.error('[GoogleDrive] Erro ao criar estrutura do empreendimento:', error.message);
    return { success: false, foldersCreated: 0, error: error.message };
  }
}

// ── File sync to Google Drive ────────────────────────────────────────────────

/**
 * Uploads a file buffer to SGAI_Backup folder (or subfolder).
 * Uses resumable upload in 1MB chunks to bypass proxy size limits.
 * Compresses text-based files before upload to reduce storage size.
 */
export async function uploadFileToGoogleDrive(
  fileName: string,
  fileBuffer: Buffer,
  mimeType = 'application/octet-stream',
  parentId?: string
): Promise<{ success: boolean; fileId?: string; error?: string }> {
  try {
    const folderId = parentId || await getOrCreateBackupFolder();

    let uploadBuffer = fileBuffer;
    let uploadMime = mimeType;
    let uploadName = fileName;

    // Compress text-based files to reduce storage size
    if (isCompressible(mimeType) && fileBuffer.length > 100 * 1024) {
      try {
        uploadBuffer = await gzipBuffer(fileBuffer);
        uploadName = fileName + '.gz';
        uploadMime = 'application/gzip';
        console.log(`[GoogleDrive] Comprimido ${fileName}: ${fileBuffer.length} → ${uploadBuffer.length} bytes`);
      } catch { uploadBuffer = fileBuffer; }
    }

    const fileId = await uploadBufferResumable(uploadName, uploadBuffer, uploadMime, folderId);
    return { success: true, fileId };
  } catch (error: any) {
    console.error(`[GoogleDrive] Erro ao enviar arquivo ${fileName}:`, error.message);
    return { success: false, error: error.message };
  }
}

export async function syncAllFilesToGoogleDrive(): Promise<{
  success: boolean;
  total: number;
  synced: number;
  errors: number;
}> {
  let synced = 0;
  let errors = 0;

  const rootId = await getOrCreateBackupFolder();

  const allArquivos = await db.select().from(arquivos).orderBy(sql`${arquivos.criadoEm} ASC`);

  const syncedLogs = await db
    .select()
    .from(dropboxSyncLog)
    .where(eq(dropboxSyncLog.status, 'synced'));
  const syncedNames = new Set(syncedLogs.map(l => l.arquivoNome));

  for (const arquivo of allArquivos) {
    if (syncedNames.has(arquivo.nome)) continue;

    try {
      // Se o arquivo já está no Google Drive, marcar como sincronizado sem re-upload
      if (arquivo.caminho?.startsWith('gdrive://')) {
        const fileId = arquivo.caminho.slice('gdrive://'.length);
        await db.insert(dropboxSyncLog).values({
          arquivoId: arquivo.id,
          arquivoNome: arquivo.nome,
          arquivoOrigem: arquivo.origem || 'arquivo',
          dropboxPath: arquivo.caminho,
          status: 'synced',
          errorMessage: null,
          fileSize: arquivo.tamanho,
          syncedAt: new Date(),
        });
        synced++;
        continue;
      }

      let fileBuffer: Buffer | null = null;

      if (arquivo.caminho) {
        try {
          const fs = await import('fs');
          if (fs.existsSync(arquivo.caminho)) {
            fileBuffer = fs.readFileSync(arquivo.caminho);
          }
        } catch { /* file not on disk */ }
      }

      if (!fileBuffer && arquivo.url) {
        try {
          const { getObjectBuffer } = await import('./objectStorageHelper');
          const key = arquivo.url.replace(/^.*\/public\//, 'public/').replace(/^.*\/\.private\//, '.private/');
          fileBuffer = await getObjectBuffer(key);
        } catch { /* object storage not available */ }
      }

      if (!fileBuffer) {
        await db.insert(dropboxSyncLog).values({
          arquivoId: arquivo.id,
          arquivoNome: arquivo.nome,
          arquivoOrigem: arquivo.origem || 'arquivo',
          status: 'error',
          errorMessage: 'Arquivo não encontrado (disco ou object storage)',
          fileSize: arquivo.tamanho,
          syncedAt: null,
        });
        errors++;
        continue;
      }

      const result = await uploadFileToGoogleDrive(
        arquivo.nome,
        fileBuffer,
        arquivo.mime || 'application/octet-stream',
        rootId
      );

      await db.insert(dropboxSyncLog).values({
        arquivoId: arquivo.id,
        arquivoNome: arquivo.nome,
        arquivoOrigem: arquivo.origem || 'arquivo',
        dropboxPath: result.fileId ? `gdrive://${result.fileId}` : null,
        status: result.success ? 'synced' : 'error',
        errorMessage: result.success ? null : result.error,
        fileSize: arquivo.tamanho,
        syncedAt: result.success ? new Date() : null,
      });

      if (result.success) synced++;
      else errors++;
    } catch (err: any) {
      console.warn(`[GoogleDriveSync] Erro ao processar arquivo ${arquivo.nome}:`, err.message);
      errors++;
    }
  }

  console.log(`[GoogleDriveSync] Concluído: ${synced} sincronizados, ${errors} erros`);
  return { success: true, total: allArquivos.length, synced, errors };
}

// ── Download backup file ──────────────────────────────────────────────────────

export async function downloadFromGoogleDrive(fileId: string): Promise<string | null> {
  try {
    const res = await connectors.proxy('google-drive', `/drive/v3/files/${fileId}?alt=media`, { method: 'GET' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Download falhou (${res.status}): ${text}`);
    }
    return await res.text();
  } catch (error: any) {
    console.error('[GoogleDrive] Erro ao baixar arquivo:', error.message);
    return null;
  }
}

// ── Document upload/download (replaces Object Storage) ───────────────────────

/**
 * Uploads a document buffer to SGAI_Backup folder (unified storage).
 * Uses resumable upload in 1MB chunks to bypass proxy size limits.
 * Returns a "gdrive://<fileId>" URL for storage in DB.
 */
export async function uploadDocumentToGoogleDrive(
  fileName: string,
  fileBuffer: Buffer,
  mimeType = 'application/octet-stream'
): Promise<{ success: boolean; url?: string; fileId?: string; error?: string }> {
  try {
    const folderId = await getOrCreateBackupFolder();

    let uploadBuffer = fileBuffer;
    let uploadMime = mimeType;
    let uploadName = fileName;

    // Compress text-based files to reduce storage size
    if (isCompressible(mimeType) && fileBuffer.length > 100 * 1024) {
      try {
        uploadBuffer = await gzipBuffer(fileBuffer);
        uploadName = fileName + '.gz';
        uploadMime = 'application/gzip';
        console.log(`[GoogleDrive] Comprimido ${fileName}: ${fileBuffer.length} → ${uploadBuffer.length} bytes`);
      } catch { uploadBuffer = fileBuffer; }
    }

    const fileId = await uploadBufferResumable(uploadName, uploadBuffer, uploadMime, folderId);
    console.log(`[GoogleDrive] Documento enviado: ${uploadName} (id=${fileId})`);
    return { success: true, fileId, url: `gdrive://${fileId}` };
  } catch (error: any) {
    console.error(`[GoogleDrive] Erro ao enviar documento ${fileName}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Downloads a document from Google Drive by fileId, returns Buffer.
 */
export async function downloadDocumentFromGoogleDrive(fileId: string): Promise<Buffer | null> {
  try {
    // 1. Get file metadata to check if it's a compressed file
    let isGzip = false;
    try {
      const meta = await driveGet(`/drive/v3/files/${fileId}?fields=name,mimeType`);
      isGzip = (meta.mimeType === 'application/gzip') || String(meta.name || '').endsWith('.gz');
    } catch { /* ignore — proceed with download */ }

    // 2. Download raw content
    const res = await connectors.proxy('google-drive', `/drive/v3/files/${fileId}?alt=media`, { method: 'GET' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Download falhou (${res.status}): ${text}`);
    }
    const rawBuf = Buffer.from(await res.arrayBuffer());

    // 3. Decompress if needed
    if (isGzip) {
      try {
        return await gunzipBuffer(rawBuf);
      } catch {
        return rawBuf; // Not actually gzipped — serve as-is
      }
    }

    return rawBuf;
  } catch (error: any) {
    console.error('[GoogleDrive] Erro ao baixar documento:', error.message);
    return null;
  }
}

// ── Connection test ──────────────────────────────────────────────────────────

export async function testGoogleDriveConnection(): Promise<{
  success: boolean;
  email?: string;
  folderId?: string;
  folderName?: string;
  error?: string;
}> {
  try {
    // Check auth by fetching user info via Drive API
    const about = await driveGet('/drive/v3/about?fields=user');
    const email = about?.user?.emailAddress || 'Desconhecido';

    cachedFolderId = null; // Force re-resolve
    const folderId = await getOrCreateBackupFolder();

    console.log(`[GoogleDrive] Conexão testada. Conta: ${email}. Pasta: ${BACKUP_FOLDER_NAME} (${folderId})`);
    return { success: true, email, folderId, folderName: BACKUP_FOLDER_NAME };
  } catch (error: any) {
    console.error('[GoogleDrive] Erro ao testar conexão:', error.message);
    return { success: false, error: error.message };
  }
}
