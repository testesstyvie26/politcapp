<?php
/** POST { id, status } — admin: aprova/recusa uma conta. */
require_once __DIR__ . '/../lib/api.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') pa_json(['ok' => false, 'erro' => 'método inválido'], 405);
pa_require_admin();

$in     = pa_input();
$id     = $in['id'] ?? '';
$status = $in['status'] ?? '';
if (!preg_match('/^[0-9a-f-]{36}$/i', $id) || !in_array($status, ['aprovado', 'rejeitado', 'pendente'], true)) {
  pa_json(['ok' => false, 'erro' => 'parâmetros inválidos'], 422);
}
pa_db()->prepare("UPDATE profiles SET conta_status = ?, updated_at = NOW() WHERE id = ?")
        ->execute([$status, $id]);
pa_json(['ok' => true]);
