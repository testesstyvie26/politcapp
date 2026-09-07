const SOURCES = {
  brasil: "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?qualidade=minima&intrarregiao=UF",
  rj: "https://servicodados.ibge.gov.br/api/v3/malhas/estados/33?qualidade=minima&intrarregiao=municipio",
  estados: "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome",
  municipios: "https://servicodados.ibge.gov.br/api/v1/localidades/estados/33/municipios?orderBy=nome"
};

export async function onRequestGet({ request, waitUntil }) {
  const scope = new URL(request.url).searchParams.get("scope") || "brasil", source = SOURCES[scope];
  if (!source) return Response.json({ error: "Mapa não disponível." }, { status: 404 });
  const cache = caches.default, key = new Request(new URL(request.url).origin + `/api/geo/ibge?scope=${scope}`);
  const stored = await cache.match(key); if (stored) return stored;
  const type = scope === "municipios" || scope === "estados" ? "application/json" : "image/svg+xml";
  const upstream = await fetch(source, { headers: { Accept: type }, signal: AbortSignal.timeout(12000) });
  if (!upstream.ok) return Response.json({ error: "O mapa oficial está temporariamente indisponível." }, { status: 502 });
  const response = new Response(upstream.body, { headers: { "Content-Type": type + "; charset=utf-8", "Cache-Control": "public, max-age=86400, s-maxage=604800", "X-Content-Type-Options": "nosniff" } });
  waitUntil(cache.put(key, response.clone())); return response;
}
