/**
 * Gera lista de candidatos a vereador — Rio de Janeiro (capital) e Duque de Caxias — eleições municipais 2024 —
 * a partir de consulta_cand_2024_RJ.csv (TSE), opcionalmente enriquecida com:
 * - votos nominais (soma por zona): votacao_candidato_munzona_2024_RJ.csv, cargo 13, 1º turno;
 * - redes sociais e WhatsApp: rede_social_candidato_2024_RJ.csv (DS_URL por SQ_CANDIDATO);
 * - telefone em falta no CSV: inferido de URLs oficiais TSE (api.whatsapp.com / wa.me) na mesma tabela;
 * - opcional: data/vereadores-contatos-suplemento.json (chave por SQ_CANDIDATO) para ligações verificadas manualmente.
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
const CONTATOS_SUPP = path.join(__dirname, "../data/vereadores-contatos-suplemento.json");
const ZIP_URL = "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2024.zip";
const ENTRY_RX = /^consulta_cand_2024_RJ\.csv$/i;
const VOT_ZIP_URL =
  "https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2024.zip";
const VOT_ENTRY_RX = /^votacao_candidato_munzona_2024_RJ\.csv$/i;
const REDE_ZIP_URL =
  "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/rede_social_candidato_2024.zip";
const REDE_ENTRY_RX = /^rede_social_candidato_2024_RJ\.csv$/i;
const TMP_DIR = path.join(__dirname, "../_tmp");

/** CD_CARGO 13 = Vereador (eleições municipais). */
const CD_CARGO_VEREADOR = 13;

/** Códigos TSE das unidades eleitorais (RJ, eleições municipais 2024). */
const SG_UE_ALVO = new Set(["60011", "58335"]);

const METADATA_UE = {
  "60011": { municipio: "Rio de Janeiro", ibge: "3304557" },
  "58335": { municipio: "Duque de Caxias", ibge: "3301702" },
};

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

function extractEntryFromZip(buf, rx) {
  const zip = new AdmZip(buf);
  const entries = zip.getEntries();
  const entry = entries.find((e) => !e.isDirectory && rx.test((e.entryName || "").split("/").pop() || ""));
  if (!entry) {
    const names = entries.map((e) => e.entryName).slice(0, 25);
    throw new Error(`Entrada CSV não encontrada no zip. Ex.: ${names.join(", ")}`);
  }
  return entry.getData();
}

function extractRjCsvFromZip(buf) {
  return extractEntryFromZip(buf, ENTRY_RX);
}

/** Mesmo algoritmo que em build-tse-prefeitos (CSV TSE com aspas). */
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

function isWhatsAppUrl(url) {
  return /whatsapp\.com|wa\.me|api\.whatsapp/i.test(String(url || ""));
}

function labelRedeFromUrl(url) {
  if (isWhatsAppUrl(url)) return "WhatsApp";
  const s = String(url || "").trim();
  if (!s) return "Link";
  try {
    const u = new URL(s);
    const h = u.hostname.replace(/^www\./, "");
    if (h.includes("instagram")) return "Instagram";
    if (h.includes("facebook.") || h === "fb.me") return "Facebook";
    if (h.includes("twitter.") || h === "x.com") return "X (Twitter)";
    if (h.includes("tiktok")) return "TikTok";
    if (h.includes("youtube.") || h === "youtu.be") return "YouTube";
    if (h.includes("linkedin")) return "LinkedIn";
    return h.split(".")[0] || "Site";
  } catch {
    return "Rede social";
  }
}

/**
 * Soma QT_VOTOS_NOMINAIS por SG_UE + SQ_CANDIDATO — vereador (CD_CARGO 13), 1º turno, eleição ordinária municipal.
 * Chave: `${SG_UE}|${SQ_CANDIDATO}` (evita ambiguidade entre municípios).
 */
