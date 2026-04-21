/**
 * API de dados do Portal da Transparência — cadastro: portaldatransparencia.gov.br/api-de-dados
 *
 * Produção em politcapp.com.br: a base do proxy assume automaticamente o próprio site
 * (https://politcapp.com.br/api-de-dados) — no Cloudflare, publique o Worker na rota /api-de-dados/* desse domínio.
 * Outros hosts: faça deploy do Worker (workers/) e defina POLITAPP_PORTAL_API_BASE abaixo se necessário.
 *
 * Local: npm run dev → http://127.0.0.1:8787/transparencia.html
 */
window.POLITAPP_PORTAL_TRANSPARENCIA_CHAVE = "69b06463c532863131b3c668dc6a555a";

/**
 * Base até /api-de-dados. Em politcapp.com.br fica vazio no arquivo: o script abaixo usa location.origin.
 * Em outro domínio, use a URL do Worker, ex.: "https://….workers.dev/api-de-dados"
 */
window.POLITAPP_PORTAL_API_BASE = "";

/** Porta(s) do politapp-dev-server (npm run dev). */
window.POLITAPP_DEV_SAME_ORIGIN_PORTS = "8787";

/** Proxy local isolado (npm run dev:portal-proxy). Deixe "" para http://127.0.0.1:8787 */
window.POLITAPP_PORTAL_PROXY_ORIGIN = "";

/** true = sempre URL direta da API (quase sempre quebra por CORS fora do servidor da CGU). */
window.POLITAPP_PORTAL_FORCE_DIRECT = false;

(function politappPortalApiBaseDefault() {
  var manual = window.POLITAPP_PORTAL_API_BASE;
  if (typeof manual === "string" && manual.trim() !== "") return;
  try {
    var h = window.location.hostname;
    if (h === "politcapp.com.br" || h === "www.politcapp.com.br") {
      window.POLITAPP_PORTAL_API_BASE = window.location.origin + "/api-de-dados";
    }
  } catch (e) {}
})();
