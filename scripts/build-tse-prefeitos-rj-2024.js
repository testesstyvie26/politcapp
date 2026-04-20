/**
 * Gera data/tse-prefeitos-ordinarias-rj-2024-by-ibge.json a partir do CSV oficial
 * consulta_cand_2024_RJ.csv (dentro de consulta_cand_2024.zip no CDN do TSE).
 *
 * Uso: node scripts/build-tse-prefeitos-rj-2024.js
 * Requer: Node 18+ (fetch). Rede para IBGE; zip TSE se o CSV não existir em _tmp/.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const OUT_JSON = path.join(ROOT, "data", "tse-prefeitos-ordinarias-rj-2024-by-ibge.json");
const TMP_DIR = path.join(ROOT, "_tmp");
const CSV_NAME = "consulta_cand_2024_RJ.csv";
const ZIP_URL = "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2024.zip";
const VOT_ZIP_URL =
  "https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2024.zip";
const VOT_CSV_NAME = "votacao_candidato_munzona_2024_RJ.csv";

const IBGE_MUN_RJ =
  "https://servicodados.ibge.gov.br/api/v1/localidades/estados/33/municipios";

function normaliza(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
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

function situacaoTse(ds) {
  const s = limpa(ds);
  if (!s) return "—";
  if (/^não eleito/i.test(s)) return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  if (/^eleito/i.test(s)) return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return s;
}

async function ensureCsv() {
  const rootCsv = path.join(ROOT, CSV_NAME);
  if (fs.existsSync(rootCsv)) return rootCsv;
  const target = path.join(TMP_DIR, CSV_NAME);
  if (fs.existsSync(target)) return target;
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const zipPath = path.join(TMP_DIR, "consulta_cand_2024.zip");
  process.stderr.write("Baixando " + ZIP_URL + " …\n");
  const res = await fetch(ZIP_URL);
  if (!res.ok) throw new Error("ZIP TSE " + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(zipPath, buf);
  process.stderr.write("Extraindo " + CSV_NAME + " …\n");
  execSync(`tar -xf "${zipPath}" -C "${TMP_DIR}" "${CSV_NAME}"`, {
    stdio: "inherit",
    shell: true,
  });
  if (!fs.existsSync(target)) throw new Error("CSV não encontrado após extração");
  return target;
}

async function ensureVotacaoMunzonaRjCsv() {
  const rootCsv = path.join(ROOT, VOT_CSV_NAME);
  if (fs.existsSync(rootCsv)) return rootCsv;
  const target = path.join(TMP_DIR, VOT_CSV_NAME);
  if (fs.existsSync(target)) return target;
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const zipPath = path.join(TMP_DIR, "votacao_candidato_munzona_2024.zip");
  process.stderr.write("Baixando " + VOT_ZIP_URL + " …\n");
  const res = await fetch(VOT_ZIP_URL);
  if (!res.ok) throw new Error("ZIP votação TSE " + res.status);
  fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  process.stderr.write("Extraindo " + VOT_CSV_NAME + " …\n");
  execSync(`tar -xf "${zipPath}" -C "${TMP_DIR}" "${VOT_CSV_NAME}"`, {
    stdio: "inherit",
    shell: true,
  });
  if (!fs.existsSync(target)) throw new Error("CSV votação RJ não encontrado após extração");
  return target;
}

/**
 * Soma QT_VOTOS_NOMINAIS por SQ_CANDIDATO (prefeito, 1º turno) e total por SG_UE para % válidos.
 */
