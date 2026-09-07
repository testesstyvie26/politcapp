<?php
/**
 * Politicapp ERP — guarda de documentos em MySQL com Kanban e versionamento.
 * GET  ?action=list|detail|download
 * POST action=upload|status|metadata|delete
 */
require_once __DIR__ . '/../lib/api.php';

$ctx = pa_require_aprovado();
$user = $ctx['user'];
$profile = $ctx['profile'];
$db = pa_db();
$officeId = (string)($profile['unidade_id'] ?? 'central');
$role = (string)($profile['grupo'] ?? 'operacoes');
$userId = (string)$user['id'];

function doc_response($data, int $status = 200): void { pa_json($data, $status); }
function doc_can_manage(string $role): bool { return in_array($role, ['admin', 'gestao'], true); }
function doc_valid_id(string $id): bool { return (bool)preg_match('/^[0-9a-f-]{36}$/i', $id); }
function doc_clean(string $value, int $max): string { return mb_substr(trim($value), 0, $max); }
function doc_find(PDO $db, string $id, string $officeId): ?array {
  $st = $db->prepare('SELECT * FROM erp_documents WHERE id = ? AND unidade_id = ? LIMIT 1');
  $st->execute([$id, $officeId]);
  return $st->fetch() ?: null;
}
function doc_can_read(array $doc, string $role, string $userId): bool {
  return $doc['visibilidade'] === 'gabinete' || doc_can_manage($role) || $doc['created_by'] === $userId;
}
function doc_event(PDO $db, string $documentId, string $userId, string $event, string $details = ''): void {
  $db->prepare('INSERT INTO erp_document_events (id, document_id, user_id, evento, detalhes) VALUES (?,?,?,?,?)')
     ->execute([pa_uuid(), $documentId, $userId, $event, $details ?: null]);
}
function doc_ensure_schema(PDO $db): void {
  try {
    $db->query('SELECT 1 FROM erp_documents LIMIT 1');
    return;
  } catch (Throwable $e) { /* primeira execução: cria o módulo */ }
  $db->exec("CREATE TABLE IF NOT EXISTS erp_documents (
    id CHAR(36) NOT NULL, unidade_id CHAR(36) NOT NULL, titulo VARCHAR(200) NOT NULL,
    descricao TEXT NULL, categoria VARCHAR(80) NULL, status VARCHAR(24) NOT NULL DEFAULT 'rascunho',
    visibilidade VARCHAR(24) NOT NULL DEFAULT 'gabinete', versao_atual INT UNSIGNED NOT NULL DEFAULT 0,
    created_by CHAR(36) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY(id), KEY idx_erp_documents_unidade_status(unidade_id,status), KEY idx_erp_documents_criador(created_by)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $db->exec("CREATE TABLE IF NOT EXISTS erp_document_versions (
    id CHAR(36) NOT NULL, document_id CHAR(36) NOT NULL, numero INT UNSIGNED NOT NULL,
    nome_arquivo VARCHAR(255) NOT NULL, mime VARCHAR(127) NOT NULL, tamanho BIGINT UNSIGNED NOT NULL,
    checksum_sha256 CHAR(64) NOT NULL, observacao VARCHAR(500) NULL, conteudo LONGBLOB NOT NULL,
    uploaded_by CHAR(36) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(id), UNIQUE KEY uq_erp_document_version(document_id,numero),
    KEY idx_erp_document_versions_documento(document_id,created_at),
    CONSTRAINT fk_erp_document_versions_documento FOREIGN KEY(document_id) REFERENCES erp_documents(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $db->exec("CREATE TABLE IF NOT EXISTS erp_document_events (
    id CHAR(36) NOT NULL, document_id CHAR(36) NOT NULL, user_id CHAR(36) NOT NULL,
    evento VARCHAR(40) NOT NULL, detalhes VARCHAR(500) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(id), KEY idx_erp_document_events_documento(document_id,created_at),
    CONSTRAINT fk_erp_document_events_documento FOREIGN KEY(document_id) REFERENCES erp_documents(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}
function doc_file(array $file): array {
  $max = 8 * 1024 * 1024;
  if (!isset($file['error']) || is_array($file['error']) || $file['error'] !== UPLOAD_ERR_OK) {
    doc_response(['ok' => false, 'erro' => 'Falha no envio do arquivo.'], 422);
  }
  $size = (int)($file['size'] ?? 0);
  if ($size < 1 || $size > $max || !is_uploaded_file($file['tmp_name'])) {
    doc_response(['ok' => false, 'erro' => 'O arquivo deve ter no máximo 8 MB.'], 422);
  }
  $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']) ?: '';
  $allowed = [
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
    'text/plain', 'text/csv', 'application/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet'
  ];
  if (!in_array($mime, $allowed, true)) {
    doc_response(['ok' => false, 'erro' => 'Tipo não permitido. Envie PDF, imagem, texto ou documento Office.'], 422);
  }
  $content = file_get_contents($file['tmp_name']);
  if ($content === false) doc_response(['ok' => false, 'erro' => 'Não foi possível ler o arquivo.'], 422);
  return [
    'name' => doc_clean((string)($file['name'] ?? 'documento'), 255),
    'mime' => $mime,
    'size' => $size,
    'hash' => hash('sha256', $content),
    'content' => $content,
  ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'POST'], true)) doc_response(['ok' => false, 'erro' => 'Método inválido.'], 405);
try { doc_ensure_schema($db); }
catch (Throwable $e) {
  error_log('[documentos] schema: ' . $e->getMessage());
  doc_response(['ok' => false, 'erro' => 'As tabelas de documentos ainda não puderam ser preparadas no MySQL.'], 503);
}
$input = $method === 'POST' ? ($_POST ?: pa_input()) : $_GET;
$action = (string)($input['action'] ?? ($method === 'GET' ? 'list' : ''));

if ($method === 'GET' && $action === 'list') {
  $where = "d.unidade_id = ? AND (d.visibilidade = 'gabinete' OR d.created_by = ? OR ? = 1)";
  $args = [$officeId, $userId, doc_can_manage($role) ? 1 : 0];
  $st = $db->prepare("SELECT d.id,d.titulo,d.descricao,d.categoria,d.status,d.visibilidade,d.versao_atual,d.created_by,d.created_at,d.updated_at,
      v.id AS version_id,v.nome_arquivo,v.mime,v.tamanho,v.checksum_sha256,v.created_at AS version_created_at,
      (SELECT COUNT(*) FROM erp_document_versions x WHERE x.document_id=d.id) AS total_versoes
    FROM erp_documents d
    LEFT JOIN erp_document_versions v ON v.document_id=d.id AND v.numero=d.versao_atual
    WHERE $where ORDER BY d.updated_at DESC LIMIT 300");
  $st->execute($args);
  doc_response(['ok' => true, 'storage' => 'mysql', 'items' => $st->fetchAll()]);
}

if ($method === 'GET' && $action === 'detail') {
  $id = (string)($input['id'] ?? '');
  $doc = doc_valid_id($id) ? doc_find($db, $id, $officeId) : null;
  if (!$doc || !doc_can_read($doc, $role, $userId)) doc_response(['ok' => false, 'erro' => 'Documento não encontrado.'], 404);
  $st = $db->prepare('SELECT id,numero,nome_arquivo,mime,tamanho,checksum_sha256,observacao,uploaded_by,created_at FROM erp_document_versions WHERE document_id=? ORDER BY numero DESC');
  $st->execute([$id]);
  doc_response(['ok' => true, 'item' => $doc, 'versions' => $st->fetchAll()]);
}

if ($method === 'GET' && $action === 'download') {
  $versionId = (string)($input['version_id'] ?? '');
  $st = $db->prepare('SELECT v.*,d.unidade_id,d.visibilidade,d.created_by FROM erp_document_versions v JOIN erp_documents d ON d.id=v.document_id WHERE v.id=? AND d.unidade_id=? LIMIT 1');
  $st->execute([$versionId, $officeId]);
  $version = $st->fetch();
  if (!$version || !doc_can_read($version, $role, $userId)) { http_response_code(404); exit('Documento não encontrado.'); }
  header('Content-Type: ' . $version['mime']);
  header('Content-Length: ' . $version['tamanho']);
  header("Content-Disposition: attachment; filename*=UTF-8''" . rawurlencode($version['nome_arquivo']));
  header('X-Content-Type-Options: nosniff');
  header('Cache-Control: private, no-store');
  echo $version['conteudo'];
  exit;
}

if ($method === 'POST' && $action === 'upload') {
  if (empty($_FILES['arquivo'])) doc_response(['ok' => false, 'erro' => 'Selecione um arquivo.'], 422);
  $file = doc_file($_FILES['arquivo']);
  $documentId = (string)($input['document_id'] ?? '');
  $newDocument = $documentId === '';
  $doc = null;
  if (!$newDocument) {
    $doc = doc_valid_id($documentId) ? doc_find($db, $documentId, $officeId) : null;
    if (!$doc || !doc_can_read($doc, $role, $userId)) doc_response(['ok' => false, 'erro' => 'Documento não encontrado.'], 404);
  }
  $title = doc_clean((string)($input['titulo'] ?? pathinfo($file['name'], PATHINFO_FILENAME)), 200);
  $description = doc_clean((string)($input['descricao'] ?? ''), 5000);
  $category = doc_clean((string)($input['categoria'] ?? ''), 80);
  $visibility = in_array(($input['visibilidade'] ?? ''), ['gabinete', 'restrito'], true) ? $input['visibilidade'] : 'gabinete';
  $note = doc_clean((string)($input['observacao'] ?? ''), 500);
  if ($title === '') doc_response(['ok' => false, 'erro' => 'Informe o título do documento.'], 422);
  $db->beginTransaction();
  try {
    if ($newDocument) {
      $documentId = pa_uuid();
      $db->prepare("INSERT INTO erp_documents(id,unidade_id,titulo,descricao,categoria,status,visibilidade,versao_atual,created_by) VALUES(?,?,?,?,?,'rascunho',?,0,?)")
         ->execute([$documentId, $officeId, $title, $description ?: null, $category ?: null, $visibility, $userId]);
      $number = 1;
    } else {
      $lock = $db->prepare('SELECT versao_atual FROM erp_documents WHERE id=? AND unidade_id=? FOR UPDATE');
      $lock->execute([$documentId, $officeId]);
      $number = ((int)$lock->fetchColumn()) + 1;
    }
    $versionId = pa_uuid();
    $db->prepare('INSERT INTO erp_document_versions(id,document_id,numero,nome_arquivo,mime,tamanho,checksum_sha256,observacao,conteudo,uploaded_by) VALUES(?,?,?,?,?,?,?,?,?,?)')
       ->execute([$versionId, $documentId, $number, $file['name'], $file['mime'], $file['size'], $file['hash'], $note ?: null, $file['content'], $userId]);
    $db->prepare('UPDATE erp_documents SET versao_atual=?,updated_at=NOW() WHERE id=?')->execute([$number, $documentId]);
    doc_event($db, $documentId, $userId, $newDocument ? 'criado' : 'nova_versao', 'Versão ' . $number);
    $db->commit();
    doc_response(['ok' => true, 'id' => $documentId, 'version_id' => $versionId, 'version' => $number], 201);
  } catch (Throwable $e) {
    if ($db->inTransaction()) $db->rollBack();
    error_log('[documentos] upload: ' . $e->getMessage());
    doc_response(['ok' => false, 'erro' => 'Não foi possível guardar o documento no MySQL.'], 500);
  }
}

if ($method === 'POST' && in_array($action, ['status', 'metadata'], true)) {
  $id = (string)($input['id'] ?? '');
  $doc = doc_valid_id($id) ? doc_find($db, $id, $officeId) : null;
  if (!$doc || !doc_can_read($doc, $role, $userId)) doc_response(['ok' => false, 'erro' => 'Documento não encontrado.'], 404);
  if ($action === 'status') {
    $status = (string)($input['status'] ?? '');
    if (!in_array($status, ['rascunho', 'revisando', 'aprovado', 'arquivado'], true)) doc_response(['ok' => false, 'erro' => 'Status inválido.'], 422);
    if ($status === 'aprovado' && !doc_can_manage($role)) doc_response(['ok' => false, 'erro' => 'A aprovação exige perfil de gestão.'], 403);
    $db->prepare('UPDATE erp_documents SET status=?,updated_at=NOW() WHERE id=? AND unidade_id=?')->execute([$status, $id, $officeId]);
    doc_event($db, $id, $userId, 'status', $doc['status'] . ' → ' . $status);
  } else {
    if (!doc_can_manage($role) && $doc['created_by'] !== $userId) doc_response(['ok' => false, 'erro' => 'Sem permissão para editar.'], 403);
    $title = doc_clean((string)($input['titulo'] ?? $doc['titulo']), 200);
    $description = doc_clean((string)($input['descricao'] ?? $doc['descricao']), 5000);
    $category = doc_clean((string)($input['categoria'] ?? $doc['categoria']), 80);
    $visibility = in_array(($input['visibilidade'] ?? ''), ['gabinete', 'restrito'], true) ? $input['visibilidade'] : $doc['visibilidade'];
    if ($title === '') doc_response(['ok' => false, 'erro' => 'Informe o título.'], 422);
    $db->prepare('UPDATE erp_documents SET titulo=?,descricao=?,categoria=?,visibilidade=?,updated_at=NOW() WHERE id=? AND unidade_id=?')
       ->execute([$title, $description ?: null, $category ?: null, $visibility, $id, $officeId]);
    doc_event($db, $id, $userId, 'editado');
  }
  doc_response(['ok' => true, 'id' => $id]);
}

if ($method === 'POST' && $action === 'delete') {
  if (!doc_can_manage($role)) doc_response(['ok' => false, 'erro' => 'A exclusão exige perfil de gestão.'], 403);
  $id = (string)($input['id'] ?? '');
  $doc = doc_valid_id($id) ? doc_find($db, $id, $officeId) : null;
  if (!$doc) doc_response(['ok' => false, 'erro' => 'Documento não encontrado.'], 404);
  $db->prepare('DELETE FROM erp_documents WHERE id=? AND unidade_id=?')->execute([$id, $officeId]);
  doc_response(['ok' => true, 'id' => $id]);
}

doc_response(['ok' => false, 'erro' => 'Ação inválida.'], 400);
