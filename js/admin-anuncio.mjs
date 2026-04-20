import { requireAdmin } from "./admin-guard.mjs";

const txt = document.getElementById("anuncioTexto");
const msg = document.getElementById("anuncioMsg");
const btnSalvar = document.getElementById("anuncioSalvar");
const btnLimpar = document.getElementById("anuncioLimpar");

function showMsg(text, isErr) {
  if (!msg) return;
  msg.hidden = !text;
  msg.textContent = text || "";
  msg.style.color = isErr ? "#f87171" : "var(--muted)";
}

(async function init() {
  const ctx = await requireAdmin();
  if (!ctx) return;
  const { supabase, session } = ctx;

  const { data, error } = await supabase
    .from("anuncio_tarefas")
    .select("mensagem")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    showMsg(error.message || "Não foi possível carregar o anúncio. Execute sql/supabase-anuncio-tarefas.sql.", true);
  } else if (txt && data) {
    txt.value = data.mensagem ?? "";
  }

  async function gravar(mensagem) {
    return supabase.from("anuncio_tarefas").upsert(
      {
        id: 1,
        mensagem,
        atualizado_em: new Date().toISOString(),
        atualizado_por: session.user.id,
      },
      { onConflict: "id" }
    );
  }

  btnSalvar?.addEventListener("click", async () => {
    showMsg("");
    const mensagem = (txt?.value ?? "").slice(0, 2000);
    const { error: upErr } = await gravar(mensagem);
    if (upErr) {
      showMsg(upErr.message, true);
      return;
    }
    showMsg("Publicado. Quem abrir Tarefas verá o aviso no topo.");
  });

  btnLimpar?.addEventListener("click", async () => {
    showMsg("");
    if (txt) txt.value = "";
    const { error: upErr } = await gravar("");
    if (upErr) {
      showMsg(upErr.message, true);
      return;
    }
    showMsg("Anúncio removido.");
  });
})();
