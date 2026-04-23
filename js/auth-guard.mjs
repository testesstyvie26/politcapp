/**
 * Exige sessão Supabase + conta aprovada (exceto páginas de espera/recusa).
 * Exporta politappAuthReady → resolve com { session, profile }.
 */
import { getSupabase, isAuthConfigured } from "./auth-client.mjs";
import { profileAllowsAppAccess, isContaRejeitada } from "./org-api.mjs";

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

/** Páginas 100% públicas: sem sessão Supabase e sem redirecionar ao login. */
const AUTH_GUARD_PUBLIC_PAGES = new Set(["landing-publico.html"]);

function isPublicHtmlPage() {
  return AUTH_GUARD_PUBLIC_PAGES.has(currentPageFile().toLowerCase());
}

function isAguardePage() {
  return location.pathname.toLowerCase().includes("aguarde-aprovacao.html");
}

function isRecusadaPage() {
  return location.pathname.toLowerCase().includes("conta-recusada.html");
}

(function injectHideStyle() {
  const s = document.createElement("style");
  s.setAttribute("data-politapp", "auth-guard");
  s.textContent = "html.auth-pending body { visibility: hidden !important; }";
  document.head.appendChild(s);
})();

(async function guard() {
  if (isPublicHtmlPage()) {
    resolveReady({ session: null, profile: null });
    return;
  }

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

    await supabase.auth.refreshSession().catch(() => {});

    const onAguarde = isAguardePage();
    const onRecusada = isRecusadaPage();

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("conta_status, grupo")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profileErr) {
      console.error("[politapp] Erro ao ler profiles:", profileErr.message);
    }

    if (profileAllowsAppAccess(profile) && onAguarde) {
      window.location.replace(new URL("index.html", location.href).href);
      return;
    }

    if (profileAllowsAppAccess(profile) && onRecusada) {
      window.location.replace(new URL("index.html", location.href).href);
      return;
    }

    if (!profile && !onAguarde) {
      window.location.replace(new URL("aguarde-aprovacao.html", location.href).href);
      return;
    }

    if (isContaRejeitada(profile) && !onRecusada) {
      window.location.replace(new URL("conta-recusada.html", location.href).href);
      return;
    }

    if (!profileAllowsAppAccess(profile) && !onAguarde && !onRecusada) {
      window.location.replace(new URL("aguarde-aprovacao.html", location.href).href);
      return;
    }

    document.documentElement.classList.remove("auth-pending");
    resolveReady({ session, profile });
  } catch (e) {
    rejectReady(e);
  }
})();
