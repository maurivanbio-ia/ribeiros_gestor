import cron from 'node-cron';
import { db } from '../db';
import { 
  users, empreendimentos, licencasAmbientais, condicionantes, demandas, 
  contratos, financeiroLancamentos, rhRegistros, veiculos, equipamentos,
  projetos, campanhas, propostasComerciais, amostras, fornecedores,
  treinamentos, baseConhecimento, tarefas, datasetPastas, datasets
} from '@shared/schema';
import {
  uploadToGoogleDrive,
  listGoogleDriveBackups,
  deleteOldGoogleDriveBackups,
  downloadFromGoogleDrive,
} from './googleDriveService';
import { uploadBytesWithRetry, getObjectBuffer } from './objectStorageHelper';
import { format } from 'date-fns';

interface BackupResult {
  success: boolean;
  timestamp: string;
  tables: { [key: string]: number };
  filePath?: string;
  driveFileId?: string;
  error?: string;
}

interface ObjectInfo {
  key: string;
  driveFileId?: string;
  lastModified: Date | null;
  size: number;
}

async function exportTableData(tableName: string, table: any): Promise<any[]> {
  try {
    const data = await db.select().from(table);
    return data;
  } catch (error) {
    console.error(`[Backup] Erro ao exportar tabela ${tableName}:`, error);
    return [];
  }
}

const BACKUP_PREFIX = '.private/backups';

function getBackupKey(timestamp: string): string {
  return `${BACKUP_PREFIX}/backup_${timestamp}.json`;
}

