const COLUMNS = [
  ["rascunho", "Rascunhos", "Preparação"],
  ["revisando", "Em revisão", "Aguardando validação"],
  ["aprovado", "Aprovados", "Prontos para uso"],
  ["arquivado", "Arquivados", "Histórico"],
];

if (!document.querySelector('link[data-documents-ux]')) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "/erp/documents-ux.css?v=20260907-13";
  stylesheet.dataset.documentsUx = "true";
  document.head.append(stylesheet);
}

const formatSize = value => {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};
const formatDate = value => value ? new Date(`${String(value).replace(" ", "T")}Z`).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
const node = (tag, className, text) => { const item = document.createElement(tag); if (className) item.className = className; if (text !== undefined) item.textContent = text; return item; };

export async function renderDocuments({ view, token, toast, role }) {
  let documents = [];
  const authToken = () => typeof token === "function" ? token() : token;

  async function request(action, { method = "GET", data = {}, form } = {}) {
    const auth = authToken() || "";
    const query = new URLSearchParams({ action, _token: auth, ...(method === "GET" ? data : {}) });
    const options = { method, credentials: "include", cache: "no-store", headers: { "Cache-Control": "no-cache" } };
    if (form) {
      form.set("action", action); form.set("_token", auth); options.body = form;
    } else if (method === "POST") {
      const body = new FormData();
      for (const [key, value] of Object.entries({ action, _token: auth, ...data })) body.set(key, value ?? "");
      options.body = body;
    }
    const response = await fetch(`/api/erp-documents?${query}`, options);
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || result.erro || "Não foi possível concluir a operação.");
    return result;
  }

  view.replaceChildren();
  const intro = node("section", "documents-intro card");
  const introText = node("div");
  introText.append(node("span", "eyebrow", "ARQUIVO DIGITAL DO GABINETE"), node("h2", "", "Documentos organizados, revisados e rastreáveis"), node("p", "", "Compartilhe arquivos com a equipe, acompanhe aprovações e recupere qualquer versão anterior."));
  const uploadButton = node("button", "primary", "+ Guardar documento"); uploadButton.type = "button";
  intro.append(introText, uploadButton);

  const controls = node("div", "documents-controls");
  const search = document.createElement("input"); search.type = "search"; search.placeholder = "Buscar por título, categoria ou arquivo"; search.setAttribute("aria-label", "Buscar documentos");
  const statusFilter = document.createElement("select"); statusFilter.setAttribute("aria-label", "Filtrar por situação");
  statusFilter.append(new Option("Todas as situações", ""), ...COLUMNS.map(([value, label]) => new Option(label, value)));
  const totals = node("span", "documents-total", "Carregando…");
  const filters = node("div", "documents-filters"); filters.append(search, statusFilter);
  controls.append(filters, totals);
  const board = node("div", "documents-board");
  view.append(intro, controls, board);

  const dialog = document.createElement("dialog"); dialog.className = "document-dialog";
  dialog.innerHTML = `<form method="dialog" class="dialog-shell"><header><div><span class="eyebrow">NOVO REGISTRO</span><h2>Guardar documento</h2></div><button class="dialog-close" value="cancel" aria-label="Fechar">×</button></header><div class="document-form-grid"><label><span>Título</span><input name="titulo" maxlength="200" required></label><label><span>Categoria</span><input name="categoria" maxlength="80" placeholder="Ex.: contrato, ofício, prestação de contas"></label><label class="wide"><span>Descrição</span><textarea name="descricao" maxlength="5000" rows="3" placeholder="Contexto para a equipe"></textarea></label><label><span>Compartilhamento</span><select name="visibilidade"><option value="gabinete">Todo o gabinete</option><option value="restrito">Somente autor e gestão</option></select></label><label><span>Arquivo (máx. 8 MB)</span><input name="arquivo" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp" required></label></div><footer><button value="cancel" class="secondary">Cancelar</button><button value="default" class="primary save-document">Guardar no MySQL</button></footer></form>`;
  document.body.append(dialog);
  const createForm = dialog.querySelector("form");
  uploadButton.onclick = () => { createForm.reset(); dialog.showModal(); setTimeout(() => createForm.elements.titulo.focus(), 30); };
  createForm.addEventListener("submit", async event => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const save = createForm.querySelector(".save-document"); save.disabled = true; save.textContent = "Enviando…";
    try { await request("upload", { method: "POST", form: new FormData(createForm) }); dialog.close(); toast("Documento guardado com a versão 1."); await load(); }
    catch (error) { toast(error.message, true); }
    finally { save.disabled = false; save.textContent = "Guardar no MySQL"; }
  });

  const detailDialog = document.createElement("dialog"); detailDialog.className = "document-dialog document-detail-dialog"; document.body.append(detailDialog);

  async function download(version) {
    try {
      toast(`Preparando ${version.nome_arquivo}…`);
      const query = new URLSearchParams({ action: "download", version_id: version.id, _token: authToken() || "" });
      const response = await fetch(`/api/erp-documents?${query}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || result.erro || "Download indisponível."); }
      const url = URL.createObjectURL(await response.blob()), anchor = document.createElement("a");
      anchor.href = url; anchor.download = version.nome_arquivo; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (error) { toast(error.message, true); }
  }

  async function openDetails(item) {
    detailDialog.innerHTML = `<section class="dialog-shell detail-loading">Carregando histórico…</section>`; detailDialog.showModal();
    try {
      const { item: doc, versions } = await request("detail", { data: { id: item.id } });
      detailDialog.replaceChildren();
      const shell = node("section", "dialog-shell");
      const header = node("header"); const heading = node("div"); heading.append(node("span", "eyebrow", doc.categoria || "DOCUMENTO"), node("h2", "", doc.titulo));
      const close = node("button", "dialog-close", "×"); close.type = "button"; close.setAttribute("aria-label", "Fechar"); close.onclick = () => detailDialog.close(); header.append(heading, close);
      const meta = node("div", "document-detail-meta"); meta.append(node("span", `doc-status status-${doc.status}`, COLUMNS.find(x => x[0] === doc.status)?.[1] || doc.status), node("span", "", doc.visibilidade === "restrito" ? "🔒 Restrito" : "♟ Compartilhado com o gabinete"), node("span", "", `${versions.length} versão(ões)`));
      if (doc.descricao) meta.append(node("p", "", doc.descricao));
      const newVersion = node("form", "new-version-form");
      newVersion.innerHTML = `<div><strong>Enviar nova versão</strong><small>O arquivo atual continuará disponível no histórico.</small></div><input type="file" name="arquivo" required accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp"><input type="text" name="observacao" maxlength="500" placeholder="O que mudou nesta versão?"><button class="primary">Enviar versão</button>`;
      newVersion.onsubmit = async event => { event.preventDefault(); const button = newVersion.querySelector("button"); button.disabled = true; try { const form = new FormData(newVersion); form.set("document_id", doc.id); await request("upload", { method: "POST", form }); toast("Nova versão armazenada."); detailDialog.close(); await load(); await openDetails(doc); } catch (error) { toast(error.message, true); } finally { button.disabled = false; } };
      const history = node("div", "version-history"); history.append(node("h3", "", "Histórico de versões"));
      for (const version of versions) {
        const row = node("article", "version-row"), text = node("div");
        text.append(node("strong", "", `Versão ${version.numero} · ${version.nome_arquivo}`), node("span", "", `${formatSize(version.tamanho)} · ${formatDate(version.created_at)}${version.observacao ? ` · ${version.observacao}` : ""}`));
        const button = node("button", "secondary", "↓ Baixar"); button.type = "button"; button.onclick = () => download(version); row.append(text, button); history.append(row);
      }
      const footer = node("footer");
      if (["admin", "gestao"].includes(role)) { const remove = node("button", "danger", "Remover documento"); remove.type = "button"; remove.onclick = async () => { if (!confirm(`Remover “${doc.titulo}” e todas as versões?`)) return; try { await request("delete", { method: "POST", data: { id: doc.id } }); detailDialog.close(); toast("Documento removido."); await load(); } catch (error) { toast(error.message, true); } }; footer.append(remove); }
      const done = node("button", "secondary", "Fechar"); done.type = "button"; done.onclick = () => detailDialog.close(); footer.append(done);
      shell.append(header, meta, newVersion, history, footer); detailDialog.append(shell);
    } catch (error) { detailDialog.close(); toast(error.message, true); }
  }

  async function move(id, status) {
    try { await request("status", { method: "POST", data: { id, status } }); toast(status === "aprovado" ? "Documento aprovado." : "Documento movido."); await load(); }
    catch (error) { toast(error.message, true); await load(); }
  }

  function render() {
    const term = search.value.trim().toLocaleLowerCase("pt-BR");
    const selectedStatus = statusFilter.value;
    const visible = documents.filter(item => (!selectedStatus || item.status === selectedStatus) && `${item.titulo} ${item.categoria || ""} ${item.nome_arquivo || ""}`.toLocaleLowerCase("pt-BR").includes(term));
    totals.textContent = `${visible.length} documento${visible.length === 1 ? "" : "s"}`; board.replaceChildren();
    for (const [status, label, description] of COLUMNS) {
      const column = node("section", `document-column status-${status}`); column.dataset.status = status;
      column.ondragover = event => { event.preventDefault(); column.classList.add("drop-target"); };
      column.ondragleave = event => { if (!column.contains(event.relatedTarget)) column.classList.remove("drop-target"); };
      column.ondrop = event => { event.preventDefault(); column.classList.remove("drop-target"); const id = event.dataTransfer.getData("text/document-id"); if (id) move(id, status); };
      const entries = visible.filter(item => item.status === status), header = node("header", "document-column-head");
      const title = node("div"); title.append(node("strong", "", label), node("small", "", description)); header.append(title, node("span", "", String(entries.length))); column.append(header);
      const cards = node("div", "document-cards");
      for (const item of entries) {
        const card = node("article", "document-card"); card.draggable = true;
        card.ondragstart = event => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/document-id", item.id); card.classList.add("dragging"); };
        card.ondragend = () => { card.classList.remove("dragging"); document.querySelectorAll(".drop-target").forEach(x => x.classList.remove("drop-target")); };
        const category = node("div", "document-card-top"); category.append(node("span", "doc-category", item.categoria || "Geral"), node("span", "doc-visibility", item.visibilidade === "restrito" ? "🔒" : "♟"));
        const open = node("button", "document-title", item.titulo); open.type = "button"; open.onclick = () => openDetails(item);
        const file = node("p", "document-file", item.nome_arquivo || "Sem arquivo");
        const meta = node("div", "document-card-meta"); meta.append(node("span", "", `v${item.versao_atual}`), node("span", "", `${item.total_versoes} versão(ões)`), node("span", "", formatSize(item.tamanho)));
        const updated = node("small", "document-updated", `Atualizado ${formatDate(item.updated_at)}`);
        const actions = node("div", "document-card-actions"); const details = node("button", "secondary", "Ver versões"); details.type = "button"; details.onclick = () => openDetails(item); actions.append(details);
        if (item.version_id) { const latest = node("button", "secondary", "↓"); latest.type = "button"; latest.title = "Baixar versão atual"; latest.onclick = () => download({ id: item.version_id, nome_arquivo: item.nome_arquivo }); actions.append(latest); }
        const moveLabel = node("label", "document-move"); moveLabel.append(node("span", "", "Mover para"));
        const moveSelect = document.createElement("select"); moveSelect.setAttribute("aria-label", `Mover ${item.titulo}`);
        for (const [value, columnLabel] of COLUMNS) { const option = new Option(columnLabel, value); option.selected = value === item.status; moveSelect.append(option); }
        moveSelect.onchange = () => move(item.id, moveSelect.value); moveLabel.append(moveSelect);
        card.append(category, open, file, meta, updated, moveLabel, actions); cards.append(card);
      }
      if (!entries.length) cards.append(node("p", "document-empty", "Arraste um documento para esta etapa")); column.append(cards); board.append(column);
    }
  }

  async function load() {
    board.classList.add("is-loading");
    try { const result = await request("list"); documents = result.items || []; render(); }
    catch (error) { board.replaceChildren(node("section", "card empty", error.message)); totals.textContent = "Indisponível"; }
    finally { board.classList.remove("is-loading"); }
  }

  search.oninput = render;
  statusFilter.onchange = render;
  await load();
}
