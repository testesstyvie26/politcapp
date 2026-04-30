/**
 * Persistência das líderanças RJ (Supabase) por unidade — ver sql/supabase-liderancas-rj.sql
 */
import { getSupabase } from "./auth-client.mjs";
import { loadProfile, profileAllowsAppAccess } from "./org-api.mjs";

let ctx = null;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ensureUuid(raw) {
  if (raw && UUID_RE.test(String(raw).trim())) return String(raw).trim();
  return crypto.randomUUID();
}

export async function initLiderancasCloud() {
  ctx = null;
  const supabase = getSupabase();
  if (!supabase) return { ok: false, reason: "no_supabase" };
  const {
    data: { session },
    error: sErr,
  } = await supabase.auth.getSession();
  if (sErr || !session?.user) return { ok: false, reason: "no_session" };
  const { data: profile, error: pErr } = await loadProfile(supabase, session.user.id);
  if (pErr || !profile || !profile.unidade_id) return { ok: false, reason: "no_unidade" };
  if (!profileAllowsAppAccess(profile)) return { ok: false, reason: "sem_acesso" };
  ctx = {
    supabase,
    unidadeId: profile.unidade_id,
    userId: session.user.id,
  };
  return { ok: true, unidadeId: ctx.unidadeId };
}

export function isCloudReady() {
  return ctx != null;
}

/** @returns {Promise<Record<string, Array<object>>>} */
export async function fetchStoreFromCloud() {
  if (!ctx) throw new Error("cloud não inicializado");
  const { data, error } = await ctx.supabase
    .from("liderancas_rj")
    .select("id, municipio_ibge, nome, telefone, partido, observacoes")
    .eq("unidade_id", ctx.unidadeId);
  if (error) throw error;
  const out = {};
  for (const row of data || []) {
    const ib = String(row.municipio_ibge || "").trim();
    if (!ib) continue;
    if (!out[ib]) out[ib] = [];
    out[ib].push({
      id: row.id,
      nome: row.nome,
      telefone: row.telefone || "",
      partido: row.partido || "",
      obs: row.observacoes || "",
      email: "",
    });
  }
  return out;
}

function flattenStore(storeObject, uid) {
  const flat = [];
  for (const ibge of Object.keys(storeObject || {})) {
    const arr = storeObject[ibge];
    if (!Array.isArray(arr)) continue;
    const ib = String(ibge).trim().replace(/\D/g, "").slice(0, 10);
    if (!ib) continue;
    for (const rec of arr) {
      if (!rec || !rec.nome) continue;
      flat.push({
        id: ensureUuid(rec.id),
        unidade_id: ctx.unidadeId,
        municipio_ibge: ib,
        nome: String(rec.nome).trim(),
        telefone: String(rec.telefone || "").trim(),
        partido: String(rec.partido || "").trim(),
        observacoes: String(rec.obs || "").trim(),
        created_by: uid,
      });
    }
  }
  return flat;
}

const CHUNK = 150;

export async function replaceCloudStore(storeObject) {
  if (!ctx) throw new Error("cloud não inicializado");
  const { supabase, unidadeId, userId } = ctx;

  const { error: delErr } = await supabase.from("liderancas_rj").delete().eq("unidade_id", unidadeId);
  if (delErr) throw delErr;

  const flat = flattenStore(storeObject, userId);
  for (let i = 0; i < flat.length; i += CHUNK) {
    const slice = flat.slice(i, i + CHUNK);
    const { error: insErr } = await supabase.from("liderancas_rj").insert(slice);
    if (insErr) throw insErr;
  }
}

window.__politAppLiderancasCloud = {
  initLiderancasCloud,
  isReady: isCloudReady,
  fetchStoreFromCloud,
  replaceCloudStore,
};
