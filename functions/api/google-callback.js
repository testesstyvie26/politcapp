import { clearStateCookie, readSignedStateCookie } from "../lib/auth.js";

function errorRedirect(origin, message) {
  const url = new URL("/login", origin);
  url.searchParams.set("erro", message);
  return new Response(null, { status: 302, headers: { Location: url.toString(), "Set-Cookie": clearStateCookie() } });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error")) return errorRedirect(url.origin, "Login com Google cancelado.");
  if (!code || !state || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.COOKIE_SECRET) {
    return errorRedirect(url.origin, "Não foi possível concluir o login com Google.");
  }
  const saved = await readSignedStateCookie(request.headers.get("Cookie") || "", env.COOKIE_SECRET);
  if (!saved || saved.state !== state) return errorRedirect(url.origin, "Sessão de login expirada. Tente novamente.");
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/api/google-callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) {
    console.error(JSON.stringify({ message: "google_token_exchange_failed", status: tokenResponse.status }));
    return errorRedirect(url.origin, "O Google recusou a autenticação.");
  }
  const tokens = await tokenResponse.json();
  if (!tokens.id_token) return errorRedirect(url.origin, "Resposta inválida do Google.");
  const destination = new URL(saved.returnUrl || "/login", url.origin);
  destination.hash = `google_id_token=${encodeURIComponent(tokens.id_token)}`;
  return new Response(null, {
    status: 302,
    headers: {
      Location: destination.toString(),
      "Set-Cookie": clearStateCookie(),
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
    },
  });
}
