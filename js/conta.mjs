import { getSupabase, isAuthConfigured } from "./auth-client.mjs";

const loading = document.getElementById("loading");
const content = document.getElementById("content");
const denied = document.getElementById("denied");
const configMsg = document.getElementById("configMsg");
const emailEl = document.getElementById("email");
const nameEl = document.getElementById("name");
const providerEl = document.getElementById("provider");
const logoutBtn = document.getElementById("logout");

(async function init() {
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
  content.hidden = false;
  emailEl.textContent = u.email || "—";
  nameEl.textContent = u.user_metadata?.full_name || u.user_metadata?.name || "—";
  const prov = u.app_metadata?.provider || (u.identities && u.identities[0]?.provider) || "—";
  providerEl.textContent = prov;

  logoutBtn?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
  });
})();
