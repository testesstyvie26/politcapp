/** Páginas públicas: sincroniza Entrar/Minha conta/Sair com a sessão atual. */
import { lwMe, lwLogout } from "./locaweb-auth.js?v=35";

(async function syncPublicAuthNavigation() {
  try {
    const result = await lwMe();
    const loggedIn = !!(result && result.ok && result.autenticado);
    window.politappSetAuthNavState?.(loggedIn);
    if (!loggedIn) return;

    const logout = document.querySelector(".pn-logout, [data-politapp-logout]");
    if (!logout || logout.dataset.logoutReady === "true") return;
    logout.dataset.logoutReady = "true";
    logout.addEventListener("click", async (event) => {
      event.preventDefault();
      logout.setAttribute("aria-disabled", "true");
      window.politappSetAuthNavState?.(false);
      try { await lwLogout(); } finally {
        window.location.replace(new URL("landing-app.html", location.href).href);
      }
    });
  } catch {
    window.politappSetAuthNavState?.(false);
  }
})();
