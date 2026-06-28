<?php
/** POST { telefone, codigo } — confere o OTP, cria/loga a conta por telefone. */
require_once __DIR__ . '/../lib/auth.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') pa_json(['ok' => false, 'erro' => 'método inválido'], 405);

$in     = pa_input();
$tel    = pa_normalize_phone_br($in['telefone'] ?? '');
$codigo = preg_replace('/\D/', '', (string)($in['codigo'] ?? ''));
$ip     = $_SERVER['REMOTE_ADDR'] ?? null;
$ua     = $_SERVER['HTTP_USER_AGENT'] ?? null;

if (!$tel || !$codigo) pa_json(['ok' => false, 'erro' => 'telefone e código são obrigatórios'], 422);

$r = pa_verify_otp($tel, 'login', $codigo);
if (!$r['ok']) { pa_record_attempt($tel, $ip, false); pa_json($r, 401); }

// cria a conta na primeira vez, senão usa a existente
$u = pa_find_user('telefone', $tel);
$userId = $u['id'] ?? pa_create_user(['telefone' => $tel, 'telefone_verificado' => pa_now(), 'status' => 'ativo']);
if ($u && !$u['telefone_verificado']) {
  pa_db()->prepare("UPDATE auth_users SET telefone_verificado = NOW() WHERE id = ?")->execute([$userId]);
}
$tok = pa_start_session($userId, $ua, $ip);
pa_json(['ok' => true, 'user_id' => $userId, 'token' => $tok]);
