/**
 * Proxy local para a API v2 do X (Twitter): o browser não pode chamar api.twitter.com por CORS.
 *
 * Uso:
 *   set TWITTER_BEARER_TOKEN=seu_bearer_aqui
 *   npm run dev:escuta-proxy
 *
 * Rotas (GET, CORS *):
 *   /health
 *   /api/x/search/recent?q=&max=
 *   /api/x/conversation?tweet_id=&max=   — pesquisa conversation_id:ID (respostas na conversa)
 *
 * O servidor escuta apenas em 127.0.0.1 por defeito.
 */
"use strict";

const http = require("http");
const https = require("https");
const { URL } = require("url");

const PORT = Number(process.env.POLITAPP_ESCUTA_PROXY_PORT) || 3334;
const HOST = process.env.POLITAPP_ESCUTA_PROXY_HOST || "127.0.0.1";
const BEARER = process.env.TWITTER_BEARER_TOKEN || process.env.ESCUTA_X_BEARER || "";

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(body);
}

function twitterGet(pathWithQuery) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "api.twitter.com",
      port: 443,
      path: pathWithQuery,
      method: "GET",
      headers: {
        Authorization: `Bearer ${BEARER}`,
        "User-Agent": "Politapp-EscutaSocial-Proxy/1",
      },
    };
    const req = https.request(opts, (pres) => {
      const chunks = [];
      pres.on("data", (c) => chunks.push(c));
      pres.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let j;
        try {
          j = JSON.parse(raw);
        } catch {
          j = { errors: [{ message: raw.slice(0, 500) }] };
        }
        resolve({ status: pres.statusCode || 502, body: j });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Use GET" });
    return;
  }

  let u;
  try {
    u = new URL(req.url || "/", "http://localhost");
  } catch {
    sendJson(res, 400, { error: "URL inválida" });
    return;
  }

  if (u.pathname === "/health") {
    sendJson(res, 200, { ok: true, hasBearer: !!BEARER, port: PORT });
    return;
  }

  if (!BEARER) {
    sendJson(res, 503, {
      error: "Defina TWITTER_BEARER_TOKEN (ou ESCUTA_X_BEARER) no ambiente antes de iniciar o proxy.",
    });
    return;
  }

  try {
    if (u.pathname === "/api/x/search/recent") {
      const q = u.searchParams.get("q") || "segurança Rio de Janeiro -is:retweet lang:pt";
      const max = Math.min(100, Math.max(5, Number(u.searchParams.get("max")) || 15));
      const path =
        "/2/tweets/search/recent?query=" +
        encodeURIComponent(q) +
        "&max_results=" +
        max +
        "&tweet.fields=created_at,author_id,conversation_id&expansions=author_id&user.fields=username,name";
      const { status, body } = await twitterGet(path);
      sendJson(res, status >= 400 ? status : 200, body);
      return;
    }

    if (u.pathname === "/api/x/conversation") {
      const tweetId = (u.searchParams.get("tweet_id") || "").replace(/\D/g, "");
      if (!tweetId) {
        sendJson(res, 400, { error: "Parâmetro tweet_id obrigatório (ID numérico do post)." });
        return;
      }
      const max = Math.min(100, Math.max(5, Number(u.searchParams.get("max")) || 15));
      const q = "conversation_id:" + tweetId;
      const path =
        "/2/tweets/search/recent?query=" +
        encodeURIComponent(q) +
        "&max_results=" +
        max +
        "&tweet.fields=created_at,author_id,conversation_id,in_reply_to_user_id&expansions=author_id&user.fields=username,name";
      const { status, body } = await twitterGet(path);
      sendJson(res, status >= 400 ? status : 200, body);
      return;
    }

    sendJson(res, 404, {
      error: "Rotas: /health, /api/x/search/recent?q=&max=, /api/x/conversation?tweet_id=&max=",
    });
  } catch (e) {
    sendJson(res, 502, { error: String(e.message || e) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Escuta social proxy em http://${HOST}:${PORT}/ (Bearer: ${BEARER ? "definido" : "AUSENTE"})`);
});
