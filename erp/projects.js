const PHASES = [
  ["iniciacao", "Iniciação"], ["planejamento", "Planejamento"], ["execucao", "Execução"],
  ["monitoramento", "Monitoramento"], ["encerramento", "Encerramento"]
];
const phaseLabel = value => PHASES.find(([id]) => id === value)?.[1] || value || "Iniciação";
const dateLabel = value => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "Não definida";
const cents = value => (Number(value || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const node = (tag, className, text) => { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; return element; };

function field(name, label, type = "text", options = []) {
  const wrap = node("label", "field"), caption = node("span", "", label); let input;
  if (type === "textarea") input = document.createElement("textarea");
  else if (type === "select") { input = document.createElement("select"); options.forEach(([value, text]) => input.append(new Option(text, value))); }
  else { input = document.createElement("input"); input.type = type; }
  input.name = name; wrap.append(caption, input); return wrap;
}

export async function renderProjects({ view, api, toast, token }) {
  if (!document.querySelector('link[href^="projects.css"]')) { const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "projects.css?v=20260907-7"; document.head.append(css); }
  view.replaceChildren();
  const toolbar = node("div", "module-toolbar"), intro = node("div");
  intro.append(node("p", "eyebrow-small", "PORTFÓLIO PMI"), node("h2", "module-title", "Projetos, marcos e documentos em uma visão executiva"));
  const add = node("button", "primary", "+ Criar projeto"); toolbar.append(intro, add); view.append(toolbar);
  const formCard = node("section", "card project-form"); formCard.hidden = true;
  const form = node("form", "erp-form");
  [field("title", "Nome do projeto"), field("phase", "Fase atual", "select", PHASES), field("sponsor", "Patrocinador"), field("owner_id", "Gerente responsável"), field("starts_at", "Início", "date"), field("due_at", "Prazo final", "date"), field("budget_cents", "Orçamento em centavos", "number"), field("objective", "Objetivo", "textarea"), field("scope", "Escopo e entregáveis", "textarea")].forEach(x => form.append(x));
  form.elements.title.required = true;
  const formActions = node("div", "form-actions"), save = node("button", "primary", "Salvar projeto"), cancel = node("button", "secondary", "Cancelar"); save.type = "submit"; cancel.type = "button"; formActions.append(cancel, save); form.append(formActions); formCard.append(node("h3", "", "Termo de abertura do projeto"), form); view.append(formCard);
  const summary = node("div", "project-metrics"), calendar = node("section", "card project-calendar"), portfolio = node("div", "project-list"); view.append(summary, calendar, portfolio);
  add.onclick = () => { form.reset(); formCard.hidden = false; form.elements.title.focus(); };
  cancel.onclick = () => formCard.hidden = true;
  form.onsubmit = async event => { event.preventDefault(); save.disabled = true; try { const data = Object.fromEntries(new FormData(form)); data.status = "planejamento"; data.progress = 0; data.description = data.objective; await api("projects", { method: "POST", body: data }); formCard.hidden = true; toast("Projeto criado com sucesso."); await load(); } catch (error) { toast(error.message, true); } finally { save.disabled = false; } };

  async function files(projectId) {
    const response = await fetch(`/api/erp-project-files?_token=${encodeURIComponent(token())}&project_id=${encodeURIComponent(projectId)}&_=${Date.now()}`, { cache: "no-store" });
    const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || "Não foi possível listar os documentos."); return data.items || [];
  }
  async function upload(projectId, stageId, file, button) {
    button.disabled = true; const data = new FormData(); data.append("_token", token()); data.append("project_id", projectId); data.append("stage_id", stageId); data.append("file", file);
    try { const response = await fetch("/api/erp-project-files", { method: "POST", credentials: "include", body: data }); const result = await response.json(); if (!response.ok || !result.ok) throw new Error(result.error); toast("Documento anexado."); await load(); } catch (error) { toast(error.message || "Falha no envio.", true); } finally { button.disabled = false; }
  }
  async function removeFile(id) { if (!confirm("Remover este documento?")) return; try { await fetch("/api/erp-project-files", { method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, _token: token() }) }).then(async response => { const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error); }); toast("Documento removido."); await load(); } catch (error) { toast(error.message, true); } }

  async function load() {
    portfolio.replaceChildren(node("p", "empty", "Carregando portfólio…"));
    try {
      const [{ items: projects = [] }, { items: stages = [] }] = await Promise.all([api("projects"), api("project-stages")]);
      projects.forEach(project => { const projectStages = stages.filter(stage => stage.project_id === project.id); if (projectStages.length) project.progress = Math.round(projectStages.reduce((sum, stage) => sum + Number(stage.progress || 0), 0) / projectStages.length); });
      summary.replaceChildren();
      const active = projects.filter(x => !["concluido", "cancelado"].includes(x.status)).length, late = projects.filter(x => x.due_at && new Date(x.due_at) < new Date() && x.status !== "concluido").length, avg = projects.length ? Math.round(projects.reduce((sum, x) => sum + Number(x.progress || 0), 0) / projects.length) : 0;
      [["Projetos ativos", active], ["Marcos cadastrados", stages.length], ["Progresso médio", `${avg}%`], ["Prazos vencidos", late]].forEach(([label, value]) => { const card = node("article", "card project-stat"); card.append(node("small", "", label), node("strong", "", value)); summary.append(card); });
      calendar.replaceChildren(node("h3", "", "Calendário de marcos")); const dated = stages.filter(x => x.due_at).sort((a, b) => String(a.due_at).localeCompare(String(b.due_at))).slice(0, 8);
      const calendarGrid = node("div", "calendar-strip"); dated.forEach(stage => { const item = node("article", "calendar-item"); item.append(node("time", "", dateLabel(stage.due_at)), node("strong", "", stage.name), node("span", "", phaseLabel(stage.phase))); calendarGrid.append(item); }); if (!dated.length) calendarGrid.append(node("p", "empty", "Adicione etapas com prazos para formar o calendário.")); calendar.append(calendarGrid);
      portfolio.replaceChildren();
      for (const project of projects) portfolio.append(await projectCard(project, stages.filter(x => x.project_id === project.id), await files(project.id)));
      if (!projects.length) portfolio.append(node("section", "card empty-state", "Nenhum projeto cadastrado. Crie o primeiro termo de abertura."));
    } catch (error) { portfolio.replaceChildren(node("section", "card empty", error.message)); }
  }

  async function projectCard(project, stages, documents) {
    const card = node("article", "card project-card"), head = node("div", "project-head"), title = node("div"), actions = node("div", "project-actions");
    title.append(node("span", `phase-badge phase-${project.phase}`, phaseLabel(project.phase)), node("h3", "", project.title), node("p", "", `${project.owner_id || "Sem gerente"} · Patrocínio: ${project.sponsor || "não definido"}`));
    const phaseSelect = document.createElement("select"); phaseSelect.setAttribute("aria-label", "Alterar fase do projeto"); PHASES.forEach(([value, label]) => phaseSelect.append(new Option(label, value))); phaseSelect.value = project.phase || "iniciacao"; phaseSelect.onchange = async () => { try { await api("projects", { method: "PATCH", body: { id: project.id, phase: phaseSelect.value, status: phaseSelect.value === "encerramento" ? "concluido" : "em_andamento" } }); toast("Fase do projeto atualizada."); await load(); } catch (error) { toast(error.message, true); } };
    const remove = node("button", "danger", "Remover"); remove.onclick = async () => { if (!confirm(`Remover o projeto “${project.title}” e suas etapas?`)) return; try { await api("projects", { method: "DELETE", body: { id: project.id } }); toast("Projeto removido."); await load(); } catch (error) { toast(error.message, true); } }; actions.append(phaseSelect, remove); head.append(title, actions); card.append(head);
    const facts = node("div", "project-facts"); [["Prazo", dateLabel(project.due_at)], ["Orçamento", cents(project.budget_cents)], ["Fase", phaseLabel(project.phase)]].forEach(([label, value]) => { const fact = node("div"); fact.append(node("small", "", label), node("strong", "", value)); facts.append(fact); }); card.append(facts);
    const progress = node("div", "project-progress"), bar = node("i"); bar.style.width = `${Math.min(100, Math.max(0, Number(project.progress || 0)))}%`; progress.append(bar); card.append(progress, node("small", "progress-label", `${project.progress || 0}% concluído`));
    const details = document.createElement("details"), summaryNode = document.createElement("summary"); summaryNode.textContent = `Acompanhar projeto · ${stages.length} etapa(s) · ${documents.length} documento(s)`; details.append(summaryNode);
    const phaseTrack = node("div", "phase-track"); PHASES.forEach(([id, label]) => { const phase = node("span", id === project.phase ? "current" : "", label); phaseTrack.append(phase); }); details.append(phaseTrack);
    const stageList = node("div", "stage-list"); for (const stage of stages) stageList.append(stageCard(project, stage, documents.filter(x => x.stage_id === stage.id))); details.append(stageList);
    const stageForm = node("form", "stage-form"); stageForm.append(field("name", "Nome da etapa"), field("phase", "Fase PMI", "select", PHASES), field("owner_id", "Responsável"), field("due_at", "Prazo", "date"), field("progress", "Progresso (%)", "number")); const stageSave = node("button", "secondary", "+ Adicionar etapa"); stageSave.type = "submit"; stageForm.append(stageSave); stageForm.onsubmit = async event => { event.preventDefault(); stageSave.disabled = true; try { const data = Object.fromEntries(new FormData(stageForm)); data.project_id = project.id; data.status = "pendente"; await api("project-stages", { method: "POST", body: data }); toast("Etapa adicionada."); await load(); } catch (error) { toast(error.message, true); } finally { stageSave.disabled = false; } }; details.append(stageForm); card.append(details); return card;
  }

  function stageCard(project, stage, documents) {
    const item = node("article", "stage-card"), head = node("div", "stage-head"), text = node("div"); text.append(node("strong", "", stage.name), node("span", "", `${phaseLabel(stage.phase)} · ${stage.owner_id || "Sem responsável"} · ${dateLabel(stage.due_at)}`));
    const status = document.createElement("select"); [["pendente", "Pendente"], ["em_andamento", "Em andamento"], ["concluida", "Concluída"]].forEach(([value, label]) => status.append(new Option(label, value))); status.value = stage.status; status.onchange = async () => { try { await api("project-stages", { method: "PATCH", body: { id: stage.id, status: status.value, progress: status.value === "concluida" ? 100 : stage.progress } }); toast("Etapa atualizada."); await load(); } catch (error) { toast(error.message, true); } }; head.append(text, status); item.append(head);
    const docs = node("div", "document-list"); documents.forEach(document => { const row = node("div", "document-row"), link = node("a", "", `📎 ${document.file_name}`); link.href = `/api/erp-project-files?id=${encodeURIComponent(document.id)}&_token=${encodeURIComponent(token())}`; const del = node("button", "danger", "×"); del.title = "Remover documento"; del.onclick = () => removeFile(document.id); row.append(link, del); docs.append(row); }); item.append(docs);
    const uploadForm = node("form", "upload-row"), input = document.createElement("input"), button = node("button", "secondary", "Anexar arquivo"); input.type = "file"; input.accept = ".pdf,.jpg,.jpeg,.png,.webp,.gif"; button.type = "submit"; uploadForm.append(input, button); uploadForm.onsubmit = event => { event.preventDefault(); if (input.files[0]) upload(project.id, stage.id, input.files[0], button); else toast("Selecione um arquivo.", true); }; item.append(uploadForm); return item;
  }
  await load();
}
