/**
 * Página aguarde-aprovacao: relê o perfil e redireciona se já liberado.
 * Provider-aware: locaweb (me.php) / supabase.
 */
import { getSupabase } from "./auth-client.js?v=28";
import { politappAuthReady } from "./auth-guard.js?v=28";
import { profileAllowsAppAccess } from "./org-api.js?v=28";

const LOCAWEB = (window.POLITAPP_AUTH_PROVIDER || "supabase") === "locaweb";
const estadoEl = () => document.getElementById("estadoPerfil");

export async function redirectIfCanEnter() {
  let profile = null;
  if (LOCAWEB) {
    const { dget } = await import("./locaweb-data.js?v=29");
    const r = await dget("auth/me.php");
    if (!r || !r.ok || !r.autenticado) { if (estadoEl()) estadoEl().textContent = "Sessão expirada. Saia e entre de novo."; return false; }
    profile = r.profile || null;
  } else {
    const sb = getSupabase();
    if (!sb) return false;
    await sb.auth.refreshSession().catch(() => {});
    const { data: { user }, error: userErr } = await sb.auth.getUser();
    if (userErr || !user) { if (estadoEl()) estadoEl().textContent = "Sem utilizador na sessão. Saia e entre de novo."; return false; }
    const { data } = await sb.from("profiles").select("conta_status, grupo").eq("id", user.id).maybeSingle();
    profile = data;
  }

  const el = estadoEl();
  if (el) el.textContent = profile
    ? `Estado lido agora: grupo = ${profile.grupo ?? "—"}, conta_status = ${profile.conta_status ?? "—"}`
    : "Sem perfil para este login.";

  if (profileAllowsAppAccess(profile)) {
    window.location.replace(new URL("index.html", location.href).href);
    return true;
  }
  return false;
}

(async function init() {
  try { await politappAuthReady; } catch { /* redirecionado pelo guard */ }
  await redirectIfCanEnter();

  document.getElementById("btnRefresh")?.addEventListener("click", async () => {
    if (await redirectIfCanEnter()) return;
    location.reload();
  });

  document.getElementById("btnSair")?.addEventListener("click", async () => {
    if (LOCAWEB) {
      const { lwLogout } = await import("./locaweb-auth.js?v=35");
      await lwLogout();
      window.location.href = "login.html";
    } else {
      const sb = getSupabase();
      if (sb) await sb.auth.signOut();
      window.location.href = "login.html";
    }
  });
})();
