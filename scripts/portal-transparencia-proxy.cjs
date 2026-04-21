/**
 * Proxy HTTP local para a API do Portal da Transparência (evita bloqueio CORS no navegador).
 * Uso: npm run dev:portal-proxy
 * Deixe a página apontar para http://127.0.0.1:8787 (automático em localhost / file / 127.0.0.1).
 */
"use strict";

const http = require("http");
const https = require("https");
const { URL } = require("url");

const PORT = Number(process.env.POLITAPP_PORTAL_PROXY_PORT) || 8787;
const UPSTREAM = "api.portaldatransparencia.gov.br";

function sendCors(res, status, body, contentType) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, chave-api-dados",
    "Content-Type": contentType || "application/json; charset=utf-8",
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    sendCors(res, 204, "");
    return;
  }

  if (req.method !== "GET") {
    sendCors(res, 405, JSON.stringify({ erro: "Use apenas GET" }));
    return;
  }

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
      "User-Agent": "Politapp-PortalTransparencia-Proxy/1",
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
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(
    "[portal-proxy] escutando http://127.0.0.1:" +
      PORT +
      " → https://" +
      UPSTREAM +
      "/api-de-dados/…\n" +
      "[portal-proxy] Abra transparencia.html via http://localhost ou inicie este proxy antes de buscar emendas."
  );
});
