const UPSTREAM = "https://cmbusinesstoken.com/politicapp/php/api/documentos.php";
const baseHeaders = { "Cache-Control": "no-store" };

function json(data, status = 200) {
  return Response.json(data, { status, headers: baseHeaders });
}

export async function onRequest({ request }) {
  if (!["GET", "POST"].includes(request.method)) return json({ ok: false, error: "Método não permitido." }, 405);
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (request.method === "POST" && origin && origin !== requestUrl.origin) return json({ ok: false, error: "Origem não autorizada." }, 403);

  const upstreamUrl = new URL(UPSTREAM);
  upstreamUrl.search = requestUrl.search;
  const headers = new Headers();
  headers.set("Accept", request.headers.get("Accept") || "application/json");
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === "POST" ? request.body : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "erp_documents_upstream_failed", message: String(error) }));
    return json({ ok: false, error: "O serviço de documentos está temporariamente indisponível." }, 502);
  }

  const responseHeaders = new Headers(baseHeaders);
  for (const name of ["content-type", "content-length", "content-disposition", "x-content-type-options"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
