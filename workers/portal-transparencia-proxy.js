/**
 * Cloudflare Worker — proxy CORS para api.portaldatransparencia.gov.br
 *
 * Deploy: na raiz do repo → npx wrangler deploy  (ver wrangler.toml na raiz; não use pasta inteira como assets)
 * Depois em js/portal-transparencia-config.js (deploy em https://politcapp.com.br ou Pages):
 *   POLITAPP_PORTAL_API_BASE = "https://<seu-worker>.workers.dev/api-de-dados";
 *
 * A chave continua indo só no header do browser → Worker (não armazene no Worker).
 */
export default {
  async fetch(request) {
    const reqHdr = request.headers.get("Access-Control-Request-Headers");
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": reqHdr || "Accept, chave-api-dados, Content-Type",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== "GET") {
      return json(405, { erro: "Use apenas GET" }, cors);
    }

    const url = new URL(request.url);
    // Se POLITAPP_PORTAL_API_BASE for só "https://….workers.dev" (sem /api-de-dados), o browser pede /emendas;
    // se a rota no Cloudflare remover o prefixo, pathname pode vir só /emendas. Normalizamos como na API CGU.
    let path = url.pathname || "/";
    if (!path.startsWith("/api-de-dados")) {
      path = "/api-de-dados" + (path === "/" ? "" : path);
    }

    const upstream = "https://api.portaldatransparencia.gov.br" + path + url.search;
    // A CGU costuma devolver 403 em alguns paths se o pedido parecer “bot”; headers de browser ajudam.
    const upstreamRes = await fetch(upstream, {
      method: "GET",
      headers: {
        Accept: request.headers.get("Accept") || "application/json",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "chave-api-dados": request.headers.get("chave-api-dados") || "",
        Referer: "https://portaldatransparencia.gov.br/",
        Origin: "https://portaldatransparencia.gov.br",
        "User-Agent":
          request.headers.get("User-Agent") ||
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });

    const out = new Response(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: upstreamRes.headers,
    });
    out.headers.set("Access-Control-Allow-Origin", "*");
    out.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    out.headers.set("Access-Control-Allow-Headers", "Accept, chave-api-dados, Content-Type");
    return out;
  },
};

function json(status, body, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...cors,
    },
  });
}
