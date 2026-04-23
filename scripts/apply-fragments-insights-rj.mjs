/**
 * Injeta data/fragment-dp-dpo.txt e data/fragment-pref-pois.txt em insights-rj.html.
 * Executar após: node scripts/finalize-rj-dp-pref.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const htmlPath = path.join(root, "insights-rj.html");

const pref = fs.readFileSync(path.join(root, "data", "fragment-pref-pois.txt"), "utf8").trimEnd();
const dp = fs.readFileSync(path.join(root, "data", "fragment-dp-dpo.txt"), "utf8").trimEnd();

const instBase = `    const POIS_ROTAS_INSTITUICOES = [
      { nome: "Palácio Tiradentes — ALERJ", cidade: "Rio de Janeiro", meso: "Metropolitana do Rio de Janeiro", tipo: "Prédio público", lat: -22.9041, lng: -43.1736, dica: "Assembleia Legislativa do Estado do Rio de Janeiro; visitas e audiências conforme calendário da casa." },
      { nome: "Tribunal de Justiça do Rio de Janeiro — Centro", cidade: "Rio de Janeiro", meso: "Metropolitana do Rio de Janeiro", tipo: "Prédio público", lat: -22.9023, lng: -43.1755, dica: "Poder judiciário estadual no Centro; forte fluxo de servidores e advogados em dias úteis." },
      { nome: "Palácio Guanabara", cidade: "Rio de Janeiro", meso: "Metropolitana do Rio de Janeiro", tipo: "Prédio público", lat: -22.951, lng: -43.1725, dica: "Sede do governo estadual (Laranjeiras); combine com análise de entorno residencial." },
      { nome: "Colégio Pedro II — Unidade Centro", cidade: "Rio de Janeiro", meso: "Metropolitana do Rio de Janeiro", tipo: "Colégio ou escola", lat: -22.9085, lng: -43.1768, dica: "Rede federal de ensino; pico de movimento em entrada e saída de turnos escolares." },
      { nome: "Colégio de Aplicação da UFRJ — CAp", cidade: "Rio de Janeiro", meso: "Metropolitana do Rio de Janeiro", tipo: "Colégio ou escola", lat: -22.9558, lng: -43.197, dica: "Escola de aplicação vinculada à UFRJ (Humaitá); útil para pauta de educação e mobilidade escolar." },
      { nome: "IFRJ — Campus Maracanã", cidade: "Rio de Janeiro", meso: "Metropolitana do Rio de Janeiro", tipo: "Colégio ou escola", lat: -22.9122, lng: -43.2242, dica: "Instituto Federal no entorno do Maracanã; eventos e calendário acadêmico alteram fluxo." },
      { nome: "UERJ — Campus Maracanã", cidade: "Rio de Janeiro", meso: "Metropolitana do Rio de Janeiro", tipo: "Colégio ou escola", lat: -22.9128, lng: -43.2248, dica: "Universidade estadual; pico em horários de aula e provas." },
      { nome: "UFRJ — Cidade Universitária (Ilha do Fundão)", cidade: "Rio de Janeiro", meso: "Metropolitana do Rio de Janeiro", tipo: "Colégio ou escola", lat: -22.858, lng: -43.233, dica: "Principal campus da UFRJ; acesso por ponte e transporte coletivo — trânsito varia com calendário." },
      { nome: "Colégio Naval — Ilha de Villegagnon", cidade: "Niterói", meso: "Metropolitana do Rio de Janeiro", tipo: "Colégio ou escola", lat: -22.9512, lng: -43.1378, dica: "Equipamento militar de ensino na baía de Guanabara; visitação sujeita a regras da Marinha." },
      { nome: "Fórum Desembargador Silvio de Moraes — TJRJ Niterói", cidade: "Niterói", meso: "Metropolitana do Rio de Janeiro", tipo: "Prédio público", lat: -22.8855, lng: -43.1062, dica: "Comarca da capital fluminense fora da capital; fluxo de público em horário forense." },
      { nome: "Colégio Pedro II — Unidade Niterói", cidade: "Niterói", meso: "Metropolitana do Rio de Janeiro", tipo: "Colégio ou escola", lat: -22.8905, lng: -43.107, dica: "Unidade federal em área central; mobilidade escolar e comércio de proximidade." },
      { nome: "Universidade Federal Fluminense — Campus Gragoatá", cidade: "Niterói", meso: "Metropolitana do Rio de Janeiro", tipo: "Colégio ou escola", lat: -22.919, lng: -43.132, dica: "Campus da UFF na região oceânica; ônibus e estacionamento variam por período letivo." },
      { nome: "Colégio Pedro II — Unidade Petrópolis", cidade: "Petrópolis", meso: "Centro Fluminense", tipo: "Colégio ou escola", lat: -22.508, lng: -43.175, dica: "Unidade federal na Região Serrana; calendário escolar marca picos de fluxo." },
    ].concat(POIS_PREF_MUNICIPIOS_RJ);`;

let html = fs.readFileSync(htmlPath, "utf8");

const tipoStart = html.indexOf("    const TIPO_INSTITUICAO_ROTA_COLORS = {");
const instEnd = html.search(/\r?\n\r?\n    \/\*\* Coordenadas da sede municipal já cadastradas/);
if (tipoStart === -1 || instEnd === -1) {
  throw new Error("Marcador TIPO/POIS_ROTAS não encontrado em insights-rj.html");
}

const tipoBlock = `    const TIPO_INSTITUICAO_ROTA_COLORS = {
      "Colégio ou escola": "#38bdf8",
      "Prédio público": "#eab308",
    };

${pref}

${instBase}`;

html = html.slice(0, tipoStart) + tipoBlock + html.slice(instEnd);

const dpStart = html.indexOf("    const DP_DPO_SAIDA_POR_CIDADE = {");
const dpEnd = html.search(/\r?\n\r?\n    function pontoSaidaPolicialParaRota/);
if (dpStart === -1 || dpEnd === -1) {
  throw new Error("Marcador DP_DPO não encontrado em insights-rj.html");
}
html = html.slice(0, dpStart) + dp + html.slice(dpEnd);

const buildRe =
  /function buildPrefeituraCoordsPorCidade\(\) \{\s*\r?\n\s*const o = \{\};\s*\r?\n\s*for \(const p of POIS_ROTAS_INSTITUICOES\) \{\s*\r?\n\s*if \(p\.nome\.startsWith\("Prefeitura de "\) && p\.cidade\) \{\s*\r?\n\s*o\[p\.cidade\] = \{ lat: p\.lat, lng: p\.lng \};\s*\r?\n\s*\}\s*\r?\n\s*\}\s*\r?\n\s*return o;\s*\r?\n\s*\}/;

const newBuild = `    function buildPrefeituraCoordsPorCidade() {
      const o = {};
      for (const p of POIS_PREF_MUNICIPIOS_RJ) {
        if (p.cidade) {
          o[p.cidade] = { lat: p.lat, lng: p.lng };
        }
      }
      return o;
    }`;

if (!buildRe.test(html)) {
  throw new Error("Corpo de buildPrefeituraCoordsPorCidade mudou; atualize apply-fragments-insights-rj.mjs");
}
html = html.replace(buildRe, newBuild);

fs.writeFileSync(htmlPath, html, "utf8");
console.error("OK: insights-rj.html atualizado (DP + prefeituras + POIS_ROTAS).");
