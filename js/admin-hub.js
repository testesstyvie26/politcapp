import { requireAdmin } from "./admin-guard.js";

(async function init() {
  const ctx = await requireAdmin();
  if (!ctx) return;
  const root = document.getElementById("root");
  if (root) root.hidden = false;
})();
