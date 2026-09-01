/**
 * Cliente de autenticação Politapp - Cloudflare Workers (sem dependência Locaweb PHP)
 * 
 * URLs:
 *   - /api/google-start       ← Cloudflare Workers JS (OAuth initiation)
 *   - /api/google-callback    ← Cloudflare Workers JS (OAuth callback)
 * 
 * Fluxo OAuth Google:
 *   1. Frontend chama /api/google-start?return=...
 *   2. Cloudflare Worker redireciona para accounts.google.com
 *   3. Usuario faz login Google
 *   4. Google redireciona para /api/google-callback?code=...
 *   5. Worker valida e retorna user data via cookie ou hash fragment
 */

const TOKEN_KEY = "politapp_token";

// ============================================================
// Google OAuth - Cloudflare Workers endpoints
// ============================================================

export function googleStartUrl(returnUrl) {
  const ret = returnUrl || (location.origin + location.pathname);
  // Usa o novo endpoint do Cloudflare Workers (RELATIVO, sem domínio externo)
  return "/api/google-start" + "?return=" + encodeURIComponent(ret);
}

// Captura token do Google que vem no fragmento (#user=...) e guarda
export function captureTokenFromHash() {
  const m = location.hash.match(/[#&]user=([^&]+)/);
  if (m) {
    try {
      const userData = decodeURIComponent(m[1]);
      localStorage.setItem(TOKEN_KEY, userData);
      history.replaceState(null, "", location.pathname + location.search);
      return true;
    } catch (e) {
      console.error("Erro ao capturar token do hash:", e);
    }
  }
  return false;
}

// ============================================================
// API calls - Cloudflare Workers (JSON via fetch)
// ============================================================

export function base() {
  return (window.POLITAPP_AUTH_BASE || "").replace(/\/$/, "");
}

export function url(rel) {
  return base() + "/" + rel.replace(/^\//, "");
}

// Requisição genérica para o Cloudflare Worker
export async function api(rel, { method = "GET", body = null } = {}) {
  const tok = localStorage.getItem(TOKEN_KEY) || "";
  let path = rel;
  const opts = { method, credentials: "include" }; // Usa cookies HttpOnly do Worker
  
  if (method === "GET") {
    if (tok) path += (path.includes("?") ? "&" : "?") + "_token=" + encodeURIComponent(tok);
  } else {
    const payload = Object.assign({}, body || {});
    if (tok) payload._token = tok;
    opts.body = JSON.stringify(payload); // fetch define Content-Type: text/plain
  }
  
  let res, data;
  try {
    res = await fetch(url(path), opts);
  } catch (e) {
    return { ok: false, erro: "rede indisponível (verifique se o Worker está deployado)" };
  }
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok && data.ok === undefined) data.ok = false;
  
  // Guarda o token quando o backend devolve (login/cadastro/otp)
  if (data && data.ok && data.token) localStorage.setItem(TOKEN_KEY, data.token);
  return data;
}

// ============================================================
// Autenticação de e-mail/senha (mantendo compatibilidade)
// ============================================================

export function lwRegister(email, senha, nome) {
  return api("auth/register.php", { method: "POST", body: { email, senha, nome } });
}

export function lwLogin(email, senha) {
  return api("auth/login.php", { method: "POST", body: { email, senha } });
}

// ============================================================
// Telefone (OTP) - também usa Workers agora
// ============================================================

export function lwPhoneRequest(telefone) {
  return api("auth/phone-request.php", { method: "POST", body: { telefone } });
}

export function lwPhoneVerify(telefone, codigo) {
  return api("auth/phone-verify.php", { method: "POST", body: { telefone, codigo } });
}

// ============================================================
// Sessão e logout
// ============================================================

export function lwMe() {
  return api("auth/me.php");
}

export async function lwLogout() {
  const r = await api("auth/logout.php", { method: "POST" });
  localStorage.removeItem(TOKEN_KEY);
  return r;
}