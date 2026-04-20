/**
 * Base URL do backend de autenticação deste repositório (Express em server.js: /api/login, /api/me, …).
 * Não é a API pública da Câmara (dadosabertos.camara.leg.br).
 *
 * - Local (npm start): deixe productionApi vazio; o front usa o mesmo host que o Node.
 * - GitHub Pages: defina a URL HTTPS completa onde o server.js está publicado (Render, Railway, VPS…),
 *   com CORS (ALLOWED_ORIGINS) e sessão cross-site conforme .env.example.
 */
(function () {
  var host = typeof location !== "undefined" ? location.hostname : "";
  var isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    /^192\.168\./.test(host || "");

  /**
   * URL HTTPS do server.js (Express + MySQL), em host separado do site estático.
   *
   * politcapp.com.br no GitHub Pages só entrega HTML/CSS/JS: não existe POST /api/login nesse domínio
   * (o navegador recebe 404/405). Não use a mesma URL do site como productionApi, a menos que um
   * proxy (nginx, Cloudflare) encaminhe /api para o Node na mesma origem.
   *
   * Depois de publicar o backend (Render, Railway, Fly.io, VPS…), coloque aqui a URL base, ex.:
   * "https://politcapp-api.onrender.com"
   */
  var productionApi = "";

  window.POLITAPP_API = isLocal ? "" : productionApi;

  window.politappApiUrl = function (path) {
    var p = path.charAt(0) === "/" ? path : "/" + path;
    var base = (window.POLITAPP_API || "").replace(/\/$/, "");
    return base + p;
  };

  /** Evita open-redirect no ?next= após login (só caminhos relativos ou absolutos no mesmo site). */
  window.politappSafeNext = function (raw) {
    if (raw == null || raw === "") return "";
    try {
      var d = decodeURIComponent(String(raw).trim());
      if (/^[a-z][a-z0-9+.-]*:/i.test(d)) return "";
      if (d.slice(0, 2) === "//") return "";
      if (d.toLowerCase().indexOf("javascript:") === 0) return "";
      return d;
    } catch (e) {
      return "";
    }
  };
})();
