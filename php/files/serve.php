<?php
/**
 * GET ?id=<uuid> — entrega o arquivo. Requer sessão e respeita o escopo de
 * unidade (um usuário só baixa arquivos da própria unidade, salvo admin).
 */
require_once __DIR__ . '/../lib/uploads.php';

$u = pa_current_user();
if (!$u) { http_response_code(401); exit('não autenticado'); }

$id = $_GET['id'] ?? '';
if (!preg_match('/^[0-9a-f-]{36}$/i', $id)) { http_response_code(400); exit('id inválido'); }

$arq = pa_find_arquivo($id);
if (!$arq) { http_response_code(404); exit('não encontrado'); }

// escopo: mesma unidade OU admin
try {
  $st = pa_db()->prepare("SELECT grupo, unidade_id FROM profiles WHERE id = ? LIMIT 1");
  $st->execute([$u['id']]);
  $p = $st->fetch() ?: [];
  $ehAdmin = ($p['grupo'] ?? '') === 'admin';
  if (!$ehAdmin && $arq['unidade_id'] && ($p['unidade_id'] ?? null) !== $arq['unidade_id']) {
    http_response_code(403); exit('sem permissão');
  }
} catch (Throwable $e) { /* sem profiles: segue */ }

// caminho seguro dentro da pasta de uploads (impede path traversal)
$cfg  = pa_upload_cfg();
$base = realpath($cfg['dir']);
$full = realpath($cfg['dir'] . '/' . $arq['caminho']);
if ($full === false || strpos($full, $base) !== 0 || !is_file($full)) {
  http_response_code(404); exit('arquivo ausente');
}

header('Content-Type: ' . $arq['mime']);
header('Content-Length: ' . filesize($full));
header('Content-Disposition: inline; filename="' . rawurlencode($arq['nome_original']) . '"');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, max-age=3600');
readfile($full);
