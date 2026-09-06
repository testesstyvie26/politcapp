import { seal, unseal } from "../lib/meta-session.js";

const COOKIE = "politapp_ai_gateway";
const MAX_BODY_BYTES = 16 * 1024;
const MAX_RESPONSE_BYTES = 512 * 1024;

function cookieValue(request) {
  const item = (request.headers.get("Cookie") || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`));
  return item ? item.slice(COOKIE.length + 1) : "";
}

function sessionSecret(env) { return env.AI_GATEWAY_SESSION_SECRET || env.COOKIE_SECRET || ""; }
function setCookie(value) { return `${COOKIE}=${value}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict`; }
function clearCookie() { return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`; }
function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  return Boolean(origin) && origin === new URL(request.url).origin;
}

function safeGatewayUrl(raw) {
  try {
    const url = new URL(String(raw || "").trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    if (host.startsWith("[") || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "0.0.0.0" || host === "127.0.0.1") return null;
    if (/^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return null;
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch { return null; }
}

function modelsUrl(base) {
  return base.endsWith("/v1") ? `${base}/models` : `${base}/v1/models`;
}

async function readJsonLimited(response) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_RESPONSE_BYTES) throw new Error("response_too_large");
  if (!response.body) return {};
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error("response_too_large"); }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(all));
}

async function current(request, env) {
  const secret = sessionSecret(env);
  return secret ? unseal(cookieValue(request), secret) : null;
}

export async function onRequestGet({ request, env }) {
  const saved = await current(request, env);
  return Response.json({
    ok: true,
    configured: Boolean(saved),
    gatewayUrl: saved?.gatewayUrl || "",
    model: saved?.model || "hermes-agent",
    models: saved?.models || [],
    tokenStored: Boolean(saved?.token),
    testedAt: saved?.testedAt || null,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return Response.json({ ok: false, error: "Origem não autorizada." }, { status: 403 });
  const secret = sessionSecret(env);
  if (!secret) return Response.json({ ok: false, error: "Armazenamento protegido não configurado." }, { status: 503 });
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) return Response.json({ ok: false, error: "Configuração muito grande." }, { status: 413 });
  let input;
  try { input = await request.json(); } catch { return Response.json({ ok: false, error: "Dados inválidos." }, { status: 400 }); }
  const previous = await current(request, env);
  const gatewayUrl = safeGatewayUrl(input.gatewayUrl);
  const token = String(input.token || previous?.token || "").trim();
  const model = String(input.model || "hermes-agent").trim().slice(0, 160);
  if (!gatewayUrl) return Response.json({ ok: false, error: "Informe uma URL HTTPS pública e válida." }, { status: 400 });
  if (!token) return Response.json({ ok: false, error: "Informe o token do gateway." }, { status: 400 });
  if (!model) return Response.json({ ok: false, error: "Informe o agente ou modelo." }, { status: 400 });

  let models = previous?.models || [];
  let testedAt = previous?.testedAt || null;
  if (input.test === true) {
    try {
      const response = await fetch(modelsUrl(gatewayUrl), {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return Response.json({ ok: false, error: `Gateway recusou a conexão (${response.status}).` }, { status: 502 });
      const payload = await readJsonLimited(response);
      models = [...new Set((payload.data || []).map((item) => String(item?.id || "").trim().slice(0, 120)).filter(Boolean))].slice(0, 12);
      testedAt = new Date().toISOString();
    } catch (error) {
      console.error(JSON.stringify({ event: "ai_gateway_connection_failed", message: String(error) }));
      return Response.json({ ok: false, error: "Não foi possível conectar ao gateway." }, { status: 502 });
    }
  }

  const encrypted = await seal({ gatewayUrl, token, model, models, testedAt }, secret);
  return Response.json({ ok: true, gatewayUrl, model, models, tokenStored: true, testedAt }, { headers: { "Set-Cookie": setCookie(encrypted), "Cache-Control": "no-store" } });
}

export function onRequestDelete({ request }) {
  if (!isSameOrigin(request)) return Response.json({ ok: false, error: "Origem não autorizada." }, { status: 403 });
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearCookie(), "Cache-Control": "no-store" } });
}
