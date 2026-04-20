/**
 * Votação nominal — Deputado Federal — 1º turno 2022 (eleição TSE 546).
 * Fonte: https://resultados.tse.jus.br/oficial/ele2022/546/dados-simplificados/
 */
(function (global) {
  var TSE_UFS = [
    "ac", "al", "ap", "am", "ba", "ce", "df", "es", "go", "ma", "mt", "ms", "mg",
    "pa", "pb", "pr", "pe", "pi", "rj", "rn", "rs", "ro", "rr", "sc", "sp", "se", "to",
  ];
  var TSE_BASE = "https://resultados.tse.jus.br/oficial/ele2022/546/dados-simplificados";

  var _cache = null;
  var _loading = null;

  function normalizeName(s) {
    if (!s) return "";
    return s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseVap(v) {
    if (v == null || v === "") return null;
    var n = parseInt(String(v).replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }

  function siglaFromCc(cc) {
    if (!cc) return "—";
    var i = cc.indexOf(" - ");
    return i > 0 ? cc.slice(0, i).trim() : cc.trim();
  }

  function loadTseDepFederal2022() {
    if (_cache) return Promise.resolve(_cache);
    if (_loading) return _loading;

    _loading = Promise.all(
      TSE_UFS.map(function (uf) {
        var url = TSE_BASE + "/" + uf + "/" + uf + "-c0006-e000546-r.json";
        return fetch(url).then(function (res) {
          if (!res.ok) throw new Error("TSE " + uf.toUpperCase() + ": " + res.status);
          return res.json();
        });
      })
    ).then(function (arr) {
      var byKey = new Map();
      var bySqcand = new Map();
      var byUf = new Map();
      var all = [];

      arr.forEach(function (data, idx) {
        var uf = TSE_UFS[idx].toUpperCase();
        var cands = data.cand || [];
        cands.forEach(function (c) {
          var row = {
            uf: uf,
            sqcand: String(c.sqcand),
            n: c.n,
            nm: c.nm,
            cc: c.cc,
            st: c.st,
            dvt: c.dvt,
            vap: parseVap(c.vap),
            pvap: c.pvap,
          };
          all.push(row);
          var k = uf + "|" + normalizeName(c.nm);
          if (!byKey.has(k)) byKey.set(k, row);
          bySqcand.set(row.sqcand, row);
          if (!byUf.has(uf)) byUf.set(uf, []);
          byUf.get(uf).push(row);
        });
      });

      _cache = { byKey: byKey, bySqcand: bySqcand, byUf: byUf, all: all };
      _loading = null;
      return _cache;
    });

    return _loading;
  }

  function lookupVote(cache, uf, names) {
    if (!cache || !uf) return null;
    var U = uf.toUpperCase();
    for (var i = 0; i < names.length; i++) {
      var nm = names[i];
      if (!nm) continue;
      var k = U + "|" + normalizeName(nm);
      if (cache.byKey.has(k)) return cache.byKey.get(k);
    }
    return null;
  }

  function isSuplenteTse(st) {
    if (!st) return false;
    var s = String(st).toLowerCase();
    return s.indexOf("suplente") !== -1;
  }

  global.TSE2022DF = {
    load: loadTseDepFederal2022,
    lookupVote: lookupVote,
    normalizeName: normalizeName,
    siglaFromCc: siglaFromCc,
    isSuplenteTse: isSuplenteTse,
  };
})(typeof window !== "undefined" ? window : globalThis);
