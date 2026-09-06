import { graphGet, metaSession, pagesForSession, publicPage } from "../lib/meta-graph.js";

export async function onRequestGet({ request, env }) {
  const session = await metaSession(request, env);
  if (!session?.accessToken) return Response.json({ ok: false, error: "not_connected" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const pages = await pagesForSession(session, env);
    const assets = await Promise.all(pages.map(async (page) => {
      const since = Math.floor((Date.now() - 28 * 86400000) / 1000);
      const posts = await graphGet(`${page.id}/feed`, page.access_token, env, {
        fields: "id,message,created_time,permalink_url,shares,comments.limit(0).summary(true),reactions.limit(0).summary(true)", limit: 5,
      }).then((data) => data.data || []).catch(() => []);
      let insights = [];
      try {
        const data = await graphGet(`${page.id}/insights`, page.access_token, env, {
          metric: "page_post_engagements,page_views_total", period: "day", since,
        });
        insights = data.data || [];
      } catch { /* Métricas variam conforme o tipo e a versão do ativo. */ }
      return { ...publicPage(page), posts, insights };
    }));
    return Response.json({ ok: true, connectedAt: session.connectedAt, assets }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(JSON.stringify({ event: "meta_dashboard_failed", message: String(error) }));
    return Response.json({ ok: false, error: "meta_unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
