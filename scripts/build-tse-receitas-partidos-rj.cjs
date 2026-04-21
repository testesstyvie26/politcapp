/**
 * Agrega receitas (VR_RECEITA) por partido a partir do CSV oficial do TSE:
 * "Prestação de contas de órgãos partidários" — recorte RJ (eleições municipais 2024).
 *
 * Fonte do arquivo: https://cdn.tse.jus.br/.../prestacao_de_contas_eleitorais_orgaos_partidarios_2024.zip
 *
 * Uso:
 *   node scripts/build-tse-receitas-partidos-rj.cjs [caminho/receitas_orgaos_partidarios_2024_RJ.csv]
 *
 * Gera: data/tse-receitas-orgaos-partidarios-rj-2024.json
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const AdmZip = require("adm-zip");
const iconv = require("iconv-lite");

const OUT = path.join(__dirname, "../data/tse-receitas-orgaos-partidarios-rj-2024.json");
const ZIP_URL =
  "https://cdn.tse.jus.br/estatistica/sead/odsele/prestacao_contas/prestacao_de_contas_eleitorais_orgaos_partidarios_2024.zip";
const ENTRY_RX = /^receitas_orgaos_partidarios_2024_RJ\.csv$/i;

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

function parseBrMoney(cell) {
  if (cell == null || cell === "" || cell === "#NULO#" || cell === "#NULO") return 0;
  const t = String(cell).replace(/^"|"$/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function aggregateFromText(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (!lines.length) throw new Error("CSV vazio");
  const header = parseCsvLineSemicolon(lines[0]);
  const ixSigla = header.indexOf("SG_PARTIDO");
  const ixNome = header.indexOf("NM_PARTIDO");
  const ixVr = header.indexOf("VR_RECEITA");
  if (ixSigla < 0 || ixNome < 0 || ixVr < 0) {
    throw new Error("Cabeçalho inesperado: faltam SG_PARTIDO, NM_PARTIDO ou VR_RECEITA");
  }
  const bySigla = new Map();
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLineSemicolon(lines[i]);
    if (cols.length <= Math.max(ixSigla, ixNome, ixVr)) continue;
    const sigla = cols[ixSigla].replace(/^"|"$/g, "").trim();
    const nome = cols[ixNome].replace(/^"|"$/g, "").trim();
    const vr = parseBrMoney(cols[ixVr]);
    if (!sigla) continue;
    const prev = bySigla.get(sigla) || { sigla, nome, receitaTotal: 0 };
    prev.receitaTotal += vr;
    if (nome && (!prev.nome || prev.nome === sigla)) prev.nome = nome;
    bySigla.set(sigla, prev);
  }
  const partidos = Array.from(bySigla.values()).sort((a, b) => b.receitaTotal - a.receitaTotal);
  return partidos;
}

async function downloadZipToBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { timeout: 120000 }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers.location;
          if (!loc) {
            reject(new Error("Redirect sem Location"));
            return;
          }
          downloadZipToBuffer(loc.startsWith("http") ? loc : new URL(loc, url).href).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
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

function extractRjReceitasCsvBufferFromZip(buf) {
  const zip = new AdmZip(buf);
  const entries = zip.getEntries();
  const entry = entries.find((e) => !e.isDirectory && ENTRY_RX.test(e.entryName.split("/").pop() || ""));
  if (!entry) {
    const names = entries.map((e) => e.entryName).slice(0, 30);
    throw new Error(`Arquivo RJ não encontrado no zip. Exemplos: ${names.join(", ")}`);
  }
  return entry.getData();
}

function readCsvTextTse(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.slice(3).toString("utf8");
  }
  return iconv.decode(buf, "windows-1252");
}

async function main() {
  let csvText;
  const arg = process.argv[2];
  const localDefault = path.join(__dirname, "../tmp-pc-org/receitas_orgaos_partidarios_2024_RJ.csv");
  if (arg) {
    csvText = readCsvTextTse(path.resolve(arg));
  } else if (fs.existsSync(localDefault)) {
    console.error("Usando:", localDefault);
    csvText = readCsvTextTse(localDefault);
  } else {
    console.error("Baixando ZIP do TSE (pode demorar)…");
    const zbuf = await downloadZipToBuffer(ZIP_URL);
    const entryBuf = extractRjReceitasCsvBufferFromZip(zbuf);
    csvText = iconv.decode(entryBuf, "windows-1252");
  }

  const partidos = aggregateFromText(csvText).map((p) => ({
    ...p,
    receitaTotal: Math.round(p.receitaTotal * 100) / 100,
  }));
  const payload = {
    fonte:
      "TSE — Sistema de Prestação de Contas Eleitorais (SPCE). Arquivo: receitas_orgaos_partidarios_2024_RJ.csv (órgãos partidários, UF RJ, eleições municipais 2024).",
    uf: "RJ",
    anoEleicao: 2024,
    observacao:
      "Valores somam VR_RECEITA por SG_PARTIDO em todo o estado. Diferente do filtro por cargo no DivulgaCand (#/partidos/2045202024/RJ/4), aqui entram todas as receitas declaradas por diretórios municipais no RJ.",
    geradoEm: new Date().toISOString(),
    partidos,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
  console.error("Gerado:", OUT, `(${partidos.length} partidos)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
