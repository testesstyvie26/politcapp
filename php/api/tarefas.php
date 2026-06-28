<?php
/**
 * Tarefas + notas por unidade/dia.
 *   GET  ?unidade_id&dia            → { tarefas:[...], nota:"" }
 *   POST { action:'add', unidade_id, dia, texto }
 *   POST { action:'toggle', id, concluida }
 *   POST { action:'del', id }
 *   POST { action:'nota', unidade_id, dia, corpo }
 */
require_once __DIR__ . '/../lib/api.php';
$ctx  = pa_require_aprovado();
$prof = $ctx['profile'];
$isAdmin = ($prof['grupo'] ?? '') === 'admin';
$myU = $prof['unidade_id'] ?? null;
$db  = pa_db();

function tarefas_unidade_ok($uid, $isAdmin, $myU) { return $isAdmin || ($uid && $uid === $myU); }
/** id de tarefa acessível ao usuário? (admin: qualquer; senão: da sua unidade) */
function tarefa_scope_ok($db, $id, $isAdmin, $myU) {
  if ($isAdmin) return true;
  $st = $db->prepare("SELECT unidade_id FROM tarefas WHERE id = ? LIMIT 1");
  $st->execute([$id]);
  return $st->fetchColumn() === $myU;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $uid = $_GET['unidade_id'] ?? '';
  $dia = $_GET['dia'] ?? '';
  if (!tarefas_unidade_ok($uid, $isAdmin, $myU)) pa_json(['ok' => false, 'erro' => 'sem acesso à unidade'], 403);
  $st = $db->prepare("SELECT id, texto, concluida, ordem FROM tarefas WHERE unidade_id = ? AND data_dia = ? ORDER BY ordem");
  $st->execute([$uid, $dia]);
  $tarefas = $st->fetchAll();
  foreach ($tarefas as &$t) { $t['concluida'] = (bool)$t['concluida']; }
  $n = $db->prepare("SELECT corpo FROM notas_unidade_dia WHERE unidade_id = ? AND data_dia = ? LIMIT 1");
  $n->execute([$uid, $dia]);
  pa_json(['ok' => true, 'tarefas' => $tarefas, 'nota' => (string)($n->fetchColumn() ?: '')]);
}

$in = pa_input();
$action = $in['action'] ?? '';

if ($action === 'add') {
  $uid = $in['unidade_id'] ?? ''; $dia = $in['dia'] ?? ''; $texto = trim($in['texto'] ?? '');
  if (!tarefas_unidade_ok($uid, $isAdmin, $myU)) pa_json(['ok' => false, 'erro' => 'sem acesso'], 403);
  if ($texto === '') pa_json(['ok' => false, 'erro' => 'texto vazio'], 422);
  $o = $db->prepare("SELECT COALESCE(MAX(ordem),-1)+1 FROM tarefas WHERE unidade_id = ? AND data_dia = ?");
  $o->execute([$uid, $dia]); $ord = (int)$o->fetchColumn();
  $db->prepare("INSERT INTO tarefas (id, unidade_id, data_dia, texto, concluida, ordem, created_by) VALUES (?,?,?,?,0,?,?)")
     ->execute([pa_uuid(), $uid, $dia, $texto, $ord, $ctx['user']['id']]);
  pa_json(['ok' => true]);
}

if ($action === 'toggle') {
  $id = $in['id'] ?? '';
  if (!tarefa_scope_ok($db, $id, $isAdmin, $myU)) pa_json(['ok' => false, 'erro' => 'sem acesso'], 403);
  $db->prepare("UPDATE tarefas SET concluida = ?, updated_at = NOW() WHERE id = ?")
     ->execute([!empty($in['concluida']) ? 1 : 0, $id]);
  pa_json(['ok' => true]);
}

if ($action === 'del') {
  $id = $in['id'] ?? '';
  if (!tarefa_scope_ok($db, $id, $isAdmin, $myU)) pa_json(['ok' => false, 'erro' => 'sem acesso'], 403);
  $db->prepare("DELETE FROM tarefas WHERE id = ?")->execute([$id]);
  pa_json(['ok' => true]);
}

if ($action === 'nota') {
  $uid = $in['unidade_id'] ?? ''; $dia = $in['dia'] ?? ''; $corpo = (string)($in['corpo'] ?? '');
  if (!tarefas_unidade_ok($uid, $isAdmin, $myU)) pa_json(['ok' => false, 'erro' => 'sem acesso'], 403);
  $db->prepare(
    "INSERT INTO notas_unidade_dia (unidade_id, data_dia, corpo, updated_by, updated_at)
     VALUES (?,?,?,?,NOW())
     ON DUPLICATE KEY UPDATE corpo = VALUES(corpo), updated_by = VALUES(updated_by), updated_at = NOW()"
  )->execute([$uid, $dia, $corpo, $ctx['user']['id']]);
  pa_json(['ok' => true]);
}

pa_json(['ok' => false, 'erro' => 'ação inválida'], 400);
