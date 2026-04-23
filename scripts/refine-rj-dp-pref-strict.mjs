/**
 * Refina DP e prefeituras: só aceita amenity=police (DP) ou townhall/government adequado (prefeitura).
 * Sem usar relation como pin. Fallback: centro administrativo do município (place=town etc.).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UA = { "User-Agent": "PolitcappInsights/1.0 (uso local OSM)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function search(params) {
  const url = "https://nominatim.openstreetmap.org/search?" + new URLSearchParams(params);
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

function norm(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function pickPolice(results, cityName) {
  const pol = results.filter((x) => x.class === "amenity" && x.type === "police");
  if (!pol.length) return null;
  const n = norm(cityName);
  const parts = n.split(/\s+/).filter((p) => p.length > 2);
  const scored = pol.map((x) => {
    const d = norm(x.display_name);
    let score = 0;
    if (d.includes(n)) score += 10;
    for (const p of parts) {
      if (d.includes(p)) score += 2;
    }
    score += Number(x.importance) || 0;
    return { x, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].x;
}

function pickTownhall(results, cityName) {
  const cand = results.filter((x) => {
    if (x.class !== "amenity") return false;
    return x.type === "townhall" || x.type === "public_building" || x.type === "government";
  });
  const n = norm(cityName);
  const withPref = cand.filter((x) => /prefeitura|pa[cç]o municipal|executivo/i.test(x.name || x.display_name || ""));
  const pool = withPref.length ? withPref : cand;
  if (!pool.length) return null;
  const scored = pool.map((x) => {
    const d = norm(x.display_name);
    let score = 0;
    if (d.includes(n)) score += 8;
    if (/prefeitura/i.test(x.name || "")) score += 4;
    score += Number(x.importance) || 0;
    return { x, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.x || null;
}

async function municipalCenter(cityName) {
  const results = await search({
    q: `${cityName}, Rio de Janeiro, Brasil`,
    format: "json",
    limit: "8",
    countrycodes: "br",
    addressdetails: "1",
  });
  const n = norm(cityName);
  const admin = results.find(
    (x) =>
      (x.type === "administrative" || x.type === "city" || x.type === "town") &&
      norm(x.display_name).includes(n)
  );
  return admin || results[0] || null;
}

const munRes = await fetch(
  "https://servicodados.ibge.gov.br/api/v1/localidades/estados/33/municipios?orderBy=nome"
);
const municipios = await munRes.json();

const outDp = {};
const outPref = {};
const meta = { dpFallback: [], prefFallback: [] };

for (const m of municipios) {
  const nome = m.nome;
  process.stderr.write(`${nome}… `);

  let results = await search({
    q: `delegacia de polícia ${nome} Rio de Janeiro`,
    format: "json",
    limit: "20",
    countrycodes: "br",
    addressdetails: "1",
  });
  let p = pickPolice(results, nome);
  if (!p) {
    await sleep(1100);
    results = await search({
      q: `delegacia policial ${nome} RJ`,
      format: "json",
      limit: "20",
      countrycodes: "br",
    });
    p = pickPolice(results, nome);
  }

  if (p) {
    const label = p.name && !p.name.includes(nome) ? `${p.name} — ${nome}` : p.name || `Delegacia de Polícia — ${nome}`;
    outDp[nome] = {
      nome: label.includes(nome) ? label : `${label} — ${nome}`,
      lat: Number(p.lat),
      lng: Number(p.lon),
    };
  } else {
    const c = await municipalCenter(nome);
    await sleep(1100);
    if (c) {
      meta.dpFallback.push(nome);
      outDp[nome] = {
        nome: `Delegacia de Polícia — ${nome} (ref. centro urbano OSM — confirmar unidade no mapa)`,
        lat: Number(c.lat),
        lng: Number(c.lon),
      };
    }
  }

  await sleep(1100);

  results = await search({
    q: `prefeitura municipal ${nome} Rio de Janeiro`,
    format: "json",
    limit: "20",
    countrycodes: "br",
  });
  let t = pickTownhall(results, nome);
  if (!t) {
    t = results.find(
      (x) =>
        x.class === "amenity" &&
        /prefeitura/i.test((x.name || "") + (x.display_name || "")) &&
        norm(x.display_name).includes(norm(nome).split(" ")[0])
    );
  }

  if (t) {
    const wrong =
      norm(nome) === "barra mansa" &&
      /volta redonda/i.test(norm(t.display_name)) &&
      !/barra mansa/i.test(norm(t.display_name));
    if (wrong) t = null;
  }

  if (t) {
    outPref[nome] = {
      nome: t.name ? `${t.name} — ${nome}` : `Prefeitura Municipal — ${nome}`,
      lat: Number(t.lat),
      lng: Number(t.lon),
    };
  } else {
    const c = await municipalCenter(nome);
    await sleep(1100);
    meta.prefFallback.push(nome);
    if (c) {
      outPref[nome] = {
        nome: `Prefeitura Municipal — ${nome} (ref. centro urbano OSM)`,
        lat: Number(c.lat),
        lng: Number(c.lon),
      };
    }
  }

  await sleep(1100);
  process.stderr.write("ok\n");
}

const dir = path.join(__dirname, "..", "data");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(
  path.join(dir, "rj-dp-refined.json"),
  JSON.stringify({ municipios: outDp, meta }, null, 2),
  "utf8"
);
fs.writeFileSync(
  path.join(dir, "rj-pref-refined.json"),
  JSON.stringify({ municipios: outPref, meta }, null, 2),
  "utf8"
);
console.log(
  JSON.stringify({
    dp: Object.keys(outDp).length,
    pref: Object.keys(outPref).length,
    meta,
  })
);
