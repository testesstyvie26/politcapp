import { getSupabase } from "./auth-client.mjs";
import { politappAuthReady } from "./auth-guard.mjs";
import { loadProfile, grupoLabel } from "./org-api.mjs";

const tbody = document.getElementById("tbody");
const errEl = document.getElementById("err");

function showErr(msg) {
  if (!errEl) return;
  errEl.textContent = msg || "";
  errEl.hidden = !msg;
}

(async function init() {
  try {
    await politappAuthReady;
  } catch (e) {
    showErr(e?.message || "Erro de sessão.");
    return;
  }

  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const { data: me } = await loadProfile(supabase, session.user.id);
  if (me?.grupo !== "admin") {
    window.location.replace("index.html");
    return;
  }

  async function load() {
    showErr("");
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, grupo, unidade_id, conta_status, unidades ( nome )")
      .eq("conta_status", "pendente")
      .order("email", { ascending: true });

    if (error) {
      showErr(error.message || "Não foi possível listar pedidos. Confirme se executou sql/supabase-conta-aprovacao.sql.");
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
          alert(upErr.message);
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
