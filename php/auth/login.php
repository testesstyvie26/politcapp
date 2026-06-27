<?php
/** POST { email, senha } — login por e-mail + senha. */
require_once __DIR__ . '/../lib/auth.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') pa_json(['ok' => false, 'erro' => 'método inválido'], 405);

$in    = pa_input();
$email = trim(strtolower($in['email'] ?? ''));
$senha = (string)($in['senha'] ?? '');
$ip    = $_SERVER['REMOTE_ADDR'] ?? null;
$ua    = $_SERVER['HTTP_USER_AGENT'] ?? null;

if (!$email || !$senha) pa_json(['ok' => false, 'erro' => 'informe e-mail e senha'], 422);
if (pa_rate_limited($email, $ip)) pa_json(['ok' => false, 'erro' => 'muitas tentativas — tente mais tarde'], 429);

$u = pa_find_user('email', $email);
if (!$u || !$u['senha_hash'] || !password_verify($senha, $u['senha_hash'])) {
  pa_record_attempt($email, $ip, false);
  pa_json(['ok' => false, 'erro' => 'credenciais inválidas'], 401);
}
if ($u['status'] === 'bloqueado') pa_json(['ok' => false, 'erro' => 'conta bloqueada'], 403);

pa_record_attempt($email, $ip, true);
pa_start_session($u['id'], $ua, $ip);
pa_json(['ok' => true, 'user_id' => $u['id']]);
