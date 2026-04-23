/**
 * Gera coordenadas de delegacias (amenity=police) e prefeituras (townhall/government)
 * para os 92 municípios do RJ via Nominatim. Respeita ~1,1 s entre pedidos.
 * Uso: node scripts/fetch-rj-dp-pref-nominatim.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UA = { "User-Agent": "PolitcappInsights/1.0 (uso local; dados OSM)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nominatimSearch(q, extra = "") {
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      q: q + extra,
      format: "json",
      limit: "5",
      countrycodes: "br",
      addressdetails: "1",
    });
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return res.json();
}

function pickPolice(results, cityName) {
  const police = results.filter((x) => x.class === "amenity" && x.type === "police");
  if (!police.length) return null;
  const cityLower = cityName.toLowerCase();
  const inCity = police.filter((x) => {
    const d = (x.display_name || "").toLowerCase();
    return d.includes(cityLower) || d.includes("rio de janeiro");
  });
  const pool = inCity.length ? inCity : police;
  return pool.sort((a, b) => (Number(b.importance) || 0) - (Number(a.importance) || 0))[0];
}

function pickPrefeitura(results, cityName) {
  const cityLower = cityName.toLowerCase();
  const scored = results.map((x) => {
    let score = 0;
    const d = (x.display_name || "").toLowerCase();
    const name = (x.name || "").toLowerCase();
    if (x.type === "townhall" || x.type === "government") score += 5;
    if (/prefeitura/.test(name) || /prefeitura/.test(d)) score += 4;
    if (d.includes(cityLower)) score += 3;
    if (d.includes("rio de janeiro")) score += 1;
    return { x, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].x : results[0] || null;
}

const munRes = await fetch(
  "https://servicodados.ibge.gov.br/api/v1/localidades/estados/33/municipios?orderBy=nome"
);
const municipios = await munRes.json();

const outDp = {};
const outPref = {};
const meta = { failedDp: [], failedPref: [] };

for (const m of municipios) {
  const nome = m.nome;
  process.stderr.write(`${nome}… `);

  try {
    const qPol = `delegacia policial ${nome}`;
    let results = await nominatimSearch(qPol, ", Rio de Janeiro, Brasil");
    let best = pickPolice(results, nome);
    if (!best) {
      results = await nominatimSearch(`DP ${nome}`, ", Rio de Janeiro, Brasil");
      best = pickPolice(results, nome);
    }
    if (!best && results[0]) best = results[0];

    if (best) {
      outDp[nome] = {
        nome: best.name ? `${best.name} — ${nome}` : `Delegacia de Polícia — ${nome}`,
        lat: Number(best.lat),
        lng: Number(best.lon),
        osm: `${best.osm_type}/${best.osm_id}`,
      };
    } else {
      meta.failedDp.push(nome);
    }
  } catch (e) {
    meta.failedDp.push(nome + ":" + e.message);
  }

  await sleep(1100);

  try {
    const results = await nominatimSearch(
      `prefeitura municipal ${nome}`,
      ", Rio de Janeiro, Brasil"
    );
    const best = pickPrefeitura(results, nome);
    if (best) {
      outPref[nome] = {
        nome: best.name ? `${best.name} — ${nome}` : `Prefeitura Municipal — ${nome}`,
        lat: Number(best.lat),
        lng: Number(best.lon),
        osm: `${best.osm_type}/${best.osm_id}`,
      };
    } else {
      meta.failedPref.push(nome);
    }
  } catch (e) {
    meta.failedPref.push(nome + ":" + e.message);
  }

  await sleep(1100);
  process.stderr.write("ok\n");
}

const dir = path.join(__dirname, "..", "data");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(
  path.join(dir, "rj-dp-nominatim.json"),
  JSON.stringify({ municipios: outDp, meta }, null, 2),
  "utf8"
);
fs.writeFileSync(
  path.join(dir, "rj-prefeituras-nominatim.json"),
  JSON.stringify({ municipios: outPref, meta }, null, 2),
  "utf8"
);

console.log(JSON.stringify({ dpCount: Object.keys(outDp).length, prefCount: Object.keys(outPref).length, meta }));
