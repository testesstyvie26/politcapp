/**
 * Proxy local para APIs de redes (CORS): X (Twitter) e Meta (Facebook / Instagram Graph).
 *
 * Uso:
 *   set TWITTER_BEARER_TOKEN=...          — rotas /api/x/*
 *   set META_PAGE_ACCESS_TOKEN=...      — rotas /api/meta/* (token de página de longa duração)
 *   npm run dev:escuta-proxy
 *
 * Variáveis alternativas: ESCUTA_X_BEARER, FACEBOOK_PAGE_ACCESS_TOKEN
 *
 * Rotas GET (CORS *):
 *   /health
 *   /api/x/search/recent?q=&max=
 *   /api/x/conversation?tweet_id=&max=
 *   /api/meta/fb/comments?post_id=PAGE_POST|&url=permalink&limit=
 *   /api/meta/ig/comments?media_id=&limit=&media_permalink= (permalink opcional para ligação nos cartões)
 *
 * Meta: o token deve ser de uma Página com permissões para ler comentários (ex.: pages_read_engagement).
 * Instagram: conta comercial/creator ligada à mesma página; media_id = id numérico da mídia na Graph API.
 *
 * O servidor escuta em 127.0.0.1:3334 por defeito (POLITAPP_ESCUTA_PROXY_*).
 */
"use strict";

const http = require("http");
const https = require("https");
const { URL } = require("url");

const PORT = Number(process.env.POLITAPP_ESCUTA_PROXY_PORT) || 3334;
const HOST = process.env.POLITAPP_ESCUTA_PROXY_HOST || "127.0.0.1";
const BEARER = process.env.TWITTER_BEARER_TOKEN || process.env.ESCUTA_X_BEARER || "";
const META_TOKEN =
  process.env.META_PAGE_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";

const GRAPH_VERSION = "v21.0";

/** Evita bloqueio “Private Network Access” ao pedir localhost a partir de páginas https ou alguns contextos. */
function corsHeaders(extra) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Access-Control-Request-Private-Network",
    "Access-Control-Allow-Private-Network": "true",
    ...extra,
  };
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    ...corsHeaders({ "Content-Type": "application/json; charset=utf-8" }),
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

function graphGet(pathWithLeadingSlash) {
  const path =
    pathWithLeadingSlash +
    (pathWithLeadingSlash.includes("?") ? "&" : "?") +
    "access_token=" +
    encodeURIComponent(META_TOKEN);
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "graph.facebook.com",
      port: 443,
      path,
      method: "GET",
      headers: { "User-Agent": "Politapp-EscutaMeta/1" },
    };
    https
      .get(opts, (pres) => {
        const chunks = [];
        pres.on("data", (c) => chunks.push(c));
        pres.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let j;
          try {
            j = JSON.parse(raw);
          } catch {
            j = { error: { message: raw.slice(0, 400) } };
          }
          resolve({ status: pres.statusCode || 502, body: j });
        });
      })
      .on("error", reject);
  });
}

function mapFbComments(graphBody, parentPostId) {
  const list = (graphBody && graphBody.data) || [];
  const parts = String(parentPostId || "").split("_");
  const pageId = parts[0];
  const storyFbid = parts.slice(1).join("_") || parts[1];
  return list.map((c) => {
    const from = c.from || {};
    const commentId = c.id;
    let postUrl = "";
    if (pageId && storyFbid && commentId) {
      postUrl = `https://www.facebook.com/${pageId}/posts/${storyFbid}?comment_id=${encodeURIComponent(commentId)}`;
    }
    return {
      nome: (from.name || "Utilizador Facebook") + " — comentário na publicação",
      handle: from.id ? "fb:" + from.id : "",
      plataforma: "facebook",
      perfilUrl: from.id ? `https://www.facebook.com/${from.id}` : "",
      perfilDesc: "Meta Graph API · comentário em post de página",
      texto: String(c.message || "").slice(0, 560),
      ctx: "Comentário lido via Graph API (Facebook)",
      fbCommentId: commentId,
      postUrl,
      tipoFonte: "api_facebook",
      verificado: false,
    };
  });
}

