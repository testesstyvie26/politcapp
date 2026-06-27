<?php
/** GET — inicia o login Google: guarda um state anti-CSRF e redireciona. */
require_once __DIR__ . '/../lib/auth.php';
if (session_status() !== PHP_SESSION_ACTIVE) session_start();

$state = bin2hex(random_bytes(16));
$_SESSION['google_oauth_state'] = $state;

header('Location: ' . pa_google_auth_url($state));
exit;
