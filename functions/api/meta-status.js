import { SESSION_COOKIE, cookieValue, unseal } from "../lib/meta-session.js";

export async function onRequestGet({ request, env }) {
  const configured = Boolean(env.META_APP_ID && env.META_APP_SECRET && env.META_SESSION_SECRET);
  if (!configured) return Response.json({ ok: true, configured: false, connected: false }, { headers: { "Cache-Control": "no-store" } });
  const session = await unseal(cookieValue(request, SESSION_COOKIE), env.META_SESSION_SECRET);
  if (!session?.accessToken) return Response.json({ ok: true, configured: true, connected: false }, { headers: { "Cache-Control": "no-store" } });
  const version = env.META_GRAPH_VERSION || "v23.0";
  const url = new URL(`https://graph.facebook.com/${version}/me/accounts`);
  url.searchParams.set("fields", "id,name,instagram_business_account{id,username,profile_picture_url}");
  url.searchParams.set("access_token", session.accessToken);
  try {
    const graphResponse = await fetch(url, { headers: { Accept: "application/json" } });
    if (!graphResponse.ok) return Response.json({ ok: true, configured: true, connected: false, expired: true }, { headers: { "Cache-Control": "no-store" } });
    const payload = await graphResponse.json();
    const pages = (payload.data || []).map((page) => ({ id: page.id, name: page.name, instagram: page.instagram_business_account || null }));
    return Response.json({ ok: true, configured: true, connected: true, connectedAt: session.connectedAt, pages }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(JSON.stringify({ event: "meta_status_failed", message: String(error) }));
    return Response.json({ ok: false, configured: true, connected: false, error: "meta_unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

