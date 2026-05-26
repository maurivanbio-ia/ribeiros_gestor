/**
 * Modelos e Layouts Routes — modelos de relatórios, ofícios, atas, etc.
 */
import type { Express } from 'express';
import { db } from '../db';
import { eq, desc, and, ilike, or } from 'drizzle-orm';
import { modelosLayouts, insertModeloLayoutSchema } from '@shared/schema';
import type { MiddlewareFn } from '../middleware/types';
import { upload } from '../controllers/arquivoController';

interface Context {
  requireAuth: MiddlewareFn;
}

export function registerModelosLayoutsRoutes(app: Express, { requireAuth }: Context) {

  // ── Listar modelos ────────────────────────────────────────────────────────
  app.get('/api/modelos-layouts', requireAuth, async (req, res) => {
    try {
      const unidade = (req.user as any)?.unidade || 'geral';
      const { tipo, q, ativo } = req.query as Record<string, string>;

      let query = db.select().from(modelosLayouts)
        .where(
          and(
            eq(modelosLayouts.unidade, unidade),
            ativo === 'false' ? eq(modelosLayouts.ativo, false) : eq(modelosLayouts.ativo, true),
            tipo && tipo !== 'todos' ? eq(modelosLayouts.tipo, tipo) : undefined,
            q ? or(
              ilike(modelosLayouts.titulo, `%${q}%`),
              ilike(modelosLayouts.tags, `%${q}%`),
              ilike(modelosLayouts.descricao, `%${q}%`),
            ) : undefined,
          )
        )
        .orderBy(desc(modelosLayouts.criadoEm));

      const rows = await query;
      res.json(rows);
    } catch (error) {
      console.error('Erro ao listar modelos:', error);
      res.status(500).json({ message: 'Erro ao listar modelos' });
    }
  });

  // ── Criar modelo (com ou sem arquivo) ────────────────────────────────────
  app.post('/api/modelos-layouts', requireAuth, upload.single('arquivo'), async (req, res) => {
    try {
      const unidade = (req.user as any)?.unidade || 'geral';
      const criadoPor = (req.user as any)?.email || (req.user as any)?.nome || '';

      let arquivoPath: string | null = null;
      let arquivoNome: string | null = null;
      let arquivoMime: string | null = null;
      let arquivoTamanho: number | null = null;

      if (req.file) {
        const { ObjectStorageService, objectStorageClient } = await import('../replit_integrations/object_storage/objectStorage');
        const svc = new ObjectStorageService();
        const privateDir = svc.getPrivateObjectDir();
        const ts = Date.now();
        const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileName = `${ts}_${safeName}`;
        const fullPath = `${privateDir}/modelos/${fileName}`;
        const parts = fullPath.split('/').filter(p => p.length > 0);
        await objectStorageClient.bucket(parts[0]).file(parts.slice(1).join('/')).save(req.file.buffer, {
          contentType: req.file.mimetype,
          metadata: { originalName: safeName, uploadedAt: new Date().toISOString() },
        });
        arquivoPath = `object:modelos/${fileName}`;
        arquivoNome = req.file.originalname;
        arquivoMime = req.file.mimetype;
        arquivoTamanho = req.file.size;
      }

      const empId = req.body.empreendimentoId ? parseInt(req.body.empreendimentoId) : null;
      const coresRaw = req.body.coresRgb; // JSON string or undefined
      let coresRgb: string | null = null;
      if (coresRaw) {
        try {
          const arr = JSON.parse(coresRaw);
          coresRgb = JSON.stringify(arr.filter((c: string) => c && c.trim()));
        } catch { coresRgb = null; }
      }

      const payload = insertModeloLayoutSchema.parse({
        titulo: req.body.titulo,
        tipo: req.body.tipo || 'relatorio',
        descricao: req.body.descricao || null,
        tags: req.body.tags || null,
        versao: req.body.versao || '1.0',
        empreendimentoId: empId,
        coresRgb,
        unidade,
        ativo: true,
        criadoPor,
        arquivoPath,
        arquivoNome,
        arquivoMime,
        arquivoTamanho,
      });

      const [created] = await db.insert(modelosLayouts).values(payload).returning();
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Erro ao criar modelo:', error);
      res.status(500).json({ message: error.message || 'Erro ao criar modelo' });
    }
  });

  // ── Atualizar metadados (sem arquivo) ─────────────────────────────────────
  app.patch('/api/modelos-layouts/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const unidade = (req.user as any)?.unidade || 'geral';
      const { titulo, tipo, descricao, tags, versao, ativo, empreendimentoId, coresRgb: coresRaw2 } = req.body;

      let coresRgb2: string | null | undefined = undefined;
      if (coresRaw2 !== undefined) {
        try {
          const arr = JSON.parse(coresRaw2);
          coresRgb2 = JSON.stringify(arr.filter((c: string) => c && c.trim()));
        } catch { coresRgb2 = null; }
      }

      const [updated] = await db.update(modelosLayouts)
        .set({
          ...(titulo !== undefined && { titulo }),
          ...(tipo !== undefined && { tipo }),
          ...(descricao !== undefined && { descricao }),
          ...(tags !== undefined && { tags }),
          ...(versao !== undefined && { versao }),
          ...(ativo !== undefined && { ativo }),
          ...(empreendimentoId !== undefined && { empreendimentoId: empreendimentoId ? parseInt(empreendimentoId) : null }),
          ...(coresRgb2 !== undefined && { coresRgb: coresRgb2 }),
          atualizadoEm: new Date(),
        })
        .where(and(eq(modelosLayouts.id, id), eq(modelosLayouts.unidade, unidade)))
        .returning();

      if (!updated) return res.status(404).json({ message: 'Modelo não encontrado' });
      res.json(updated);
    } catch (error: any) {
      console.error('Erro ao atualizar modelo:', error);
      res.status(500).json({ message: error.message || 'Erro ao atualizar modelo' });
    }
  });

  // ── Download do arquivo ───────────────────────────────────────────────────
  app.get('/api/modelos-layouts/:id/download', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [modelo] = await db.select().from(modelosLayouts).where(eq(modelosLayouts.id, id)).limit(1);
      if (!modelo || !modelo.arquivoPath) {
        return res.status(404).json({ message: 'Arquivo não encontrado' });
      }

      if (modelo.arquivoPath.startsWith('object:')) {
        const relativePath = modelo.arquivoPath.slice('object:'.length);
        const { ObjectStorageService, objectStorageClient } = await import('../replit_integrations/object_storage/objectStorage');
        const svc = new ObjectStorageService();
        const privateDir = svc.getPrivateObjectDir();
        const key = `${privateDir}/${relativePath}`;
        const parts = key.split('/').filter(p => p.length > 0);
        const fileRef = objectStorageClient.bucket(parts[0]).file(parts.slice(1).join('/'));
        const [exists] = await fileRef.exists();
        if (!exists) return res.status(404).json({ message: 'Arquivo não encontrado no storage' });
        const [buffer] = await fileRef.download();
        res.set({
          'Content-Type': modelo.arquivoMime || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(modelo.arquivoNome || 'modelo')}"`,
          'Content-Length': buffer.length,
        });
        return res.send(buffer);
      }

      res.status(404).json({ message: 'Caminho de arquivo inválido' });
    } catch (error: any) {
      console.error('Erro ao baixar modelo:', error);
      res.status(500).json({ message: error.message || 'Erro ao baixar arquivo' });
    }
  });

  // ── Deletar modelo ────────────────────────────────────────────────────────
  app.delete('/api/modelos-layouts/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const unidade = (req.user as any)?.unidade || 'geral';
      const [deleted] = await db.delete(modelosLayouts)
        .where(and(eq(modelosLayouts.id, id), eq(modelosLayouts.unidade, unidade)))
        .returning();
      if (!deleted) return res.status(404).json({ message: 'Modelo não encontrado' });
      res.json({ ok: true });
    } catch (error: any) {
      console.error('Erro ao deletar modelo:', error);
      res.status(500).json({ message: error.message || 'Erro ao deletar modelo' });
    }
  });
}
