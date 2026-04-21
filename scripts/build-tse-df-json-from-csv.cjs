/**
 * Gera arquivos no formato TSE dados-simplificados (eleição 546, c0006) a partir do CSV
 * de deputados federais (lucasthaynan/apuracao_eleicoes_2022), para servir em
 * data/tse-ele2022-df/{uf}/{uf}-c0006-e000546-r.json (mesma origem → sem CORS no GitHub Pages).
 *
 * Uso: node scripts/build-tse-df-json-from-csv.cjs [caminho.csv]
 * Sem argumento: baixa o CSV da URL pública abaixo.
 */
const fs = require("fs");
const https = require("https");
const path = require("path");

const CSV_URL =
  "https://raw.githubusercontent.com/lucasthaynan/apuracao_eleicoes_2022/main/dados/deputados_federais_votos_2022.csv";

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      })
      .on("error", reject);
  });
}

/** RFC4180-style: campos entre aspas podem conter vírgulas. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cur += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(cur);
      cur = "";
      i++;
      continue;
    }
    if (c === "\n" || (c === "\r" && text[i + 1] === "\n")) {
      if (c === "\r") i++;
      row.push(cur);
      cur = "";
      if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
      row = [];
      i++;
      continue;
    }
    if (c === "\r") {
      row.push(cur);
      cur = "";
      if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
      row = [];
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  if (cur.length || row.length) {
    row.push(cur);
    if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
  }
  return rows;
}

function rowToCand(cells) {
  if (cells.length < 10) return null;
  const uf = String(cells[1] || "").trim().toUpperCase();
  if (uf.length !== 2) return null;
  const pvap = String(cells[9] || "")
    .replace(/^"|"$/g, "")
    .trim();
  return {
    sqcand: String(cells[2] || "").trim(),
    n: String(cells[3] || "").trim(),
    nm: String(cells[4] || "").trim(),
    cc: String(cells[5] || "").trim(),
    st: String(cells[6] || "").trim(),
    dvt: String(cells[7] || "").trim(),
    vap: String(cells[8] || "").replace(/\D/g, "") || "0",
    pvap,
  };
}

async function main() {
  const root = path.join(__dirname, "..");
  const argCsv = process.argv[2];
  let text;
  if (argCsv) {
    text = fs.readFileSync(path.resolve(argCsv), "utf8");
  } else {
    text = await fetchText(CSV_URL);
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = parseCsv(text);
  if (!rows.length) throw new Error("CSV vazio");

  const byUf = new Map();
  for (let r = 1; r < rows.length; r++) {
    const cand = rowToCand(rows[r]);
    if (!cand || !cand.sqcand) continue;
    const uf = String(rows[r][1] || "")
      .trim()
      .toUpperCase();
    if (!byUf.has(uf)) byUf.set(uf, []);
    byUf.get(uf).push(cand);
  }

  const outRoot = path.join(root, "data", "tse-ele2022-df");
  fs.mkdirSync(outRoot, { recursive: true });

  for (const [uf, cands] of byUf) {
    const u = uf.toLowerCase();
    const dir = path.join(outRoot, u);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${u}-c0006-e000546-r.json`);
    fs.writeFileSync(file, JSON.stringify({ cand: cands }), "utf8");
    process.stdout.write(`${uf} ${cands.length} candidatos\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
