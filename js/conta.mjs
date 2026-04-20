import { getSupabase, isAuthConfigured } from "./auth-client.mjs";
import { politappAuthReady } from "./auth-guard.mjs";
import { loadProfile, grupoLabel } from "./org-api.mjs";

const loading = document.getElementById("loading");
const content = document.getElementById("content");
const denied = document.getElementById("denied");
const configMsg = document.getElementById("configMsg");
const emailEl = document.getElementById("email");
const nameEl = document.getElementById("name");
const providerEl = document.getElementById("provider");
const grupoEl = document.getElementById("grupo");
const unidadeEl = document.getElementById("unidadeNome");
const logoutBtn = document.getElementById("logout");

(async function init() {
  try {
    await politappAuthReady;
  } catch {
    return;
  }

  if (!isAuthConfigured()) {
    loading.hidden = true;
    configMsg.hidden = false;
    return;
  }

  const supabase = getSupabase();
  if (!supabase) {
    loading.hidden = true;
    configMsg.hidden = false;
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  loading.hidden = true;

  if (!session?.user) {
    denied.hidden = false;
    return;
  }

  const u = session.user;
  const { data: profile } = await loadProfile(supabase, u.id);

  content.hidden = false;
  emailEl.textContent = u.email || "—";
  nameEl.textContent = u.user_metadata?.full_name || u.user_metadata?.name || "—";
  const prov = u.app_metadata?.provider || (u.identities && u.identities[0]?.provider) || "—";
  providerEl.textContent = prov;

  if (grupoEl) grupoEl.textContent = profile?.grupo ? grupoLabel(profile.grupo) : "— (execute sql/supabase-org-tarefas.sql)";
  if (unidadeEl) {
    const raw = profile?.unidades;
    const u = Array.isArray(raw) ? raw[0] : raw;
    unidadeEl.textContent = u?.nome || "—";
  }

  logoutBtn?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
  });
})();
