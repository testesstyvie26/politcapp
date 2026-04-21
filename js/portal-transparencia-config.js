/**
 * API de dados do Portal da Transparência — cadastro: portaldatransparencia.gov.br/api-de-dados
 *
 * GitHub Pages: o navegador não pode chamar a API oficial (CORS). Use uma destas opções:
 *   1) Deploy do Worker em workers/portal-transparencia-proxy.js (Cloudflare) e preencha POLITAPP_PORTAL_API_BASE abaixo.
 *   2) Desenvolvimento local: npm run dev → http://127.0.0.1:8787/transparencia.html
 */
window.POLITAPP_PORTAL_TRANSPARENCIA_CHAVE = "";

/**
 * Produção (ex.: https://usuario.github.io/repositorio/): URL completa até /api-de-dados, apontando para seu proxy.
 * Ex.: "https://politapp-pt-proxy.seu-subdominio.workers.dev/api-de-dados"
 * Deixe "" para modo automático (localhost, file, ou API direta — em github.io a direta costuma falhar).
 */
window.POLITAPP_PORTAL_API_BASE = "";

/** Porta(s) do politapp-dev-server (npm run dev). */
window.POLITAPP_DEV_SAME_ORIGIN_PORTS = "8787";

/** Proxy local isolado (npm run dev:portal-proxy). Deixe "" para http://127.0.0.1:8787 */
window.POLITAPP_PORTAL_PROXY_ORIGIN = "";

/** true = sempre URL direta da API (quase sempre quebra por CORS fora do servidor da CGU). */
window.POLITAPP_PORTAL_FORCE_DIRECT = false;
