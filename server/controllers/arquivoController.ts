import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { db } from "../db";
import { arquivos } from "@shared/schema";
import { sql } from "drizzle-orm";

const ARQUIVOS_SUBDIR = "arquivos";
const OBJ_PREFIX = "object:";

function getPrivateDirName(): string {
  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  const parts = dir.split("/").filter((p) => p.length > 0);
  return parts.length > 1 ? parts.slice(1).join("/") : ".private";
}

function storedPathToKey(caminho: string): string {
  const relativePath = caminho.slice(OBJ_PREFIX.length);
  const privateDirName = getPrivateDirName();
  return `${privateDirName}/${relativePath}`;
}

function isSafePath(filePath: string): boolean {
  const resolvedPath = path.resolve(filePath);
  const workspaceRoot = path.resolve(process.cwd());
  return resolvedPath.startsWith(workspaceRoot);
}




const ALLOWED_MIMETYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "text/plain",
  "application/zip",
  "application/x-rar-compressed",
  "text/xml",
  "application/xml",
];

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Tipo de arquivo não permitido. Formatos aceitos: PDF, Word, Excel, imagens (JPG, PNG), TXT, ZIP, RAR, XML"));
  }
};

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 30 * 1024 * 1024 },
});

async function saveToGoogleDrive(buffer: Buffer, originalName: string, mimeType: string): Promise<string> {
  const { uploadDocumentToGoogleDrive } = await import("../services/googleDriveService");
  const timestamp = Date.now();
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${timestamp}_${safeName}`;
  const result = await uploadDocumentToGoogleDrive(fileName, buffer, mimeType);
  if (!result.success || !result.url) throw new Error(`Falha ao salvar arquivo no Google Drive`);
  console.log(`[Arquivo Upload] Salvo no Google Drive: ${result.fileId}`);
  return result.url;
}

export async function uploadArquivo(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo foi enviado" });
    }

    const userId = (req.session as any).userId;
    const { origem, empreendimentoCliente, empreendimentoUf, empreendimentoCodigo, empreendimentoNome } = req.body;

    const checksum = crypto.createHash("md5").update(req.file.buffer).digest("hex");

    const caminho = await saveToGoogleDrive(req.file.buffer, req.file.originalname, req.file.mimetype);

    const [arquivo] = await db
      .insert(arquivos)
      .values({
        nome: req.file.originalname,
        mime: req.file.mimetype,
        tamanho: req.file.size,
        caminho,
        checksum,
        origem: origem || "contrato",
        uploaderId: userId,
      })
      .returning();

    res.json(arquivo);

    setImmediate(async () => {
      try {
        const { syncFileToDropbox } = await import("../services/dropboxService");
        await syncFileToDropbox({
          fileBuffer: req.file!.buffer,
          originalName: req.file!.originalname,
          mimeType: req.file!.mimetype,
          module: origem || "documento",
          empreendimento: empreendimentoCliente
            ? { cliente: empreendimentoCliente, uf: empreendimentoUf || "BR", codigo: empreendimentoCodigo || "", nome: empreendimentoNome || empreendimentoCodigo || "" }
            : undefined,
        });
      } catch (err: any) {
        console.warn("[Dropbox] Sync em background falhou:", err.message);
      }

      try {
        const { autoIndexDocument } = await import("../services/documentIndexService");
        const unidade = (req as any).user?.unidade || (req.session as any)?.unidade || "geral";
        await autoIndexDocument({
          unidade,
          fileName: req.file!.originalname,
          fileUrl: `/api/arquivos/${arquivo.id}/download`,
          fileBuffer: req.file!.buffer,
          fileType: req.file!.mimetype,
          module: origem || "documento",
          empreendimentoNome: empreendimentoNome || empreendimentoCliente || undefined,
        });
      } catch (err: any) {
        console.warn("[RAG] Auto-index em background falhou:", err.message);
      }
    });
  } catch (error: any) {
    console.error("Erro ao fazer upload:", error);
    res.status(500).json({ message: error.message || "Erro ao fazer upload do arquivo" });
  }
}

export async function downloadArquivo(req: Request, res: Response) {
  try {
    const arquivoId = parseInt(req.params.id);

    const [arquivo] = await db
      .select()
      .from(arquivos)
      .where(sql`${arquivos.id} = ${arquivoId}`);

    if (!arquivo) {
      return res.status(404).json({ message: "Arquivo não encontrado" });
    }

    const ext = path.extname(arquivo.nome).toLowerCase();
    let mimeType = arquivo.mime || "application/octet-stream";
    if (!mimeType || mimeType === "application/octet-stream") {
      if (ext === ".pdf") mimeType = "application/pdf";
      else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
      else if (ext === ".png") mimeType = "image/png";
      else if (ext === ".docx") mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      else if (ext === ".xlsx") mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }
    const inlineTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif", "text/plain"];
    const disposition = inlineTypes.includes(mimeType) ? "inline" : "attachment";

    if (arquivo.caminho.startsWith("gdrive://")) {
      try {
        const { downloadDocumentFromGoogleDrive } = await import("../services/googleDriveService");
        const bytes = await downloadDocumentFromGoogleDrive(arquivo.caminho.slice("gdrive://".length));
        if (!bytes) return res.status(503).json({ message: "Arquivo temporariamente indisponível no Google Drive." });
        res.setHeader("Content-Type", mimeType);
        res.setHeader("Content-Disposition", `${disposition}; filename="${encodeURIComponent(arquivo.nome)}"`);
        res.setHeader("Cache-Control", "private, max-age=3600");
        res.setHeader("Content-Length", bytes.length);
        return res.send(bytes);
      } catch (err: any) {
        console.error(`[Arquivo Download] Erro ao baixar do Google Drive:`, err.message);
        if (!res.headersSent) return res.status(503).json({ message: "Erro ao acessar o Google Drive. Tente novamente." });
      }
      return;
    }

    if (arquivo.caminho.startsWith(OBJ_PREFIX)) {
      const key = storedPathToKey(arquivo.caminho);
      try {
        const { getObjectBuffer } = await import("../services/objectStorageHelper");
        const bytes = await getObjectBuffer(key);
        if (!bytes) return res.status(503).json({ message: "Arquivo temporariamente indisponível, tente novamente." });
        res.setHeader("Content-Type", mimeType);
        res.setHeader("Content-Disposition", `${disposition}; filename="${encodeURIComponent(arquivo.nome)}"`);
        res.setHeader("Cache-Control", "private, max-age=3600");
        res.setHeader("Content-Length", bytes.length);
        return res.send(bytes);
      } catch (err: any) {
        console.error(`[Arquivo Download] Erro ao baixar do Object Storage (key=${key}):`, err.message);
        if (!res.headersSent) return res.status(503).json({ message: "Erro ao acessar o armazenamento. Tente novamente." });
      }
      return;
    }

    const fs = await import("fs");
    if (!isSafePath(arquivo.caminho)) {
      return res.status(403).json({ message: "Acesso não autorizado ao caminho de arquivo especificado." });
    }
    if (!fs.default.existsSync(arquivo.caminho)) {
      return res.status(404).json({
        message: "Arquivo físico não encontrado. O arquivo foi salvo antes da migração para armazenamento permanente. Por favor, faça o upload novamente.",
      });
    }

    res.download(arquivo.caminho, arquivo.nome);
  } catch (error: any) {
    console.error("Erro ao baixar arquivo:", error);
    res.status(500).json({ message: error.message || "Erro ao baixar arquivo" });
  }
}

export async function deleteArquivo(req: Request, res: Response) {
  try {
    const arquivoId = parseInt(req.params.id);

    const [arquivo] = await db
      .select()
      .from(arquivos)
      .where(sql`${arquivos.id} = ${arquivoId}`);

    if (!arquivo) {
      return res.status(404).json({ message: "Arquivo não encontrado" });
    }

    if (arquivo.caminho.startsWith("gdrive://")) {
      // Google Drive files are retained (no delete to avoid connector complexity)
      console.log(`[Arquivo Delete] Registro removido do BD (Google Drive file retido): ${arquivo.caminho}`);
    } else if (arquivo.caminho.startsWith(OBJ_PREFIX)) {
      try {
        const { Client } = await import("@replit/object-storage");
        const client = new Client();
        const key = storedPathToKey(arquivo.caminho);
        await client.delete(key);
      } catch (err: any) {
        console.warn("[Arquivo Delete] Erro ao remover do Object Storage:", err.message);
      }
    } else {
      try {
        const fs = await import("fs");
        if (!isSafePath(arquivo.caminho)) {
          return res.status(403).json({ message: "Acesso não autorizado para remoção do caminho de arquivo especificado." });
        }
        if (fs.default.existsSync(arquivo.caminho)) {
          fs.default.unlinkSync(arquivo.caminho);
        }
      } catch (err: any) {
        console.warn("[Arquivo Delete] Erro ao remover arquivo local:", err.message);
      }
    }

    await db.delete(arquivos).where(sql`${arquivos.id} = ${arquivoId}`);

    res.json({ message: "Arquivo deletado com sucesso" });
  } catch (error: any) {
    console.error("Erro ao deletar arquivo:", error);
    res.status(500).json({ message: error.message || "Erro ao deletar arquivo" });
  }
}
