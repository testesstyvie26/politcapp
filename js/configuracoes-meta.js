const badge = document.getElementById("metaBadge");
const pages = document.getElementById("metaPages");
const connect = document.getElementById("connectMeta");
const disconnect = document.getElementById("disconnectMeta");
const refresh = document.getElementById("refreshMeta");

function escapeHtml(value) { return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function setBadge(text, ok = false) { badge.textContent = text; badge.classList.toggle("ok", ok); }

async function loadStatus() {
  refresh.disabled = true;
  try {
    const response = await fetch("/api/meta-status", { credentials: "include", cache: "no-store" });
    const result = await response.json();
    if (!result.configured) {
      setBadge("Aguardando credenciais no Cloudflare"); connect.hidden = true; disconnect.hidden = true;
      pages.innerHTML = '<p class="empty">Configure os três segredos indicados para habilitar a conexão.</p>'; return;
    }
    connect.hidden = !!result.connected; disconnect.hidden = !result.connected;
    if (!result.connected) {
      setBadge(result.expired ? "Conexão expirada" : "Pronto para conectar");
      pages.innerHTML = '<p class="empty">Clique em “Conectar com a Meta” para selecionar os ativos.</p>'; return;
    }
    setBadge("Conectado", true);
    const rows = result.pages || [];
    pages.innerHTML = rows.length ? rows.map((item) => `<article class="page-item"><strong>${escapeHtml(item.name)}</strong><span>Facebook Page ID: ${escapeHtml(item.id)}</span><span>${item.instagram ? `Instagram: @${escapeHtml(item.instagram.username || item.instagram.id)}` : "Sem conta profissional do Instagram vinculada"}</span></article>`).join("") : '<p class="empty">Conectado, mas nenhuma Página foi autorizada.</p>';
  } catch { setBadge("Serviço Meta indisponível"); }
  finally { refresh.disabled = false; }
}

disconnect.addEventListener("click", async () => {
  disconnect.disabled = true;
  try { await fetch("/api/meta-disconnect", { method: "POST", credentials: "include" }); } finally { disconnect.disabled = false; await loadStatus(); }
});
refresh.addEventListener("click", loadStatus);

const feedback = new URLSearchParams(location.search).get("meta");
if (feedback) history.replaceState(null, "", location.pathname);
loadStatus();

