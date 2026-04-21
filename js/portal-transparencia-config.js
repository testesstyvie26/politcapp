/**
 * POLITAPP_PORTAL_API_BASE — URL do Worker (pode ser só o origin: https://xxx.workers.dev ;
 *   o site acrescenta /api-de-dados automaticamente).
 *
 * POLITAPP_PORTAL_TRANSPARENCIA_CHAVE — token hex (cadastro em portaldatransparencia.gov.br/api-de-dados).
 */
window.POLITAPP_PORTAL_TRANSPARENCIA_CHAVE = "69b06463c532863131b3c668dc6a555a";

/** Worker Cloudflare (deploy: wrangler). O site acrescenta /api-de-dados se faltar. */
window.POLITAPP_PORTAL_API_BASE = "https://politcapp.atendimento-df1.workers.dev";

window.POLITAPP_DEV_SAME_ORIGIN_PORTS = "8787";
window.POLITAPP_PORTAL_PROXY_ORIGIN = "";
window.POLITAPP_PORTAL_FORCE_DIRECT = false;
