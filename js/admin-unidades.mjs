import { requireAdmin } from "./admin-guard.mjs";

const tbody = document.getElementById("tbody");
const errEl = document.getElementById("err");
const form = document.getElementById("formNova");
const nomeIn = document.getElementById("nome");
const slugIn = document.getElementById("slug");
const slugHint = document.getElementById("slugHint");

function showErr(msg) {
  if (!errEl) return;
  errEl.textContent = msg || "";
  errEl.hidden = !msg;
}

/** Gera slug estável a partir do nome (pt, sem acentos). */
function slugifyNome(s) {
  const t = String(s ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return t || "unidade";
}

(async function init() {
  const ctx = await requireAdmin();
  if (!ctx) return;

  const { supabase } = ctx;
  const root = document.getElementById("root");
  if (root) root.hidden = false;

  let slugManual = false;
  slugIn?.addEventListener("input", () => {
    slugManual = (slugIn.value || "").trim().length > 0;
  });

  nomeIn?.addEventListener("input", () => {
    if (!slugManual && slugIn) {
      const s = slugifyNome(nomeIn.value);
      slugIn.placeholder = s;
      if (slugHint) slugHint.textContent = s || "—";
    }
  });

  async function load() {
    showErr("");
    const { data, error } = await supabase
      .from("unidades")
      .select("id, nome, slug, created_at")
      .order("nome", { ascending: true });

    if (error) {
      showErr(error.message || "Não foi possível listar unidades.");
      tbody.innerHTML = `<tr><td colspan="3" class="empty">—</td></tr>`;
      return;
    }

    if (!data?.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="empty">Nenhuma unidade.</td></tr>`;
      return;
    }

    tbody.innerHTML = data
      .map(
        (r) => `<tr>
          <td>${escapeHtml(r.nome)}</td>
          <td class="mono">${escapeHtml(r.slug)}</td>
          <td class="muted">${formatDate(r.created_at)}</td>
        </tr>`
      )
      .join("");
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = (nomeIn?.value || "").trim();
    if (!nome) {
      showErr("Informe o nome da unidade.");
      return;
    }
    const slugRaw = (slugIn?.value || "").trim();
    const slug = slugifyNome(slugRaw || nome);
    showErr("");
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    const { error } = await supabase.from("unidades").insert({ nome, slug });
    if (btn) btn.disabled = false;
    if (error) {
      showErr(error.message || "Não foi possível criar.");
      return;
    }
    nomeIn.value = "";
    if (slugIn) {
      slugIn.value = "";
      slugManual = false;
      slugIn.placeholder = "";
      if (slugHint) slugHint.textContent = "—";
    }
    load();
  });

  load();
})();

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}
