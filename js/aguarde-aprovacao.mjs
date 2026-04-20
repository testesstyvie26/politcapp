/**
 * Página aguarde-aprovacao: após o auth-guard, volta a ler o perfil e redireciona
 * se já estiver liberado (evita ficar preso quando o primeiro fetch falha ou atrasa).
 */
import { getSupabase } from "./auth-client.mjs";
import { politappAuthReady } from "./auth-guard.mjs";
import { profileAllowsAppAccess } from "./org-api.mjs";

const estadoEl = () => document.getElementById("estadoPerfil");

export async function redirectIfCanEnter() {
  const sb = getSupabase();
  if (!sb) return false;

  await sb.auth.refreshSession().catch(() => {});
  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();
  if (userErr || !user) {
    if (estadoEl()) {
      estadoEl().textContent = userErr
        ? "Sessão: " + userErr.message
        : "Sem utilizador na sessão. Use Sair e entre de novo.";
    }
    return false;
  }

  const { data: profile, error } = await sb
    .from("profiles")
    .select("conta_status, grupo")
    .eq("id", user.id)
    .maybeSingle();

  const el = estadoEl();
  if (el) {
    if (error) {
      el.textContent = "Erro ao ler perfil: " + error.message;
    } else if (!profile) {
      el.textContent =
        "Sem linha em profiles para este login. No Supabase, execute sql/backfill-profiles-from-auth.sql.";
    } else {
      el.textContent = `Estado lido agora: grupo = ${profile.grupo ?? "—"}, conta_status = ${profile.conta_status ?? "—"}`;
    }
  }

  if (profileAllowsAppAccess(profile)) {
    window.location.replace(new URL("index.html", location.href).href);
    return true;
  }
  return false;
}

(async function init() {
  try {
    await politappAuthReady;
  } catch {
    /* redirecionado pelo guard */
  }

  await redirectIfCanEnter();

  document.getElementById("btnRefresh")?.addEventListener("click", async () => {
    if (await redirectIfCanEnter()) return;
    location.reload();
  });

  document.getElementById("btnSair")?.addEventListener("click", async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    window.location.href = "login.html";
  });
})();
