/**
 * Cliente do auth próprio (PHP/Locaweb). Cross-origin friendly:
 * usa credentials:'include' para o cookie de sessão viajar entre front e PHP.
 * A base do backend vem de window.POLITAPP_AUTH_BASE (vazio = mesmo domínio).
 */
function base() {
  return (window.POLITAPP_AUTH_BASE || "").replace(/\/$/, "");
}
function url(rel) {
  return base() + "/" + rel.replace(/^\//, "");
}

async function api(rel, { method = "GET", body = null } = {}) {
  const opts = { method, credentials: "include", headers: {} };
  if (body != null) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  let res, data;
  try {
    res = await fetch(url(rel), opts);
  } catch (e) {
    return { ok: false, erro: "rede indisponível (verifique a URL do backend / CORS)" };
  }
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok && data.ok === undefined) data.ok = false;
  return data;
}

/* ── E-mail + senha ─────────────────────────────────────────────────────── */
export function lwRegister(email, senha, nome) {
  return api("auth/register.php", { method: "POST", body: { email, senha, nome } });
}
export function lwLogin(email, senha) {
  return api("auth/login.php", { method: "POST", body: { email, senha } });
}

/* ── Telefone (OTP) ─────────────────────────────────────────────────────── */
export function lwPhoneRequest(telefone) {
  return api("auth/phone-request.php", { method: "POST", body: { telefone } });
}
export function lwPhoneVerify(telefone, codigo) {
  return api("auth/phone-verify.php", { method: "POST", body: { telefone, codigo } });
}

/* ── Google (redirect) ──────────────────────────────────────────────────── */
export function lwGoogleStartUrl() {
  return url("auth/google-start.php");
}

/* ── Sessão ─────────────────────────────────────────────────────────────── */
export function lwMe() {
  return api("auth/me.php");
}
export function lwLogout() {
  return api("auth/logout.php", { method: "POST" });
}
