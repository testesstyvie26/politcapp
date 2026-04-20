/**
 * Exige sessão Supabase + conta aprovada (exceto páginas de espera/recusa).
 * Exporta politappAuthReady → resolve com { session, profile }.
 */
import { getSupabase, isAuthConfigured } from "./auth-client.mjs";

let resolveReady;
let rejectReady;

export const politappAuthReady = new Promise((res, rej) => {
  resolveReady = res;
  rejectReady = rej;
});

function loginUrlWithNext() {
  const path = (location.pathname.replace(/^\//, "") || "index.html") + location.search;
  return "login.html?" + new URLSearchParams({ next: path }).toString();
}

function currentPageFile() {
  const parts = location.pathname.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "index.html";
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

    const page = currentPageFile();
    const onAguarde = page === "aguarde-aprovacao.html";
    const onRecusada = page === "conta-recusada.html";

    const { data: profile } = await supabase
      .from("profiles")
      .select("conta_status, grupo")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!profile && !onAguarde) {
      window.location.replace(new URL("aguarde-aprovacao.html", location.href).href);
      return;
    }

    const st = profile?.conta_status;
    const isAdmin = profile?.grupo === "admin";

    if (st === "rejeitado" && !onRecusada) {
      window.location.replace(new URL("conta-recusada.html", location.href).href);
      return;
    }

    if (st === "pendente" && !isAdmin && !onAguarde) {
      window.location.replace(new URL("aguarde-aprovacao.html", location.href).href);
      return;
    }

    document.documentElement.classList.remove("auth-pending");
    resolveReady({ session, profile });
  } catch (e) {
    rejectReady(e);
  }
})();