export async function performBackup(): Promise<BackupResult> {
  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
  console.log(`[Backup] Iniciando backup do sistema - ${timestamp}`);

  try {
    const tables: { [key: string]: number } = {};
    const backupData: { [key: string]: any[] } = {};

    const tablesToBackup = [
      { name: 'users', table: users },
      { name: 'empreendimentos', table: empreendimentos },
      { name: 'licencasAmbientais', table: licencasAmbientais },
      { name: 'condicionantes', table: condicionantes },
      { name: 'demandas', table: demandas },
      { name: 'contratos', table: contratos },
      { name: 'financeiroLancamentos', table: financeiroLancamentos },
      { name: 'rhRegistros', table: rhRegistros },
      { name: 'veiculos', table: veiculos },
      { name: 'equipamentos', table: equipamentos },
      { name: 'projetos', table: projetos },
      { name: 'campanhas', table: campanhas },
      { name: 'propostasComerciais', table: propostasComerciais },
      { name: 'amostras', table: amostras },
      { name: 'fornecedores', table: fornecedores },
      { name: 'treinamentos', table: treinamentos },
      { name: 'baseConhecimento', table: baseConhecimento },
      { name: 'tarefas', table: tarefas },
      { name: 'datasetPastas', table: datasetPastas },
      { name: 'datasets', table: datasets },
    ];

    for (const { name, table } of tablesToBackup) {
      const data = await exportTableData(name, table);
      backupData[name] = data;
      tables[name] = data.length;
      console.log(`[Backup] ${name}: ${data.length} registros`);
    }

    const backupJson = JSON.stringify({
      timestamp,
      generatedAt: new Date().toISOString(),
      version: '1.0',
      tables: backupData,
    }, null, 2);

    const fileName = `backup_${timestamp}.json`;
    let driveFileId: string | undefined;
    let savedOk = false;

    // ── Destino primário: Google Drive ───────────────────────────────────────
    try {
      const driveResult = await uploadToGoogleDrive(fileName, backupJson);
      if (driveResult.success && driveResult.fileId) {
        driveFileId = driveResult.fileId;
        savedOk = true;
        console.log(`[Backup] Salvo no Google Drive: ${fileName} (id=${driveFileId})`);
        // Limpar backups antigos (>30 dias) no Drive
        await deleteOldGoogleDriveBackups(30).catch(e =>
          console.warn('[Backup] Limpeza Google Drive ignorada:', e.message)
        );
      } else {
        console.warn('[Backup] Google Drive não disponível:', driveResult.error);
      }
    } catch (driveError: any) {
      console.warn('[Backup] Google Drive falhou:', driveError.message);
    }

    // ── Destino secundário: Object Storage (opcional, não bloqueia) ──────────
    try {
      const key = getBackupKey(timestamp);
      const buf = Buffer.from(backupJson, 'utf-8');
      const uploadOk = await uploadBytesWithRetry(key, buf, { contentType: 'application/json' });
      if (uploadOk) {
        console.log(`[Backup] Cópia salva no Object Storage: ${key}`);
        savedOk = true;
      } else {
        console.warn('[Backup] Object Storage indisponível — ignorado (backup já salvo no Drive)');
      }
    } catch (storageError: any) {
      console.warn('[Backup] Object Storage falhou (não crítico):', storageError.message);
    }

    if (!savedOk) {
      throw new Error('Falha ao salvar backup: Google Drive e Object Storage indisponíveis');
    }

    return {
      success: true,
      timestamp,
      tables,
      filePath: `backups/${fileName}`,
      driveFileId,
    };
  } catch (error) {
    console.error('[Backup] Erro durante backup:', error);
    return {
      success: false,
      timestamp,
      tables: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function listBackups(): Promise<ObjectInfo[]> {
  const results: ObjectInfo[] = [];

  // Listar do Google Drive (fonte primária)
  try {
    const driveList = await listGoogleDriveBackups();
    if (driveList.success && driveList.files && driveList.files.length > 0) {
      for (const f of driveList.files) {
        results.push({
          key: f.name,
          driveFileId: f.id,
          lastModified: f.modifiedTime ? new Date(f.modifiedTime) : null,
          size: f.size || 0,
        });
      }
      console.log(`[Backup] ${results.length} backups listados do Google Drive`);
      return results;
    }
  } catch (e: any) {
    console.warn('[Backup] Listagem Google Drive falhou, tentando Object Storage:', e.message);
  }

  // Fallback: Object Storage
  try {
    const { Client } = await import('@replit/object-storage');
    const client = new Client();
    const listResult = await client.list({ prefix: `${BACKUP_PREFIX}/` });
    if (listResult.ok) {
      return (listResult.value || [])
        .filter((f: any) => f.name.endsWith('.json'))
        .map((f: any) => ({
          key: f.name.split('/').pop()!,
          lastModified: null,
          size: 0,
        }))
        .sort((a: ObjectInfo, b: ObjectInfo) => b.key.localeCompare(a.key));
    }
  } catch (e: any) {
    console.warn('[Backup] Object Storage também indisponível para listagem:', e.message);
  }

  return results;
}

export async function downloadBackup(fileName: string): Promise<string | null> {
  // Tentar Google Drive primeiro (por driveFileId ou buscando pelo nome)
  try {
    const driveList = await listGoogleDriveBackups();
    if (driveList.success && driveList.files) {
      const match = driveList.files.find(f => f.name === fileName || f.id === fileName);
      if (match) {
        const content = await downloadFromGoogleDrive(match.id);
        if (content) return content;
      }
    }
  } catch (e: any) {
    console.warn('[Backup] Download Google Drive falhou:', e.message);
  }

  // Fallback: Object Storage
  try {
    const key = fileName.startsWith(`${BACKUP_PREFIX}/`) ? fileName : `${BACKUP_PREFIX}/${fileName}`;
    const buf = await getObjectBuffer(key);
    if (buf) return buf.toString('utf-8');
  } catch (e: any) {
    console.warn('[Backup] Download Object Storage falhou:', e.message);
  }

  return null;
}

export function initBackupService() {
  console.log('[Backup] Inicializando serviço de backup automático...');

  cron.schedule('0 0 * * *', async () => {
    console.log('[Backup] Executando backup automático diário (00:00)...');
    const result = await performBackup();
    if (result.success) {
      console.log(`[Backup] Backup diário concluído: ${result.filePath} | Drive: ${result.driveFileId || 'n/a'}`);
    } else {
      console.error(`[Backup] Falha no backup diário: ${result.error}`);
    }
  }, { timezone: 'America/Sao_Paulo' });

  cron.schedule('0 2 * * 0', async () => {
    console.log('[Backup] Executando sincronização semanal de arquivos com Google Drive (domingo 02:00)...');
    try {
      const { syncAllFilesToGoogleDrive } = await import('./googleDriveService');
      const result = await syncAllFilesToGoogleDrive();
      if (result.success) {
        console.log(`[Backup] Object Storage → Google Drive: ${result.synced} arquivos enviados`);
      }
    } catch (err) {
      console.warn('[Backup] Sincronização com Google Drive ignorada:', err);
    }
  }, { timezone: 'America/Sao_Paulo' });

  console.log('[Backup] Backup automático agendado para 00:00 (horário de Brasília)');
  console.log('[Backup] Sincronização de arquivos com Google Drive agendada para domingos às 02:00 (horário de Brasília)');
}
