<?php
/** GET — inicia o login Google: guarda state anti-CSRF (+ URL de retorno) e redireciona. */
require_once __DIR__ . '/../lib/auth.php';
if (session_status() !== PHP_SESSION_ACTIVE) session_start();

$state = bin2hex(random_bytes(16));
$_SESSION['google_oauth_state'] = $state;

// URL de retorno (front cross-origin, ex.: politcapp.com.br). Só aceita
// origens autorizadas, para não virar open redirect.
$ret = $_GET['return'] ?? '';
if ($ret !== '') {
  $origins = pa_config()['allowed_origins'] ?? [];
  $ok = false;
  foreach ($origins as $o) { if (strpos($ret, rtrim($o, '/')) === 0) { $ok = true; break; } }
  if ($ok) $_SESSION['google_return'] = $ret;
}

header('Location: ' . pa_google_auth_url($state));
exit;
