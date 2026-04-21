/**
 * API de dados do Portal da Transparência — cadastro: portaldatransparencia.gov.br/api-de-dados
 * Cole o token entre aspas ou deixe "" e use o campo em transparencia.html (localStorage).
 *
 * CORS: o navegador costuma bloquear chamadas diretas da API. Rode o proxy local:
 *   npm run dev:portal-proxy
 * Em localhost/127.0.0.1/file:// a página usa o proxy em POLITAPP_PORTAL_PROXY_ORIGIN.
 */
window.POLITAPP_PORTAL_TRANSPARENCIA_CHAVE = "";

/** Origem do proxy (npm run dev:portal-proxy). Deixe "" para http://127.0.0.1:8787 */
window.POLITAPP_PORTAL_PROXY_ORIGIN = "";

/** true = sempre chamar a API oficial no browser (pode falhar por CORS em dev). */
window.POLITAPP_PORTAL_FORCE_DIRECT = false;
