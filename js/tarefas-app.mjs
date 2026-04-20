import { getSupabase, isAuthConfigured } from "./auth-client.mjs";
import { politappAuthReady } from "./auth-guard.mjs";
import { loadProfile, listUnidadesForSelect, grupoLabel } from "./org-api.mjs";

const STORAGE_KEY = "politapp.diary.v1";

const elDia = document.getElementById("dia");
const elLista = document.getElementById("lista");
const elVazia = document.getElementById("listaVazia");
const elNova = document.getElementById("novaTarefa");
const elNotas = document.getElementById("notas");
const elProgress = document.getElementById("progress");
const elHeaderP = document.querySelector("header p");
const cloudBar = document.getElementById("cloudBar");
const selUnidade = document.getElementById("selUnidade");
const elGrupoBadge = document.getElementById("grupoBadge");
const modeBanner = document.getElementById("modeBanner");

function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/* ---------- Modo local (localStorage) ---------- */

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function initModoLocal(opts = {}) {
  if (!opts.skipBanner && modeBanner) {
    modeBanner.hidden = false;
    modeBanner.textContent =
      "Modo offline: dados só neste navegador. Entre com sua conta e execute o SQL no Supabase para sincronizar por unidade.";
  }
  if (cloudBar) cloudBar.hidden = true;
  if (elHeaderP) {
    elHeaderP.innerHTML =
      "Checklist com concluído e bloco de notas por data. Os dados ficam salvos apenas neste navegador (localStorage).";
  }

  elDia.value = todayISODate();

  function getDay() {
    return elDia.value || todayISODate();
  }

  function dayData() {
    const all = loadAll();
    const key = getDay();
    if (!all[key]) all[key] = { tasks: [], notes: "" };
    if (!Array.isArray(all[key].tasks)) all[key].tasks = [];
    if (typeof all[key].notes !== "string") all[key].notes = "";
    return { all, key, day: all[key] };
  }

  function persistDay(dayObj) {
    const { all, key } = dayData();
    all[key] = dayObj;
    saveAll(all);
  }

  function updateProgress(tasks) {
    const total = tasks.length;
    const done = tasks.filter((t) => t.done).length;
    elProgress.innerHTML = `<strong>${done}</strong> / ${total} concluída${total === 1 ? "" : "s"}`;
  }

  function render() {
    const { day } = dayData();
    elLista.innerHTML = "";
    elNotas.value = day.notes;
    updateProgress(day.tasks);

    if (!day.tasks.length) {
      elVazia.hidden = false;
      return;
    }
    elVazia.hidden = true;

    day.tasks.forEach((t) => {
      const li = document.createElement("li");
      li.className = "task-item" + (t.done ? " done" : "");
      li.dataset.id = t.id;

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!t.done;
      cb.setAttribute("aria-label", t.done ? "Marcar como pendente" : "Marcar como concluída");
      cb.addEventListener("change", () => {
        t.done = cb.checked;
        persistDay(day);
        li.classList.toggle("done", t.done);
        updateProgress(day.tasks);
      });

      const span = document.createElement("span");
      span.className = "task-text";
      span.textContent = t.text;

      const del = document.createElement("button");
      del.type = "button";
      del.className = "task-del";
      del.setAttribute("aria-label", "Remover tarefa");
      del.innerHTML = "&times;";
      del.addEventListener("click", () => {
        day.tasks = day.tasks.filter((x) => x.id !== t.id);
        persistDay(day);
        render();
      });

      li.appendChild(cb);
      li.appendChild(span);
      li.appendChild(del);
      elLista.appendChild(li);
    });
  }

  function addTask() {
    const text = elNova.value.trim();
    if (!text) return;
    const { all, key, day } = dayData();
    day.tasks.push({ id: uid(), text, done: false });
    all[key] = day;
    saveAll(all);
    elNova.value = "";
    elNova.focus();
    render();
  }

  document.getElementById("btnAdd").addEventListener("click", addTask);
  elNova.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTask();
    }
  });

  elDia.addEventListener("change", () => render());

  elNotas.addEventListener("change", () => {
    const { all, key, day } = dayData();
    day.notes = elNotas.value;
    all[key] = day;
    saveAll(all);
  });

  elNotas.addEventListener("blur", () => elNotas.dispatchEvent(new Event("change")));

  document.getElementById("tab-t").addEventListener("click", () => {
    document.getElementById("tab-t").setAttribute("aria-selected", "true");
    document.getElementById("tab-n").setAttribute("aria-selected", "false");
    document.getElementById("panel-t").hidden = false;
    document.getElementById("panel-n").hidden = true;
  });
  document.getElementById("tab-n").addEventListener("click", () => {
    document.getElementById("tab-n").setAttribute("aria-selected", "true");
    document.getElementById("tab-t").setAttribute("aria-selected", "false");
    document.getElementById("panel-n").hidden = false;
    document.getElementById("panel-t").hidden = true;
  });

  render();
}

