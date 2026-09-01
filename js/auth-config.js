/**
 * Configuracoes de Autenticação Politapp
 * Versao atualizada: Cloudflare Workers (sem dependencia Locaweb PHP)
 * 
 * URLs substituidas:
 *  - antigo: /politicapp/auth/google-start.php   (PHP/Locaweb)  
 *  - novo:    /api/google-start                  (Cloudflare Workers JS)
 *  - antigo: /politicapp/auth/google-callback    (PHP/Locaweb)  
 *  - novo:    /api/google-callback               (Cloudflare Workers JS)
 */
(function () {
  // Credenciais do Google OAuth (do Google Cloud Console)
  window.POLITAPP_GOOGLE_CLIENT_ID = window.POLITAPP_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_HERE";
  
  /* ── Provedor de autenticação ────────────────────────────────────────────
   * Agora usa Cloudflare Workers em vez de PHP/Locaweb
   * 
   * Fluxo: Frontend -> /api/google-start (Worker) -> Google OAuth -> /api/google-callback -> Frontend
   * 
   * Beneficios:
   * - Zero dependencia externa (PHP, MySQL)
   * - Executado na edge network do Cloudflare (baixa latencia)
   * - State baseado em cookie (sem KV namespace necessario)
   * - Mais seguro (HMAC signing de cookies)
   */
  
  var host = location.hostname || "";
  
  // Detecta se estamos no dominio da Locaweb antigo (para compatibilidade durante migracao)
  var naLocaweb =
    /(^|\.)cmbusinesstoken\.com$/i.test(host) ||
    /hospedagemdesites\.ws$/i.test(host);
  
  // Define o provider default
  // 'locaweb' = usa PHP antigo (compatibilidade)
  // 'cloudflare' = usa Workers JS novo (recomendado)
  window.POLITAPP_AUTH_PROVIDER = window.POLITAPP_AUTH_PROVIDER || "cloudflare";
  
  // Base URL para endpoints de auth
  // Se Locaweb: https://cmbusinesstoken.com/politicapp
  // Cloudflare: usa roteamento /api/google-start no mesmo dominio da pagina
  window.POLITAPP_AUTH_BASE = window.POLITAPP_AUTH_BASE ||
    (naLocaweb ?
      "https://cmbusinesstoken.com/politicapp" :
      // Para Cloudflare, o frontend chama /api/google-start (relative ao dominio da pagina)
      "/api/google-start"
    );
  
  // URLs especificas - Cloudflare Workers endpoints
  window.POLITAPP_GOOGLE_START_URL = window.POLITAPP_GOOGLE_START_URL || "/api/google-start";
  window.POLITAPP_GOOGLE_CALLBACK_URL = window.POLITAPP_GOOGLE_CALLBACK_URL || "/api/google-callback";
})();