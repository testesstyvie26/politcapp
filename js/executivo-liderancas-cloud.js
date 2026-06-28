/**
 * Persistência das lideranças RJ por unidade. Provider-aware:
 *   locaweb  → API PHP (api/liderancas.php)
 *   supabase → Supabase (fluxo antigo)
 */
import { getSupabase } from "./auth-client.js?v=28";
import { loadProfile, profileAllowsAppAccess } from "./org-api.js?v=28";

const LOCAWEB = (window.POLITAPP_AUTH_PROVIDER || "supabase") === "locaweb";
let ctx = null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function ensureUuid(raw) { return raw && UUID_RE.test(String(raw).trim()) ? String(raw).trim() : crypto.randomUUID(); }

export async function initLiderancasCloud() {
  ctx = null;
  if (LOCAWEB) {
    const { dget } = await import("./locaweb-data.js?v=28");
    const r = await dget("auth/me.php");
    if (!r || !r.ok || !r.autenticado) return { ok: false, reason: "no_session" };
    const p = r.profile || {};
    if (!p.unidade_id) return { ok: false, reason: "no_unidade" };
    if (!profileAllowsAppAccess(p)) return { ok: false, reason: "sem_acesso" };
    ctx = { mode: "locaweb", unidadeId: p.unidade_id };
    return { ok: true, unidadeId: p.unidade_id };
  }
  const supabase = getSupabase();
  if (!supabase) return { ok: false, reason: "no_supabase" };
  const { data: { session }, error: sErr } = await supabase.auth.getSession();
  if (sErr || !session?.user) return { ok: false, reason: "no_session" };
  const { data: profile, error: pErr } = await loadProfile(supabase, session.user.id);
  if (pErr || !profile || !profile.unidade_id) return { ok: false, reason: "no_unidade" };
  if (!profileAllowsAppAccess(profile)) return { ok: false, reason: "sem_acesso" };
  ctx = { mode: "supabase", supabase, unidadeId: profile.unidade_id, userId: session.user.id };
  return { ok: true, unidadeId: ctx.unidadeId };
}

export function isCloudReady() { return ctx != null; }

export async function fetchStoreFromCloud() {
  if (!ctx) throw new Error("cloud não inicializado");
  if (ctx.mode === "locaweb") {
    const { dget } = await import("./locaweb-data.js?v=28");
    const r = await dget("api/liderancas.php");
    if (!r.ok) throw new Error(r.erro || "erro");
    return r.store || {};
  }
  const { data, error } = await ctx.supabase
    .from("liderancas_rj")
    .select("id, municipio_ibge, nome, telefone, partido, observacoes")
    .eq("unidade_id", ctx.unidadeId);
  if (error) throw error;
  const out = {};
  for (const row of data || []) {
    const ib = String(row.municipio_ibge || "").trim();
    if (!ib) continue;
    (out[ib] ||= []).push({
      id: row.id, nome: row.nome, telefone: row.telefone || "", partido: row.partido || "", obs: row.observacoes || "", email: "",
    });
  }
  return out;
}

export async function replaceCloudStore(storeObject) {
  if (!ctx) throw new Error("cloud não inicializado");
  if (ctx.mode === "locaweb") {
    const { dpost } = await import("./locaweb-data.js?v=28");
    const r = await dpost("api/liderancas.php", { action: "replace", store: storeObject || {} });
    if (!r.ok) throw new Error(r.erro || "erro ao salvar");
    return;
  }
  const { supabase, unidadeId, userId } = ctx;
  const { error: delErr } = await supabase.from("liderancas_rj").delete().eq("unidade_id", unidadeId);
  if (delErr) throw delErr;
  const flat = [];
  for (const ibge of Object.keys(storeObject || {})) {
    const arr = storeObject[ibge];
    if (!Array.isArray(arr)) continue;
    const ib = String(ibge).trim().replace(/\D/g, "").slice(0, 10);
    if (!ib) continue;
    for (const rec of arr) {
      if (!rec || !rec.nome) continue;
      flat.push({
        id: ensureUuid(rec.id), unidade_id: unidadeId, municipio_ibge: ib,
        nome: String(rec.nome).trim(), telefone: String(rec.telefone || "").trim(),
        partido: String(rec.partido || "").trim(), observacoes: String(rec.obs || "").trim(), created_by: userId,
      });
    }
  }
  const CHUNK = 150;
  for (let i = 0; i < flat.length; i += CHUNK) {
    const { error: insErr } = await supabase.from("liderancas_rj").insert(flat.slice(i, i + CHUNK));
    if (insErr) throw insErr;
  }
}

window.__politAppLiderancasCloud = { initLiderancasCloud, isReady: isCloudReady, fetchStoreFromCloud, replaceCloudStore };
