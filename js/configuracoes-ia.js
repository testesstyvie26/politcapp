const $ = (id) => document.getElementById(id);
let tokenStored = false;

function setStatus(message, type = "") { $("gatewayStatus").textContent = message; $("gatewayStatus").className = `status ${type}`.trim(); }
function selectedModel() { return $("modelSelect").value === "__manual__" ? $("manualModel").value.trim() : $("modelSelect").value; }

function renderModels(models, selected) {
  const unique = [...new Set([...(models || []), selected || "hermes-agent"].filter(Boolean))];
  const options = unique.map((id) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = id;
    return option;
  });
  const manual = document.createElement("option");
  manual.value = "__manual__";
  manual.textContent = "Informar identificador manualmente…";
  $("modelSelect").replaceChildren(...options, manual);
  $("modelSelect").value = unique.includes(selected) ? selected : unique[0];
  const count = unique.length;
  $("publishedCount").textContent = `${count} ${count === 1 ? "opção publicada" : "opções publicadas"}`;
  $("modelsHelp").textContent = `${count} ${count === 1 ? "opção publicada" : "opções publicadas"} pelo gateway.`;
}

function updateTokenState() { $("tokenState").hidden = !tokenStored || Boolean($("gatewayToken").value); }
function updateManual() { $("manualModel").hidden = $("modelSelect").value !== "__manual__"; }

async function load() {
  try {
    const response = await fetch("/api/ai-gateway-config", { credentials: "include", cache: "no-store" });
    const data = await response.json();
    if (!data.ok) throw new Error();
    $("gatewayUrl").value = data.gatewayUrl || "";
    tokenStored = !!data.tokenStored;
    updateTokenState();
    renderModels(data.models?.length ? data.models : ["hermes-agent"], data.model || "hermes-agent");
    $("removeGateway").hidden = !data.configured;
    if (data.configured) setStatus(data.testedAt ? "Gateway conectado e configuração protegida." : "Configuração salva sem teste.", "ok");
  } catch { setStatus("Não foi possível carregar a configuração.", "err"); }
}

async function save(test) {
  const model = selectedModel();
  if (!model) { setStatus("Informe o agente ou modelo.", "err"); return; }
  const buttons = [$("connectGateway"), $("saveGateway")]; buttons.forEach((button) => button.disabled = true);
  setStatus(test ? "Conectando ao gateway…" : "Salvando configuração…");
  try {
    const response = await fetch("/api/ai-gateway-config", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gatewayUrl: $("gatewayUrl").value.trim(), token: $("gatewayToken").value, model, test }) });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Não foi possível salvar.");
    $("gatewayToken").value = ""; tokenStored = true; updateTokenState();
    renderModels(data.models?.length ? data.models : [model], model);
    $("removeGateway").hidden = false;
    setStatus(test ? "Conexão realizada. Agentes e modelos atualizados." : "Configuração salva sem testar o gateway.", "ok");
  } catch (error) { setStatus(error.message || "Não foi possível salvar.", "err"); }
  finally { buttons.forEach((button) => button.disabled = false); }
}

$("modelSelect").addEventListener("change", updateManual);
$("gatewayToken").addEventListener("input", updateTokenState);
$("connectGateway").addEventListener("click", () => save(true));
$("saveGateway").addEventListener("click", () => save(false));
$("removeGateway").addEventListener("click", async () => { await fetch("/api/ai-gateway-config", { method: "DELETE", credentials: "include" }); $("gatewayUrl").value = ""; $("gatewayToken").value = ""; tokenStored = false; updateTokenState(); renderModels(["hermes-agent"], "hermes-agent"); $("removeGateway").hidden = true; setStatus("Configuração removida.", "ok"); });
load();
