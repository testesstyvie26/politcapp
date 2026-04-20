import {
  getSupabase,
  isAuthConfigured,
  politappSafeNext,
  loginRedirectUrl,
  finalizeOAuthFromUrl,
} from "./auth-client.mjs";

const errEl = document.getElementById("err");
const btnLoginGoogle = document.getElementById("btnLoginGoogle");
const btnRegisterGoogle = document.getElementById("btnRegisterGoogle");
const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const panelLogin = document.getElementById("panelLogin");
const panelRegister = document.getElementById("panelRegister");

function showError(msg) {
  if (!errEl) return;
  errEl.textContent = msg || "";
  errEl.hidden = !msg;
}

function showConfigHint() {
  showError(
    "Configure js/auth-config.js com POLITAPP_SUPABASE_URL e POLITAPP_SUPABASE_ANON_KEY (projeto Supabase → API)."
  );
}

async function signInWithGoogle() {
  const supabase = getSupabase();
  if (!supabase) {
    showConfigHint();
    return;
  }
  showError("");
  const redirectTo = loginRedirectUrl();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) showError(error.message || "Não foi possível iniciar o login com Google.");
}

function setTab(which) {
  const loginOn = which === "login";
  if (tabLogin && tabRegister) {
    tabLogin.setAttribute("aria-selected", loginOn ? "true" : "false");
    tabRegister.setAttribute("aria-selected", loginOn ? "false" : "true");
    tabLogin.tabIndex = loginOn ? 0 : -1;
    tabRegister.tabIndex = loginOn ? -1 : 0;
  }
  if (panelLogin && panelRegister) {
    panelLogin.hidden = !loginOn;
    panelRegister.hidden = loginOn;
  }
}

function readOAuthErrorFromUrl() {
  const h = window.location.hash.replace(/^#/, "");
  if (h) {
    const p = new URLSearchParams(h);
    const desc = p.get("error_description") || p.get("error");
    if (desc) return decodeURIComponent(desc.replace(/\+/g, " "));
  }
  const q = new URLSearchParams(window.location.search);
  const qe = q.get("error_description") || q.get("error");
  if (qe) return qe;
  return "";
}

(async function init() {
  if (!isAuthConfigured()) {
    showConfigHint();
    if (btnLoginGoogle) btnLoginGoogle.disabled = true;
    if (btnRegisterGoogle) btnRegisterGoogle.disabled = true;
    return;
  }

  const supabase = getSupabase();
  if (!supabase) {
    showConfigHint();
    return;
  }

  const { error: exchangeErr } = await finalizeOAuthFromUrl(supabase);
  if (exchangeErr) {
    showError(exchangeErr.message || "Não foi possível concluir o login (troca do código OAuth).");
  } else {
    const oauthErr = readOAuthErrorFromUrl();
    if (oauthErr) showError(oauthErr);
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) {
    const next = politappSafeNext(new URLSearchParams(location.search).get("next"));
    window.location.replace(next || "index.html");
    return;
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user) {
      const next = politappSafeNext(new URLSearchParams(location.search).get("next"));
      window.location.replace(next || "index.html");
    }
  });

  tabLogin?.addEventListener("click", () => setTab("login"));
  tabRegister?.addEventListener("click", () => setTab("register"));
  tabLogin?.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      tabRegister?.focus();
      setTab("register");
    }
  });
  tabRegister?.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      tabLogin?.focus();
      setTab("login");
    }
  });

  btnLoginGoogle?.addEventListener("click", () => signInWithGoogle());
  btnRegisterGoogle?.addEventListener("click", () => signInWithGoogle());
})();
