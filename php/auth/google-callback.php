<?php
/** GET ?code&state — callback do Google: valida state, faz login e redireciona. */
require_once __DIR__ . '/../lib/auth.php';
if (session_status() !== PHP_SESSION_ACTIVE) session_start();

$code  = $_GET['code'] ?? '';
$state = $_GET['state'] ?? '';
$esperado = $_SESSION['google_oauth_state'] ?? '';
unset($_SESSION['google_oauth_state']);

if (!$code || !$state || !hash_equals($esperado, $state)) {
  pa_json(['ok' => false, 'erro' => 'state inválido (possível CSRF)'], 400);
}

$r = pa_google_login($code, $_SERVER['HTTP_USER_AGENT'] ?? null, $_SERVER['REMOTE_ADDR'] ?? null);
if (!$r['ok']) pa_json($r, 401);

// Para onde voltar: front cross-origin (se informado e autorizado) ou app_url.
$dest = $_SESSION['google_return'] ?? pa_config()['app_url'];
unset($_SESSION['google_return']);

// Entrega o token no fragmento (#) — o front guarda no localStorage.
// (Fragmento não vai ao servidor; melhor que query para não cair em logs.)
$sep = (strpos($dest, '#') === false) ? '#' : '&';
header('Location: ' . $dest . $sep . 'token=' . urlencode($r['token']));
exit;