function mapIgComments(graphBody, mediaPermalink) {
  const list = (graphBody && graphBody.data) || [];
  const perm = String(mediaPermalink || "").trim();
  return list.map((c) => ({
    nome: (c.username || "Utilizador Instagram") + " — comentário",
    handle: c.username ? "@" + String(c.username).replace(/^@+/, "") : "",
    plataforma: "instagram",
    perfilUrl: c.username ? `https://www.instagram.com/${encodeURIComponent(c.username)}/` : "",
    perfilDesc: "Meta Graph API · comentário em mídia",
    texto: String(c.text || "").slice(0, 560),
    ctx: "Comentário lido via Graph API (Instagram)",
    igCommentId: c.id,
    postUrl: perm,
    tipoFonte: "api_instagram",
    verificado: false,
  }));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
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
    sendJson(res, 200, {
      ok: true,
      hasBearer: !!BEARER,
      hasMetaPageToken: !!META_TOKEN,
      port: PORT,
    });
    return;
  }

  if (u.pathname.startsWith("/api/meta/")) {
    if (!META_TOKEN) {
      sendJson(res, 503, {
        error:
          "Defina META_PAGE_ACCESS_TOKEN (ou FACEBOOK_PAGE_ACCESS_TOKEN) com token de página Meta (longa duração).",
      });
      return;
    }

    try {
      if (u.pathname === "/api/meta/fb/comments") {
        let postId = (u.searchParams.get("post_id") || "").trim();
        const urlParam = (u.searchParams.get("url") || "").trim();
        if (!postId && urlParam) {
          const { status, body } = await graphGet(
            `/${GRAPH_VERSION}/?id=${encodeURIComponent(urlParam)}&fields=id`
          );
          if (body.error) {
            sendJson(res, status >= 400 ? status : 400, {
              error: body.error.message || JSON.stringify(body.error),
            });
            return;
          }
          postId = body.id || "";
        }
        if (!postId) {
          sendJson(res, 400, {
            error: "Indique post_id (formato pageId_postId) ou url (permalink da publicação da página).",
          });
          return;
        }
        const limit = Math.min(100, Math.max(1, Number(u.searchParams.get("limit")) || 25));
        const fields = encodeURIComponent("id,message,created_time,from{id,name}");
        const { status, body } = await graphGet(
          `/${GRAPH_VERSION}/${encodeURIComponent(postId)}/comments?fields=${fields}&limit=${limit}`
        );
        if (body.error) {
          sendJson(res, status >= 400 ? status : 400, {
            error: body.error.message || JSON.stringify(body.error),
          });
          return;
        }
        sendJson(res, 200, { items: mapFbComments(body, postId), postId });
        return;
      }

      if (u.pathname === "/api/meta/ig/comments") {
        const mediaId = (u.searchParams.get("media_id") || "").replace(/\D/g, "");
        if (!mediaId) {
          sendJson(res, 400, {
            error: "Parâmetro media_id obrigatório (id numérico da mídia na Instagram Graph API).",
          });
          return;
        }
        const limit = Math.min(100, Math.max(1, Number(u.searchParams.get("limit")) || 25));
        const mediaPermalink = (u.searchParams.get("media_permalink") || "").trim();
        const fields = encodeURIComponent("id,text,username,timestamp");
        const { status, body } = await graphGet(
          `/${GRAPH_VERSION}/${mediaId}/comments?fields=${fields}&limit=${limit}`
        );
        if (body.error) {
          sendJson(res, status >= 400 ? status : 400, {
            error: body.error.message || JSON.stringify(body.error),
          });
          return;
        }
        sendJson(res, 200, { items: mapIgComments(body, mediaPermalink), mediaId });
        return;
      }

      sendJson(res, 404, {
        error: "Rotas Meta: /api/meta/fb/comments, /api/meta/ig/comments",
      });
    } catch (e) {
      sendJson(res, 502, { error: String(e.message || e) });
    }
    return;
  }

  if (u.pathname.startsWith("/api/x/")) {
    if (!BEARER) {
      sendJson(res, 503, {
        error: "Defina TWITTER_BEARER_TOKEN (ou ESCUTA_X_BEARER) no ambiente para rotas /api/x/*.",
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
        error: "Rotas X: /api/x/search/recent, /api/x/conversation",
      });
    } catch (e) {
      sendJson(res, 502, { error: String(e.message || e) });
    }
    return;
  }

  sendJson(res, 404, {
    error:
      "Rotas: /health, /api/x/* (Bearer), /api/meta/* (META_PAGE_ACCESS_TOKEN). Ver cabeçalho do script.",
  });
});

server.listen(PORT, HOST, () => {
  console.log(
    `Escuta proxy http://${HOST}:${PORT}/ | X Bearer: ${BEARER ? "sim" : "não"} | Meta página: ${
      META_TOKEN ? "sim" : "não"
    }`
  );
});
