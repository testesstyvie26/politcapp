/** Hub admin. Provider-aware: exige grupo admin (locaweb via me.php / supabase). */
const LOCAWEB = (window.POLITAPP_AUTH_PROVIDER || "supabase") === "locaweb";

(async function init() {
  if (LOCAWEB) {
    const { politappAuthReady } = await import("./auth-guard.js?v=28");
    try { await politappAuthReady; } catch { return; }
    const { dget } = await import("./locaweb-data.js?v=28");
    const r = await dget("auth/me.php");
    if (!r || !r.ok || (r.profile?.grupo !== "admin")) {
      window.location.replace(new URL("index.html", location.href).href);
      return;
    }
    const root = document.getElementById("root"); if (root) root.hidden = false;
    return;
  }
  const { requireAdmin } = await import("./admin-guard.js?v=28");
  const ctx = await requireAdmin();
  if (!ctx) return;
  const root = document.getElementById("root"); if (root) root.hidden = false;
})();
