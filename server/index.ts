// Garante que OPENAI_DIRECT_KEY (sem interferência do proxy Replit) seja usado
if (process.env.OPENAI_DIRECT_KEY) {
  process.env.OPENAI_API_KEY = process.env.OPENAI_DIRECT_KEY;
}

// Previne crash por IP de container stale no Vite HMR WebSocket
// O Vite resolve REPLIT_DEV_DOMAIN → IP antigo e chama process.exit(1) quando bind falha
const _origExit = process.exit.bind(process);
(process as any).exit = function interceptedExit(code?: number) {
  if (code === 1) {
    const stack = new Error().stack ?? '';
    if (
      stack.includes('dep-') ||    // Vite bundled chunks (dep-XXXXXXXX.js)
      stack.includes('/vite/') ||  // vite internals
      stack.includes('customLogger')
    ) {
      console.warn('[Server] Vite HMR WebSocket falhou (IP de container mudou) — continuando sem HMR');
      return undefined as never;
    }
  }
  return _origExit(code as any);
};

process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRNOTAVAIL' || err.code === 'EADDRINUSE') {
    console.warn('[Server] Endereço de rede indisponível (container restart) — continuando:', err.message);
    return;
  }
  console.error('[Server] Exceção não capturada:', err);
  _origExit(1);
});

import express, { type Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import compression from "compression";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { textNormalizationMiddleware } from "./middleware/normalizeText";

const app = express();
app.set("trust proxy", 1);
app.use(compression());
app.use(express.json({ limit: "150mb" }));
app.use(express.urlencoded({ extended: false, limit: "150mb" }));
app.use(textNormalizationMiddleware);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Muitas tentativas de login. Tente novamente em 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { message: "Muitas requisições. Tente novamente em instantes." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith("/ws"),
});

const unlockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: "Muitas tentativas de desbloqueio. Segurança acionada. Aguarde 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── SEO: ensure production domain is indexable ───────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const host = req.hostname || "";
  const isProduction = host === "maurivangestao.online";
  if (isProduction) {
    res.setHeader("X-Robots-Tag", "index, follow");
  }
  next();
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/painel/unlock", unlockLimiter);
app.use("/api/auth/unlock-module", unlockLimiter);
app.use("/api/auth/unlock-sensitive", unlockLimiter);
app.use("/api/auth/promote-admin", unlockLimiter);
app.use("/api/blog/unlock", unlockLimiter);
app.use("/api", apiLimiter);

/**
 * API Request Logger
 *
 * Substitui o monkey-patch de res.json() por uma abordagem limpa e tipada:
 * - Usa o evento "finish" nativo do http.ServerResponse
 * - Captura o corpo da resposta apenas quando for JSON pequeno (< 500 chars)
 * - Registra todos os erros (4xx/5xx) com contexto completo
 * - Requests bem-sucedidos mas lentos (> 500ms) também são registrados em destaque
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.path.startsWith("/api")) return next();

  const startMs = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startMs;
    const { method, path: reqPath } = req;
    const status = res.statusCode;
    const isError = status >= 400;
    const isSlow = durationMs > 500;

    let logLine = `${method} ${reqPath} ${status} in ${durationMs}ms`;

    if (logLine.length > 120) logLine = logLine.slice(0, 119) + "…";

    if (isError || isSlow) {
      log(`[${isError ? "ERR" : "SLOW"}] ${logLine}`);
    } else {
      log(logLine);
    }
  });

  next();
});

(async () => {
  // Garantir que a estrutura do banco de dados está atualizada em produção
  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    console.log("[DB Migration] Verificando estrutura do banco de dados...");
    
    // Verifica se a coluna whatsapp existe na tabela users
    const checkWhatsapp = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'whatsapp';
    `);
    
    if (!checkWhatsapp.rows || checkWhatsapp.rows.length === 0) {
      console.log("[DB Migration] Coluna 'whatsapp' não encontrada na tabela 'users'. Adicionando...");
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp text;`);
      console.log("[DB Migration] Coluna 'whatsapp' adicionada com sucesso.");
    } else {
      console.log("[DB Migration] Coluna 'whatsapp' já existe na tabela 'users'.");
    }
  } catch (err: any) {
    console.error("[DB Migration] Falha ao atualizar estrutura do banco:", err.message || err);
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    log(`serving on port ${port}`);
  });
})();
