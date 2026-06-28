/**
 * Cliente do auth próprio (PHP/Locaweb). Suporta:
 *  - same-origin (cookie de sessão), e
 *  - cross-origin (token Bearer no localStorage) — para o front no GitHub Pages
 *    (politcapp.com.br) falando com o PHP na Locaweb, sem depender de
 *    cookies de terceiros (que os navegadores bloqueiam).
 * Base do backend: window.POLITAPP_AUTH_BASE (vazio = mesmo domínio).
 */
const TOKEN_KEY = "politapp_token";

export function lwGetToken() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } }
export function lwSetToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} }

function base() { return (window.POLITAPP_AUTH_BASE || "").replace(/\/$/, ""); }
function url(rel) { return base() + "/" + rel.replace(/^\//, ""); }

async function api(rel, { method = "GET", body = null } = {}) {
  // IMPORTANTE: requisição "simples" (sem header Authorization e sem
  // Content-Type application/json) para NÃO disparar preflight CORS — o
  // Cloudflare do site bloqueia OPTIONS. O token vai por _token (query/corpo)
  // e o corpo é enviado como texto puro (o PHP lê php://input mesmo assim).
  const tok = lwGetToken();
  let path = rel;
  const opts = { method, credentials: "include" };
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
    return { ok: false, erro: "rede indisponível (verifique a URL do backend / CORS)" };
  }
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok && data.ok === undefined) data.ok = false;
  // guarda o token quando o backend o devolve (login/cadastro/otp)
  if (data && data.ok && data.token) lwSetToken(data.token);
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

/* ── Google (redirect) — volta ao front com o token no fragmento (#) ─────── */
export function lwGoogleStartUrl(returnUrl) {
  const ret = returnUrl || (location.origin + location.pathname);
  return url("auth/google-start.php") + "?return=" + encodeURIComponent(ret);
}
/** Captura #token=... no retorno do Google e guarda; limpa o fragmento. */
export function lwCaptureTokenFromHash() {
  const m = location.hash.match(/[#&]token=([^&]+)/);
  if (m) {
    lwSetToken(decodeURIComponent(m[1]));
    history.replaceState(null, "", location.pathname + location.search);
    return true;
  }
  return false;
}

/* ── Sessão ─────────────────────────────────────────────────────────────── */
export function lwMe() { return api("auth/me.php"); }
export async function lwLogout() {
  const r = await api("auth/logout.php", { method: "POST" });
  lwSetToken("");
  return r;
}
