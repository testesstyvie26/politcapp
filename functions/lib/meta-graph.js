import { SESSION_COOKIE, cookieValue, unseal } from "./meta-session.js";

export function graphVersion(env) { return env.META_GRAPH_VERSION || "v23.0"; }

export async function metaSession(request, env) {
  if (!env.META_SESSION_SECRET) return null;
  return unseal(cookieValue(request, SESSION_COOKIE), env.META_SESSION_SECRET);
}

export async function graphGet(path, token, env, params = {}) {
  const url = new URL(`https://graph.facebook.com/${graphVersion(env)}/${String(path).replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  url.searchParams.set("access_token", token);
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `Meta Graph ${response.status}`);
  return payload;
}

export async function pagesForSession(session, env) {
  const payload = await graphGet("me/accounts", session.accessToken, env, {
    fields: "id,name,category,access_token,fan_count,followers_count,instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count}",
    limit: 100,
  });
  return payload.data || [];
}

export function publicPage(page) {
  return {
    id: page.id,
    name: page.name,
    category: page.category || "",
    fanCount: page.fan_count ?? null,
    followersCount: page.followers_count ?? null,
    instagram: page.instagram_business_account || null,
  };
}
