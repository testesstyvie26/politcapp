/**
 * Aprovações de conta. Provider-aware:
 *   locaweb  → API PHP (php/api/admin-*.php)
 *   supabase → fluxo antigo (Supabase), carregado dinamicamente
 */
import { grupoLabel } from "./org-api.js?v=28";

const tbody = document.getElementById("tbody");
const errEl = document.getElementById("err");

function showErr(msg) { if (errEl) { errEl.textContent = msg || ""; errEl.hidden = !msg; } }
function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderRows(rows, onAct) {
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="4" class="empty">Nenhum pedido pendente.</td></tr>`; return; }
  tbody.innerHTML = rows.map((row) => {
    const em = (row.email || "").trim() || "—";
    return `<tr data-id="${row.id}">
      <td>${escapeHtml(em)}</td>
      <td>${escapeHtml(grupoLabel(row.grupo))}</td>
      <td>${escapeHtml(row.unidade_nome || "—")}</td>
      <td class="actions">
        <button type="button" class="btn-ok" data-act="ok">Aprovar</button>
        <button type="button" class="btn-bad" data-act="no">Recusar</button>
      </td>
    </tr>`;
  }).join("");
  tbody.querySelectorAll("button[data-act]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tr = btn.closest("tr");
      const id = tr?.getAttribute("data-id");
      if (!id) return;
      btn.disabled = true;
      await onAct(id, btn.getAttribute("data-act") === "ok" ? "aprovado" : "rejeitado");
      btn.disabled = false;
    });
  });
}

/* ── Locaweb (PHP) ──────────────────────────────────────────────────────── */
async function initLocaweb() {
  const { dget, dpost } = await import("./locaweb-data.js?v=29");
  async function load() {
    showErr("");
    const r = await dget("api/admin-pendentes.php");
    if (!r.ok) { showErr(r.erro || "Não foi possível listar pedidos."); tbody.innerHTML = `<tr><td colspan="4" class="empty">—</td></tr>`; return; }
    renderRows(r.pendentes || [], async (id, status) => {
      const up = await dpost("api/admin-aprovar.php", { id, status });
      if (!up.ok) { alert(up.erro || "Erro ao atualizar."); return; }
      load();
    });
  }
  load();
}

/* ── Supabase (antigo) ──────────────────────────────────────────────────── */
async function initSupabase() {
  const { requireAdmin } = await import("./admin-guard.js?v=28");
  const ctx = await requireAdmin();
  if (!ctx) return;
  const { supabase } = ctx;
  async function load() {
    showErr("");
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, grupo, unidade_id, conta_status, unidades ( nome )")
      .eq("conta_status", "pendente")
      .order("email", { ascending: true });
    if (error) { showErr(error.message || "Não foi possível listar pedidos."); tbody.innerHTML = `<tr><td colspan="4" class="empty">—</td></tr>`; return; }
    const rows = (data || []).map((row) => {
      const un = Array.isArray(row.unidades) ? row.unidades[0] : row.unidades;
      return { ...row, unidade_nome: un?.nome || "—" };
    });
    renderRows(rows, async (id, status) => {
      const { error: upErr } = await supabase
        .from("profiles").update({ conta_status: status, updated_at: new Date().toISOString() }).eq("id", id);
      if (upErr) { alert(upErr.message || "Erro ao atualizar."); return; }
      load();
    });
  }
  load();
}

(window.POLITAPP_AUTH_PROVIDER === "locaweb" ? initLocaweb() : initSupabase());
