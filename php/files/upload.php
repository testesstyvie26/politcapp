<?php
/**
 * POST multipart — campo "arquivo" (+ opcionais: entidade, entidade_id).
 * Requer sessão. Grava no disco e registra em `arquivos`.
 */
require_once __DIR__ . '/../lib/uploads.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') pa_json(['ok' => false, 'erro' => 'método inválido'], 405);

$u = pa_current_user();
if (!$u) pa_json(['ok' => false, 'erro' => 'não autenticado'], 401);

if (empty($_FILES['arquivo'])) pa_json(['ok' => false, 'erro' => 'nenhum arquivo enviado (campo "arquivo")'], 422);

// unidade do usuário (escopo), via profile
$unidadeId = null;
try {
  $st = pa_db()->prepare("SELECT unidade_id FROM profiles WHERE id = ? LIMIT 1");
  $st->execute([$u['id']]);
  $unidadeId = $st->fetchColumn() ?: null;
} catch (Throwable $e) { /* profiles opcional */ }

$r = pa_store_upload($_FILES['arquivo'], [
  'user_id'     => $u['id'],
  'unidade_id'  => $unidadeId,
  'entidade'    => isset($_POST['entidade']) ? mb_substr($_POST['entidade'], 0, 40) : null,
  'entidade_id' => $_POST['entidade_id'] ?? null,
]);
pa_json($r, $r['ok'] ? 200 : 422);
