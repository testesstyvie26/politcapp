/**
 * Gera PDFs de apresentação do Politapp em PT-BR com capturas (Playwright + pdf-lib).
 *
 * Uso:
 *   npm run build:pdf-apresentacao              → técnico (todas as áreas + URL das telas)
 *   npm run build:pdf-apresentacao-comercial    → visão comercial (narrativa + prints essenciais)
 *
 * Requer: npm install ; npx playwright install chromium
 */
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const isComercial = process.argv.includes("--comercial");

const OUT = path.join(
  ROOT,
  "docs",
  isComercial ? "Politapp-apresentacao-comercial.pdf" : "Politapp-apresentacao.pdf",
);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function startStaticServer() {
  const server = http.createServer((req, res) => {
    try {
      const u = new URL(req.url || "/", "http://127.0.0.1");
      let pathname = decodeURIComponent(u.pathname).replace(/^\/+/, "") || "index.html";
      const candidate = path.resolve(ROOT, pathname);
      if (!candidate.startsWith(path.resolve(ROOT))) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.stat(candidate, (err, st) => {
        if (err || !st.isFile()) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        const ext = path.extname(candidate).toLowerCase();
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        fs.createReadStream(candidate).pipe(res);
      });
    } catch {
      res.writeHead(500);
      res.end();
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, port });
    });
    server.on("error", reject);
  });
}

/** @type {{ title: string; detail: string; path: string; waitSelector?: string; timeoutMs?: number; fullPage?: boolean }[]} */
const SLIDES_TECNICO = [
  {
    title: "Entrar e cadastro",
    detail:
      "Autenticação com Google via Supabase; após o login o perfil pode passar por aprovação administrativa antes do acesso completo ao app.",
    path: "/login.html",
    waitSelector: ".page, main, body",
    timeoutMs: 20000,
    fullPage: true,
  },
  {
    title: "Agenda pública e contato",
    detail:
      "Página pública (sem guarda de sessão) para agenda, canal de contato e manifestações da equipe junto ao eleitorado.",
    path: "/landing-publico.html",
    waitSelector: ".wrap header, header",
    timeoutMs: 20000,
    fullPage: true,
  },
  {
    title: "Deputados federais — lista Câmara e votos TSE",
    detail:
      "Lista paginada a partir da API v2 da Câmara, com filtros (nome, partido, UF, legislatura), enriquecimento com votos TSE 2022 e links para o perfil do candidato — módulo central do Politapp junto com RJ (vereadores, prefeituras) e transparência.",
    path: "/index.html",
    waitSelector: "#content table, #content .error",
    timeoutMs: 90000,
    fullPage: true,
  },
  {
    title: "Eleição 2022 · Distrito Federal",
    detail: "Recorte eleitoral e tabelas específicas do DF conforme dados TSE/Câmara no site.",
    path: "/eleicao-2022-deputado-federal.html",
    waitSelector: ".wrap, body",
    timeoutMs: 45000,
    fullPage: true,
  },
  {
    title: "Visão executiva",
    detail: "Consolidados e indicadores de campanha / executivo para leitura rápida pela coordenação.",
    path: "/executivo.html",
    waitSelector: ".wrap, body",
    timeoutMs: 45000,
    fullPage: true,
  },
  {
    title: "Insights RJ",
    detail: "Painel de insights com foco no estado do Rio de Janeiro.",
    path: "/insights-rj.html",
    waitSelector: ".wrap, body",
    timeoutMs: 45000,
    fullPage: true,
  },
  {
    title: "Prefeituras RJ",
    detail: "Dados e navegação por prefeituras do estado do Rio.",
    path: "/prefeituras-rj.html",
    waitSelector: ".wrap, body",
    timeoutMs: 45000,
    fullPage: true,
  },
  {
    title: "Vereadores RJ",
    detail: "Lista, filtros e análises de vereadores (Rio e Caxias), com vínculos para mapas e comparativos.",
    path: "/vereadores-rj.html",
    waitSelector: ".wrap, body",
    timeoutMs: 45000,
    fullPage: true,
  },
  {
    title: "Mapa de votos (zona e seção)",
    detail: "Visualização geográfica de votação por zona e seção eleitoral.",
    path: "/vereadores-rj-mapa-votos.html",
    waitSelector: ".wrap, body",
    timeoutMs: 60000,
    fullPage: true,
  },
  {
    title: "Portal da Transparência",
    detail:
      "Consulta a despesas e receitas via API federal; em desenvolvimento local use npm run dev para proxy na mesma origem e evitar bloqueio CORS.",
    path: "/transparencia.html",
    waitSelector: ".wrap, body",
    timeoutMs: 45000,
    fullPage: true,
  },
  {
    title: "Mídia social — escuta e conteúdo",
    detail:
      "Painel de acompanhamento de redes; pode depender do proxy de escuta (npm run dev:escuta-proxy) para dados ao vivo.",
    path: "/midia-social.html",
    waitSelector: ".wrap, body",
    timeoutMs: 45000,
    fullPage: true,
  },
  {
    title: "WhatsApp — bot",
    detail: "Documentação e interface relacionada ao fluxo do bot em WhatsApp.",
    path: "/whatsapp.html",
    waitSelector: ".wrap, body",
    timeoutMs: 20000,
    fullPage: true,
  },
  {
    title: "Guia de uso",
    detail: "Manual interno com orientações de navegação e boas práticas no Politapp.",
    path: "/guia-uso.html",
    waitSelector: ".wrap, body",
    timeoutMs: 20000,
    fullPage: true,
  },
  {
    title: "Tarefas",
    detail: "Acompanhamento de tarefas e demandas operacionais.",
    path: "/tarefas.html",
    waitSelector: ".wrap, body",
    timeoutMs: 20000,
    fullPage: true,
  },
  {
    title: "Minha conta",
    detail:
      "Dados do usuário logado, grupo, unidade e estado da conta; link para áreas administrativas quando aplicável.",
    path: "/conta.html",
    waitSelector: "#panel, .wrap",
    timeoutMs: 25000,
    fullPage: true,
  },
  {
    title: "Administração",
    detail: "Painéis admin (unidades e aprovações) para gestores; requer perfil autorizado em produção.",
    path: "/admin.html",
    waitSelector: ".wrap, body",
    timeoutMs: 25000,
    fullPage: true,
  },
];

