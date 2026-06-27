/**
 * Botão "Deslogar" — preferência: nav.site-nav, depois nav.top-nav (landings), senão canto fixo.
 */
export function attachPolitappLogoutButton(supabase) {
  if (!supabase || typeof document === "undefined") return;
  if (document.querySelector("[data-politapp-logout]")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.politappLogout = "";
  btn.setAttribute("aria-label", "Deslogar e encerrar a sessão");
  btn.textContent = "Deslogar";
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.href = "login.html";
    }
  });

  const nav =
    document.querySelector("nav.site-nav") ||
    document.querySelector("nav.top-nav") ||
    document.querySelector("[data-politapp-logout-nav]");

  if (nav) {
    btn.className = "site-nav-logout-btn";
    nav.appendChild(btn);
    return;
  }

  btn.className = "politapp-logout-floating-btn";
  const bar = document.createElement("div");
  bar.className = "politapp-logout-fallback-bar";
  bar.setAttribute("data-politapp-logout-bar", "");
  bar.appendChild(btn);
  document.body.appendChild(bar);
}
