import { getSupabase } from "./auth-client.mjs";
import { politappAuthReady } from "./auth-guard.mjs";
import { loadProfile, listUnidadesForSelect, grupoLabel } from "./org-api.mjs";

/** Legado: diário só no navegador; migrado uma vez para o Supabase. */
const STORAGE_KEY = "politapp.diary.v1";
const MIGRATED_KEY = "politapp.diary.migrated.v1";

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

/**
 * Importa dados antigos do localStorage (mesma chave do modo removido) para a unidade atual.
 * Roda no máximo uma vez por navegador.
 */
async function importLocalDiaryOnce(supabase, unidadeId, userId) {
  if (localStorage.getItem(MIGRATED_KEY)) return;
  let all;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    all = raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.setItem(MIGRATED_KEY, "1");
    return;
  }
  if (!all || typeof all !== "object") {
    localStorage.setItem(MIGRATED_KEY, "1");
    return;
  }

  let hadFailure = false;

  for (const [dataDia, day] of Object.entries(all)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataDia)) continue;
    const tasks = day?.tasks;
    const notes = typeof day?.notes === "string" ? day.notes : "";

    const { count, error: cErr } = await supabase
      .from("tarefas")
      .select("id", { count: "exact", head: true })
      .eq("unidade_id", unidadeId)
      .eq("data_dia", dataDia);
    if (cErr) {
      console.error(cErr);
      hadFailure = true;
      break;
    }

    if (Array.isArray(tasks) && tasks.length && (count ?? 0) === 0) {
      let ord = 0;
      for (const t of tasks) {
        const texto = typeof t.text === "string" ? t.text.trim() : "";
        if (!texto) continue;
        const { error: insErr } = await supabase.from("tarefas").insert({
          unidade_id: unidadeId,
          data_dia: dataDia,
          texto,
          concluida: !!t.done,
          ordem: ord++,
          created_by: userId,
        });
        if (insErr) {
          console.error(insErr);
          hadFailure = true;
          break;
        }
      }
      if (hadFailure) break;
    }

    if (notes.trim()) {
      const { data: existing } = await supabase
        .from("notas_unidade_dia")
        .select("corpo")
        .eq("unidade_id", unidadeId)
        .eq("data_dia", dataDia)
        .maybeSingle();
      if (!existing?.corpo?.trim()) {
        const { error: nErr } = await supabase.from("notas_unidade_dia").upsert(
          {
            unidade_id: unidadeId,
            data_dia: dataDia,
            corpo: notes,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "unidade_id,data_dia" }
        );
        if (nErr) {
          console.error(nErr);
          hadFailure = true;
          break;
        }
      }
    }
  }

  if (!hadFailure) {
    localStorage.setItem(MIGRATED_KEY, "1");
  }
}

function initModoCloud(supabase, session, profile) {
  if (modeBanner) modeBanner.hidden = true;
  if (cloudBar) cloudBar.hidden = false;
  if (elGrupoBadge) elGrupoBadge.textContent = grupoLabel(profile.grupo);
  if (elHeaderP) {
    elHeaderP.innerHTML =
      "Tarefas e anotações por <strong>unidade</strong> e data, guardadas no Supabase (visíveis para o time da mesma unidade).";
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

  fillUnidades().then(async () => {
    if (unidadeId) {
      await importLocalDiaryOnce(supabase, unidadeId, session.user.id);
    }
    loadNotasAndRenderTasks();
  });
}

(async function main() {
  let ready;
  try {
    ready = await politappAuthReady;
  } catch {
    return;
  }

  const supabase = getSupabase();
  const { session } = ready;
  if (!supabase || !session?.user) {
    return;
  }

  const { data: profile, error: pErr } = await loadProfile(supabase, session.user.id);

  if (pErr || !profile) {
    if (modeBanner) {
      modeBanner.hidden = false;
      modeBanner.innerHTML =
        "Não foi possível carregar seu perfil. Confira o script <code>sql/supabase-org-tarefas.sql</code> no Supabase (SQL Editor).";
    }
    return;
  }

  initModoCloud(supabase, session, profile);
})();
