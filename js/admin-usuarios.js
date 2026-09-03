import { contaStatusLabel, grupoLabel } from "./org-api.js?v=28";

const tbody = document.getElementById("tbody");
const errEl = document.getElementById("err");
const buscaEl = document.getElementById("busca");
const statusEl = document.getElementById("statusFiltro");
const grupoEl = document.getElementById("grupoFiltro");
const totalEl = document.getElementById("totalUsuarios");
const resultadoEl = document.getElementById("totalResultado");
let usuarios = [];

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function formatDate(value) {
  if (!value) return "—";
  const parsed = new Date(String(value).replace(" ", "T") + (String(value).includes("Z") ? "" : "Z"));
  return Number.isNaN(parsed.getTime()) ? escapeHtml(value) : parsed.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function statusClass(status) {
  return ["aprovado", "pendente", "rejeitado"].includes(status) ? status : "neutro";
}

function render() {
  const query = normalize(buscaEl.value.trim());
  const status = statusEl.value;
  const grupo = grupoEl.value;
  const rows = usuarios.filter((row) => {
    const searchable = normalize([row.nome, row.email, row.unidade_nome, row.metodo_acesso].join(" "));
    return (!query || searchable.includes(query)) && (!status || row.conta_status === status) && (!grupo || row.grupo === grupo);
  });

  totalEl.textContent = String(usuarios.length);
  resultadoEl.textContent = String(rows.length);
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">Nenhum usuário encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((row) => `<tr>
    <td><strong>${escapeHtml(row.nome || "Sem nome")}</strong><small>${escapeHtml(row.email || "—")}</small></td>
    <td>${escapeHtml(grupoLabel(row.grupo))}</td>
    <td>${escapeHtml(row.unidade_nome || "—")}</td>
    <td><span class="status ${statusClass(row.conta_status)}">${escapeHtml(contaStatusLabel(row.conta_status))}</span></td>
    <td>${escapeHtml(row.metodo_acesso || "—")}</td>
    <td>${formatDate(row.created_at)}</td>
    <td>${formatDate(row.ultimo_login)}</td>
  </tr>`).join("");
}

function showError(message) {
  errEl.textContent = message || "";
  errEl.hidden = !message;
}

async function initLocaweb() {
  const { dget } = await import("./locaweb-data.js?v=29");
  const response = await dget("api/admin-usuarios.php");
  if (!response.ok) {
    showError(response.erro || "Não foi possível carregar os usuários.");
    tbody.innerHTML = '<tr><td colspan="7" class="empty">—</td></tr>';
    return;
  }
  usuarios = response.usuarios || [];
  render();
}

async function initSupabase() {
  const { requireAdmin } = await import("./admin-guard.js?v=28");
  const context = await requireAdmin();
  if (!context) return;
  const { data, error } = await context.supabase.from("profiles")
    .select("id, email, grupo, unidade_id, conta_status, updated_at, unidades ( nome )")
    .order("email", { ascending: true });
  if (error) { showError(error.message); return; }
  usuarios = (data || []).map((row) => ({
    ...row,
    nome: "",
    unidade_nome: (Array.isArray(row.unidades) ? row.unidades[0] : row.unidades)?.nome || "—",
    metodo_acesso: "—",
    created_at: row.updated_at,
    ultimo_login: null,
  }));
  render();
}

[buscaEl, statusEl, grupoEl].forEach((element) => element.addEventListener("input", render));
(window.POLITAPP_AUTH_PROVIDER === "locaweb" ? initLocaweb() : initSupabase())
  .catch(() => showError("Não foi possível carregar os usuários."));

