/**
 * Disparo de WhatsApp por click-to-chat (wa.me) — Politapp
 * ---------------------------------------------------------------------------
 * Funciona em site estático: NÃO usa token nem API. Para cada contato de
 * `liderancas_rj` (escopo da unidade do usuário), monta um link wa.me com a
 * mensagem já preenchida; o operador revisa e envia manualmente.
 *
 * Conformidade: envio assistido (humano no loop). Respeite opt-in, LGPD e a
 * legislação eleitoral. Disparo automático/massa exige backend + Cloud API +
 * templates aprovados pela Meta (a ser feito após a migração Locaweb).
 */
import { getSupabase } from "./auth-client.js";
import { loadProfile, profileAllowsAppAccess } from "./org-api.js";

const $ = (id) => document.getElementById(id);

/** Normaliza telefone BR para o formato que o wa.me espera (só dígitos, com 55). */
export function normalizePhoneBR(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  // remove zeros de operadora/tronco à esquerda
  d = d.replace(/^0+/, "");
  // já vem com DDI 55?
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  // DDD + número (10 ou 11 dígitos) -> prefixa 55
  if (d.length === 10 || d.length === 11) return "55" + d;
  // 8/9 dígitos (sem DDD) -> não dá para inferir DDD com segurança
  return d.length >= 12 ? d : "";
}

/** Aplica campos {{nome}} / {{primeiro_nome}} / {{partido}} / {{municipio}}. */
export function renderTemplate(tpl, contato) {
  const primeiro = String(contato.nome || "").trim().split(/\s+/)[0] || "";
  return String(tpl || "")
    .replaceAll("{{nome}}", contato.nome || "")
    .replaceAll("{{primeiro_nome}}", primeiro)
    .replaceAll("{{partido}}", contato.partido || "")
    .replaceAll("{{municipio}}", contato.municipio_ibge || "");
}

export function waLink(phoneNorm, texto) {
  return `https://wa.me/${phoneNorm}?text=${encodeURIComponent(texto)}`;
}

let state = { contatos: [], fila: [], idx: 0 };

function setMsg(msg, kind) {
  const el = $("waDispStatus");
  if (!el) return;
  el.textContent = msg || "";
  el.className = kind || "";
}

async function carregarContatos() {
  setMsg("Carregando contatos da unidade…");
  const supabase = getSupabase();
  if (!supabase) { setMsg("Supabase indisponível (verifique a configuração).", "err"); return; }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) { setMsg("Sessão expirada — entre novamente.", "err"); return; }
  const { data: profile, error: pErr } = await loadProfile(supabase, session.user.id);
  if (pErr || !profile?.unidade_id) { setMsg("Sem unidade vinculada ao seu perfil.", "err"); return; }
  if (!profileAllowsAppAccess(profile)) { setMsg("Conta sem acesso aprovado.", "err"); return; }

  const { data, error } = await supabase
    .from("liderancas_rj")
    .select("id, nome, telefone, partido, municipio_ibge")
    .eq("unidade_id", profile.unidade_id)
    .order("nome", { ascending: true });
  if (error) { setMsg("Erro ao carregar contatos: " + error.message, "err"); return; }

  state.contatos = (data || []).map((r) => ({
    ...r,
    fone: normalizePhoneBR(r.telefone),
  }));
  renderLista();
  const comFone = state.contatos.filter((c) => c.fone).length;
  setMsg(`${state.contatos.length} contato(s) · ${comFone} com telefone válido.`, "ok");
}

function renderLista() {
  const tb = $("waContatosBody");
  if (!tb) return;
  if (!state.contatos.length) {
    tb.innerHTML = '<tr><td colspan="4" class="muted" style="text-align:center;padding:1rem">Nenhum contato em liderancas_rj para esta unidade.</td></tr>';
    return;
  }
  tb.innerHTML = state.contatos.map((c, i) => `
    <tr>
      <td><input type="checkbox" class="wa-cb" data-i="${i}" ${c.fone ? "checked" : "disabled"} /></td>
      <td>${esc(c.nome)}${c.partido ? ` <span class="muted">· ${esc(c.partido)}</span>` : ""}</td>
      <td class="mono">${c.fone ? "+" + esc(c.fone) : '<span class="muted">sem telefone</span>'}</td>
      <td>${c.fone ? `<a class="btn btn-wa" style="padding:.3rem .6rem;font-size:.8rem" target="_blank" rel="noopener" href="${waLink(c.fone, previewTexto(c))}"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Abrir</a>` : ""}</td>
    </tr>`).join("");
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
}

function previewTexto(contato) {
  return renderTemplate($("waMensagem")?.value || "", contato);
}

function selecionados() {
  const ids = [...document.querySelectorAll(".wa-cb:checked")].map((cb) => Number(cb.dataset.i));
  return ids.map((i) => state.contatos[i]).filter((c) => c && c.fone);
}

/* ── Fila de disparo assistido (um por vez) ───────────────────────────── */
function iniciarFila() {
  const sel = selecionados();
  if (!sel.length) { setMsg("Selecione ao menos um contato com telefone.", "err"); return; }
  if (!$("waMensagem").value.trim()) { setMsg("Escreva a mensagem antes de disparar.", "err"); return; }
  state.fila = sel;
  state.idx = 0;
  $("waFilaBox").hidden = false;
  mostrarAtual();
}

function mostrarAtual() {
  const c = state.fila[state.idx];
  const total = state.fila.length;
  if (!c) { finalizarFila(); return; }
  $("waFilaInfo").innerHTML = `Contato <strong>${state.idx + 1}</strong> de <strong>${total}</strong>: ${esc(c.nome)} <span class="mono muted">+${esc(c.fone)}</span>`;
  const link = waLink(c.fone, renderTemplate($("waMensagem").value, c));
  $("waFilaAbrir").href = link;
}

function proximo() {
  state.idx++;
  if (state.idx >= state.fila.length) finalizarFila();
  else mostrarAtual();
}

function finalizarFila() {
  $("waFilaBox").hidden = true;
  setMsg(`Disparo concluído (${state.fila.length} contato(s) percorridos).`, "ok");
  state.fila = []; state.idx = 0;
}

export function initWhatsAppDisparo() {
  if (!$("waMensagem")) return; // seção não está na página
  $("btnWaCarregar")?.addEventListener("click", carregarContatos);
  $("waMensagem")?.addEventListener("input", () => { renderLista(); });
  $("waSelTodos")?.addEventListener("change", (e) => {
    document.querySelectorAll(".wa-cb:not([disabled])").forEach((cb) => { cb.checked = e.target.checked; });
  });
  $("btnWaIniciar")?.addEventListener("click", iniciarFila);
  $("waFilaAbrir")?.addEventListener("click", () => { $("waFilaProximo").disabled = false; });
  $("waFilaProximo")?.addEventListener("click", proximo);
  $("waFilaCancelar")?.addEventListener("click", finalizarFila);
  carregarContatos();
}

initWhatsAppDisparo();
