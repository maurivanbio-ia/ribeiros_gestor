/**
 * Script de emergência: cria ou atualiza o usuário admin no banco Neon.
 * Uso: DATABASE_URL="postgres://..." node server/scripts/reset-admin-password.mjs
 *
 * Variáveis de ambiente necessárias:
 *   DATABASE_URL  — connection string do Neon PostgreSQL
 *   ADMIN_EMAIL   — e-mail do usuário (padrão: maurivan.bio@gmail.com)
 *   ADMIN_PASSWORD — nova senha (obrigatório por segurança)
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);

const bcrypt = require("bcrypt");
const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;
const EMAIL = process.env.ADMIN_EMAIL || "maurivan.bio@gmail.com";
const NEW_PASSWORD = process.env.ADMIN_PASSWORD;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL não definida.");
  process.exit(1);
}
if (!NEW_PASSWORD) {
  console.error("❌ ADMIN_PASSWORD não definida. Execute:");
  console.error('   DATABASE_URL="..." ADMIN_PASSWORD="nova_senha" node server/scripts/reset-admin-password.mjs');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    // Verifica se o usuário existe
    const existing = await client.query("SELECT id, email, role FROM users WHERE email = $1", [EMAIL]);

    const passwordHash = await bcrypt.hash(NEW_PASSWORD, 10);

    if (existing.rows.length > 0) {
      // Atualiza senha e garante role admin
      await client.query(
        "UPDATE users SET password_hash = $1, role = 'admin' WHERE email = $2",
        [passwordHash, EMAIL]
      );
      console.log(`✅ Senha atualizada para: ${EMAIL}`);
      console.log(`   role: admin`);
    } else {
      // Cria usuário novo
      await client.query(
        `INSERT INTO users (email, password_hash, role, unidade, cargo)
         VALUES ($1, $2, 'admin', 'salvador', 'diretor')`,
        [EMAIL, passwordHash]
      );
      console.log(`✅ Usuário criado: ${EMAIL}`);
      console.log(`   role: admin | unidade: salvador | cargo: diretor`);
    }

    // Confirma
    const check = await client.query("SELECT id, email, role, unidade, cargo FROM users WHERE email = $1", [EMAIL]);
    console.log("📋 Usuário no banco:", check.rows[0]);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Erro:", err.message);
  process.exit(1);
});
