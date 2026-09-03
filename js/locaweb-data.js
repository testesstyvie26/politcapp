/**
 * Cliente de dados do backend PHP/Locaweb (mesma estratégia "sem preflight"
 * do auth: token via _token, corpo text/plain, sem header custom).
 */
const TOKEN_KEY = "politapp_token";
function tok() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } }
function base() { return (window.POLITAPP_AUTH_BASE || "").replace(/\/$/, ""); }
function urlOf(rel) {
  const selectedBase = rel.startsWith("auth/")
    ? (window.POLITAPP_AUTH_API_BASE || base())
    : base();
  return selectedBase.replace(/\/$/, "") + "/" + rel.replace(/^\//, "");
}

export async function dget(rel) {
  let p = rel;
  const t = tok();
  if (t) p += (p.includes("?") ? "&" : "?") + "_token=" + encodeURIComponent(t);
  let r, d;
  try { r = await fetch(urlOf(p), { credentials: "include" }); }
  catch { return { ok: false, erro: "rede indisponível" }; }
  try { d = await r.json(); } catch { d = {}; }
  if (!r.ok && d.ok === undefined) d.ok = false;
  return d;
}

export async function dpost(rel, body) {
  const payload = Object.assign({}, body || {});
  const t = tok();
  if (t) payload._token = t;
  let r, d;
  try { r = await fetch(urlOf(rel), { method: "POST", credentials: "include", body: JSON.stringify(payload) }); }
  catch { return { ok: false, erro: "rede indisponível" }; }
  try { d = await r.json(); } catch { d = {}; }
  if (!r.ok && d.ok === undefined) d.ok = false;
  return d;
}
