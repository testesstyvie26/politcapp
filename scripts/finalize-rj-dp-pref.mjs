/**
 * Cruza DP/prefeituras refinadas com centróide IBGE (malha v3).
 * Descarta pin de DP absurdamente longe do município; aplica overrides manuais.
 * Saída: data/rj-dp-final.json, data/rj-pref-final.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const IBGE_MALHA =
  "https://servicodados.ibge.gov.br/api/v3/malhas/estados/33?intrarregiao=municipio&qualidade=intermediaria&formato=application/vnd.geo+json";
const IBGE_MUN = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/33/municipios?orderBy=nome";

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Centróide aproximado (anel externo do 1º polígono). */
function ringCentroid(ring) {
  let sLat = 0;
  let sLng = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    sLng += ring[i][0];
    sLat += ring[i][1];
  }
  return { lat: sLat / n, lng: sLng / n };
}

function featureCentroid(f) {
  const g = f.geometry;
  if (g.type === "Polygon") return ringCentroid(g.coordinates[0]);
  if (g.type === "MultiPolygon") return ringCentroid(g.coordinates[0][0]);
  return null;
}

const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Overrides manuais conferidos (OSM / endereço oficial). */
const DP_OVERRIDE = {
  Carmo: {
    nome: "112ª DP — Carmo (R. Alceu Matos, 99 — Bela Vista, 28640-000)",
    lat: -21.930137,
    lng: -42.609191,
  },
  "Rio de Janeiro": { nome: "4ª DP — Saara / Centro (PCERJ)", lat: -22.9035, lng: -43.1785 },
  Niterói: { nome: "76ª DP — Centro (Niterói)", lat: -22.8848, lng: -43.1035 },
  "São Gonçalo": { nome: "72ª DP — São Gonçalo", lat: -22.8266, lng: -43.0536 },
  "Duque de Caxias": { nome: "61ª DP — Duque de Caxias", lat: -22.7855, lng: -43.3116 },
  "Nova Iguaçu": { nome: "62ª DP — Nova Iguaçu", lat: -22.7598, lng: -43.4512 },
  "Belford Roxo": { nome: "64ª DP — Belford Roxo", lat: -22.7644, lng: -43.3996 },
  "São João de Meriti": { nome: "63ª DP — São João de Meriti", lat: -22.8044, lng: -43.373 },
  Queimados: { nome: "65ª DP — Queimados", lat: -22.716, lng: -43.5552 },
  Nilópolis: { nome: "66ª DP — Nilópolis", lat: -22.8074, lng: -43.4138 },
  Mesquita: { nome: "67ª DP — Mesquita", lat: -22.7838, lng: -43.4294 },
  Cantagalo: {
    nome: "Delegacia de Polícia — Cantagalo (ref. centro urbano — confirme unidade no mapa)",
    lat: -21.9811,
    lng: -42.3672,
  },
  "Cabo Frio": {
    nome: "126ª Delegacia Policial — Cabo Frio (OSM; confirme plantão / número no PCERJ)",
    lat: -22.889955,
    lng: -42.034249,
  },
  "Santo Antônio de Pádua": {
    nome: "Delegacia de Polícia — Santo Antônio de Pádua (OSM amenity=police)",
    lat: -21.538189,
    lng: -42.181132,
  },
};

const PREF_OVERRIDE = {
  "Barra Mansa": {
    nome: "Prefeitura Municipal de Barra Mansa — Barra Mansa",
    lat: -22.5482,
    lng: -44.1758,
  },
  Niterói: { nome: "Prefeitura de Niterói — Niterói", lat: -22.8839, lng: -43.1034 },
  "Rio de Janeiro": {
    nome: "Prefeitura da Cidade do Rio de Janeiro — Cidade Nova",
    lat: -22.9057,
    lng: -43.1725,
  },
  "Três Rios": {
    nome: "Prefeitura Municipal de Três Rios — Três Rios",
    lat: -22.1169,
    lng: -43.2087,
  },
  Piraí: {
    nome: "Prefeitura Municipal de Piraí — Piraí",
    lat: -22.628444,
    lng: -43.898246,
  },
};

