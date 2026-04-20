/**
 * Serve o site estático + API de login no MySQL.
 * Uso: npm install && copie .env.example para .env && npm start
 * Abra http://localhost:8080/login.html (não use file://).
 */
require("dotenv").config();
const crypto = require("crypto");
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

const googleOAuthEnabled = !!(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CALLBACK_URL
);

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

function safeNextForOAuth(raw) {
  if (raw == null || raw === "") return "";
  try {
    const d = decodeURIComponent(String(raw).trim());
    if (/^[a-z][a-z0-9+.-]*:/i.test(d)) return "";
    if (d.slice(0, 2) === "//") return "";
    if (d.toLowerCase().indexOf("javascript:") === 0) return "";
    const path = d.startsWith("/") ? d : "/" + d;
    if (path.indexOf("..") !== -1) return "";
    return path;
  } catch {
    return "";
  }
}

function frontendBaseUrl() {
  const explicit = String(process.env.FRONTEND_BASE_URL || "")
    .trim()
    .replace(/\/$/, "");
  if (explicit) return explicit;
  if (ALLOWED_ORIGINS.length) return ALLOWED_ORIGINS[0].replace(/\/$/, "");
  return `http://localhost:${PORT}`;
}

async function upsertGoogleUser(googleSub, email, name) {
  const [byG] = await pool.execute("SELECT id, email FROM users WHERE google_sub = ? LIMIT 1", [googleSub]);
  if (byG.length) return { id: byG[0].id, email: byG[0].email };
  const [byE] = await pool.execute("SELECT id, email FROM users WHERE email = ? LIMIT 1", [email]);
  if (byE.length) {
    await pool.execute("UPDATE users SET google_sub = ?, name = COALESCE(?, name) WHERE id = ?", [
      googleSub,
      name,
      byE[0].id,
    ]);
    return { id: byE[0].id, email: byE[0].email };
  }
  const [r] = await pool.execute(
    "INSERT INTO users (email, google_sub, password_hash, name) VALUES (?, ?, NULL, ?)",
    [email, googleSub, name]
  );
  return { id: r.insertId, email };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "politapp-api" });
});

app.get("/api/auth/providers", (_req, res) => {
  res.json({ google: googleOAuthEnabled });
});

app.get("/api/auth/google", (req, res) => {
  if (!googleOAuthEnabled) {
    return res.status(404).json({ error: "Google OAuth não configurado no servidor." });
  }
  const state = crypto.randomBytes(24).toString("hex");
  req.session.googleOAuthState = state;
  const n = safeNextForOAuth(req.query.next);
  req.session.oauthNext = n || "/index.html";
  req.session.save((err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Não foi possível iniciar sessão." });
    }
    const p = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: process.env.GOOGLE_CALLBACK_URL,
      response_type: "code",
      scope: "openid email profile",
      state,
    });
    res.redirect(302, "https://accounts.google.com/o/oauth2/v2/auth?" + p.toString());
  });
});

app.get("/api/auth/google/callback", async (req, res) => {
  const base = frontendBaseUrl();
  if (!googleOAuthEnabled) {
    return res.redirect(302, base + "/login.html?error=google_config");
  }
  const { code, state, error } = req.query;
  if (error === "access_denied") {
    return res.redirect(302, base + "/login.html?error=google_denied");
  }
  if (!code || !state || state !== req.session.googleOAuthState) {
    return res.redirect(302, base + "/login.html?error=google_state");
  }
  const nextPath = req.session.oauthNext || "/index.html";
  req.session.googleOAuthState = null;
  req.session.oauthNext = null;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("google token:", tokens);
      return res.redirect(302, base + "/login.html?error=google_token");
    }
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await userRes.json();
    if (!profile.email || !profile.sub) {
      return res.redirect(302, base + "/login.html?error=google_profile");
    }
    const email = String(profile.email).trim().toLowerCase();
    const name = profile.name ? String(profile.name).slice(0, 120) : null;
    const user = await upsertGoogleUser(String(profile.sub), email, name);
    req.session.userId = user.id;
    req.session.userEmail = user.email;
  } catch (e) {
    console.error(e);
    return res.redirect(302, base + "/login.html?error=google_server");
  }
  req.session.save((err) => {
    if (err) console.error(err);
    res.redirect(302, base + nextPath);
  });
});

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
    if (!rows[0].password_hash) {
      return res.status(401).json({ error: "Esta conta usa login com Google." });
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

const PORTAL_TRANSPARENCIA_API = "https://api.portaldatransparencia.gov.br/api-de-dados";

/**
 * Proxy para a API de dados do Portal da Transparência (evita bloqueio CORS no navegador).
 * A chave gratuita deve ser enviada no cabeçalho chave-api-dados (igual à API oficial).
 * Documentação: https://portaldatransparencia.gov.br/api-de-dados
 */
app.get("/api/portaldatransparencia/emendas", async (req, res) => {
  const chave = req.get("chave-api-dados");
  if (!chave || !String(chave).trim()) {
    return res.status(400).json({
      erro: "Informe o cabeçalho chave-api-dados com o token obtido em portaldatransparencia.gov.br/api-de-dados/cadastrar-email",
    });
  }
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (v === undefined || v === null || v === "") continue;
    q.set(k, String(v));
  }
  const url = `${PORTAL_TRANSPARENCIA_API}/emendas?${q.toString()}`;
  try {
    const r = await fetch(url, {
      headers: {
        Accept: "application/json",
        "chave-api-dados": String(chave).trim(),
      },
    });
    const text = await r.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { erro: "Resposta não JSON do Portal", corpo: text.slice(0, 500) };
    }
    return res.status(r.status).json(body);
  } catch (e) {
    console.error("portaldatransparencia proxy:", e);
    return res.status(502).json({ erro: "Falha ao contatar api.portaldatransparencia.gov.br" });
  }
});

app.get("/api/portaldatransparencia/emendas/:codigo", async (req, res) => {
  const chave = req.get("chave-api-dados");
  if (!chave || !String(chave).trim()) {
    return res.status(400).json({
      erro: "Informe o cabeçalho chave-api-dados com o token da API do Portal.",
    });
  }
  const codigo = encodeURIComponent(req.params.codigo);
  const url = `${PORTAL_TRANSPARENCIA_API}/emendas/${codigo}`;
  try {
    const r = await fetch(url, {
      headers: {
        Accept: "application/json",
        "chave-api-dados": String(chave).trim(),
      },
    });
    const text = await r.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { erro: "Resposta não JSON do Portal", corpo: text.slice(0, 500) };
    }
    return res.status(r.status).json(body);
  } catch (e) {
    console.error("portaldatransparencia proxy detalhe:", e);
    return res.status(502).json({ erro: "Falha ao contatar api.portaldatransparencia.gov.br" });
  }
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Politapp em http://localhost:${PORT}`);
  console.log(`MySQL: ${process.env.DB_HOST || "172.31.30.133"} (configure .env)`);
  console.log(`CORS: ${ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS.join(", ") : "(dev: qualquer origem)"}`);
  console.log(`Sessão cross-site: ${SESSION_CROSS_SITE ? "sim (GitHub Pages + HTTPS)" : "não"}`);
  console.log(`Cadastro via API: ${ALLOW_REGISTER ? "ligado" : "desligado"} (ALLOW_REGISTER)`);
  console.log(`Google OAuth: ${googleOAuthEnabled ? "ligado" : "desligado"}`);
});