/* ---------- Modo Supabase ---------- */

function initModoCloud(supabase, session, profile) {
  if (modeBanner) modeBanner.hidden = true;
  if (cloudBar) cloudBar.hidden = false;
  if (elGrupoBadge) elGrupoBadge.textContent = grupoLabel(profile.grupo);
  if (elHeaderP) {
    elHeaderP.innerHTML =
      "Tarefas e anotações por <strong>unidade</strong> e data, sincronizadas no Supabase (visíveis para o time da mesma unidade).";
  }

  let unidadeId = null;
  let notasTimer = null;

  elDia.value = todayISODate();

  async function fillUnidades() {
    const { rows, error } = await listUnidadesForSelect(supabase, profile);
    selUnidade.innerHTML = "";
    if (error || !rows.length) {
      selUnidade.innerHTML = '<option value="">— Nenhuma unidade —</option>';
      elLista.innerHTML = "";
      elVazia.hidden = false;
      elVazia.textContent =
        "Nenhuma unidade disponível. Um admin deve executar o SQL em sql/supabase-org-tarefas.sql e atribuir sua unidade em Perfis.";
      return;
    }
    rows.forEach((r) => {
      const o = document.createElement("option");
      o.value = r.id;
      o.textContent = r.nome;
      selUnidade.appendChild(o);
    });
    if (profile.grupo !== "admin" && profile.unidade_id) {
      unidadeId = profile.unidade_id;
      selUnidade.value = unidadeId;
      selUnidade.disabled = rows.length <= 1;
    } else {
      unidadeId = rows[0].id;
      selUnidade.value = unidadeId;
      selUnidade.disabled = rows.length <= 1;
    }
  }

  async function loadNotasAndRenderTasks() {
    const dia = elDia.value || todayISODate();
    if (!unidadeId) return;

    const { data: tasks, error: e1 } = await supabase
      .from("tarefas")
      .select("id, texto, concluida, ordem")
      .eq("unidade_id", unidadeId)
      .eq("data_dia", dia)
      .order("ordem", { ascending: true });

    if (e1) {
      console.error(e1);
      elVazia.hidden = false;
      elVazia.textContent = "Erro ao carregar tarefas: " + (e1.message || String(e1));
      return;
    }

    const { data: notaRow } = await supabase
      .from("notas_unidade_dia")
      .select("corpo")
      .eq("unidade_id", unidadeId)
      .eq("data_dia", dia)
      .maybeSingle();

    elNotas.value = notaRow?.corpo ?? "";
    renderCloudTasks(tasks || []);
  }

  function renderCloudTasks(tasks) {
    elLista.innerHTML = "";
    const done = tasks.filter((t) => t.concluida).length;
    elProgress.innerHTML = `<strong>${done}</strong> / ${tasks.length} concluída${tasks.length === 1 ? "" : "s"}`;

    if (!tasks.length) {
      elVazia.hidden = false;
      elVazia.textContent = "Nenhuma tarefa neste dia. Adicione acima.";
      return;
    }
    elVazia.hidden = true;

    tasks.forEach((t) => {
      const li = document.createElement("li");
      li.className = "task-item" + (t.concluida ? " done" : "");

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!t.concluida;
      cb.setAttribute("aria-label", t.concluida ? "Marcar como pendente" : "Marcar como concluída");
      cb.addEventListener("change", async () => {
        const { error } = await supabase
          .from("tarefas")
          .update({ concluida: cb.checked, updated_at: new Date().toISOString() })
          .eq("id", t.id);
        if (error) {
          cb.checked = !cb.checked;
          alert(error.message);
          return;
        }
        loadNotasAndRenderTasks();
      });

      const span = document.createElement("span");
      span.className = "task-text";
      span.textContent = t.texto;

      const del = document.createElement("button");
      del.type = "button";
      del.className = "task-del";
      del.setAttribute("aria-label", "Remover tarefa");
      del.innerHTML = "&times;";
      del.addEventListener("click", async () => {
        const { error } = await supabase.from("tarefas").delete().eq("id", t.id);
        if (error) {
          alert(error.message);
          return;
        }
        loadNotasAndRenderTasks();
      });

      li.appendChild(cb);
      li.appendChild(span);
      li.appendChild(del);
      elLista.appendChild(li);
    });
  }

  async function addTaskCloud() {
    const text = elNova.value.trim();
    const dia = elDia.value || todayISODate();
    if (!text || !unidadeId) return;

    const { data: existing } = await supabase
      .from("tarefas")
      .select("ordem")
      .eq("unidade_id", unidadeId)
      .eq("data_dia", dia)
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrd = (existing?.ordem ?? -1) + 1;

    const { error } = await supabase.from("tarefas").insert({
      unidade_id: unidadeId,
      data_dia: dia,
      texto: text,
      concluida: false,
      ordem: nextOrd,
      created_by: session.user.id,
    });

    if (error) {
      alert(error.message);
      return;
    }
    elNova.value = "";
    elNova.focus();
    loadNotasAndRenderTasks();
  }

  function scheduleNotasSave() {
    clearTimeout(notasTimer);
    notasTimer = setTimeout(saveNotasCloud, 500);
  }

  async function saveNotasCloud() {
    const dia = elDia.value || todayISODate();
    if (!unidadeId) return;
    const { error } = await supabase.from("notas_unidade_dia").upsert(
      {
        unidade_id: unidadeId,
        data_dia: dia,
        corpo: elNotas.value,
        updated_by: session.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "unidade_id,data_dia" }
    );
    if (error) console.error(error);
  }

  document.getElementById("btnAdd").addEventListener("click", addTaskCloud);
  elNova.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTaskCloud();
    }
  });

  elDia.addEventListener("change", () => loadNotasAndRenderTasks());

  selUnidade.addEventListener("change", () => {
    unidadeId = selUnidade.value || null;
    loadNotasAndRenderTasks();
  });

  elNotas.addEventListener("input", scheduleNotasSave);
  elNotas.addEventListener("blur", saveNotasCloud);

  document.getElementById("tab-t").addEventListener("click", () => {
    document.getElementById("tab-t").setAttribute("aria-selected", "true");
    document.getElementById("tab-n").setAttribute("aria-selected", "false");
    document.getElementById("panel-t").hidden = false;
    document.getElementById("panel-n").hidden = true;
  });
  document.getElementById("tab-n").addEventListener("click", () => {
    document.getElementById("tab-n").setAttribute("aria-selected", "true");
    document.getElementById("tab-t").setAttribute("aria-selected", "false");
    document.getElementById("panel-n").hidden = false;
    document.getElementById("panel-t").hidden = true;
  });

  fillUnidades().then(() => loadNotasAndRenderTasks());
}

/* ---------- Entrada ---------- */

(async function main() {
  try {
    await politappAuthReady;
  } catch {
    return;
  }

  if (!isAuthConfigured()) {
    initModoLocal();
    return;
  }

  const supabase = getSupabase();
  if (!supabase) {
    initModoLocal();
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    initModoLocal();
    return;
  }

  const { data: profile, error: pErr } = await loadProfile(supabase, session.user.id);

  if (pErr || !profile) {
    initModoLocal({ skipBanner: true });
    if (modeBanner) {
      modeBanner.hidden = false;
      modeBanner.innerHTML =
        "Perfil não encontrado no banco. Execute o script <code>sql/supabase-org-tarefas.sql</code> no Supabase (SQL Editor) e faça login de novo. Modo local ativo.";
    }
    return;
  }

  initModoCloud(supabase, session, profile);
})();
