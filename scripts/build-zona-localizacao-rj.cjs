/**
 * Morada de referência (TSE) por zona eleitoral — Rio 60011 e Duque 58335.
 * Primeiro registo (votacao_secao) para cada par SG_UE + NR_ZONA, cargo 13, 1.º turno.
 *
 * Fonte: https://cdn.tse.jus.br/.../votacao_secao_2024_RJ.zip
 * Saída: data/vereadores-zona-local-2024-rj.json
 * Uso: node scripts/build-zona-localizacao-rj.cjs [--geocode]
 */
const fs = require("fs");
const readline = require("readline");
const path = require("path");
const https = require("https");
const AdmZip = require("adm-zip");

const SG_UE_ALVO = new Set(["60011", "58335"]);
const CD_CARGO = "13";
const TIPO_ORD = "2";
const TURNO = "1";
const OUT = path.join(__dirname, "../data/vereadores-zona-local-2024-rj.json");
const ZIP = "https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_2024_RJ.zip";
const TMP = path.join(__dirname, "../_tmp/votacao_secao_2024_RJ.csv");

const UE_MUN = { "60011": "Rio de Janeiro", "58335": "Duque de Caxias" };

function downloadZip() {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(TMP) && fs.statSync(TMP).size > 1e6) {
      resolve(TMP);
      return;
    }
    https.get(ZIP, (res) => {
      const b = [];
      res.on("data", (c) => b.push(c));
      res.on("end", () => {
        const z = new AdmZip(Buffer.concat(b));
        const e = z.getEntry("votacao_secao_2024_RJ.csv");
        fs.mkdirSync(path.dirname(TMP), { recursive: true });
        fs.writeFileSync(TMP, e.getData());
        resolve(TMP);
      });
    }).on("error", reject);
  });
}

function parseLine(line) {
  const p = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === ";" && !inQ) {
      p.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  p.push(cur);
  return p.map((s) => s.trim().replace(/^"|"$/g, ""));
}

async function main() {
  const csvPath = await downloadZip();
  const s0 = (await new Promise((resolve) => {
    const f = fs.createReadStream(csvPath, { start: 0, end: 20000, encoding: "latin1" });
    let b = "";
    f.on("data", (c) => (b += c));
    f.on("end", () => resolve(b));
  })).split(/\r?\n/)[0];
  const cols = parseLine(s0);
  const idx = (n) => cols.indexOf(n);
  const i = {
    iTipo: idx("CD_TIPO_ELEICAO"),
    iTurno: idx("NR_TURNO"),
    iUe: idx("SG_UE"),
    iCargo: idx("CD_CARGO"),
    iZona: idx("NR_ZONA"),
    iLoc: idx("NM_LOCAL_VOTACAO"),
    iEnd: idx("DS_LOCAL_VOTACAO_ENDERECO"),
  };
  for (const k of Object.keys(i)) {
    if (i[k] < 0) throw new Error("Coluna em falta no CSV TSE: " + k);
  }

  const porZona = {};
  const rl = readline.createInterface({ input: fs.createReadStream(csvPath, { encoding: "latin1" }), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (first) {
      first = false;
      continue;
    }
    if (!line) continue;
    const c = parseLine(line);
    if (c[i.iTipo] !== TIPO_ORD || c[i.iTurno] !== TURNO) continue;
    if (c[i.iCargo] !== CD_CARGO) continue;
    const ue = c[i.iUe];
    if (!SG_UE_ALVO.has(ue)) continue;
    const z = parseInt(c[i.iZona] || "0", 10) || 0;
    if (z <= 0) continue;
    const k = `${ue}|${z}`;
    if (porZona[k]) continue;
    porZona[k] = {
      local: c[i.iLoc] || "—",
      endereco: c[i.iEnd] || "—",
    };
  }

  const querGeocode = process.argv.includes("--geocode") || process.env.GEOCODE_ZONAS === "1";
  if (querGeocode && Object.keys(porZona).length) {
    function montaQuery(ue, row) {
      const mun = UE_MUN[ue] || "Rio de Janeiro";
      const p = [];
      if (row.endereco && row.endereco !== "—") p.push(row.endereco);
      if (row.local && row.local !== "—") p.push(row.local);
      p.push(mun, "RJ", "Brasil");
      return p.join(", ");
    }
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    function nominatim(q) {
      return new Promise((resolve) => {
        const pathN = "/search?format=json&limit=1&countrycodes=br&q=" + encodeURIComponent(q);
        const opts = {
          hostname: "nominatim.openstreetmap.org",
          path: pathN,
          headers: {
            "User-Agent": "Politapp/1.0 (build zona local RJ; politcapp)",
            Accept: "application/json",
          },
        };
        https
          .get(opts, (res) => {
            let b2 = "";
            res.on("data", (c) => (b2 += c));
            res.on("end", () => {
              try {
                const arr = JSON.parse(b2);
                if (!Array.isArray(arr) || !arr[0]) return resolve(null);
                const la = parseFloat(arr[0].lat);
                const lo = parseFloat(arr[0].lon);
                if (!Number.isFinite(la) || !Number.isFinite(lo)) return resolve(null);
                resolve({ lat: la, lon: lo });
              } catch {
                resolve(null);
              }
            });
          })
          .on("error", () => resolve(null));
      });
    }
    const chaves = Object.keys(porZona);
    console.error("Nominatim (1 req/s) para", chaves.length, "zonas…");
    for (let n = 0; n < chaves.length; n++) {
      const k2 = chaves[n];
      const [ue] = k2.split("|");
      if (n > 0) await sleep(1100);
      const q = montaQuery(ue, porZona[k2]);
      const pt = await nominatim(q);
      if (pt) {
        porZona[k2].lat = pt.lat;
        porZona[k2].lon = pt.lon;
      }
      if ((n + 1) % 20 === 0) console.error(" …", n + 1, "/", chaves.length);
    }
  }

  const payload = {
    fonte:
      "TSE — votacao_secao_2024 (RJ), primeiro registo por SG_UE + NR_ZONA (local / endereço de seção nessa zona).",
    nota: querGeocode
      ? "lat/lon via Nominatim; serve como ponto de referência da morada, não o cartório da zona no TRE."
      : "sem --geocode: o mapa obtém coordenadas em tempo real (Photon) a partir do endereço; regenere com --geocode para embutir lat/lon.",
    porZona,
    totalZonas: Object.keys(porZona).length,
    geradoEm: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload), "utf8");
  console.error("Gerado:", OUT, "—", Object.keys(porZona).length, "zonas");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
