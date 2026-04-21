/**
 * Cloudflare Worker — proxy CORS para api.portaldatransparencia.gov.br
 *
 * Deploy (ex.): wrangler deploy
 * Depois em js/portal-transparencia-config.js (deploy em https://politcapp.com.br ou Pages):
 *   POLITAPP_PORTAL_API_BASE = "https://<seu-worker>.workers.dev/api-de-dados";
 *
 * A chave continua indo só no header do browser → Worker (não armazene no Worker).
 */
export default {
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Accept, chave-api-dados",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== "GET") {
      return json(405, { erro: "Use apenas GET" }, cors);
    }

    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api-de-dados")) {
      return json(
        404,
        { erro: "Rota esperada: /api-de-dados/… (emenda do mesmo path da API oficial)" },
        cors
      );
    }

    const upstream = "https://api.portaldatransparencia.gov.br" + url.pathname + url.search;
    const upstreamRes = await fetch(upstream, {
      method: "GET",
      headers: {
        Accept: request.headers.get("Accept") || "application/json",
        "chave-api-dados": request.headers.get("chave-api-dados") || "",
        "User-Agent": "Politapp-CF-Worker-Proxy/1",
      },
    });

    const out = new Response(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: upstreamRes.headers,
    });
    out.headers.set("Access-Control-Allow-Origin", "*");
    out.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    out.headers.set("Access-Control-Allow-Headers", "Accept, chave-api-dados");
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
