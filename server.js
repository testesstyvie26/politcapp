/**
 * Serve o site estático + API de login no MySQL.
 * Uso: npm install && copie .env.example para .env && npm start
 * Abra http://localhost:8080/login.html (não use file://).
 */
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

const PORT = Number(process.env.PORT || 8080);
const ALLOW_REGISTER = String(process.env.ALLOW_REGISTER || "false").toLowerCase() === "true";

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const SESSION_CROSS_SITE = String(process.env.SESSION_CROSS_SITE || "false").toLowerCase() === "true";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "172.31.30.133",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "politapp_auth",
  waitForConnections: true,
  connectionLimit: 10,
});

const app = express();

if (process.env.TRUST_PROXY === "1" || process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.length && ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      if (!ALLOWED_ORIGINS.length && process.env.NODE_ENV !== "production") return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);

app.use(express.json());

const cookieSecure = SESSION_CROSS_SITE || process.env.COOKIE_SECURE === "true";
app.use(
  session({
    name: "politapp.sid",
    secret: process.env.SESSION_SECRET || "defina-SESSION_SECRET-no-env",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: SESSION_CROSS_SITE ? "none" : "lax",
      secure: cookieSecure,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

app.post("/api/register", async (req, res) => {
  if (!ALLOW_REGISTER) {
    return res.status(403).json({ error: "Cadastro desativado." });
  }
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";
  const name = (req.body.name || "").trim() || null;
  if (!isValidEmail(email) || password.length < 8) {
    return res.status(400).json({ error: "E-mail inválido ou senha curta (mín. 8 caracteres)." });
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const [r] = await pool.execute(
      "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
      [email, hash, name]
    );
    req.session.userId = r.insertId;
    req.session.userEmail = email;
    return res.json({ ok: true, user: { id: r.insertId, email } });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "E-mail já cadastrado." });
    console.error(e);
    return res.status(500).json({ error: dbErrorMessage(e) });
  }
});

app.post("/api/login", async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";
  if (!isValidEmail(email) || !password) {
    return res.status(400).json({ error: "Informe e-mail e senha." });
  }
  try {
    const [rows] = await pool.execute(
      "SELECT id, email, password_hash FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    if (!rows.length) {
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }
    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: "E-mail ou senha incorretos." });
    req.session.userId = rows[0].id;
    req.session.userEmail = rows[0].email;
    return res.json({ ok: true, user: { id: rows[0].id, email: rows[0].email } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: dbErrorMessage(e) });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("politapp.sid");
    res.json({ ok: true });
  });
});

app.get("/api/me", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ user: null });
  try {
    const [rows] = await pool.execute(
      "SELECT id, email, name, created_at FROM users WHERE id = ? LIMIT 1",
      [req.session.userId]
    );
    if (!rows.length) {
      req.session.destroy();
      return res.status(401).json({ user: null });
    }
    return res.json({
      user: {
        id: rows[0].id,
        email: rows[0].email,
        name: rows[0].name,
        created_at: rows[0].created_at,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: dbErrorMessage(e) });
  }
});

function dbErrorMessage(e) {
  if (e.code === "ECONNREFUSED" || e.code === "ETIMEDOUT") {
    return "Não foi possível conectar ao MySQL. Verifique DB_HOST, firewall e se o servidor Node está na mesma rede que 172.31.30.133.";
  }
  if (e.code === "ER_ACCESS_DENIED_ERROR") return "Acesso negado ao MySQL (usuário/senha).";
  if (e.code === "ER_BAD_DB_ERROR") return "Banco de dados não existe. Rode sql/auth-schema.sql.";
  return "Erro no servidor. Tente novamente.";
}

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Politapp em http://localhost:${PORT}`);
  console.log(`MySQL: ${process.env.DB_HOST || "172.31.30.133"} (configure .env)`);
  console.log(`CORS: ${ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS.join(", ") : "(dev: qualquer origem)"}`);
  console.log(`Sessão cross-site: ${SESSION_CROSS_SITE ? "sim (GitHub Pages + HTTPS)" : "não"}`);
  console.log(`Cadastro via API: ${ALLOW_REGISTER ? "ligado" : "desligado"} (ALLOW_REGISTER)`);
});
