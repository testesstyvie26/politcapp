/** Unidades (admin). Provider-aware: locaweb=PHP, supabase=antigo. */
const tbody = document.getElementById("tbody");
const errEl = document.getElementById("err");
const form = document.getElementById("formNova");
const nomeIn = document.getElementById("nome");
const slugIn = document.getElementById("slug");
const slugHint = document.getElementById("slugHint");

const LOCAWEB = (window.POLITAPP_AUTH_PROVIDER || "supabase") === "locaweb";

function showErr(msg) { if (errEl) { errEl.textContent = msg || ""; errEl.hidden = !msg; } }
function escapeHtml(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function formatDate(iso) { if (!iso) return "—"; try { return new Date(iso.replace(" ", "T")).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); } catch { return "—"; } }
function slugifyNome(s) {
  const t = String(s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return t || "unidade";
}

function renderRows(rows) {
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="3" class="empty">Nenhuma unidade.</td></tr>`; return; }
  tbody.innerHTML = rows.map((r) => `<tr>
    <td>${escapeHtml(r.nome)}</td>
    <td class="mono">${escapeHtml(r.slug)}</td>
    <td class="muted">${formatDate(r.created_at)}</td>
  </tr>`).join("");
}

function wireSlug() {
  let slugManual = false;
  slugIn?.addEventListener("input", () => { slugManual = (slugIn.value || "").trim().length > 0; });
  nomeIn?.addEventListener("input", () => {
    if (!slugManual && slugIn) { const s = slugifyNome(nomeIn.value); slugIn.placeholder = s; if (slugHint) slugHint.textContent = s || "—"; }
  });
}

async function initLocaweb() {
  const { dget, dpost } = await import("./locaweb-data.js?v=27");
  const root = document.getElementById("root"); if (root) root.hidden = false;
  wireSlug();
  async function load() {
    showErr("");
    const r = await dget("api/unidades.php");
    if (!r.ok) { showErr(r.erro || "Não foi possível listar."); tbody.innerHTML = `<tr><td colspan="3" class="empty">—</td></tr>`; return; }
    renderRows(r.unidades || []);
  }
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = (nomeIn?.value || "").trim();
    if (!nome) { showErr("Informe o nome da unidade."); return; }
    const slug = slugifyNome((slugIn?.value || "").trim() || nome);
    showErr("");
    const btn = form.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
    const r = await dpost("api/unidades.php", { action: "add", nome, slug });
    if (btn) btn.disabled = false;
    if (!r.ok) { showErr(r.erro || "Não foi possível criar."); return; }
    nomeIn.value = ""; if (slugIn) { slugIn.value = ""; slugIn.placeholder = ""; if (slugHint) slugHint.textContent = "—"; }
    load();
  });
  load();
}

async function initSupabase() {
  const { requireAdmin } = await import("./admin-guard.js?v=27");
  const ctx = await requireAdmin(); if (!ctx) return;
  const { supabase } = ctx;
  const root = document.getElementById("root"); if (root) root.hidden = false;
  wireSlug();
  async function load() {
    showErr("");
    const { data, error } = await supabase.from("unidades").select("id, nome, slug, created_at").order("nome", { ascending: true });
    if (error) { showErr(error.message || "Não foi possível listar."); tbody.innerHTML = `<tr><td colspan="3" class="empty">—</td></tr>`; return; }
    renderRows(data || []);
  }
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = (nomeIn?.value || "").trim();
    if (!nome) { showErr("Informe o nome da unidade."); return; }
    const slug = slugifyNome((slugIn?.value || "").trim() || nome);
    showErr("");
    const btn = form.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
    const { error } = await supabase.from("unidades").insert({ nome, slug });
    if (btn) btn.disabled = false;
    if (error) { showErr(error.message || "Não foi possível criar."); return; }
    nomeIn.value = ""; if (slugIn) { slugIn.value = ""; slugIn.placeholder = ""; if (slugHint) slugHint.textContent = "—"; }
    load();
  });
  load();
}

(LOCAWEB ? initLocaweb() : initSupabase());
