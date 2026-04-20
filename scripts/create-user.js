/**
 * Uso: node scripts/create-user.js email@exemplo.com "SenhaForte123" [Nome]
 * Requer .env com DB_* configurado.
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

async function main() {
  const [email, password, name] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Uso: node scripts/create-user.js email@exemplo.com "Senha" [Nome]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Senha deve ter pelo menos 8 caracteres.");
    process.exit(1);
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "politapp_auth",
  });

  const hash = await bcrypt.hash(password, 12);
  try {
    await pool.execute(
      "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
      [email.trim().toLowerCase(), hash, name || null]
    );
    console.log("Usuário criado:", email);
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") console.error("E-mail já cadastrado.");
    else console.error(e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
