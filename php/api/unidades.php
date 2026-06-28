<?php
/**
 * Unidades.
 *   GET                         → { unidades:[...] }  (admin: todas; senão: a própria)
 *   POST { action:'add', nome, slug }  (admin)
 */
require_once __DIR__ . '/../lib/api.php';
$ctx  = pa_require_aprovado();
$prof = $ctx['profile'];
$isAdmin = ($prof['grupo'] ?? '') === 'admin';
$db  = pa_db();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  if ($isAdmin) {
    $st = $db->query("SELECT id, nome, slug, created_at FROM unidades ORDER BY nome");
    pa_json(['ok' => true, 'unidades' => $st->fetchAll()]);
  }
  if (!$prof['unidade_id']) pa_json(['ok' => true, 'unidades' => []]);
  $st = $db->prepare("SELECT id, nome, slug, created_at FROM unidades WHERE id = ?");
  $st->execute([$prof['unidade_id']]);
  pa_json(['ok' => true, 'unidades' => $st->fetchAll()]);
}

// mutações: só admin
if (!$isAdmin) pa_json(['ok' => false, 'erro' => 'apenas administradores'], 403);
$in = pa_input();
if (($in['action'] ?? '') === 'add') {
  $nome = trim($in['nome'] ?? '');
  $slug = trim($in['slug'] ?? '');
  if ($nome === '' || $slug === '') pa_json(['ok' => false, 'erro' => 'nome e slug obrigatórios'], 422);
  try {
    $db->prepare("INSERT INTO unidades (id, nome, slug) VALUES (?,?,?)")->execute([pa_uuid(), $nome, $slug]);
  } catch (PDOException $e) {
    pa_json(['ok' => false, 'erro' => (strpos($e->getMessage(), '1062') !== false) ? 'slug já existe' : 'erro ao criar'], 409);
  }
  pa_json(['ok' => true]);
}
pa_json(['ok' => false, 'erro' => 'ação inválida'], 400);
