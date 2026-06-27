import { getSupabase } from "./auth-client.js";
import { politappAuthReady } from "./auth-guard.js";
import { loadProfile } from "./org-api.js";

/** Garante sessão e grupo admin; caso contrário redireciona. */
export async function requireAdmin() {
  try {
    await politappAuthReady;
  } catch {
    window.location.replace("index.html");
    return null;
  }

  const supabase = getSupabase();
  if (!supabase) {
    window.location.replace("login.html");
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    window.location.replace("login.html");
    return null;
  }

  const { data: profile } = await loadProfile(supabase, session.user.id);
  if (profile?.grupo !== "admin") {
    window.location.replace("index.html");
    return null;
  }

  return { supabase, session, profile };
}
