import { seal, stateCookie } from "../lib/meta-session.js";

export async function onRequestGet({ request, env }) {
  if (!env.META_APP_ID || !env.META_APP_SECRET || !env.META_SESSION_SECRET) {
    return Response.redirect(new URL("/configuracoes.html?meta=configuracao-incompleta", request.url), 302);
  }
  const url = new URL(request.url);
  const state = crypto.randomUUID();
  const sealedState = await seal({ state, createdAt: Date.now() }, env.META_SESSION_SECRET);
  const graphVersion = env.META_GRAPH_VERSION || "v23.0";
  const authUrl = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
  authUrl.searchParams.set("client_id", env.META_APP_ID);
  authUrl.searchParams.set("redirect_uri", `${url.origin}/api/meta-callback`);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "pages_show_list,pages_read_engagement,pages_manage_posts,read_insights,instagram_basic,instagram_manage_insights,instagram_content_publish");
  return new Response(null, { status: 302, headers: { Location: authUrl.toString(), "Set-Cookie": stateCookie(sealedState), "Cache-Control": "no-store" } });
}
