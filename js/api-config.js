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
