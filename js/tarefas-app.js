import { getSupabase } from "./auth-client.js";
import { politappAuthReady } from "./auth-guard.js";
import { loadProfile, listUnidadesForSelect, grupoLabel } from "./org-api.js";

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
const anuncioAlert = document.getElementById("anuncioAlert");
const anuncioAlertText = document.getElementById("anuncioAlertText");

const LOCAWEB = (window.POLITAPP_AUTH_PROVIDER || "supabase") === "locaweb";

function todayISODate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ── Data-layer: duas implementações, mesma interface ───────────────────── */
async function makeDataLayer(supabase, session) {
  if (LOCAWEB) {
    const { dget, dpost } = await import("./locaweb-data.js?v=1");
    return {
      async listTarefas(uid, dia) {
        const r = await dget(`api/tarefas.php?unidade_id=${encodeURIComponent(uid)}&dia=${encodeURIComponent(dia)}`);
        if (!r.ok) throw new Error(r.erro || "erro");
        return { tarefas: r.tarefas || [], nota: r.nota || "" };
      },
      addTarefa: (uid, dia, texto) => dpost("api/tarefas.php", { action: "add", unidade_id: uid, dia, texto }),
      toggleTarefa: (id, concluida) => dpost("api/tarefas.php", { action: "toggle", id, concluida }),
      delTarefa: (id) => dpost("api/tarefas.php", { action: "del", id }),
      saveNota: (uid, dia, corpo) => dpost("api/tarefas.php", { action: "nota", unidade_id: uid, dia, corpo }),
      async getAnuncio() { const r = await dget("api/anuncio.php"); return r.ok ? (r.mensagem || "") : ""; },
    };
  }
  // Supabase
  return {
    async listTarefas(uid, dia) {
      const { data: tarefas, error } = await supabase.from("tarefas")
        .select("id, texto, concluida, ordem").eq("unidade_id", uid).eq("data_dia", dia).order("ordem", { ascending: true });
      if (error) throw error;
      const { data: notaRow } = await supabase.from("notas_unidade_dia")
        .select("corpo").eq("unidade_id", uid).eq("data_dia", dia).maybeSingle();
      return { tarefas: tarefas || [], nota: notaRow?.corpo ?? "" };
    },
    async addTarefa(uid, dia, texto) {
      const { data: ex } = await supabase.from("tarefas").select("ordem")
        .eq("unidade_id", uid).eq("data_dia", dia).order("ordem", { ascending: false }).limit(1).maybeSingle();
      return supabase.from("tarefas").insert({
        unidade_id: uid, data_dia: dia, texto, concluida: false, ordem: (ex?.ordem ?? -1) + 1, created_by: session.user.id,
      });
    },
    toggleTarefa: (id, concluida) => supabase.from("tarefas").update({ concluida, updated_at: new Date().toISOString() }).eq("id", id),
    delTarefa: (id) => supabase.from("tarefas").delete().eq("id", id),
    saveNota: (uid, dia, corpo) => supabase.from("notas_unidade_dia").upsert(
      { unidade_id: uid, data_dia: dia, corpo, updated_by: session.user.id, updated_at: new Date().toISOString() },
      { onConflict: "unidade_id,data_dia" }),
    async getAnuncio() {
      const { data } = await supabase.from("anuncio_tarefas").select("mensagem").eq("id", 1).maybeSingle();
      return (data?.mensagem ?? "").trim();
    },
  };
}

function setAnuncioVisible(show) {
  if (!anuncioAlert) return;
  show ? anuncioAlert.removeAttribute("hidden") : anuncioAlert.setAttribute("hidden", "");
}
async function loadAnuncio(dl) {
  if (!anuncioAlert || !anuncioAlertText) return;
  try {
    const m = (await dl.getAnuncio()).trim();
    if (m) { anuncioAlertText.textContent = m; setAnuncioVisible(true); } else setAnuncioVisible(false);
  } catch { setAnuncioVisible(false); }
}

