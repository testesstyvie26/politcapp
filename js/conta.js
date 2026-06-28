/** Página Conta. Provider-aware: locaweb (me.php) / supabase. */
import { getSupabase, isAuthConfigured } from "./auth-client.js";
import { politappAuthReady } from "./auth-guard.js";
import { loadProfile, grupoLabel, contaStatusLabel } from "./org-api.js";

const LOCAWEB = (window.POLITAPP_AUTH_PROVIDER || "supabase") === "locaweb";
const loading = document.getElementById("loading");
const content = document.getElementById("content");
const denied = document.getElementById("denied");
const configMsg = document.getElementById("configMsg");
const emailEl = document.getElementById("email");
const nameEl = document.getElementById("name");
const providerEl = document.getElementById("provider");
const grupoEl = document.getElementById("grupo");
const unidadeEl = document.getElementById("unidadeNome");
const contaStatusEl = document.getElementById("contaStatus");
const adminHubLink = document.getElementById("adminHubLink");
const logoutBtn = document.getElementById("logout");

(async function init() {
  try { await politappAuthReady; } catch { return; }

  if (LOCAWEB) {
    const { dget } = await import("./locaweb-data.js?v=1");
    const { lwLogout } = await import("./locaweb-auth.js?v=2");
    const r = await dget("auth/me.php");
    loading.hidden = true;
    if (!r || !r.ok || !r.autenticado) { denied.hidden = false; return; }
    const user = r.user || {}, profile = r.profile || {};
    content.hidden = false;
    emailEl.textContent = user.email || "—";
    nameEl.textContent = user.nome || "—";
    providerEl.textContent = user.telefone ? "telefone" : (user.email ? "e-mail/Google" : "—");
    if (grupoEl) grupoEl.textContent = profile.grupo ? grupoLabel(profile.grupo) : "—";
    if (unidadeEl) unidadeEl.textContent = "—";
    if (contaStatusEl) contaStatusEl.textContent = profile.conta_status ? contaStatusLabel(profile.conta_status) : "—";
    if (adminHubLink && profile.grupo === "admin") adminHubLink.hidden = false;
    logoutBtn?.addEventListener("click", async () => { await lwLogout(); window.location.href = "login-locaweb.html"; });
    return;
  }

  // Supabase
  if (!isAuthConfigured()) { loading.hidden = true; configMsg.hidden = false; return; }
  const supabase = getSupabase();
  if (!supabase) { loading.hidden = true; configMsg.hidden = false; return; }
  const { data: { session } } = await supabase.auth.getSession();
  loading.hidden = true;
  if (!session?.user) { denied.hidden = false; return; }
  const u = session.user;
  const { data: profile } = await loadProfile(supabase, u.id);
  content.hidden = false;
  emailEl.textContent = u.email || "—";
  nameEl.textContent = u.user_metadata?.full_name || u.user_metadata?.name || "—";
  providerEl.textContent = u.app_metadata?.provider || (u.identities && u.identities[0]?.provider) || "—";
  if (grupoEl) grupoEl.textContent = profile?.grupo ? grupoLabel(profile.grupo) : "—";
  if (unidadeEl) { const raw = profile?.unidades; const un = Array.isArray(raw) ? raw[0] : raw; unidadeEl.textContent = un?.nome || "—"; }
  if (contaStatusEl) contaStatusEl.textContent = profile?.conta_status ? contaStatusLabel(profile.conta_status) : "—";
  if (adminHubLink && profile?.grupo === "admin") adminHubLink.hidden = false;
  logoutBtn?.addEventListener("click", async () => { await supabase.auth.signOut(); window.location.href = "login.html"; });
})();
