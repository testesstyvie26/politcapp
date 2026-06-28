/** Anúncio/mural (admin). Provider-aware: locaweb=PHP, supabase=antigo. */
const txt = document.getElementById("anuncioTexto");
const msg = document.getElementById("anuncioMsg");
const btnSalvar = document.getElementById("anuncioSalvar");
const btnLimpar = document.getElementById("anuncioLimpar");

const LOCAWEB = (window.POLITAPP_AUTH_PROVIDER || "supabase") === "locaweb";

function showMsg(text, isErr) {
  if (!msg) return;
  msg.hidden = !text; msg.textContent = text || "";
  msg.style.color = isErr ? "#f87171" : "var(--muted)";
}

function wire(getLoadErr, gravar) {
  btnSalvar?.addEventListener("click", async () => {
    showMsg("");
    const r = await gravar((txt?.value ?? "").slice(0, 2000));
    if (r) { showMsg(r, true); return; }
    showMsg("Publicado. Quem abrir Tarefas verá o aviso no topo.");
  });
  btnLimpar?.addEventListener("click", async () => {
    showMsg(""); if (txt) txt.value = "";
    const r = await gravar("");
    if (r) { showMsg(r, true); return; }
    showMsg("Anúncio removido.");
  });
  if (getLoadErr) showMsg(getLoadErr, true);
}

async function initLocaweb() {
  const { dget, dpost } = await import("./locaweb-data.js?v=28");
  const r = await dget("api/anuncio.php");
  let loadErr = "";
  if (!r.ok) loadErr = r.erro || "Não foi possível carregar o anúncio.";
  else if (txt) txt.value = r.mensagem || "";
  wire(loadErr, async (mensagem) => {
    const up = await dpost("api/anuncio.php", { mensagem });
    return up.ok ? null : (up.erro || "Erro ao salvar.");
  });
}

async function initSupabase() {
  const { requireAdmin } = await import("./admin-guard.js?v=28");
  const ctx = await requireAdmin(); if (!ctx) return;
  const { supabase, session } = ctx;
  const { data, error } = await supabase.from("anuncio_tarefas").select("mensagem").eq("id", 1).maybeSingle();
  let loadErr = "";
  if (error) loadErr = error.message || "Não foi possível carregar o anúncio.";
  else if (txt && data) txt.value = data.mensagem ?? "";
  wire(loadErr, async (mensagem) => {
    const { error: upErr } = await supabase.from("anuncio_tarefas").upsert(
      { id: 1, mensagem, atualizado_em: new Date().toISOString(), atualizado_por: session.user.id }, { onConflict: "id" });
    return upErr ? upErr.message : null;
  });
}

(LOCAWEB ? initLocaweb() : initSupabase());
