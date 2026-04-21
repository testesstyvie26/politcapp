/**
 * API de dados do Portal da Transparência — cadastro: portaldatransparencia.gov.br/api-de-dados
 *
 * PRODUÇÃO: preencha POLITAPP_PORTAL_API_BASE com a URL do Worker após deploy (wrangler.toml na raiz):
 *   npx wrangler deploy
 * Use a URL que o Wrangler mostrar, terminando em /api-de-dados, ex.:
 *   https://politapp-portal-transparencia-proxy.<subconta>.workers.dev/api-de-dados
 * Não use só o domínio do site (https://politcapp.com.br/api-de-dados) a menos que o Worker esteja
 * associado a essa rota no Cloudflare — caso contrário recebe 404 HTML do hosting estático.
 */
window.POLITAPP_PORTAL_TRANSPARENCIA_CHAVE = "";

/** Obrigatório em produção. Ex.: "https://xxxx.workers.dev/api-de-dados" */
window.POLITAPP_PORTAL_API_BASE = "";

/** Porta(s) do politapp-dev-server (npm run dev). */
window.POLITAPP_DEV_SAME_ORIGIN_PORTS = "8787";

/** Proxy local (npm run dev:portal-proxy). Deixe "" para http://127.0.0.1:8787 */
window.POLITAPP_PORTAL_PROXY_ORIGIN = "";

/** true = chamar API oficial direto (só útil no servidor da CGU; no browser gera CORS). */
window.POLITAPP_PORTAL_FORCE_DIRECT = false;
