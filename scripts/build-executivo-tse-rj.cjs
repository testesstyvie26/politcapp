/**
 * Compila indicadores TSE para a visão executiva: receitas de órgãos partidários (RJ)
 * + agregados de candidaturas a vereador (Rio capital e Duque de Caxias), alinhado ao
 * ecossistema DivulgaCandContas / SPCE.
 *
 * Dependências (gerar antes, na mesma ordem ou com os JSON já atualizados):
 *   npm run build:tse-partidos-rj
 *   npm run build:vereadores-rj
 *
 * Saída: data/executivo-tse-rj.json
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data/executivo-tse-rj.json");
const RECEITAS = path.join(ROOT, "data/tse-receitas-orgaos-partidarios-rj-2024.json");
const VEREADORES = path.join(ROOT, "data/vereadores-rj-rio-2024.json");

const DIVULGA_BASE = "https://divulgacandcontas.tse.jus.br/divulga/#";
/** Partidos / diretório estadual RJ — eleições municipais 2024 (parâmetros do front TSE). */
const DIVULGA_PARTIDOS_RJ_2024 = `${DIVULGA_BASE}/partidos/2045202024/RJ/4`;
const DADOS_ABERTOS_CAND_2024 = "https://dadosabertos.tse.jus.br/dataset/candidatos-2024";
const SPCE_INFO =
  "https://dadosabertos.tse.jus.br/dataset/prestacao-de-contas-eleitorais-orgaos-partidarios";

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function papelFrom(r) {
  if (r.papelEleicao) return r.papelEleicao;
  const s = String(r.dsSitTotTurno || "").trim();
  if (s === "ELEITO POR QP" || s === "ELEITO POR MÉDIA") return "eleito";
  if (s === "SUPLENTE") return "suplente";
  return "participante";
}

function aggregateVereadoresPorPartido(list) {
  const m = new Map();
  for (const r of list) {
    const sigla = String(r.partido || "").trim() || "—";
    const nome = (r.partidoNome || sigla).trim();
    let row = m.get(sigla);
    if (!row) {
      row = { sigla, nome, candidaturas: 0, eleitos: 0, suplentes: 0, participantes: 0 };
      m.set(sigla, row);
    }
    row.candidaturas++;
    const p = papelFrom(r);
    if (p === "eleito") row.eleitos++;
    else if (p === "suplente") row.suplentes++;
    else row.participantes++;
  }
  return Array.from(m.values()).sort((a, b) => b.candidaturas - a.candidaturas);
}

function main() {
  if (!fs.existsSync(RECEITAS)) {
    console.error("Falta:", RECEITAS, "→ rode: npm run build:tse-partidos-rj");
    process.exit(1);
  }
  if (!fs.existsSync(VEREADORES)) {
    console.error("Falta:", VEREADORES, "→ rode: npm run build:vereadores-rj");
    process.exit(1);
  }

  const rec = readJson(RECEITAS);
  const ver = readJson(VEREADORES);
  const lista = ver.vereadores || [];

  const totV = {
    candidaturas: lista.length,
    eleitos: 0,
    suplentes: 0,
    participantes: 0,
  };
  for (const r of lista) {
    const p = papelFrom(r);
    if (p === "eleito") totV.eleitos++;
    else if (p === "suplente") totV.suplentes++;
    else totV.participantes++;
  }

  const partidosRec = rec.partidos || [];
  const somaReceitas = partidosRec.reduce((s, x) => s + (Number(x.receitaTotal) || 0), 0);

  const porPartidoVereador = aggregateVereadoresPorPartido(lista);

  const payload = {
    titulo: "RJ — TSE · órgãos partidários e campo municipal (visão executiva)",
    geradoEm: new Date().toISOString(),
    uf: "RJ",
    anoEleicao: 2024,
    divulgacandContas: {
      descricao:
        "DivulgaCandContas agrega candidaturas e prestação de contas de campanha; receitas por diretório em RJ (municipais 2024) costuma ser consultada em Partidos / UF.",
      home: `${DIVULGA_BASE}/`,
      partidosDiretorioRj2024: DIVULGA_PARTIDOS_RJ_2024,
    },
    fontes: [
      {
        id: "spce-receitas",
        rotulo: "SPCE — receitas órgãos partidários (CSV RJ)",
        detalhe: rec.fonte || "",
        dataset: SPCE_INFO,
      },
      {
        id: "consulta-cand-vereador",
        rotulo: "consulta_cand — vereador, UEs Rio e Duque de Caxias",
        detalhe: ver.fonte || "",
        dataset: DADOS_ABERTOS_CAND_2024,
      },
    ],
    municipiosVereador: ver.municipios || [],
    receitasOrgaosPartidarios: {
      resumo: {
        partidosComLinha: partidosRec.length,
        receitaTotalEstado: Math.round(somaReceitas * 100) / 100,
        moeda: "BRL",
        observacao: rec.observacao || "",
      },
      porPartido: partidosRec,
    },
    vereadores2024Recorte: {
      escopo:
        "Candidaturas a vereador (cargo 13): capital Rio de Janeiro (UE 60011) e Duque de Caxias (UE 58335).",
      totais: totV,
      porPartido: porPartidoVereador,
    },
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
  console.error("Gerado:", OUT);
  console.error(
    "  receitas partidos:",
    partidosRec.length,
    "| vereador candidaturas:",
    totV.candidaturas,
    `(${totV.eleitos} eleitos, ${totV.suplentes} supl., ${totV.participantes} demais)`
  );
}

main();
