/**
 * Gera lista de candidatos a vereador — capital (Rio de Janeiro), eleições municipais 2024 —
 * a partir de consulta_cand_2024_RJ.csv (TSE).
 *
 * Fonte: ZIP em https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2024.zip
 *
 * Uso:
 *   node scripts/build-vereadores-rj-json.cjs [caminho/consulta_cand_2024_RJ.csv]
 *
 * Saída: data/vereadores-rj-rio-2024.json
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const AdmZip = require("adm-zip");
const iconv = require("iconv-lite");

const OUT = path.join(__dirname, "../data/vereadores-rj-rio-2024.json");
const ZIP_URL = "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2024.zip";
const ENTRY_RX = /^consulta_cand_2024_RJ\.csv$/i;

/** CD_CARGO 13 = Vereador (eleições municipais). */
const CD_CARGO_VEREADOR = 13;

/** Código TSE da unidade eleitoral — capital Rio de Janeiro (eleições municipais 2024). */
const SG_UE_RIO_CAPITAL = "60011";

function parseCsvLineSemicolon(line) {
  const parts = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === ";" && !inQ) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  parts.push(cur);
  return parts.map((s) => s.trim());
}

function readCsvTse(buf) {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.slice(3).toString("utf8");
  }
  return iconv.decode(buf, "windows-1252");
}

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

function extractRjCsvFromZip(buf) {
  const zip = new AdmZip(buf);
  const entries = zip.getEntries();
  const entry = entries.find((e) => !e.isDirectory && ENTRY_RX.test((e.entryName || "").split("/").pop() || ""));
  if (!entry) {
    const names = entries.map((e) => e.entryName).slice(0, 25);
    throw new Error(`consulta_cand_2024_RJ.csv não encontrado no zip. Ex.: ${names.join(", ")}`);
  }
  return entry.getData();
}

function colIndex(header, name) {
  const i = header.indexOf(name);
  if (i < 0) throw new Error(`Coluna obrigatória ausente: ${name}. Cabeçalho: ${header.slice(0, 12).join(", ")}…`);
  return i;
}

function parseIntSafe(s) {
  const n = parseInt(String(s || "").replace(/^"|"$/g, "").trim(), 10);
  return Number.isFinite(n) ? n : NaN;
}

function mainSync(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.length > 0);
  if (!lines.length) throw new Error("CSV vazio");
  const header = parseCsvLineSemicolon(lines[0]).map((h) => h.replace(/^"|"$/g, ""));
  const ixUf = colIndex(header, "SG_UF");
  const ixUe = colIndex(header, "SG_UE");
  const ixNmUe = header.indexOf("NM_UE");
  const ixCargo = colIndex(header, "CD_CARGO");
  const ixDsCargo = header.indexOf("DS_CARGO");
  const ixNr = header.indexOf("NR_CANDIDATO");
  const ixNmUrna = colIndex(header, "NM_URNA_CANDIDATO");
  const ixNmCand = header.indexOf("NM_CANDIDATO");
  const ixPartido = colIndex(header, "SG_PARTIDO");
  const ixNmPartido = header.indexOf("NM_PARTIDO");
  const ixSq = header.indexOf("SQ_CANDIDATO");
  const ixDsSit = header.indexOf("DS_SITUACAO_CANDIDATURA");
  const ixSitTot = header.indexOf("DS_SIT_TOT_TURNO");

  /** Classificação derivada de DS_SIT_TOT_TURNO (após o pleito), para filtros na UI. */
  function papelEleicao(dsSitTotTurno) {
    const s = String(dsSitTotTurno || "").trim();
    if (s === "ELEITO POR QP" || s === "ELEITO POR MÉDIA") return "eleito";
    if (s === "SUPLENTE") return "suplente";
    return "participante";
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLineSemicolon(lines[i]);
    if (cols.length < header.length - 2) continue;
    if (String(cols[ixUf] || "").replace(/^"|"$/g, "").trim() !== "RJ") continue;
    const sgUe = String(cols[ixUe] || "")
      .replace(/^"|"$/g, "")
      .trim();
    if (sgUe !== SG_UE_RIO_CAPITAL) continue;
    const cdCargo = parseIntSafe(cols[ixCargo]);
    if (cdCargo !== CD_CARGO_VEREADOR) continue;

    const pick = (ix) =>
      ix >= 0 && cols[ix] != null ? String(cols[ix]).replace(/^"|"$/g, "").trim() : "";

    const dsSitTotTurno = ixSitTot >= 0 ? pick(ixSitTot) : "";
    rows.push({
      sqCandidato: pick(ixSq) || undefined,
      numero: pick(ixNr) || undefined,
      nomeUrna: pick(ixNmUrna) || pick(ixNmCand) || "—",
      nomeCompleto: pick(ixNmCand) || undefined,
      municipio: ixNmUe >= 0 ? pick(ixNmUe) : undefined,
      partido: pick(ixPartido) || "—",
      partidoNome: pick(ixNmPartido) || undefined,
      situacao: pick(ixDsSit) || undefined,
      dsSitTotTurno: dsSitTotTurno || undefined,
      papelEleicao: papelEleicao(dsSitTotTurno),
      dsCargo: ixDsCargo >= 0 ? pick(ixDsCargo) : undefined,
    });
  }

  const ordPapel = { eleito: 0, suplente: 1, participante: 2 };
  rows.sort((a, b) => {
    const pa = ordPapel[a.papelEleicao] - ordPapel[b.papelEleicao];
    if (pa !== 0) return pa;
    const pp = (a.partido || "").localeCompare(b.partido || "", "pt-BR");
    if (pp !== 0) return pp;
    return (a.nomeUrna || "").localeCompare(b.nomeUrna || "", "pt-BR");
  });

  return rows;
}

async function main() {
  let buf;
  const arg = process.argv[2];
  const localDefault = path.join(__dirname, "../consulta_cand_2024_RJ.csv");
  if (arg) {
    buf = fs.readFileSync(path.resolve(arg));
  } else if (fs.existsSync(localDefault)) {
    console.error("Usando CSV local:", localDefault);
    buf = fs.readFileSync(localDefault);
  } else {
    console.error("Baixando ZIP do TSE (pode demorar)…");
    const z = await downloadZipBuffer(ZIP_URL);
    buf = extractRjCsvFromZip(z);
  }

  const csvText = readCsvTse(Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
  const vereadores = mainSync(csvText);

  const payload = {
    fonte:
      "TSE — consulta de candidatos (consulta_cand), UF RJ, SG_UE 60011 (capital), cargo 13 (vereador) — eleições municipais 2024. Campo DS_SIT_TOT_TURNO: eleitos (ELEITO POR QP/MÉDIA), suplentes (SUPLENTE) e demais participantes (ex.: NÃO ELEITO, #NULO).",
    uf: "RJ",
    municipio: "Rio de Janeiro",
    sgUeTse: SG_UE_RIO_CAPITAL,
    ibge: "3304557",
    cdCargo: CD_CARGO_VEREADOR,
    geradoEm: new Date().toISOString(),
    total: vereadores.length,
    vereadores,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
  console.error("Gerado:", OUT, `(${vereadores.length} registos)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