function initModoCloud(dl, profile) {
  if (modeBanner) modeBanner.hidden = true;
  if (cloudBar) cloudBar.hidden = false;
  loadAnuncio(dl);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") loadAnuncio(dl); });
  if (elGrupoBadge) elGrupoBadge.textContent = grupoLabel(profile.grupo);
  if (elHeaderP) elHeaderP.innerHTML = "Tarefas e anotações por <strong>unidade</strong> e data, <strong>salvas no banco</strong> — visíveis ao time da mesma unidade.";

  let unidadeId = null, notasTimer = null;
  elDia.value = todayISODate();

  async function fillUnidades() {
    const { rows, error } = await listUnidadesForSelect(getSupabase(), profile);
    selUnidade.innerHTML = "";
    if (error || !rows.length) {
      selUnidade.innerHTML = '<option value="">— Nenhuma unidade —</option>';
      elLista.innerHTML = ""; elVazia.hidden = false;
      elVazia.textContent = "Nenhuma unidade disponível. Um admin precisa criar unidades e atribuir a sua.";
      return;
    }
    rows.forEach((r) => { const o = document.createElement("option"); o.value = r.id; o.textContent = r.nome; selUnidade.appendChild(o); });
    unidadeId = (profile.grupo !== "admin" && profile.unidade_id) ? profile.unidade_id : rows[0].id;
    selUnidade.value = unidadeId;
    selUnidade.disabled = rows.length <= 1;
  }

  async function refresh() {
    const dia = elDia.value || todayISODate();
    if (!unidadeId) return;
    let res;
    try { res = await dl.listTarefas(unidadeId, dia); }
    catch (e) { elVazia.hidden = false; elVazia.textContent = "Erro ao carregar: " + (e.message || e); return; }
    elNotas.value = res.nota || "";
    renderTasks(res.tarefas);
  }

  function renderTasks(tasks) {
    elLista.innerHTML = "";
    const done = tasks.filter((t) => t.concluida).length;
    elProgress.innerHTML = `<strong>${done}</strong> / ${tasks.length} concluída${tasks.length === 1 ? "" : "s"}`;
    if (!tasks.length) { elVazia.hidden = false; elVazia.textContent = "Nenhuma tarefa neste dia. Adicione acima."; return; }
    elVazia.hidden = true;
    tasks.forEach((t) => {
      const li = document.createElement("li");
      li.className = "task-item" + (t.concluida ? " done" : "");
      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = !!t.concluida;
      cb.addEventListener("change", async () => {
        const r = await dl.toggleTarefa(t.id, cb.checked);
        if (r && r.error) { cb.checked = !cb.checked; alert(r.error.message || r.error); return; }
        if (r && r.ok === false) { cb.checked = !cb.checked; alert(r.erro); return; }
        refresh();
      });
      const span = document.createElement("span"); span.className = "task-text"; span.textContent = t.texto;
      const del = document.createElement("button");
      del.type = "button"; del.className = "task-del"; del.setAttribute("aria-label", "Remover"); del.innerHTML = "&times;";
      del.addEventListener("click", async () => {
        const r = await dl.delTarefa(t.id);
        if (r && r.error) { alert(r.error.message || r.error); return; }
        if (r && r.ok === false) { alert(r.erro); return; }
        refresh();
      });
      li.append(cb, span, del); elLista.appendChild(li);
    });
  }

  async function addTask() {
    const text = elNova.value.trim();
    const dia = elDia.value || todayISODate();
    if (!text || !unidadeId) return;
    const r = await dl.addTarefa(unidadeId, dia, text);
    if (r && r.error) { alert(r.error.message || r.error); return; }
    if (r && r.ok === false) { alert(r.erro); return; }
    elNova.value = ""; elNova.focus(); refresh();
  }
  async function saveNotas() {
    const dia = elDia.value || todayISODate();
    if (!unidadeId) return;
    const r = await dl.saveNota(unidadeId, dia, elNotas.value);
    if (r && r.error) console.error(r.error);
  }

  document.getElementById("btnAdd").addEventListener("click", addTask);
  elNova.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addTask(); } });
  elDia.addEventListener("change", refresh);
  selUnidade.addEventListener("change", () => { unidadeId = selUnidade.value || null; refresh(); });
  elNotas.addEventListener("input", () => { clearTimeout(notasTimer); notasTimer = setTimeout(saveNotas, 500); });
  elNotas.addEventListener("blur", saveNotas);
  document.getElementById("tab-t").addEventListener("click", () => {
    document.getElementById("tab-t").setAttribute("aria-selected", "true");
    document.getElementById("tab-n").setAttribute("aria-selected", "false");
    document.getElementById("panel-t").hidden = false; document.getElementById("panel-n").hidden = true;
  });
  document.getElementById("tab-n").addEventListener("click", () => {
    document.getElementById("tab-n").setAttribute("aria-selected", "true");
    document.getElementById("tab-t").setAttribute("aria-selected", "false");
    document.getElementById("panel-n").hidden = false; document.getElementById("panel-t").hidden = true;
  });

  fillUnidades().then(refresh);
}

(async function main() {
  let ready;
  try { ready = await politappAuthReady; } catch { return; }
  const supabase = getSupabase();
  const { session, profile: readyProfile } = ready;
  if (!session?.user) return;

  let profile = readyProfile;
  if (!profile) {
    const { data, error } = await loadProfile(supabase, session.user.id);
    if (error || !data) {
      if (modeBanner) { modeBanner.hidden = false; modeBanner.textContent = "Não foi possível carregar seu perfil."; }
      return;
    }
    profile = data;
  }
  const dl = await makeDataLayer(supabase, session);
  initModoCloud(dl, profile);
})();
