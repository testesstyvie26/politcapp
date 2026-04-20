/**
 * - Local (npm start): deixe productionApi vazio; as chamadas vão para o mesmo host.
 * - GitHub Pages: defina productionApi com a URL HTTPS do seu backend (Node + MySQL em Render, Railway, VPS…).
 */
(function () {
  var host = typeof location !== "undefined" ? location.hostname : "";
  var isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    /^192\.168\./.test(host || "");

  var productionApi = "";

  window.POLITAPP_API = isLocal ? "" : productionApi;

  window.politappApiUrl = function (path) {
    var p = path.charAt(0) === "/" ? path : "/" + path;
    var base = (window.POLITAPP_API || "").replace(/\/$/, "");
    return base + p;
  };
})();
