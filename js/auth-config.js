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
})();
