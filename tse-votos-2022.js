/**
 * Votação nominal — Deputado Federal — 1º turno 2022 (eleição TSE 546).
 * Fonte: https://resultados.tse.jus.br/oficial/ele2022/546/dados-simplificados/
 *
 * `ensureUfs` carrega só as UFs pedidas (ex.: RJ na abertura do index).
 * `load` / `loadFull` mantêm o comportamento anterior: todas as UFs.
 */
(function (global) {
  var TSE_UFS = [
    "ac", "al", "ap", "am", "ba", "ce", "df", "es", "go", "ma", "mt", "ms", "mg",
    "pa", "pb", "pr", "pe", "pi", "rj", "rn", "rs", "ro", "rr", "sc", "sp", "se", "to",
  ];
  var TSE_BASE = "https://resultados.tse.jus.br/oficial/ele2022/546/dados-simplificados";

  var _cache = null;
  var _loading = null;
  var _loadedUfs = new Set();

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

  function emptyCache() {
    return { byKey: new Map(), bySqcand: new Map(), byUf: new Map(), all: [] };
  }

  function ingestJsonIntoCache(cache, ufLower, data) {
    var uf = ufLower.toUpperCase();
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
      cache.all.push(row);
      var k = uf + "|" + normalizeName(c.nm);
      if (!cache.byKey.has(k)) cache.byKey.set(k, row);
      cache.bySqcand.set(row.sqcand, row);
      if (!cache.byUf.has(uf)) cache.byUf.set(uf, []);
      cache.byUf.get(uf).push(row);
    });
  }

  function fetchUfJson(ufLower) {
    var u = String(ufLower).toLowerCase();
    var url = TSE_BASE + "/" + u + "/" + u + "-c0006-e000546-r.json";
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("TSE " + u.toUpperCase() + ": " + res.status);
      return res.json();
    });
  }

  function loadFull() {
    if (_cache && _loadedUfs.size >= TSE_UFS.length) return Promise.resolve(_cache);
    var missing = TSE_UFS.filter(function (u) {
      return !_loadedUfs.has(u.toUpperCase());
    });
    if (!missing.length) return Promise.resolve(_cache);
    if (!_cache) _cache = emptyCache();
    if (_loading) return _loading.then(function () {
      return loadFull();
    });
    _loading = Promise.all(missing.map(fetchUfJson))
      .then(function (arr) {
        missing.forEach(function (uf, idx) {
          ingestJsonIntoCache(_cache, uf, arr[idx]);
          _loadedUfs.add(uf.toUpperCase());
        });
        _loading = null;
        return _cache;
      })
      .catch(function (e) {
        _loading = null;
        throw e;
      });
    return _loading;
  }

  /** Carrega apenas UFs ainda não presentes no cache (ex.: ['rj']). */
  function ensureUfs(ufsLowerArr) {
    if (!ufsLowerArr || !ufsLowerArr.length) return loadFull();
    var need = ufsLowerArr.filter(function (u) {
      return u && !_loadedUfs.has(String(u).toUpperCase());
    });
    if (!need.length) return Promise.resolve(_cache);
    if (!_cache) _cache = emptyCache();
    if (_loading) {
      return _loading.then(function () {
        return ensureUfs(ufsLowerArr);
      });
    }
    _loading = Promise.all(need.map(fetchUfJson))
      .then(function (arr) {
        need.forEach(function (uf, idx) {
          ingestJsonIntoCache(_cache, uf, arr[idx]);
          _loadedUfs.add(uf.toUpperCase());
        });
        _loading = null;
        return _cache;
      })
      .catch(function (e) {
        _loading = null;
        throw e;
      });
    return _loading;
  }

  function loadTseDepFederal2022() {
    return loadFull();
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
    loadFull: loadFull,
    ensureUfs: ensureUfs,
    lookupVote: lookupVote,
    normalizeName: normalizeName,
    siglaFromCc: siglaFromCc,
    isSuplenteTse: isSuplenteTse,
  };
})(typeof window !== "undefined" ? window : globalThis);