function votosPrefeitoPorSqUe(csvPath) {
  const raw = fs.readFileSync(csvPath, "latin1");
  const lines = raw.split(/\r?\n/).filter((l) => l.length);
  if (lines.length < 2) return { porSq: new Map(), totalPorUe: new Map() };
  const head = parseCsvLine(lines[0]);
  const idx = (name) => head.indexOf(name);
  const iTipo = idx("CD_TIPO_ELEICAO");
  const iTurno = idx("NR_TURNO");
  const iCargo = idx("CD_CARGO");
  const iSq = idx("SQ_CANDIDATO");
  const iUe = idx("SG_UE");
  const iQt = idx("QT_VOTOS_NOMINAIS");
  const porSq = new Map();
  const totalPorUe = new Map();
  for (let li = 1; li < lines.length; li++) {
    const cols = parseCsvLine(lines[li]);
    if (cols.length < head.length) continue;
    if (limpa(cols[iTipo]) !== "2") continue;
    if (limpa(cols[iTurno]) !== "1") continue;
    if (limpa(cols[iCargo]) !== "11") continue;
    const sq = limpa(cols[iSq]);
    const ue = limpa(cols[iUe]);
    const qt = parseInt(String(cols[iQt] != null ? cols[iQt] : "0").trim(), 10) || 0;
    if (!sq) continue;
    porSq.set(sq, (porSq.get(sq) || 0) + qt);
    totalPorUe.set(ue, (totalPorUe.get(ue) || 0) + qt);
  }
  return { porSq, totalPorUe };
}

function pctValidosLocale(votos, totalMun) {
  if (totalMun == null || totalMun <= 0 || votos == null) return undefined;
  const p = (100 * votos) / totalMun;
  return `${p.toFixed(2).replace(".", ",")}%`;
}

async function ibgePorNome() {
  const res = await fetch(IBGE_MUN_RJ);
  if (!res.ok) throw new Error("IBGE " + res.status);
  /** @type {{ id: number, nome: string }[]} */
  const munis = await res.json();
  const map = new Map();
  for (const m of munis) {
    map.set(normaliza(m.nome), { id: m.id, nome: m.nome });
  }
  return map;
}