function votosVereadorPorUeSq(csvPath) {
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
  const iQt = idx("QT_VOTOS_NOMINAIS");
  if (iSq < 0 || iQt < 0 || iUe < 0) throw new Error("votação CSV: faltam colunas (SQ_CANDIDATO, SG_UE ou QT_VOTOS_NOMINAIS)");
  const porUeSq = new Map();
  for (let li = 1; li < lines.length; li++) {
    const cols = parseCsvLine(lines[li]);
    if (cols.length < head.length) continue;
    if (iTipo >= 0 && limpa(cols[iTipo]) !== "2") continue;
    if (iTurno >= 0 && limpa(cols[iTurno]) !== "1") continue;
    if (iCargo >= 0 && limpa(cols[iCargo]) !== "13") continue;
    const sq = limpa(cols[iSq]);
    const ue = limpa(cols[iUe]);
    const qt = parseInt(String(cols[iQt] != null ? cols[iQt] : "0").trim(), 10) || 0;
    if (!sq || !ue || !SG_UE_ALVO.has(ue)) continue;
    const key = `${ue}|${sq}`;
    porUeSq.set(key, (porUeSq.get(key) || 0) + qt);
  }
  return porUeSq;
}

function redeSocialPorSqCandidato(csvPath) {
  const raw = fs.readFileSync(csvPath, "latin1");
  const lines = raw.split(/\r?\n/).filter((l) => l.length);
  if (lines.length < 2) return new Map();
  const head = parseCsvLine(lines[0]);
  const ix = (n) => head.indexOf(n);
  const iSq = ix("SQ_CANDIDATO");
  const iUrl = ix("DS_URL");
  if (iSq < 0 || iUrl < 0) throw new Error("rede_social CSV: SQ_CANDIDATO ou DS_URL ausentes");
  const map = new Map();
  for (let li = 1; li < lines.length; li++) {
    const cols = parseCsvLine(lines[li]);
    if (cols.length < head.length) continue;
    const sq = limpa(cols[iSq]);
    const url = limpa(cols[iUrl]);
    if (!sq || !url || !/^https?:\/\//i.test(url)) continue;
    const label = labelRedeFromUrl(url);
    const arr = map.get(sq) || [];
    if (!arr.some((x) => x.url === url)) arr.push({ label, url });
    map.set(sq, arr);
  }
  return map;
}

function splitWhatsappEMidias(list) {
  const whatsapp = [];
  const midiasSociais = [];
  for (const x of list || []) {
    if (isWhatsAppUrl(x.url)) whatsapp.push(x);
    else midiasSociais.push(x);
  }
  return { whatsapp, midiasSociais };
}

function normalizeWaUrl(u) {
  return String(u || "")
    .trim()
    .replace(/\/$/, "")
    .toLowerCase();
}

function dedupeWaEntries(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr || []) {
    const k = normalizeWaUrl(x.url);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

async function ensureVotacaoMunzonaRjCsv() {
  const target = path.join(TMP_DIR, "votacao_candidato_munzona_2024_RJ.csv");
  if (fs.existsSync(target)) return target;
  fs.mkdirSync(TMP_DIR, { recursive: true });
  console.error("A extrair votacao_candidato_munzona_2024_RJ.csv do ZIP TSE…");
  const buf = await downloadZipBuffer(VOT_ZIP_URL);
  fs.writeFileSync(target, extractEntryFromZip(buf, VOT_ENTRY_RX));
  return target;
}

async function ensureRedeSocialRJ2024Csv() {
  const target = path.join(TMP_DIR, "rede_social_candidato_2024_RJ.csv");
  if (fs.existsSync(target)) return target;
  fs.mkdirSync(TMP_DIR, { recursive: true });
  console.error("A extrair rede_social_candidato_2024_RJ.csv do ZIP TSE…");
  const buf = await downloadZipBuffer(REDE_ZIP_URL);
  fs.writeFileSync(target, extractEntryFromZip(buf, REDE_ENTRY_RX));
  return target;
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {Map<string, number>} votosPorUeSq
 * @param {Map<string, {label:string,url:string}[]>} redePorSq
 */
function enriquecerVereadores(rows, votosPorUeSq, redePorSq) {
  for (const row of rows) {
    const ue = row.sgUeTse != null ? String(row.sgUeTse).trim() : "";
    const sq = row.sqCandidato != null ? String(row.sqCandidato).trim() : "";
    if (ue && sq && votosPorUeSq.has(`${ue}|${sq}`)) {
      row.votos = votosPorUeSq.get(`${ue}|${sq}`);
    }
    const redes = sq ? redePorSq.get(sq) || [] : [];
    if (!row.telefone) {
      for (const { url } of redes) {
        const tel = telefoneExibicaoDeUrlWhatsapp(url);
        if (tel) {
          row.telefone = tel;
          break;
        }
      }
    }
    if (!row._waUrlCelular) {
      for (const { url } of redes) {
        const wu = waMeUrlCanonicoDeUrlWhatsapp(url);
        if (wu) {
          row._waUrlCelular = wu;
          break;
        }
      }
    }
    const { whatsapp: waRede, midiasSociais } = splitWhatsappEMidias(redes);
    let whatsapp = [...waRede];
    const waCel = row._waUrlCelular;
    delete row._waUrlCelular;
    if (waCel && !whatsapp.some((w) => normalizeWaUrl(w.url) === normalizeWaUrl(waCel))) {
      whatsapp.push({ label: "WhatsApp", url: waCel });
    }
    whatsapp = dedupeWaEntries(whatsapp);
    if (whatsapp.length) row.whatsapp = whatsapp;
    if (midiasSociais.length) row.midiasSociais = midiasSociais;
  }
}

/**
 * Complemento manual a rede_social_candidato (perfis públicos confirmados quando o TSE não traz URL).
 * Chave: SQ_CANDIDATO (string).
 */
const MIDIAS_SUPLEMENTO_POR_SQ = {
  "190001956959": [{ label: "Instagram", url: "https://www.instagram.com/prof.heitorqueiroz/" }],
};

function urlKeyMidia(u) {
  try {
    return new URL(String(u || "").trim()).href.replace(/\/$/, "").toLowerCase();
  } catch {
    return String(u || "")
      .trim()
      .replace(/\/$/, "")
      .toLowerCase();
  }
}

function mergeMidiasSuplemento(rows) {
  for (const row of rows) {
    const sq = row.sqCandidato != null ? String(row.sqCandidato).trim() : "";
    const extra = MIDIAS_SUPLEMENTO_POR_SQ[sq];
    if (!extra || !extra.length) continue;
    const cur = Array.isArray(row.midiasSociais) ? [...row.midiasSociais] : [];
    const seen = new Set(cur.map((x) => urlKeyMidia(x.url)));
    for (const e of extra) {
      const u = String(e.url || "").trim();
      if (!u || !/^https?:\/\//i.test(u)) continue;
      const k = urlKeyMidia(u);
      if (seen.has(k)) continue;
      seen.add(k);
      cur.push({ label: e.label || "Rede social", url: u });
    }
    if (cur.length) row.midiasSociais = cur;
  }
}

/**
 * Contatos verificados manualmente (ficheiro opcional), chave: SQ_CANDIDATO.
 * Isto não “raspa” redes: serve para anexar o que a equipa validar, além do TSE.
 */
function mergeContatosSuplemento(rows) {
  if (!fs.existsSync(CONTATOS_SUPP)) return;
  let sup;
  try {
    sup = JSON.parse(fs.readFileSync(CONTATOS_SUPP, "utf8"));
  } catch (e) {
    console.error("Aviso: vereadores-contatos-suplemento.json inválido ou ilegível:", e.message || e);
    return;
  }
  const map = sup.porSqCandidato;
  if (!map || typeof map !== "object") return;
  for (const row of rows) {
    const sq = row.sqCandidato != null ? String(row.sqCandidato).trim() : "";
    if (!sq || !map[sq]) continue;
    const o = map[sq];
    if (o.telefone != null && String(o.telefone).trim() !== "") {
      row.telefone = String(o.telefone).trim();
    }
    if (Array.isArray(o.whatsapp) && o.whatsapp.length) {
      const cur = Array.isArray(row.whatsapp) ? [...row.whatsapp] : [];
      for (const w of o.whatsapp) {
        const u = w && w.url && String(w.url).trim();
        if (!u || !/^https?:\/\//i.test(u)) continue;
        if (!cur.some((x) => x.url === u)) {
          cur.push({ label: (w && w.label) || "WhatsApp", url: u });
        }
      }
      if (cur.length) row.whatsapp = dedupeWaEntries(cur);
    }
  }
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

/** Ex.: DDD 21 e cel 987654321 → (21) 98765-4321 */
function exibirCelularBr(ddd, numSemDdd) {
  const c = String(numSemDdd).replace(/\D/g, "");
  if (c.length === 9) return `(${ddd}) ${c.slice(0, 5)}-${c.slice(5)}`;
  if (c.length === 8) return `(${ddd}) ${c.slice(0, 4)}-${c.slice(4)}`;
  return c ? `(${ddd}) ${c}` : "";
}

/**
 * Tira dígitos nacionais (DDD+número) de URLs oficiais TSE (rede_social_candidato) ou outras
 * ligações wa.me / api.whatsapp.com quando o CSV principal não traz NR_DDD_CELULAR / NR_CELULAR.
 */
function telefoneExibicaoDeUrlWhatsapp(u) {
  const s = String(u || "");
  const m1 = s.match(/[?&]phone=\+?(\d{10,15})/i);
  if (m1) {
    let d = m1[1].replace(/\D/g, "");
    if (d.startsWith("55") && d.length > 4) d = d.slice(2);
    if (d.length >= 10) return exibirCelularBr(d.slice(0, 2), d.slice(2));
  }
  const m2 = s.match(/wa\.me\/\+?(\d{10,15})/i);
  if (m2) {
    let d = m2[1].replace(/\D/g, "");
    if (d.startsWith("55") && d.length > 4) d = d.slice(2);
    if (d.length >= 10) return exibirCelularBr(d.slice(0, 2), d.slice(2));
  }
  return null;
}

/** Normaliza para https://wa.me/55... (apenas dígitos após 55) para dedupe com _waUrlCelular. */
function waMeUrlCanonicoDeUrlWhatsapp(u) {
  const s = String(u || "");
  const m1 = s.match(/[?&]phone=\+?(\d{10,15})/i);
  if (m1) {
    const d = m1[1].replace(/\D/g, "");
    if (d.length >= 10) return `https://wa.me/${d.startsWith("55") ? d : "55" + d}`;
  }
  const m2 = s.match(/wa\.me\/\+?(\d{10,15})/i);
  if (m2) {
    const d = m2[1].replace(/\D/g, "");
    if (d.length >= 10) return `https://wa.me/${d.startsWith("55") ? d : "55" + d}`;
  }
  return null;
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
  const ixDddCel = header.indexOf("NR_DDD_CELULAR");
  const ixCel = header.indexOf("NR_CELULAR");

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
    if (!SG_UE_ALVO.has(sgUe)) continue;
    const cdCargo = parseIntSafe(cols[ixCargo]);
    if (cdCargo !== CD_CARGO_VEREADOR) continue;

    const pick = (ix) =>
      ix >= 0 && cols[ix] != null ? String(cols[ix]).replace(/^"|"$/g, "").trim() : "";

    const dsSitTotTurno = ixSitTot >= 0 ? pick(ixSitTot) : "";
    const metaUe = METADATA_UE[sgUe] || {};
    /** wa.me a partir de DDD + celular declarados no TSE (se existirem colunas). */
    let _waUrlCelular;
    let telefone;
    if (ixDddCel >= 0 && ixCel >= 0) {
      const ddd = String(pick(ixDddCel) || "").replace(/\D/g, "");
      const cel = String(pick(ixCel) || "").replace(/\D/g, "");
      if (ddd.length >= 2 && cel.length >= 8) {
        _waUrlCelular = `https://wa.me/55${ddd}${cel}`;
        telefone = exibirCelularBr(ddd, cel) || undefined;
      }
    }
    rows.push({
      sgUeTse: sgUe,
      sqCandidato: pick(ixSq) || undefined,
      numero: pick(ixNr) || undefined,
      nomeUrna: pick(ixNmUrna) || pick(ixNmCand) || "—",
      nomeCompleto: pick(ixNmCand) || undefined,
      municipio: ixNmUe >= 0 ? pick(ixNmUe) : metaUe.municipio,
      ibgeMunicipio: metaUe.ibge,
      partido: pick(ixPartido) || "—",
      partidoNome: pick(ixNmPartido) || undefined,
      situacao: pick(ixDsSit) || undefined,
      dsSitTotTurno: dsSitTotTurno || undefined,
      papelEleicao: papelEleicao(dsSitTotTurno),
      dsCargo: ixDsCargo >= 0 ? pick(ixDsCargo) : undefined,
      ...(telefone ? { telefone } : {}),
      ...(_waUrlCelular ? { _waUrlCelular } : {}),
    });
  }

  const ordPapel = { eleito: 0, suplente: 1, participante: 2 };
  rows.sort((a, b) => {
    const pm = (a.municipio || "").localeCompare(b.municipio || "", "pt-BR");
    if (pm !== 0) return pm;
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

  let votosPorUeSq = new Map();
  let redePorSq = new Map();
  try {
    votosPorUeSq = votosVereadorPorUeSq(await ensureVotacaoMunzonaRjCsv());
  } catch (e) {
    console.error("Aviso: votos nominais não incluídos:", e.message || e);
  }
  try {
    redePorSq = redeSocialPorSqCandidato(await ensureRedeSocialRJ2024Csv());
  } catch (e) {
    console.error("Aviso: redes sociais / WhatsApp não incluídos:", e.message || e);
  }
  enriquecerVereadores(vereadores, votosPorUeSq, redePorSq);
  mergeMidiasSuplemento(vereadores);
  mergeContatosSuplemento(vereadores);

  const temSupContatos = fs.existsSync(CONTATOS_SUPP);
  const payload = {
    fonte:
      "TSE — consulta_cand (UF RJ, SG_UE 60011 Rio capital, 58335 Duque de Caxias, cargo 13), votacao_candidato_munzona (soma QT_VOTOS_NOMINAIS, 1º turno, cargo 13), rede_social_candidato (DS_URL) e DDD/celular em consulta_cand; quando faltar DDD/celular no CSV, o build infere exibição e link wa.me a partir de URLs oficiais TSE (api.whatsapp.com / wa.me). " +
      (temSupContatos
        ? "Contatos adicionais em data/vereadores-contatos-suplemento.json (verificados manualmente). "
        : "Opcional: data/vereadores-contatos-suplemento.json para contatos manuais verificados. ") +
      "Mais Instagram/sites verificados manualmente (MIDIAS_SUPLEMENTO) quando ausentes no TSE — eleições municipais 2024. Inclui eleitos, suplentes e demais participantes (DS_SIT_TOT_TURNO).",
    uf: "RJ",
    municipios: [
      { nome: "Rio de Janeiro", sgUeTse: "60011", ibge: "3304557" },
      { nome: "Duque de Caxias", sgUeTse: "58335", ibge: "3301702" },
    ],
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
