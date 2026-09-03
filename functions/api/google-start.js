import { createSignedStateCookie, safeReturnUrl } from "../lib/auth.js";

export async function onRequestGet({ request, env }) {
  if (!env.GOOGLE_CLIENT_ID || !env.COOKIE_SECRET) {
    return new Response("OAuth não configurado", { status: 503 });
  }
  const requestUrl = new URL(request.url);
  const returnUrl = safeReturnUrl(requestUrl.searchParams.get("return"), requestUrl.origin);
  const stateBytes = new Uint8Array(24);
  crypto.getRandomValues(stateBytes);
  const state = Array.from(stateBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const cookie = await createSignedStateCookie({ state, returnUrl }, env.COOKIE_SECRET);
  const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleUrl.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  googleUrl.searchParams.set("redirect_uri", `${requestUrl.origin}/api/google-callback`);
  googleUrl.searchParams.set("response_type", "code");
  googleUrl.searchParams.set("scope", "openid email profile");
  googleUrl.searchParams.set("state", state);
  googleUrl.searchParams.set("prompt", "select_account");
  return new Response(null, { status: 302, headers: { Location: googleUrl.toString(), "Set-Cookie": cookie } });
}
