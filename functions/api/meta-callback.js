import { STATE_COOKIE, clearStateCookie, cookieValue, seal, sessionCookie, unseal } from "../lib/meta-session.js";

function back(request, status) {
  const url = new URL("/configuracoes.html", request.url);
  url.searchParams.set("meta", status);
  return new Response(null, { status: 302, headers: { Location: url.toString(), "Set-Cookie": clearStateCookie(), "Cache-Control": "no-store" } });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get("error")) return back(request, "cancelado");
  if (!env.META_APP_ID || !env.META_APP_SECRET || !env.META_SESSION_SECRET) return back(request, "configuracao-incompleta");
  const saved = await unseal(cookieValue(request, STATE_COOKIE), env.META_SESSION_SECRET);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!saved || !code || !state || saved.state !== state || Date.now() - saved.createdAt > 600000) return back(request, "sessao-expirada");

  const graphVersion = env.META_GRAPH_VERSION || "v23.0";
  const tokenUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", env.META_APP_ID);
  tokenUrl.searchParams.set("client_secret", env.META_APP_SECRET);
  tokenUrl.searchParams.set("redirect_uri", `${url.origin}/api/meta-callback`);
  tokenUrl.searchParams.set("code", code);
  try {
    const tokenResponse = await fetch(tokenUrl, { headers: { Accept: "application/json" } });
    if (!tokenResponse.ok) return back(request, "falha");
    const token = await tokenResponse.json();
    if (!token.access_token) return back(request, "falha");
    const encrypted = await seal({ accessToken: token.access_token, connectedAt: Date.now() }, env.META_SESSION_SECRET);
    const response = back(request, "conectado");
    response.headers.append("Set-Cookie", sessionCookie(encrypted));
    return response;
  } catch (error) {
    console.error(JSON.stringify({ event: "meta_oauth_failed", message: String(error) }));
    return back(request, "falha");
  }
}