const PREF_BLOCK_WRONG = [
  { mun: "Barra Mansa", ifMatch: (n) => norm(n).includes("volta redonda") && !norm(n).includes("barra mansa") },
  { mun: "Três Rios", ifMatch: (n) => /comendador levy/i.test(n) },
];

const [geoRes, munRes, dpRaw, prefRaw] = await Promise.all([
  fetch(IBGE_MALHA),
  fetch(IBGE_MUN),
  fs.promises.readFile(path.join(__dirname, "..", "data", "rj-dp-refined.json"), "utf8"),
  fs.promises.readFile(path.join(__dirname, "..", "data", "rj-pref-refined.json"), "utf8"),
]);

const geo = await geoRes.json();
const municipios = await munRes.json();
const idToNome = new Map(municipios.map((m) => [String(m.id), m.nome]));

const ibgeCentroid = {};
for (const f of geo.features || []) {
  const id = String(f.properties?.codarea ?? "");
  const nome = idToNome.get(id);
  if (!nome) continue;
  const c = featureCentroid(f);
  if (c) ibgeCentroid[nome] = c;
}

const refinedDp = JSON.parse(dpRaw).municipios;
const refinedPref = JSON.parse(prefRaw).municipios;

/** DPs fora deste raio do centróide IBGE são descartadas (ex.: homônimos «89ª DP» em Resende para Barra Mansa). */
const MAX_DP_KM = 18;
const MAX_PREF_KM = 28;

const dpFinal = {};
const prefFinal = {};
const meta = { dpReplaced: [], prefReplaced: [] };

for (const m of municipios) {
  const nome = m.nome;
  const cen = ibgeCentroid[nome];
  if (!cen) continue;

  if (DP_OVERRIDE[nome]) {
    dpFinal[nome] = { ...DP_OVERRIDE[nome] };
  } else {
    let d = refinedDp[nome];
    if (d) {
      const dist = haversineKm(d.lat, d.lng, cen.lat, cen.lng);
      const badLabel =
        /quissam[aã]/i.test(d.nome) ||
        (nome === "Cardoso Moreira" && /itaperuna/i.test(d.nome)) ||
        dist > MAX_DP_KM;
      if (badLabel) {
        const reason =
          /quissam[aã]/i.test(d.nome) || (nome === "Cardoso Moreira" && /itaperuna/i.test(d.nome))
            ? "rótulo/homônimo"
            : `dist ${dist.toFixed(1)} km`;
        meta.dpReplaced.push({ nome, reason });
        d = {
          nome: `Delegacia de Polícia — ${nome} (ref. centróide IBGE — confirme a unidade no Google Maps)`,
          lat: cen.lat,
          lng: cen.lng,
        };
      }
    } else {
      d = {
        nome: `Delegacia de Polícia — ${nome} (ref. centróide IBGE — confirme a unidade no Google Maps)`,
        lat: cen.lat,
        lng: cen.lng,
      };
    }
    dpFinal[nome] = d;
  }

  if (PREF_OVERRIDE[nome]) {
    prefFinal[nome] = { ...PREF_OVERRIDE[nome] };
  } else {
    let p = refinedPref[nome];
    const block = PREF_BLOCK_WRONG.find((x) => x.mun === nome && x.ifMatch(p?.nome || ""));
    if (block || !p) {
      meta.prefReplaced.push(nome);
      p = {
        nome: `Prefeitura Municipal — ${nome} (ref. centróide IBGE)`,
        lat: cen.lat,
        lng: cen.lng,
      };
    } else {
      const dist = haversineKm(p.lat, p.lng, cen.lat, cen.lng);
      if (dist > MAX_PREF_KM) {
        meta.prefReplaced.push(nome);
        p = {
          nome: `Prefeitura Municipal — ${nome} (ref. centróide IBGE)`,
          lat: cen.lat,
          lng: cen.lng,
        };
      }
    }
    prefFinal[nome] = p;
  }
}

