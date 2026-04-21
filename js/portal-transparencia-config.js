/**
 * POLITAPP_PORTAL_API_BASE — copie a URL exata do deploy ou do painel Cloudflare (Workers → o teu worker).
 * Formato: https://<nome-do-worker>.<subconta>.workers.dev/api-de-dados
 * O nome no wrangler.toml é "politapp-portal-transparencia-proxy" → começa por esse URL, não uses "politcapp.workers.dev"
 * a menos que a Cloudflare mostre essa subconta no teu ecrã.
 *
 * POLITAPP_PORTAL_TRANSPARENCIA_CHAVE — token hex (cadastro em portaldatransparencia.gov.br/api-de-dados).
 */
window.POLITAPP_PORTAL_TRANSPARENCIA_CHAVE = "69b06463c532863131b3c668dc6a555a";

/** Depois de: npx wrangler deploy (na raiz do repo). Cole o URL completo; testa no browser antes. */
window.POLITAPP_PORTAL_API_BASE = "https://politcapp.atendimento-df1.workers.dev";

window.POLITAPP_DEV_SAME_ORIGIN_PORTS = "8787";
window.POLITAPP_PORTAL_PROXY_ORIGIN = "";
window.POLITAPP_PORTAL_FORCE_DIRECT = false;
