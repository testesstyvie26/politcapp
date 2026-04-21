/**
 * Votos de vereador (cargo 13, 1º turno) por ZONA eleitoral — Rio 60011 e Duque 58335 — a partir de
 * votacao_candidato_munzona_2024_RJ.csv (TSE).
 *
 * Saída: data/vereadores-votos-zona-2024-rj.json
 * Uso: node scripts/build-vereadores-votos-zona-rj.cjs
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const AdmZip = require("adm-zip");

const OUT = path.join(__dirname, "../data/vereadores-votos-zona-2024-rj.json");
const VOT_ZIP_URL =
  "https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2024.zip";
const VOT_ENTRY_RX = /^votacao_candidato_munzona_2024_RJ\.csv$/i;
const SG_UE_ALVO = new Set(["60011", "58335"]);
const TMP_DIR = path.join(__dirname, "../_tmp");
const CD_CARGO_VEREADOR = 13;

function downloadZipBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { timeout: 180000 }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers.location;
          if (!loc) {
            reject(new Error("Redirect sem Location"));
            return;
          }
          downloadZipBuffer(loc.startsWith("http") ? loc : new URL(loc, url).href).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

function extractEntryFromZip(buf, rx) {
  const zip = new AdmZip(buf);
  const entries = zip.getEntries();
  const entry = entries.find((e) => !e.isDirectory && rx.test((e.entryName || "").split("/").pop() || ""));
  if (!entry) throw new Error("Entrada CSV não encontrada no ZIP TSE (munzona RJ).");
  return entry.getData();
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && c === ";") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function limpa(v) {
  if (v == null) return "";
  const s = String(v).trim();
  if (s === "#NULO" || s === "-1" || s === "-4" || s === "#NE") return "";
  return s;
}

async function ensureMunzonaCsv() {
  const target = path.join(TMP_DIR, "votacao_candidato_munzona_2024_RJ.csv");
  if (fs.existsSync(target) && fs.statSync(target).size > 1e5) return target;
  fs.mkdirSync(TMP_DIR, { recursive: true });
  console.error("A extrair votacao_candidato_munzona_2024_RJ.csv do ZIP TSE…");
  const buf = await downloadZipBuffer(VOT_ZIP_URL);
  fs.writeFileSync(target, extractEntryFromZip(buf, VOT_ENTRY_RX));
  return target;
}

/**
 * Soma votos por SG_UE + NR_ZONA + SQ_CANDIDATO.
 * @returns {Map<string, number>} chave: `${ue}|${zona}|${sq}` → votos
 */
function votosPorUezonaSq(csvPath) {
  const raw = fs.readFileSync(csvPath, "latin1");
  const lines = raw.split(/\r?\n/).filter((l) => l.length);
  if (lines.length < 2) return new Map();
  const head = parseCsvLine(lines[0]);
  const idx = (name) => head.indexOf(name);
  const iTipo = idx("CD_TIPO_ELEICAO");
  const iTurno = idx("NR_TURNO");
  const iCargo = idx("CD_CARGO");
  const iSq = idx("SQ_CANDIDATO");
  const iUe = idx("SG_UE");
  const iZona = idx("NR_ZONA");
  const iQt = idx("QT_VOTOS_NOMINAIS");
  if (iSq < 0 || iQt < 0 || iUe < 0 || iZona < 0) {
    throw new Error("votação CSV: faltam colunas (incl. NR_ZONA, SG_UE, SQ_CANDIDATO, QT_VOTOS_NOMINAIS).");
  }
  const m = new Map();
  for (let li = 1; li < lines.length; li++) {
    const cols = parseCsvLine(lines[li]);
    if (cols.length < head.length) continue;
    if (iTipo >= 0 && limpa(cols[iTipo]) !== "2") continue;
    if (iTurno >= 0 && limpa(cols[iTurno]) !== "1") continue;
    if (iCargo >= 0 && limpa(cols[iCargo]) !== String(CD_CARGO_VEREADOR)) continue;
    const sq = limpa(cols[iSq]);
    const ue = limpa(cols[iUe]);
    const zona = limpa(cols[iZona]);
    const qt = parseInt(String(cols[iQt] != null ? cols[iQt] : "0").trim(), 10) || 0;
    if (!sq || !ue || !zona || !SG_UE_ALVO.has(ue) || qt <= 0) continue;
    const key = `${ue}|${zona}|${sq}`;
    m.set(key, (m.get(key) || 0) + qt);
  }
  return m;
}

async function main() {
  const byKey = votosPorUezonaSq(await ensureMunzonaCsv());
  const bySq = {};
  for (const [key, v] of byKey) {
    const [ue, z, sq] = key.split("|");
    if (!bySq[sq]) bySq[sq] = [];
    bySq[sq].push({ ue, z: parseInt(z, 10), v });
  }
  for (const sq of Object.keys(bySq)) {
    bySq[sq].sort((a, b) => a.z - b.z || a.ue.localeCompare(b.ue));
  }
  const payload = {
    fonte:
      "TSE — votacao_candidato_munzona_2024 (RJ), cargo 13 vereador, 1.º turno, eleição ordinária. Agregado por unidade eleitoral e número de zona.",
    eleicao: "Municipais 2024 — 1º turno",
    bySq,
    geradoEm: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload), "utf8");
  const nSq = Object.keys(bySq).length;
  const nLin = Object.values(bySq).reduce((a, b) => a + b.length, 0);
  console.error("Gerado:", OUT, `(${nSq} candidatos, ${nLin} faixas zona×UE com votos > 0)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
