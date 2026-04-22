/**
 * Servidor local: arquivos estáticos + proxy /api-de-dados → Portal da Transparência.
 * Tudo na mesma origem (ex.: http://127.0.0.1:8787) → o navegador não bloqueia o fetch.
 *
 * Uso: npm run dev
 * Abra: http://127.0.0.1:8787/transparencia.html
 *
 * Encaminha /escuta-proxy/* → http://127.0.0.1:3334/* (mesma origem, evita “Failed to fetch”).
 * Requer noutro terminal: npm run dev:escuta-proxy
 */
"use strict";

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 8787;
const UPSTREAM = "api.portaldatransparencia.gov.br";
const ESCUTA_UPSTREAM = process.env.POLITAPP_ESCUTA_UPSTREAM || "http://127.0.0.1:3334";

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

function sendCors(res, status, body) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, chave-api-dados",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(body);
}

function proxyApi(req, res) {
  let pathQuery;
  try {
    pathQuery = new URL(req.url, "http://localhost").pathname + new URL(req.url, "http://localhost").search;
  } catch {
    sendCors(res, 400, JSON.stringify({ erro: "URL inválida" }));
    return;
  }

  if (!pathQuery.startsWith("/api-de-dados")) {
    sendCors(
      res,
      404,
      JSON.stringify({
        erro: "Rota esperada: /api-de-dados/... (ex.: /api-de-dados/emendas?ano=2024&pagina=1)",
      })
    );
    return;
  }

  const opts = {
    hostname: UPSTREAM,
    port: 443,
    path: pathQuery,
    method: "GET",
    headers: {
      Accept: req.headers.accept || "application/json",
      "chave-api-dados": req.headers["chave-api-dados"] || "",
      "User-Agent": "Politapp-PolitappDevServer/1",
    },
  };

  const preq = https.request(opts, (pres) => {
    res.writeHead(pres.statusCode || 502, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Accept, chave-api-dados",
      "Content-Type": pres.headers["content-type"] || "application/json; charset=utf-8",
    });
    pres.pipe(res);
  });

  preq.on("error", (err) => {
    if (res.headersSent) return;
    sendCors(res, 502, JSON.stringify({ erro: "Proxy: " + err.message }));
  });

  preq.end();
}

function safeFileForUrl(pathname) {
  const rel = pathname.replace(/^\/+/, "");
  if (!rel) return path.join(ROOT, "index.html");
  const resolved = path.resolve(ROOT, rel);
  const relToRoot = path.relative(ROOT, resolved);
  if (relToRoot.startsWith("..") || path.isAbsolute(relToRoot)) return null;
  return resolved;
}

function sendStatic(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type });
  fs.createReadStream(filePath).pipe(res);
}

function proxyEscuta(req, res) {
  let inner;
  try {
    const u = new URL(req.url || "/", "http://127.0.0.1");
    inner = (u.pathname.slice("/escuta-proxy".length) || "/") + u.search;
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad request");
    return;
  }

  let base;
  try {
    base = new URL(ESCUTA_UPSTREAM);
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("POLITAPP_ESCUTA_UPSTREAM inválido");
    return;
  }

  const isHttps = base.protocol === "https:";
  const port = base.port ? Number(base.port) : isHttps ? 443 : 80;
  const opts = {
    hostname: base.hostname,
    port,
    path: inner,
    method: req.method || "GET",
    headers: {
      "User-Agent": req.headers["user-agent"] || "Politapp-Dev-EscutaForward/1",
    },
  };

  const lib = isHttps ? https : http;
  const preq = lib.request(opts, (pres) => {
    const skip = new Set(["connection", "transfer-encoding"]);
    const h = {};
    for (const [k, v] of Object.entries(pres.headers)) {
      if (v != null && !skip.has(k.toLowerCase())) h[k] = v;
    }
    res.writeHead(pres.statusCode || 502, h);
    pres.pipe(res);
  });
  preq.on("error", (e) => {
    if (res.headersSent) return;
    res.writeHead(502, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(
      JSON.stringify({
        error:
          "Ligação ao proxy de escuta falhou (" +
          ESCUTA_UPSTREAM +
          "). Noutro terminal execute: npm run dev:escuta-proxy — " +
          e.message,
      })
    );
  });
  preq.end();
}

function staticHandler(req, res) {
  const u = new URL(req.url, "http://127.0.0.1");
  let pathname = u.pathname;
  if (pathname === "/") pathname = "/index.html";

  let filePath = safeFileForUrl(pathname);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, st) => {
    if (!err && st.isFile()) {
      sendStatic(filePath, res);
      return;
    }
    if (!pathname.endsWith(".html")) {
      const alt = safeFileForUrl(pathname + ".html");
      if (alt) {
        fs.stat(alt, (e2, st2) => {
          if (!e2 && st2.isFile()) {
            sendStatic(alt, res);
            return;
          }
          res.writeHead(404);
          res.end("Not found");
        });
        return;
      }
    }
    res.writeHead(404);
    res.end("Not found");
  });
}

const server = http.createServer((req, res) => {
  if (req.url && req.url.startsWith("/escuta-proxy")) {
    proxyEscuta(req, res);
    return;
  }

  if (req.url && req.url.startsWith("/api-de-dados")) {
    if (req.method === "OPTIONS") {
      sendCors(res, 204, "");
      return;
    }
    if (req.method !== "GET") {
      sendCors(res, 405, JSON.stringify({ erro: "Use apenas GET" }));
      return;
    }
    proxyApi(req, res);
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method !== "GET") {
    res.writeHead(405);
    res.end("Method not allowed");
    return;
  }
  staticHandler(req, res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(
    "[politapp-dev] http://127.0.0.1:" +
      PORT +
      "/ — estático + /api-de-dados → https://" +
      UPSTREAM +
      "\n[politapp-dev] Transparência: http://127.0.0.1:" +
      PORT +
      "/transparencia.html" +
      "\n[politapp-dev] Mídia social: http://127.0.0.1:" +
      PORT +
      "/midia-social.html (proxy escuta: /escuta-proxy → " +
      ESCUTA_UPSTREAM +
      " ; corra npm run dev:escuta-proxy)"
  );
});
