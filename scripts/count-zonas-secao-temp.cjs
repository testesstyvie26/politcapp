const fs = require("fs");
const readline = require("readline");
const path = require("path");
const TMP = path.join(__dirname, "../_tmp/votacao_secao_2024_RJ.csv");
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
  const firstLine = await new Promise((resolve) => {
    const f = fs.createReadStream(TMP, { start: 0, end: 20000, encoding: "latin1" });
    let b = "";
    f.on("data", (c) => (b += c));
    f.on("end", () => resolve(b.split(/\r?\n/)[0]));
  });
  const head = parseLine(firstLine);
  const idx = (n) => head.indexOf(n);
  const i = { t: idx("CD_TIPO_ELEICAO"), turn: idx("NR_TURNO"), ue: idx("SG_UE"), cargo: idx("CD_CARGO"), z: idx("NR_ZONA") };
  const SG = new Set(["60011", "58335"]);
  const s = new Set();
  let n = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(TMP, { encoding: "latin1" }), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (first) {
      first = false;
      continue;
    }
    if (!line) continue;
    const c = parseLine(line);
    if (c[i.t] !== "2" || c[i.turn] !== "1" || c[i.cargo] !== "13") continue;
    if (!SG.has(c[i.ue])) continue;
    s.add(c[i.ue] + "|" + c[i.z]);
    n++;
  }
  for (let j = 0; j < head.length; j++) {
    if (/ZONA|CARGO|SECAO|UE/i.test(head[j])) console.log("col", j, head[j]);
  }
  const byUe = { "60011": new Set(), "58335": new Set() };
  for (const k of s) {
    const [ue, z] = k.split("|");
    if (byUe[ue]) byUe[ue].add(z);
  }
  console.log("lines", n, "unique total", s.size, "Rio n(z)", byUe["60011"].size, "Duque n(z)", byUe["58335"].size);
  const rz = Array.from(byUe["60011"]).map(Number).filter((x) => x > 0);
  console.log("Rio z min", Math.min(...rz), "max", Math.max(...rz));
}
main();
