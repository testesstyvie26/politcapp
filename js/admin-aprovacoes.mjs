import { requireAdmin } from "./admin-guard.mjs";
import { grupoLabel } from "./org-api.mjs";

const tbody = document.getElementById("tbody");
const errEl = document.getElementById("err");

function showErr(msg) {
  if (!errEl) return;
  errEl.textContent = msg || "";
  errEl.hidden = !msg;
}

(async function init() {
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

    if (error) {
      let msg = error.message || "Não foi possível listar pedidos.";
      if (/policy|permission|RLS|42501|violates row/i.test(msg)) {
        msg +=
          " Verifique se o seu utilizador tem grupo admin (sql/promover-admin.sql no Supabase).";
      }
      showErr(msg);
      tbody.innerHTML = `<tr><td colspan="4" class="empty">—</td></tr>`;
      return;
    }

    if (!data?.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty">Nenhum pedido pendente.</td></tr>`;
      return;
    }

    tbody.innerHTML = data
      .map((row) => {
        const un = Array.isArray(row.unidades) ? row.unidades[0] : row.unidades;
        const unNome = un?.nome || "—";
        const em = (row.email || "").trim() || "—";
        return `<tr data-id="${row.id}">
          <td>${escapeHtml(em)}</td>
          <td>${escapeHtml(grupoLabel(row.grupo))}</td>
          <td>${escapeHtml(unNome)}</td>
          <td class="actions">
            <button type="button" class="btn-ok" data-act="ok">Aprovar</button>
            <button type="button" class="btn-bad" data-act="no">Recusar</button>
          </td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("button[data-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const tr = btn.closest("tr");
        const id = tr?.getAttribute("data-id");
        if (!id) return;
        const act = btn.getAttribute("data-act");
        const nextStatus = act === "ok" ? "aprovado" : "rejeitado";
        btn.disabled = true;
        const { error: upErr } = await supabase
          .from("profiles")
          .update({ conta_status: nextStatus, updated_at: new Date().toISOString() })
          .eq("id", id);
        btn.disabled = false;
        if (upErr) {
          let m = upErr.message || "Erro ao atualizar.";
          if (/policy|permission|RLS|42501|violates row/i.test(m)) {
            m +=
              "\n\nSó um admin pode aprovar. Execute no Supabase o script sql/promover-admin.sql (definir grupo = admin).";
          }
          alert(m);
          return;
        }
        load();
      });
    });
  }

  load();
})();

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