/** Slides enxutos e copy comercial (benefícios; sem jargão de deploy). */
const SLIDES_COMERCIAL = [
  {
    title: "Acesso seguro para a equipe",
    detail:
      "Autenticação padronizada e fluxo de aprovação de perfis: você define quem acessa o que, com menos risco operacional e mais governança.",
    path: "/login.html",
    waitSelector: ".page, main, body",
    timeoutMs: 20000,
    fullPage: true,
  },
  {
    title: "Institucional e relacionamento",
    detail:
      "Canal público para agenda, contato e manifestações: transparência com o eleitorado e um ponto único de escuta formal.",
    path: "/landing-publico.html",
    waitSelector: ".wrap header, header",
    timeoutMs: 20000,
    fullPage: true,
  },
  {
    title: "Mandato e performance eleitoral",
    detail:
      "Visão unificada de deputados federais com cruzamento de dados oficiais da Câmara e resultados de urna: menos planilhas, mais clareza para decisão.",
    path: "/index.html",
    waitSelector: "#content table, #content .error",
    timeoutMs: 90000,
    fullPage: true,
  },
  {
    title: "Painel para a coordenação",
    detail:
      "Indicadores e consolidados em um só lugar: leitura rápida para liderança de campanha ou mandato, sem depender de relatórios esparsos.",
    path: "/executivo.html",
    waitSelector: ".wrap, body",
    timeoutMs: 45000,
    fullPage: true,
  },
  {
    title: "Inteligência regional — RJ",
    detail:
      "Recortes e análises com foco no Rio de Janeiro: apoio concreto a estratégia territorial e narrativa local.",
    path: "/insights-rj.html",
    waitSelector: ".wrap, body",
    timeoutMs: 45000,
    fullPage: true,
  },
  {
    title: "Base municipal",
    detail:
      "Navegação por prefeituras do estado: alinhamento entre capital, interior e articulação federativa.",
    path: "/prefeituras-rj.html",
    waitSelector: ".wrap, body",
    timeoutMs: 45000,
    fullPage: true,
  },
  {
    title: "Câmaras e legislativo local",
    detail:
      "Listas, filtros e análises de vereadores com apoio a comparativos e leituras de cenário municipal.",
    path: "/vereadores-rj.html",
    waitSelector: ".wrap, body",
    timeoutMs: 45000,
    fullPage: true,
  },
  {
    title: "Território de voto",
    detail:
      "Mapa por zona e seção: onde a campanha converte ou precisa reforço — geometria da eleição aplicada ao planejamento de campo.",
    path: "/vereadores-rj-mapa-votos.html",
    waitSelector: ".wrap, body",
    timeoutMs: 60000,
    fullPage: true,
  },
  {
    title: "Transparência e reputação",
    detail:
      "Consulta integrada a despesas e receitas públicas federais: embasamento para pesquisa, fiscalização institucional e conteúdo factível.",
    path: "/transparencia.html",
    waitSelector: ".wrap, body",
    timeoutMs: 45000,
    fullPage: true,
  },
  {
    title: "Escuta em mídias sociais",
    detail:
      "Acompanhamento de conversa digital: tendências, narratives e tempo de resposta da equipe de comunicação.",
    path: "/midia-social.html",
    waitSelector: ".wrap, body",
    timeoutMs: 45000,
    fullPage: true,
  },
  {
    title: "Relacionamento em escala — WhatsApp",
    detail:
      "Integração com fluxos de WhatsApp para atendimento, disparo de informação e engajamento com apoiadores.",
    path: "/whatsapp.html",
    waitSelector: ".wrap, body",
    timeoutMs: 20000,
    fullPage: true,
  },
  {
    title: "Gestão de usuários e perfis",
    detail:
      "Área da conta com visão clara de grupo, unidade e status: transição suave entre operação cotidiana e governança de acesso.",
    path: "/conta.html",
    waitSelector: "#panel, .wrap",
    timeoutMs: 25000,
    fullPage: true,
  },
];

