<?php
/**
 * Aviso do mural (linha única id=1).
 *   GET            → { mensagem }
 *   POST { mensagem }  (admin ou gestão)
 */
require_once __DIR__ . '/../lib/api.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  pa_require_aprovado();
  $st = pa_db()->query("SELECT mensagem FROM anuncio_tarefas WHERE id = 1 LIMIT 1");
  pa_json(['ok' => true, 'mensagem' => (string)($st->fetchColumn() ?: '')]);
}

$ctx = pa_require_aprovado();
if (!in_array($ctx['profile']['grupo'] ?? '', ['admin', 'gestao'], true)) {
  pa_json(['ok' => false, 'erro' => 'apenas admin/gestão'], 403);
}
$in = pa_input();
$msg = (string)($in['mensagem'] ?? '');
pa_db()->prepare(
  "INSERT INTO anuncio_tarefas (id, mensagem, atualizado_por, atualizado_em)
   VALUES (1, ?, ?, NOW())
   ON DUPLICATE KEY UPDATE mensagem = VALUES(mensagem), atualizado_por = VALUES(atualizado_por), atualizado_em = NOW()"
)->execute([$msg, $ctx['user']['id']]);
pa_json(['ok' => true]);
