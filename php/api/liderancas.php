<?php
/**
 * Lideranças RJ por unidade (do usuário).
 *   GET                              → { store: { ibge: [ {id,nome,telefone,partido,obs} ] } }
 *   POST { action:'replace', store } → substitui todas as lideranças da unidade
 */
require_once __DIR__ . '/../lib/api.php';
$ctx  = pa_require_aprovado();
$prof = $ctx['profile'];
$uid  = $prof['unidade_id'] ?? null;
$db   = pa_db();

if (!$uid) pa_json(['ok' => false, 'erro' => 'sem unidade vinculada'], 403);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $st = $db->prepare("SELECT id, municipio_ibge, nome, telefone, partido, observacoes FROM liderancas_rj WHERE unidade_id = ?");
  $st->execute([$uid]);
  $store = [];
  foreach ($st->fetchAll() as $r) {
    $ib = trim((string)$r['municipio_ibge']);
    if ($ib === '') continue;
    $store[$ib][] = [
      'id' => $r['id'], 'nome' => $r['nome'], 'telefone' => $r['telefone'] ?? '',
      'partido' => $r['partido'] ?? '', 'obs' => $r['observacoes'] ?? '', 'email' => '',
    ];
  }
  pa_json(['ok' => true, 'store' => $store ?: (object)[]]);
}

$in = pa_input();
if (($in['action'] ?? '') !== 'replace') pa_json(['ok' => false, 'erro' => 'ação inválida'], 400);
$store = $in['store'] ?? [];
if (!is_array($store)) pa_json(['ok' => false, 'erro' => 'store inválido'], 422);

$db->beginTransaction();
try {
  $db->prepare("DELETE FROM liderancas_rj WHERE unidade_id = ?")->execute([$uid]);
  $ins = $db->prepare(
    "INSERT INTO liderancas_rj (id, unidade_id, municipio_ibge, nome, telefone, partido, observacoes, created_by)
     VALUES (?,?,?,?,?,?,?,?)"
  );
  foreach ($store as $ibge => $arr) {
    $ib = preg_replace('/\D/', '', (string)$ibge);
    if ($ib === '' || !is_array($arr)) continue;
    foreach ($arr as $rec) {
      $nome = trim((string)($rec['nome'] ?? ''));
      if ($nome === '') continue;
      $ins->execute([
        pa_uuid(), $uid, $ib, $nome,
        trim((string)($rec['telefone'] ?? '')), trim((string)($rec['partido'] ?? '')),
        trim((string)($rec['obs'] ?? $rec['observacoes'] ?? '')), $ctx['user']['id'],
      ]);
    }
  }
  $db->commit();
} catch (Throwable $e) {
  $db->rollBack();
  pa_json(['ok' => false, 'erro' => 'falha ao salvar lideranças'], 500);
}
pa_json(['ok' => true]);