const SLIDES = isComercial ? SLIDES_COMERCIAL : SLIDES_TECNICO;

function wrapLines(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawTextBlock(page, lines, opts) {
  const { x, startY, size, font, color, leading } = opts;
  let y = startY;
  for (const line of lines) {
    page.drawText(line, { x, y, size, font, color });
    y -= leading;
  }
  return y;
}

async function main() {
  const { server, port } = await startStaticServer();
  const base = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1360, height: 900 },
    deviceScaleFactor: 1,
  });
  await context.addInitScript(() => {
    window.POLITAPP_PRESENTATION_CAPTURE = true;
  });

  const shots = [];

  try {
    for (const slide of SLIDES) {
      const page = await context.newPage();
      try {
        await page.goto(`${base}${slide.path}`, { waitUntil: "domcontentloaded", timeout: slide.timeoutMs || 60000 });
        if (slide.waitSelector) {
          await page.waitForSelector(slide.waitSelector, { timeout: slide.timeoutMs || 60000 });
        }
        await page.evaluate(() => new Promise((r) => setTimeout(r, 900)));
        const buf = await page.screenshot({
          type: "png",
          fullPage: slide.fullPage !== false,
        });
        shots.push({ ...slide, png: buf });
      } catch (e) {
        console.warn(`[politapp-pdf] Falha em ${slide.path}:`, e.message || e);
        shots.push({ ...slide, png: null, fail: String(e.message || e) });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const W = 595;
  const H = 842;
  const margin = 48;
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  function drawCoverTecnico() {
    const page = pdfDoc.addPage([W, H]);
    page.drawText("Politapp", {
      x: margin,
      y: H - margin - 42,
      size: 28,
      font: fontBold,
      color: rgb(0.12, 0.16, 0.22),
    });
    page.drawText("Apresentação do sistema", {
      x: margin,
      y: H - margin - 78,
      size: 16,
      font,
      color: rgb(0.25, 0.3, 0.38),
    });
    page.drawText(`Gerado em ${dateStr}`, {
      x: margin,
      y: margin + 28,
      size: 10,
      font,
      color: rgb(0.45, 0.48, 0.52),
    });
    const intro = wrapLines(
      "Este documento resume as principais áreas do Politapp com capturas de tela geradas automaticamente a partir do código local. Alguns módulos dependem de APIs externas (Câmara, TSE, Portal da Transparência) ou de proxies opcionais; a aparência pode variar conforme rede e dados disponíveis.",
      72,
    );
    drawTextBlock(page, intro, {
      x: margin,
      startY: H - margin - 130,
      size: 11,
      font,
      color: rgb(0.2, 0.22, 0.28),
      leading: 14,
    });
  }

  function drawCoverComercial() {
    const page = pdfDoc.addPage([W, H]);
    const accent = rgb(0.08, 0.35, 0.72);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(0.96, 0.97, 0.98) });
    page.drawRectangle({ x: 0, y: H - 120, width: W, height: 120, color: accent });
    page.drawText("Politapp", {
      x: margin,
      y: H - margin - 36,
      size: 32,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page.drawText("Inteligência política e dados públicos", {
      x: margin,
      y: H - margin - 76,
      size: 14,
      font,
      color: rgb(0.9, 0.93, 0.98),
    });
    page.drawText("Apresentação comercial", {
      x: margin,
      y: H - 160,
      size: 18,
      font: fontBold,
      color: rgb(0.12, 0.16, 0.22),
    });
    page.drawText(`Referência · ${dateStr}`, {
      x: margin,
      y: margin + 20,
      size: 9,
      font,
      color: rgb(0.45, 0.48, 0.52),
    });
    let y = H - margin - 200;
    const pitch = wrapLines(
      "Plataforma web que une mandato, eleição, território, transparência federal, escuta digital e relacionamento via WhatsApp — com acesso corporativo para equipes que precisam decidir rápido, com dados oficiais e governança de usuários.",
      74,
    );
    y = drawTextBlock(page, pitch, {
      x: margin,
      startY: y,
      size: 11,
      font,
      color: rgb(0.22, 0.25, 0.32),
      leading: 14,
    }) - 8;
    const bullets = wrapLines(
      "Uma só visão • Menos dispersão entre portais • Leitura territorial • Conformidade institucional com trilho de login e aprovação",
      74,
    );
    drawTextBlock(page, bullets, {
      x: margin,
      startY: y,
      size: 10,
      font: fontBold,
      color: rgb(0.2, 0.35, 0.58),
      leading: 14,
    });
  }

  function drawComercialNarrativa() {
    let p = pdfDoc.addPage([W, H]);
    p.drawText("Por que existe o Politapp", {
      x: margin,
      y: H - margin - 40,
      size: 16,
      font: fontBold,
      color: rgb(0.1, 0.12, 0.18),
    });
    let y = H - margin - 78;
    const bloco1 =
      "Equipes políticas e institucionais consomem dezenas de fontes públicas diferentes. Cruzar Câmara, TSE, municípios, mapas eleitorais e transparência exige tempo e aumenta erro. O Politapp organiza esse ecossistema em um ambiente navegável, com foco no Rio de Janeiro e extensível a outras agendas.";
    y = drawTextBlock(p, wrapLines(bloco1, 76), {
      x: margin,
      startY: y,
      size: 10,
      font,
      color: rgb(0.22, 0.25, 0.32),
      leading: 13,
    });
    y -= 18;
    y = drawTextBlock(p, wrapLines("O que o cliente ganha:", 76), {
      x: margin,
      startY: y,
      size: 11,
      font: fontBold,
      color: rgb(0.1, 0.12, 0.18),
      leading: 14,
    });
    y -= 6;
    const gains = [
      "Decisão mais rápida com indicadores executivos e recortes RJ.",
      "Argumentação sustentada em dados oficiais auditáveis (Câmara, TSE, Transparência).",
      "Leitura onde o voto nasce — zona e seção — para campo e comunicação.",
      "Escuta e relacionamento digital integrados ao mesmo ecossistema de gestão.",
      "Controle de acesso: onboarding e aprovação alinhados à sua política interna.",
    ];
    for (const g of gains) {
      for (const line of wrapLines(`• ${g}`, 74)) {
        p.drawText(line, { x: margin, y, size: 10, font, color: rgb(0.24, 0.26, 0.34) });
        y -= 13;
      }
      y -= 4;
      if (y < margin + 80) break;
    }

    p = pdfDoc.addPage([W, H]);
    p.drawText("Para quem é", {
      x: margin,
      y: H - margin - 40,
      size: 16,
      font: fontBold,
      color: rgb(0.1, 0.12, 0.18),
    });
    y = H - margin - 74;
    const quem = [
      "Campanhas e mandatos que precisam de inteligência operacional diária.",
      "Coordenações que articulam capital, interior e legislativos municipais no RJ.",
      "Comunicação e estratégia que exigem escuta digital e institucional alinhadas.",
      "Organizações que não podem abrir mão de trilho de acesso para equipes e terceiros.",
    ];
    for (const q of quem) {
      for (const line of wrapLines(`• ${q}`, 74)) {
        p.drawText(line, { x: margin, y, size: 10, font, color: rgb(0.24, 0.26, 0.34) });
        y -= 13;
      }
      y -= 8;
    }
    y -= 12;
    p.drawText("Proposta de valor em uma frase", {
      x: margin,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.1, 0.12, 0.18),
    });
    y -= 22;
    drawTextBlock(
      p,
      wrapLines(
        "Do gasto público ao voto na seção, com equipe cadastrada e narrativa territorial — menos ruído, mais consistência institucional.",
        74,
      ),
      { x: margin, startY: y, size: 11, font, color: rgb(0.15, 0.28, 0.52), leading: 15 },
    );
  }

  if (isComercial) {
    drawCoverComercial();
    drawComercialNarrativa();
  } else {
    drawCoverTecnico();
  }

  const showTechnicalUrlFooter = !isComercial;

  for (const shot of shots) {
    const textPage = pdfDoc.addPage([W, H]);
    let ty = H - margin;
    textPage.drawText(shot.title, {
      x: margin,
      y: ty,
      size: isComercial ? 17 : 16,
      font: fontBold,
      color: rgb(0.1, 0.12, 0.18),
    });
    ty -= 28;
    for (const line of wrapLines(shot.detail, 78)) {
      textPage.drawText(line, { x: margin, y: ty, size: 10, font, color: rgb(0.22, 0.25, 0.32) });
      ty -= 13;
    }
    if (showTechnicalUrlFooter) {
      textPage.drawText(`URL: ${shot.path}`, {
        x: margin,
        y: margin + 12,
        size: 8,
        font,
        color: rgb(0.45, 0.48, 0.52),
      });
    } else if (ty > margin + 40) {
      textPage.drawText("Demonstração ao vivo · Material confidencial do projeto", {
        x: margin,
        y: margin + 14,
        size: 8,
        font,
        color: rgb(0.55, 0.58, 0.62),
      });
    }

    if (shot.fail) {
      const errPage = pdfDoc.addPage([W, H]);
      errPage.drawText("Falha na captura", { x: margin, y: H - margin - 40, size: 14, font: fontBold });
      let ey = H - margin - 70;
      for (const line of wrapLines(shot.fail, 80)) {
        errPage.drawText(line, { x: margin, y: ey, size: 9, font, color: rgb(0.5, 0.2, 0.2) });
        ey -= 12;
      }
      continue;
    }
    if (!shot.png) continue;

    const imgPage = pdfDoc.addPage([W, H]);
    const image = await pdfDoc.embedPng(shot.png);
    const iw = image.width;
    const ih = image.height;
    const maxW = W - margin * 2;
    const maxH = H - margin * 2 - 24;
    const scale = Math.min(maxW / iw, maxH / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const x = margin + (maxW - dw) / 2;
    const iy = margin + (maxH - dh) / 2;
    imgPage.drawText(shot.title, {
      x: margin,
      y: H - margin - 10,
      size: 9,
      font: fontBold,
      color: rgb(0.35, 0.38, 0.42),
    });
    imgPage.drawImage(image, { x, y: iy, width: dw, height: dh });
  }

  if (isComercial) {
    const last = pdfDoc.addPage([W, H]);
    last.drawText("Próximo passo", {
      x: margin,
      y: H - margin - 48,
      size: 20,
      font: fontBold,
      color: rgb(0.08, 0.35, 0.72),
    });
    const closer = wrapLines(
      "Agende uma sessão técnico-comercial para customização de perfis de acesso, recortes territoriais adicionais e integração aos fluxos já existentes na sua organização. O Politapp evolui com seu calendário eleitoral e suas prioridades institucionais.",
      76,
    );
    drawTextBlock(last, closer, {
      x: margin,
      startY: H - margin - 92,
      size: 11,
      font,
      color: rgb(0.22, 0.25, 0.32),
      leading: 15,
    });
    last.drawText(`Politapp · ${dateStr}`, {
      x: margin,
      y: margin + 24,
      size: 9,
      font,
      color: rgb(0.5, 0.52, 0.56),
    });
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(OUT, pdfBytes);
  console.log(`PDF salvo em: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
