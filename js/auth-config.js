/**
 * Configurações de Autenticação Politapp
 * Versão atualizada: Cloudflare Workers (sem dependência Locaweb PHP)
 * 
 * URLs:
 *  - /api/google-start     ← Cloudflare Workers JS (OAuth initiation)
 *  - /api/google-callback  ← Cloudflare Workers JS (OAuth callback)
 * 
 * Fluxo: Frontend → /api/google-start → Google OAuth → /api/google-callback → Frontend
 * 
 * Benefícios:
 * - Zero dependência externa (PHP, MySQL, Locaweb)
 * - Execução na edge network do Cloudflare (baixa latência)
 * - State baseado em cookie assinado (sem KV namespace)
 * - Mais seguro (HMAC signing de cookies)
 */

(function () {
  // Credenciais do Google OAuth (do Google Cloud Console)
  // DEFINA AQUI SEU CLIENT ID DO GOOGLE:
  window.POLITAPP_GOOGLE_CLIENT_ID = window.POLITAPP_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_HERE";
  
  /* ── Provedor de autenticação ────────────────────────────────────────────
   * Agora usa Cloudflare Workers em vez de PHP/Locaweb
   * 
   * Fluxo: Frontend → /api/google-start (Worker) → Google OAuth → /api/google-callback → Frontend
   * 
   * Benefícios:
   * - Zero dependência externa (PHP, MySQL)
   * - Executado na edge network do Cloudflare (baixa latência)
   * - State baseado em cookie (sem KV namespace necessário)
   * - Mais seguro (HMAC signing de cookies)
   */
  
  // Detecta o host atual - NÃO há mais detecção de Locaweb/cmbusinesstoken
  // A sessão e os dados continuam no backend PHP; o callback OAuth ocorre
  // diretamente no domínio do Politapp via Pages Functions.
  window.POLITAPP_AUTH_PROVIDER = window.POLITAPP_AUTH_PROVIDER || "locaweb";
  
  window.POLITAPP_AUTH_BASE = window.POLITAPP_AUTH_BASE ||
    "https://cmbusinesstoken.com/politicapp/php";

  // Autenticação passa pelo próprio domínio para não depender de CORS no navegador.
  window.POLITAPP_AUTH_API_BASE = window.POLITAPP_AUTH_API_BASE || "/api";
  
  // URLs específicas - Cloudflare Workers endpoints (Sempre relativos)
  window.POLITAPP_GOOGLE_START_URL = window.POLITAPP_GOOGLE_START_URL || "/api/google-start";
  window.POLITAPP_GOOGLE_CALLBACK_URL = window.POLITAPP_GOOGLE_CALLBACK_URL || "/api/google-callback";
  
  // Google Client ID must be set for OAuth to work
  // Em produção, defina via variável de ambiente no Cloudflare:
  // window.POLITAPP_GOOGLE_CLIENT_ID = "${process.env.GOOGLE_CLIENT_ID}";
})();
