/**
 * Extrai votação por SEÇÃO eleitoral (detalhe por local) para um SQ_CANDIDATO no RJ (Rio e Duque).
 * Faz streaming do ficheiro grande — adequado para um candidato de exemplo (ficheiro JSON pequeno no repo).
 *
 * Fonte: https://cdn.tse.jus.br/.../votacao_secao_2024_RJ.zip
 * Uso: node scripts/build-secao-exemplo-candidato-rj.cjs [SQ_CANDIDATO]
 * Default SQ: 190001956959 (PROFESSOR HEITOR QUEIROZ, Duque de Caxias)
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
const DEFAULT_SQ = "190001956959";
const OUT = path.join(__dirname, "../data/vereadores-secao-exemplo-2024.json");
const ZIP = "https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_2024_RJ.zip";
const TMP = path.join(__dirname, "../_tmp/votacao_secao_2024_RJ.csv");

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
  const targetSq = String(process.argv[2] || DEFAULT_SQ).replace(/\D/g, "") || DEFAULT_SQ;
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
    iSec: idx("NR_SECAO"),
    iSq: idx("SQ_CANDIDATO"),
    iQt: idx("QT_VOTOS"),
    iLoc: idx("NM_LOCAL_VOTACAO"),
    iEnd: idx("DS_LOCAL_VOTACAO_ENDERECO"),
  };
  for (const k of Object.keys(i)) {
    if (i[k] < 0) throw new Error("Coluna em falta no CSV TSE: " + k);
  }

  const rows = [];
  const rl = readline.createInterface({ input: fs.createReadStream(csvPath, { encoding: "latin1" }), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (first) {
      first = false;
      continue;
    }
    if (!line) continue;
    const c = parseLine(line);
    if (c[i.iSq] !== targetSq) continue;
    if (c[i.iTipo] !== TIPO_ORD || c[i.iTurno] !== TURNO) continue;
    if (c[i.iCargo] !== CD_CARGO) continue;
    if (!SG_UE_ALVO.has(c[i.iUe])) continue;
    const v = parseInt(c[i.iQt] || "0", 10) || 0;
    if (v <= 0) continue;
    rows.push({
      ue: c[i.iUe],
      z: parseInt(c[i.iZona] || "0", 10) || 0,
      s: parseInt(c[i.iSec] || "0", 10) || 0,
      v,
      local: c[i.iLoc] || "—",
      endereco: c[i.iEnd] || "—",
    });
  }
  rows.sort((a, b) => a.ue.localeCompare(b.ue) || a.z - b.z || a.s - b.s);
  const tot = rows.reduce((a, b) => a + b.v, 0);
  const payload = {
    fonte:
      "TSE — votacao_secao_2024 (RJ), cargo 13, 1.º turno, eleição ordinária, filtrado por SQ_CANDIDATO.",
    sqCandidato: targetSq,
    totalVotosSecao: tot,
    totalLocais: rows.length,
    sec: rows,
    nota:
      "Coordenadas no mapa do Politapp são esquemáticas (hash por zona/seção) para leitura territorial; o endereço e o n.º oficiais vêm do TSE.",
    geradoEm: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload), "utf8");
  console.error("Gerado:", OUT, `(${rows.length} seções, ${tot} votos)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
