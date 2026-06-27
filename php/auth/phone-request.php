<?php
/** POST { telefone } — gera um OTP e envia por SMS. */
require_once __DIR__ . '/../lib/auth.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') pa_json(['ok' => false, 'erro' => 'método inválido'], 405);

$in  = pa_input();
$tel = pa_normalize_phone_br($in['telefone'] ?? '');
$ip  = $_SERVER['REMOTE_ADDR'] ?? null;

if (!$tel) pa_json(['ok' => false, 'erro' => 'telefone inválido'], 422);
if (pa_rate_limited($tel, $ip)) pa_json(['ok' => false, 'erro' => 'muitas solicitações — aguarde'], 429);

$u = pa_find_user('telefone', $tel);
$codigo = pa_create_otp($tel, 'sms', 'login', $u['id'] ?? null);
pa_send_sms($tel, "Politapp: seu código de acesso é $codigo. Válido por 10 minutos.");
pa_record_attempt($tel, $ip, true);

// Nunca devolva o código ao cliente.
pa_json(['ok' => true, 'enviado' => true]);
