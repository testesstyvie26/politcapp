/** Perfis, grupos e unidades (Supabase). */

export const GRUPO_LABEL = {
  admin: "Administração",
  gestao: "Gestão",
  operacoes: "Operações",
};

export function grupoLabel(codigo) {
  return GRUPO_LABEL[codigo] || codigo || "—";
}

export const CONTA_STATUS_LABEL = {
  pendente: "Aguardando aprovação",
  aprovado: "Aprovada",
  rejeitado: "Recusada",
};

export function contaStatusLabel(codigo) {
  return CONTA_STATUS_LABEL[codigo] || codigo || "—";
}

export async function loadProfile(supabase, userId) {
  return supabase
    .from("profiles")
    .select("grupo, unidade_id, conta_status, unidades ( id, nome, slug )")
    .eq("id", userId)
    .maybeSingle();
}

/** Unidades que o usuário pode escolher na lista de tarefas: todas se admin; senão só a própria. */
export async function listUnidadesForSelect(supabase, profile) {
  if (!profile) return { rows: [], error: new Error("sem perfil") };
  if (profile.grupo === "admin") {
    const { data, error } = await supabase.from("unidades").select("id, nome, slug").order("nome");
    return { rows: data ?? [], error };
  }
  const raw = profile.unidades;
  const u = Array.isArray(raw) ? raw[0] : raw;
  if (profile.unidade_id && u && u.id) {
    return { rows: [u], error: null };
  }
  if (!profile.unidade_id) return { rows: [], error: null };
  const { data, error } = await supabase.from("unidades").select("id, nome, slug").eq("id", profile.unidade_id).maybeSingle();
  return { rows: data ? [data] : [], error };
}