const dir = path.join(__dirname, "..", "data");
fs.writeFileSync(path.join(dir, "rj-dp-final.json"), JSON.stringify({ municipios: dpFinal, meta }, null, 2));
fs.writeFileSync(
  path.join(dir, "rj-pref-final.json"),
  JSON.stringify({ municipios: prefFinal, meta }, null, 2)
);

const MESO_IBGE_PARA_INSIGHTS = {
  Baixadas: "Baixada Fluminense",
  "Baixadas Litorâneas": "Baixada Fluminense",
  "Centro Fluminense": "Centro Fluminense",
  Metropolitana: "Metropolitana do Rio de Janeiro",
  "Metropolitana do Rio de Janeiro": "Metropolitana do Rio de Janeiro",
  Norte: "Norte Fluminense",
  "Norte Fluminense": "Norte Fluminense",
  Noroeste: "Noroeste Fluminense",
  "Noroeste Fluminense": "Noroeste Fluminense",
  Sul: "Sul Fluminense",
  "Sul Fluminense": "Sul Fluminense",
};

function r6(x) {
  return Math.round(Number(x) * 1e6) / 1e6;
}

function mesoInsightKey(nomeIbge) {
  if (!nomeIbge || nomeIbge === "—") return "Centro Fluminense";
  if (MESO_IBGE_PARA_INSIGHTS[nomeIbge]) return MESO_IBGE_PARA_INSIGHTS[nomeIbge];
  return nomeIbge || "Centro Fluminense";
}

const mesoPorCidade = {};
for (const m of municipios) {
  const nomeIbge = m.microrregiao?.mesorregiao?.nome ?? m.microrregiao?.nome ?? "—";
  mesoPorCidade[m.nome] = mesoInsightKey(nomeIbge);
}

const prefPois = [];
for (const m of municipios) {
  const cidade = m.nome;
  const p = prefFinal[cidade];
  if (!p) continue;
  prefPois.push({
    nome: (p.nome || "").replace(/Munícipal/gi, "Municipal"),
    cidade,
    meso: mesoPorCidade[cidade] || "Centro Fluminense",
    tipo: "Prédio público",
    lat: r6(p.lat),
    lng: r6(p.lng),
    dica:
      "Sede do poder executivo municipal. Coordenadas cruzadas com OpenStreetMap / centróide IBGE; confirme o endereço no portal da prefeitura e no mapa.",
  });
}
prefPois.sort((a, b) => a.cidade.localeCompare(b.cidade, "pt-BR"));

function linesDpConst() {
  const lines = ["    const DP_DPO_SAIDA_POR_CIDADE = {"];
  for (const m of municipios) {
    const nome = m.nome;
    const d = dpFinal[nome];
    if (!d) continue;
    lines.push(
      `      ${JSON.stringify(nome)}: { nome: ${JSON.stringify(d.nome)}, lat: ${r6(d.lat)}, lng: ${r6(d.lng)} },`
    );
  }
  lines.push("    };");
  return lines.join("\n");
}

function linesPrefPois() {
  const lines = ["    const POIS_PREF_MUNICIPIOS_RJ = ["];
  for (const o of prefPois) {
    lines.push(
      `      { nome: ${JSON.stringify(o.nome)}, cidade: ${JSON.stringify(o.cidade)}, meso: ${JSON.stringify(o.meso)}, tipo: ${JSON.stringify(o.tipo)}, lat: ${o.lat}, lng: ${o.lng}, dica: ${JSON.stringify(o.dica)} },`
    );
  }
  lines.push("    ];");
  return lines.join("\n");
}

fs.writeFileSync(path.join(dir, "fragment-dp-dpo.txt"), linesDpConst(), "utf8");
fs.writeFileSync(path.join(dir, "fragment-pref-pois.txt"), linesPrefPois(), "utf8");
console.error(JSON.stringify({ meta, dp: Object.keys(dpFinal).length, prefPois: prefPois.length }));
