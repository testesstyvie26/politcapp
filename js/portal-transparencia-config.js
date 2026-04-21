/**
 * API de dados do Portal da Transparência — cadastro: portaldatransparencia.gov.br/api-de-dados
 *
 * Produção (https://politcapp.com.br, GitHub Pages, etc.): o navegador bloqueia a API oficial (CORS).
 * Faça deploy do Worker em workers/portal-transparencia-proxy.js e preencha POLITAPP_PORTAL_API_BASE abaixo.
 *
 * Local: npm run dev → http://127.0.0.1:8787/transparencia.html
 */
window.POLITAPP_PORTAL_TRANSPARENCIA_CHAVE = "";

/**
 * URL base até /api-de-dados do seu proxy (Cloudflare Worker). Obrigatório em produção.
 * Ex.: "https://politapp-portal-transparencia-proxy.seu-subdominio.workers.dev/api-de-dados"
 * Deixe "" só para desenvolvimento local (ou a página usa a API direta e tende a falhar fora do CGU).
 */
window.POLITAPP_PORTAL_API_BASE = "";

/** Porta(s) do politapp-dev-server (npm run dev). */
window.POLITAPP_DEV_SAME_ORIGIN_PORTS = "8787";

/** Proxy local isolado (npm run dev:portal-proxy). Deixe "" para http://127.0.0.1:8787 */
window.POLITAPP_PORTAL_PROXY_ORIGIN = "";

/** true = sempre URL direta da API (quase sempre quebra por CORS fora do servidor da CGU). */
window.POLITAPP_PORTAL_FORCE_DIRECT = false;
