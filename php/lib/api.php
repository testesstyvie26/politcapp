<?php
/** Helpers de autorização para a API de dados (usa o auth por token/cookie). */
require_once __DIR__ . '/auth.php';

function pa_require_user(): array {
  $u = pa_current_user();
  if (!$u) pa_json(['ok' => false, 'erro' => 'não autenticado'], 401);
  return $u;
}

function pa_profile(string $userId): array {
  $st = pa_db()->prepare("SELECT grupo, unidade_id, conta_status FROM profiles WHERE id = ? LIMIT 1");
  $st->execute([$userId]);
  return $st->fetch() ?: ['grupo' => null, 'unidade_id' => null, 'conta_status' => null];
}

/** Exige conta aprovada. Retorna ['user'=>..., 'profile'=>...]. */
function pa_require_aprovado(): array {
  $u = pa_require_user();
  $p = pa_profile($u['id']);
  if (($p['conta_status'] ?? '') !== 'aprovado') pa_json(['ok' => false, 'erro' => 'conta não aprovada'], 403);
  return ['user' => $u, 'profile' => $p];
}

/** Exige grupo admin. */
function pa_require_admin(): array {
  $u = pa_require_user();
  $p = pa_profile($u['id']);
  if (($p['grupo'] ?? '') !== 'admin') pa_json(['ok' => false, 'erro' => 'apenas administradores'], 403);
  return ['user' => $u, 'profile' => $p];
}
