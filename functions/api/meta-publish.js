import { metaSession, pagesForSession } from "../lib/meta-graph.js";

function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  return Boolean(origin) && origin === new URL(request.url).origin;
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return Response.json({ ok: false, error: "Origem não autorizada." }, { status: 403 });
  const session = await metaSession(request, env);
  if (!session?.accessToken) return Response.json({ ok: false, error: "Conecte sua conta Meta primeiro." }, { status: 401 });
  let input;
  try { input = await request.json(); } catch { return Response.json({ ok: false, error: "Dados inválidos." }, { status: 400 }); }
  const pageId = String(input.pageId || "").trim();
  const message = String(input.message || "").trim().slice(0, 5000);
  if (!pageId || !message) return Response.json({ ok: false, error: "Selecione a Página e escreva a publicação." }, { status: 400 });
  try {
    const pages = await pagesForSession(session, env);
    const page = pages.find((item) => item.id === pageId);
    if (!page?.access_token) return Response.json({ ok: false, error: "Página não autorizada." }, { status: 403 });
    const url = new URL(`https://graph.facebook.com/${env.META_GRAPH_VERSION || "v23.0"}/${page.id}/feed`);
    const body = new URLSearchParams({ message, access_token: page.access_token });
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body, signal: AbortSignal.timeout(12000) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.error?.message || "Publicação recusada pela Meta.");
    return Response.json({ ok: true, postId: result.id || null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(JSON.stringify({ event: "meta_publish_failed", message: String(error) }));
    return Response.json({ ok: false, error: error.message || "Não foi possível publicar." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
