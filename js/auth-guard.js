/**
 * Acesso ao site apenas com sessão válida (/api/me).
 * Inclua após js/api-config.js. Não inclua em login.html.
 * Nota: proteção real de dados exige checagem no servidor; isto evita uso casual sem login.
 */
(function () {
  var path = (location.pathname || "").toLowerCase();
  if (path.indexOf("login.html") !== -1) return;

  function goLogin() {
    var next = encodeURIComponent(location.pathname + location.search + location.hash);
    location.replace("login.html?next=" + next);
  }

  function apiUrl(p) {
    return typeof politappApiUrl === "function" ? politappApiUrl(p) : p;
  }

  fetch(apiUrl("/api/me"), { credentials: "include" })
    .then(function (r) {
      if (!r.ok) throw new Error("401");
      return r.json();
    })
    .then(function (data) {
      if (!data || !data.user) throw new Error("no user");
    })
    .catch(function () {
      goLogin();
    });
})();
