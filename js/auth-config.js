/**
 * Credenciais do projeto Supabase (Authentication → Providers → Google).
 * Checklist de URLs e Google: docs/supabase-login-setup.md
 *
 * 1) Project Settings → API: URL e chave publishable (ou anon legado)
 * 2) Authentication → URL Configuration: Redirect URLs com a URL exata de login.html
 * 3) Authentication → Providers → Google + Google Cloud (redirect = …/auth/v1/callback no Supabase)
 */
(function () {
  window.POLITAPP_SUPABASE_URL = "https://koqkdqrcuplhtjggvora.supabase.co";
  window.POLITAPP_SUPABASE_ANON_KEY = "sb_publishable_V5zHA8tmZs2KHWlbVU9nig_fAQkBbrV";

  /* ── Provedor de dados/autenticação ────────────────────────────────────
   * Locaweb (PHP + MySQL) em TODOS os hosts — o Supabase não é mais usado
   * em runtime (código antigo fica só como fallback inerte).
   *   • cmbusinesstoken.com/politicapp → same-origin (PHP em /politicapp/php)
   *   • qualquer outro host (politcapp.com.br, GitHub Pages, localhost) →
   *     cross-origin para o PHP da Locaweb, via token.
   * Para forçar Supabase em dev, defina window.POLITAPP_AUTH_PROVIDER="supabase"
   * antes de carregar este arquivo.                                       */
  var host = location.hostname || "";
  var naLocaweb =
    /(^|\.)cmbusinesstoken\.com$/i.test(host) ||
    /hospedagemdesites\.ws$/i.test(host);

  window.POLITAPP_AUTH_PROVIDER = window.POLITAPP_AUTH_PROVIDER || "locaweb";
  window.POLITAPP_AUTH_BASE = window.POLITAPP_AUTH_BASE ||
    (naLocaweb ? (location.origin + "/politicapp/php") : "https://cmbusinesstoken.com/politicapp/php");
})();
