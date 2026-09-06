/** Páginas públicas: sincroniza Entrar/Minha conta/Sair com a sessão atual. */
import { lwMe, lwLogout } from "./locaweb-auth.js?v=36";

(async function syncPublicAuthNavigation() {
  function setPublicState(loggedIn) {
    window.politappSetAuthNavState?.(loggedIn);
    document.querySelectorAll("[data-politapp-account]").forEach((link) => {
      link.href = loggedIn ? "conta.html" : "login.html";
      if (loggedIn) link.textContent = "Minha conta";
      else if (link.closest(".top-actions")) link.textContent = "Entrar";
      else if (link.closest(".final-cta")) link.textContent = "Entrar ou cadastrar";
      else link.textContent = "Acessar o Politapp";
    });
    document.querySelectorAll("[data-politapp-logout]").forEach((link) => { link.hidden = !loggedIn; });
  }

  try {
    const result = await lwMe();
    const loggedIn = !!(result && result.ok && result.autenticado);
    setPublicState(loggedIn);
    if (!loggedIn) return;

    document.querySelectorAll(".pn-logout, [data-politapp-logout]").forEach((logout) => {
      if (logout.dataset.logoutReady === "true") return;
      logout.dataset.logoutReady = "true";
      logout.addEventListener("click", async (event) => {
        event.preventDefault();
        logout.setAttribute("aria-disabled", "true");
        setPublicState(false);
        try { await lwLogout(); } finally {
          window.location.replace(new URL("landing-app.html", location.href).href);
        }
      });
    });
  } catch {
    setPublicState(false);
  }
})();
