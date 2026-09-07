const AUTH_ME = "https://cmbusinesstoken.com/politicapp/php/auth/me.php";
const FILES_BASE = "https://cmbusinesstoken.com/politicapp/php/files";
const headers = { "Cache-Control": "no-store" };
const json = (data, status = 200) => Response.json(data, { status, headers });

async function identity(request, body = {}) {
  const url = new URL(request.url);
  const token = String(url.searchParams.get("_token") || body._token || "");
  if (!token) return null;
  const auth = new URL(AUTH_ME);
  auth.searchParams.set("_token", token);
  const result = await fetch(auth, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!result.ok) return null;
  const data = await result.json();
  if (!data.ok || !data.autenticado || data.profile?.conta_status !== "aprovado") return null;
  return { user: data.user || {}, profile: data.profile };
}

function safeName(name) {
  return String(name || "arquivo").normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
}

export async function onRequest({ request, env }) {
  if (!env.ERP_DB) return json({ ok: false, error: "Banco de documentos não configurado." }, 503);
  if (!["GET", "POST", "DELETE"].includes(request.method)) return json({ ok: false, error: "Método não permitido." }, 405);
  const origin = request.headers.get("Origin");
  if (request.method !== "GET" && origin && origin !== new URL(request.url).origin) return json({ ok: false, error: "Origem não autorizada." }, 403);
  let form, body = {};
  if (request.method === "POST") form = await request.formData().catch(() => null);
  if (request.method === "DELETE") body = await request.json().catch(() => ({}));
  const credentials = form ? { _token: form.get("_token") } : body;
  const account = await identity(request, credentials).catch(() => null);
  if (!account) return json({ ok: false, error: "Sessão inválida." }, 401);
  if (!["admin", "gestao"].includes(account.profile.grupo)) return json({ ok: false, error: "Acesso não autorizado." }, 403);
  const office = String(account.profile.unidade_id || "central");
  const db = typeof env.ERP_DB.withSession === "function" ? env.ERP_DB.withSession("first-primary") : env.ERP_DB;

  if (request.method === "GET") {
    const url = new URL(request.url), id = url.searchParams.get("id"), projectId = url.searchParams.get("project_id");
    if (id) {
      const item = await db.prepare("SELECT * FROM erp_project_files WHERE id=? AND office_id=?").bind(id, office).first();
      if (!item) return json({ ok: false, error: "Documento não encontrado." }, 404);
      const remoteId = String(item.object_key).replace(/^locaweb:/, "");
      const remote = await fetch(`${FILES_BASE}/serve.php?id=${encodeURIComponent(remoteId)}&_token=${encodeURIComponent(url.searchParams.get("_token") || "")}`);
      if (!remote.ok || !remote.body) return json({ ok: false, error: "Arquivo indisponível." }, remote.status || 404);
      const responseHeaders = new Headers(headers);
      responseHeaders.set("Content-Type", item.content_type);
      responseHeaders.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(item.file_name)}`);
      return new Response(remote.body, { headers: responseHeaders });
    }
    if (!projectId) return json({ ok: false, error: "Informe o projeto." }, 400);
    const rows = await db.prepare("SELECT id,project_id,stage_id,file_name,content_type,size_bytes,created_at FROM erp_project_files WHERE office_id=? AND project_id=? ORDER BY created_at DESC").bind(office, projectId).all();
    return json({ ok: true, items: rows.results || [] });
  }

  if (request.method === "POST") {
    if (!form) return json({ ok: false, error: "Envio inválido." }, 400);
    const projectId = String(form.get("project_id") || ""), stageId = String(form.get("stage_id") || ""), file = form.get("file");
    if (!projectId || !stageId || !(file instanceof File) || !file.size) return json({ ok: false, error: "Selecione um arquivo e uma etapa." }, 400);
    if (file.size > 8 * 1024 * 1024) return json({ ok: false, error: "O arquivo deve ter no máximo 8 MB." }, 413);
    const stage = await db.prepare("SELECT id FROM erp_project_stages WHERE id=? AND project_id=? AND office_id=?").bind(stageId, projectId, office).first();
    if (!stage) return json({ ok: false, error: "Etapa não encontrada." }, 404);
    const upstreamForm = new FormData(); upstreamForm.append("_token", String(form.get("_token") || "")); upstreamForm.append("arquivo", file, safeName(file.name)); upstreamForm.append("entidade", "projeto_etapa"); upstreamForm.append("entidade_id", stageId);
    const upstream = await fetch(`${FILES_BASE}/upload.php`, { method: "POST", body: upstreamForm });
    const uploaded = await upstream.json().catch(() => ({}));
    if (!upstream.ok || !uploaded.ok || !uploaded.arquivo?.id) return json({ ok: false, error: uploaded.erro || "Não foi possível armazenar o arquivo." }, upstream.status || 502);
    const id = crypto.randomUUID(), key = `locaweb:${uploaded.arquivo.id}`;
    await db.prepare("INSERT INTO erp_project_files(id,office_id,project_id,stage_id,object_key,file_name,content_type,size_bytes,uploaded_by) VALUES(?,?,?,?,?,?,?,?,?)").bind(id, office, projectId, stageId, key, uploaded.arquivo.nome || file.name.slice(0, 240), uploaded.arquivo.mime || file.type || "application/octet-stream", uploaded.arquivo.tamanho || file.size, String(account.user.id || account.user.email || "unknown")).run();
    return json({ ok: true, id, fileName: file.name }, 201);
  }

  const id = String(body.id || "");
  const item = await db.prepare("SELECT object_key FROM erp_project_files WHERE id=? AND office_id=?").bind(id, office).first();
  if (!item) return json({ ok: false, error: "Documento não encontrado." }, 404);
  await db.prepare("DELETE FROM erp_project_files WHERE id=? AND office_id=?").bind(id, office).run();
  return json({ ok: true, id });
}
