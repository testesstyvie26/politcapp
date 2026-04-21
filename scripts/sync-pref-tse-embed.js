/**
 * Copia data/tse-prefeitos-ordinarias-rj-2024-by-ibge.json para o bloco
 * #pref-tse-embedded-data em prefeituras-rj.html (uso em file://).
 *
 * Rode após: node scripts/build-tse-prefeitos-rj-2024.js (inclui redes sociais TSE)
 */
const fs = require("fs");
const path = require("path");
const htmlPath = path.join(__dirname, "..", "prefeituras-rj.html");
const jsonPath = path.join(
  __dirname,
  "..",
  "data",
  "tse-prefeitos-ordinarias-rj-2024-by-ibge.json"
);
const open = '<script type="application/json" id="pref-tse-embedded-data">';
let html = fs.readFileSync(htmlPath, "utf8");
const json = fs.readFileSync(jsonPath, "utf8").trim();
const i = html.indexOf(open);
if (i < 0) throw new Error("pref-tse-embedded-data não encontrado em prefeituras-rj.html");
const start = i + open.length;
const j = html.indexOf("</script>", start);
if (j < 0) throw new Error("fechamento do script embed TSE não encontrado");
fs.writeFileSync(htmlPath, html.slice(0, start) + "\n" + json + "\n  " + html.slice(j));
console.log("pref-tse-embedded-data atualizado em prefeituras-rj.html");
