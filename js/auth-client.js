import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.0";

let client = null;

export function getSupabase() {
  if (client) return client;
  const url = typeof window !== "undefined" ? String(window.POLITAPP_SUPABASE_URL || "").trim() : "";
  const key = typeof window !== "undefined" ? String(window.POLITAPP_SUPABASE_ANON_KEY || "").trim() : "";
  if (!url || !key) return null;
  client = createClient(url, key, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
    },
  });
  return client;
}

/**
 * Fluxo PKCE: após o redirect do Supabase, a URL traz ?code=...
 * Sem esta troca explícita, a sessão pode não ser criada em alguns ambientes.
 */
export async function finalizeOAuthFromUrl(supabase) {
  if (!supabase) return { error: null };
  const u = new URL(window.location.href);
  const code = u.searchParams.get("code");
  if (!code) return { error: null };

  const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
  if (error) return { error };

  const next = u.searchParams.get("next");
  ["code", "state"].forEach((k) => u.searchParams.delete(k));
  if (next) u.searchParams.set("next", next);
  const qs = u.searchParams.toString();
  window.history.replaceState({}, "", u.pathname + (qs ? "?" + qs : "") + u.hash);
  return { error: null };
}

export function isAuthConfigured() {
  const url = String(window.POLITAPP_SUPABASE_URL || "").trim();
  const key = String(window.POLITAPP_SUPABASE_ANON_KEY || "").trim();
  return Boolean(url && key);
}

/** Evita open-redirect no ?next= após login (só caminhos relativos ao site). */
export function politappSafeNext(raw) {
  if (raw == null || raw === "") return "";
  try {
    const d = decodeURIComponent(String(raw).trim());
    if (/^[a-z][a-z0-9+.-]*:/i.test(d)) return "";
    if (d.slice(0, 2) === "//") return "";
    if (d.toLowerCase().indexOf("javascript:") === 0) return "";
    return d;
  } catch {
    return "";
  }
}

export function loginRedirectUrl() {
  return new URL("login.html", window.location.href).href;
}