function main() {
  return (async () => {
    const csvPath = await ensureCsv();
    const ibgeMap = await ibgePorNome();
    const raw = fs.readFileSync(csvPath, "latin1");
    const lines = raw.split(/\r?\n/).filter((l) => l.length);
    if (!lines.length) throw new Error("CSV vazio");

    const head = parseCsvLine(lines[0]);
    const idx = (name) => head.indexOf(name);

    const iTipo = idx("CD_TIPO_ELEICAO");
    const iUe = idx("SG_UE");
    const iNmUe = idx("NM_UE");
    const iCargo = idx("DS_CARGO");
    const iNr = idx("NR_CANDIDATO");
    const iNm = idx("NM_CANDIDATO");
    const iUrna = idx("NM_URNA_CANDIDATO");
    const iPart = idx("SG_PARTIDO");
    const iColig = idx("NM_COLIGACAO");
    const iComp = idx("DS_COMPOSICAO_COLIGACAO");
    const iSqCol = idx("SQ_COLIGACAO");
    const iSit = idx("DS_SIT_TOT_TURNO");
    const iOcup = idx("DS_OCUPACAO");
    const iSqCand = idx("SQ_CANDIDATO");

    /** @type {Map<string, Record<string, string>>} */
    const vices = new Map();
    /** @type {Record<string, string>[]} */
    const prefeitos = [];

    for (let li = 1; li < lines.length; li++) {
      const cols = parseCsvLine(lines[li]);
      if (cols.length < head.length) continue;
      const tipo = limpa(cols[iTipo]);
      if (tipo !== "2") continue;
      const nmUe = limpa(cols[iNmUe]);
      const sgUe = limpa(cols[iUe]);
      const cargo = limpa(cols[iCargo]);
      const sqCol = limpa(cols[iSqCol]);
      const key = `${sgUe}|${sqCol}`;
      if (cargo === "VICE-PREFEITO") {
        vices.set(key, {
          nome: limpa(cols[iNm]),
          partido: limpa(cols[iPart]),
          situacao: situacaoTse(cols[iSit]),
        });
      } else if (cargo === "PREFEITO") {
        prefeitos.push({
          sg_ue: sgUe,
          nm_ue: nmUe,
          sq_coligacao: sqCol,
          sq_candidato: limpa(cols[iSqCand]),
          numero: limpa(cols[iNr]),
          nome: limpa(cols[iNm]),
          nome_urna: limpa(cols[iUrna]),
          partido: limpa(cols[iPart]),
          coligacao: limpa(cols[iColig]) || limpa(cols[iComp]) || "—",
          situacao: situacaoTse(cols[iSit]),
          ocupacao: limpa(cols[iOcup]),
        });
      }
    }

    const votPath = await ensureVotacaoMunzonaRjCsv();
    const { porSq: votosPorSq, totalPorUe: totPrefPorUe } = votosPrefeitoPorSqUe(votPath);

    /** @type {Record<string, unknown>} */
    const byIbge = {};
    const naoCasados = new Set();

    for (const pr of prefeitos) {
      const ibgeRec = ibgeMap.get(normaliza(pr.nm_ue));
      if (!ibgeRec) {
        naoCasados.add(pr.nm_ue);
        continue;
      }
      const k = String(ibgeRec.id);
      const vice = vices.get(`${pr.sg_ue}|${pr.sq_coligacao}`) || null;
      const detalhes = pr.ocupacao
        ? `Ocupação declarada ao TSE (consulta candidatos 2024): ${pr.ocupacao}.`
        : "Registro na consulta pública de candidatos do TSE (2024), pleito ordinário municipal.";
      const sqKey = pr.sq_candidato ? String(pr.sq_candidato) : "";
      const vts = sqKey ? votosPorSq.get(sqKey) : undefined;
      const totUe = totPrefPorUe.get(String(pr.sg_ue)) || 0;
      const pct =
        vts != null && totUe > 0 ? pctValidosLocale(vts, totUe) : undefined;
      const row = {
        nome: pr.nome,
        nome_urna: pr.nome_urna || undefined,
        partido: pr.partido || "—",
        numero: pr.numero ? Number(pr.numero) : undefined,
        coligacao: pr.coligacao,
        situacao: pr.situacao,
        vice: vice && vice.nome ? { nome: vice.nome, partido: vice.partido || "—" } : undefined,
        detalhes,
        mandato: "",
        resultado:
          vts != null
            ? {
                votos: vts,
                pct_validos: pct,
                nota_votos:
                  "Votos nominais no 1º turno (soma por zona), arquivo «Votação nominal por município e zona» — resultados 2024 (TSE). Municípios com 2º turno para prefeito: percentual refere-se à soma dos votos de prefeito no 1º turno naquele município.",
              }
            : undefined,
        redes: [
          {
            label: "Candidatos 2024 — dados abertos TSE",
            url: "https://dadosabertos.tse.jus.br/dataset/candidatos-2024",
          },
          {
            label: "Resultados 2024 — votação nominal (TSE)",
            url: "https://dadosabertos.tse.jus.br/dataset/resultados-2024",
          },
        ],
        fonte_tse:
          "consulta_cand_2024_RJ.csv e votacao_candidato_munzona_2024_RJ.csv (TSE, ordinárias 06/10/2024, 1º turno)",
      };
      if (!byIbge[k]) byIbge[k] = [];
      byIbge[k].push(row);
    }

    const meta = {
      gerado_em: new Date().toISOString(),
      fonte:
        "TSE — consulta_cand_2024 + votacao_candidato_munzona_2024 (RJ), votos 1º turno por zona",
      eleicao: "Eleições municipais ordinárias 2024 — RJ",
      ibges: Object.keys(byIbge).length,
    };

    fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
    fs.writeFileSync(OUT_JSON, JSON.stringify({ meta, prefeitos_por_ibge: byIbge }, null, 2), "utf8");
    process.stderr.write(
      `OK: ${OUT_JSON} (${meta.ibges} municípios com chapas a prefeito)\n`
    );
    if (naoCasados.size) {
      process.stderr.write(
        `Aviso: ${naoCasados.size} NM_UE sem par IBGE: ${[...naoCasados].slice(0, 8).join("; ")}${naoCasados.size > 8 ? "…" : ""}\n`
      );
    }
    process.stderr.write("Para embutir no HTML (file://): node scripts/sync-pref-tse-embed.js\n");
  })();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
