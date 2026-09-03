const AUTH_ORIGIN = "https://cmbusinesstoken.com/politicapp/php/auth/";

const ALLOWED_ENDPOINTS = new Set([
  "google-token.php",
  "login.php",
  "logout.php",
  "me.php",
  "phone-request.php",
  "phone-verify.php",
  "register.php",
]);

const ALLOWED_METHODS = new Set(["GET", "POST"]);

export async function onRequest({ request, params }) {
  const endpoint = String(params.endpoint || "");
  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return Response.json({ ok: false, erro: "Endpoint de autenticação inválido." }, { status: 404 });
  }

  if (!ALLOWED_METHODS.has(request.method)) {
    return Response.json(
      { ok: false, erro: "Método não permitido." },
      { status: 405, headers: { Allow: "GET, POST" } },
    );
  }

  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(endpoint + incomingUrl.search, AUTH_ORIGIN);
  const headers = new Headers({ Accept: "application/json" });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method === "POST") init.body = await request.arrayBuffer();

  try {
    const upstream = await fetch(upstreamUrl, init);
    const responseHeaders = new Headers({
      "Cache-Control": "no-store",
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Auth upstream unavailable", error);
    return Response.json(
      { ok: false, erro: "Serviço de autenticação temporariamente indisponível." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
