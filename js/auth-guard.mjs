/**
 * Exige sessão Supabase: redireciona para login.html?next=...
 * Exporta politappAuthReady — aguarde antes de lógica que não deve rodar sem login.
 */
import { getSupabase, isAuthConfigured } from "./auth-client.mjs";

let resolveReady;
let rejectReady;

/** Resolve com a sessão quando o utilizador está autenticado; nunca resolve se houver redirect. */
export const politappAuthReady = new Promise((res, rej) => {
  resolveReady = res;
  rejectReady = rej;
});

function loginUrlWithNext() {
  const path = (location.pathname.replace(/^\//, "") || "index.html") + location.search;
  return "login.html?" + new URLSearchParams({ next: path }).toString();
}

(function injectHideStyle() {
  const s = document.createElement("style");
  s.setAttribute("data-politapp", "auth-guard");
  s.textContent = "html.auth-pending body { visibility: hidden !important; }";
  document.head.appendChild(s);
})();

(async function guard() {
  document.documentElement.classList.add("auth-pending");

  try {
    if (!isAuthConfigured()) {
      window.location.replace(loginUrlWithNext());
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      window.location.replace(loginUrlWithNext());
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.replace(loginUrlWithNext());
      return;
    }

    document.documentElement.classList.remove("auth-pending");
    resolveReady(session);
  } catch (e) {
    rejectReady(e);
  }
})();
