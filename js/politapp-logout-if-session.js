/**
 * Páginas públicas: mostra "Deslogar" se existir sessão Supabase (sem auth-guard).
 */
import { getSupabase, isAuthConfigured } from "./auth-client.js?v=28";
import { attachPolitappLogoutButton } from "./logout-ui.js?v=28";

(async function () {
  if (!isAuthConfigured()) return;
  const supabase = getSupabase();
  if (!supabase) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return;
  attachPolitappLogoutButton(supabase);
})();
