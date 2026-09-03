/**
 * Guard do auth Locaweb (PHP). Chamado por auth-guard.js quando
 * window.POLITAPP_AUTH_PROVIDER === "locaweb". Não importa nada do Supabase.
 */
import { lwMe, lwLogout } from "./locaweb-auth.js?v=33";

// Home da área NÃO logada (visitante cai aqui; "Acessar o painel" leva ao login).
const HOME_PAGE = "landing-app.html";

function currentPageFile() {
  const parts = location.pathname.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "index.html";
}
function go(page) { window.location.replace(new URL(page, location.href).href); }

function aprovado(profile) { return !!profile && profile.conta_status === "aprovado"; }
function rejeitada(profile) { return !!profile && profile.conta_status === "rejeitado"; }

function attachLogout() {
  async function doLogout(e) {
    if (e) e.preventDefault();
    try { await lwLogout(); } catch {}
    window.location.replace(new URL(HOME_PAGE, location.href).href);
  }
  window.politappLogout = doLogout;
  window.politappSetAuthNavState?.(true);
  document.querySelectorAll("[data-politapp-logout], #btnLogout, .politapp-logout").forEach((el) => {
    el.hidden = false;            // revela o "Sair" agora que está logado
    el.addEventListener("click", doLogout);
  });
}

export async function runLocawebGuard(resolve, reject) {
  const file = currentPageFile().toLowerCase();
  const onAguarde = file.includes("aguarde-aprovacao.html");
  const onRecusada = file.includes("conta-recusada.html");

  document.documentElement.classList.add("auth-pending");
  try {
    const r = await lwMe();
    if (!r || !r.ok || !r.autenticado) { go(HOME_PAGE); return; }

    const profile = r.profile || null;

    if (aprovado(profile) && (onAguarde || onRecusada)) { go("index.html"); return; }
    if (!profile && !onAguarde) { go("aguarde-aprovacao.html"); return; }
    if (rejeitada(profile) && !onRecusada) { go("conta-recusada.html"); return; }
    if (!aprovado(profile) && !onAguarde && !onRecusada) { go("aguarde-aprovacao.html"); return; }

    document.documentElement.classList.remove("auth-pending");
    attachLogout();
    resolve({ session: { user: r.user }, profile });
  } catch (e) {
    console.error("[politapp] locaweb-auth-guard:", e);
    document.documentElement.classList.remove("auth-pending");
    reject(e);
    try { go(HOME_PAGE); } catch {}
  }
}
