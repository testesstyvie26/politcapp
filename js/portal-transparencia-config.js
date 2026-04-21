/**
 * Dois valores diferentes:
 *
 * POLITAPP_PORTAL_API_BASE — URL do proxy Cloudflare até /api-de-dados (não é o token).
 * POLITAPP_PORTAL_TRANSPARENCIA_CHAVE — token hex recebido por e-mail no cadastro da API.
 *
 * Cadastro token: https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email
 */
window.POLITAPP_PORTAL_TRANSPARENCIA_CHAVE = "69b06463c532863131b3c668dc6a555a";

/** URL completa do Worker, ex.: https://xxxx.workers.dev/api-de-dados */
window.POLITAPP_PORTAL_API_BASE = "https://portal-transparencia-proxy.politcapp.workers.dev/api-de-dados";

/** Porta(s) do politapp-dev-server (npm run dev). */
window.POLITAPP_DEV_SAME_ORIGIN_PORTS = "8787";

/** Proxy local (npm run dev:portal-proxy). Deixe "" para http://127.0.0.1:8787 */
window.POLITAPP_PORTAL_PROXY_ORIGIN = "";

/** true = chamar API oficial direto (no browser costuma dar CORS). */
window.POLITAPP_PORTAL_FORCE_DIRECT = false;
