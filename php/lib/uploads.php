<?php
/**
 * Politapp — upload de arquivos (disco da Locaweb + metadados no MySQL).
 * Segurança: valida o MIME REAL (finfo), whitelist de extensões, nome aleatório,
 * pasta sem execução de script. Nunca confia no nome/mime enviado pelo cliente.
 */
require_once __DIR__ . '/auth.php';

function pa_upload_cfg(): array {
  return [
    'dir'      => __DIR__ . '/../storage/uploads',      // fora da raiz pública seria ideal
    'max'      => 8 * 1024 * 1024,                       // 8 MB
    // mime real => extensão segura
    'permitidos' => [
      'image/jpeg'      => 'jpg',
      'image/png'       => 'png',
      'image/webp'      => 'webp',
      'image/gif'       => 'gif',
      'application/pdf' => 'pdf',
    ],
  ];
}

/**
 * Valida e grava o arquivo enviado. $file = item de $_FILES.
 * @return array ['ok'=>bool, 'erro'?=>string, 'arquivo'?=>array]
 */
function pa_store_upload(array $file, array $meta = []): array {
  $cfg = pa_upload_cfg();

  if (!isset($file['error']) || is_array($file['error']))      return ['ok' => false, 'erro' => 'envio inválido'];
  if ($file['error'] !== UPLOAD_ERR_OK)                         return ['ok' => false, 'erro' => 'falha no upload (cód. ' . $file['error'] . ')'];
  if (($file['size'] ?? 0) <= 0 || $file['size'] > $cfg['max']) return ['ok' => false, 'erro' => 'tamanho inválido (máx. 8 MB)'];
  if (!is_uploaded_file($file['tmp_name']))                     return ['ok' => false, 'erro' => 'origem inválida'];

  // MIME real do conteúdo (não confia no que o cliente mandou)
  $finfo = new finfo(FILEINFO_MIME_TYPE);
  $mime  = $finfo->file($file['tmp_name']) ?: '';
  if (!isset($cfg['permitidos'][$mime])) {
    return ['ok' => false, 'erro' => 'tipo não permitido (' . htmlspecialchars($mime) . '). Use JPG, PNG, WEBP, GIF ou PDF.'];
  }
  $ext = $cfg['permitidos'][$mime];

  // pasta por ano/mês, criada se faltar
  $sub  = gmdate('Y/m');
  $base = $cfg['dir'] . '/' . $sub;
  if (!is_dir($base) && !mkdir($base, 0775, true) && !is_dir($base)) {
    return ['ok' => false, 'erro' => 'não foi possível criar a pasta de destino'];
  }

  $id       = pa_uuid();
  $relativo = $sub . '/' . $id . '.' . $ext;
  $destino  = $cfg['dir'] . '/' . $relativo;
  if (!move_uploaded_file($file['tmp_name'], $destino)) {
    return ['ok' => false, 'erro' => 'não foi possível salvar o arquivo'];
  }
  @chmod($destino, 0644);

  $nomeOrig = mb_substr((string)($file['name'] ?? 'arquivo'), 0, 255);
  pa_db()->prepare(
    "INSERT INTO arquivos (id, user_id, unidade_id, entidade, entidade_id, nome_original, caminho, mime, tamanho)
     VALUES (?,?,?,?,?,?,?,?,?)"
  )->execute([
    $id,
    $meta['user_id']     ?? null,
    $meta['unidade_id']  ?? null,
    $meta['entidade']    ?? null,
    $meta['entidade_id'] ?? null,
    $nomeOrig, $relativo, $mime, (int)$file['size'],
  ]);

  return ['ok' => true, 'arquivo' => [
    'id'    => $id,
    'nome'  => $nomeOrig,
    'mime'  => $mime,
    'tamanho' => (int)$file['size'],
    'url'   => 'files/serve.php?id=' . $id,
  ]];
}

function pa_find_arquivo(string $id): ?array {
  $st = pa_db()->prepare("SELECT * FROM arquivos WHERE id = ? LIMIT 1");
  $st->execute([$id]);
  return $st->fetch() ?: null;
}
