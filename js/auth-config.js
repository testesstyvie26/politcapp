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

  /* ── Provedor de autenticação (detecção automática por host) ───────────
   * Na Locaweb (cmbusinesstoken.com/politicapp) usa o auth próprio em PHP.
   * Em qualquer outro host (politcapp.com.br / GitHub Pages / localhost)
   * mantém o Supabase. Assim o mesmo repositório serve os dois durante a
   * migração, sem quebrar nada.
   * Para forçar manualmente, defina window.POLITAPP_AUTH_PROVIDER antes
   * de carregar este arquivo.                                            */
  var host = location.hostname || "";
  // Locaweb (mesmo domínio do PHP): cmbusinesstoken.com/politicapp
  var naLocaweb =
    /(^|\.)cmbusinesstoken\.com$/i.test(host) ||
    /hospedagemdesites\.ws$/i.test(host);
  // Front cross-origin (GitHub Pages) que usa o PHP da Locaweb por token
  var crossOrigin =
    /(^|\.)politcapp\.com\.br$/i.test(host) ||
    /\.github\.io$/i.test(host);

  if (naLocaweb) {
    window.POLITAPP_AUTH_PROVIDER = "locaweb";
    // mesmo domínio: PHP em /politicapp/php/
    window.POLITAPP_AUTH_BASE = location.origin + "/politicapp/php";
  } else if (crossOrigin) {
    // front no GitHub Pages → PHP na Locaweb (auth por token Bearer)
    window.POLITAPP_AUTH_PROVIDER = "locaweb";
    window.POLITAPP_AUTH_BASE = "https://cmbusinesstoken.com/politicapp/php";
  } else {
    // localhost / outros: Supabase (não há PHP local)
    window.POLITAPP_AUTH_PROVIDER = window.POLITAPP_AUTH_PROVIDER || "supabase";
    window.POLITAPP_AUTH_BASE = window.POLITAPP_AUTH_BASE || "";
  }
})();
