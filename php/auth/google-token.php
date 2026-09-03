<?php
/** POST { id_token } — valida o callback Cloudflare e cria a sessão Politapp. */
require_once __DIR__ . '/../lib/auth.php';

$in = pa_input();
$idToken = trim((string)($in['id_token'] ?? ''));
if ($idToken === '') pa_json(['ok' => false, 'erro' => 'token Google ausente'], 400);

$ch = curl_init('https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($idToken));
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15]);
$raw = curl_exec($ch);
$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
$info = json_decode($raw ?: '[]', true) ?: [];

$g = pa_google_cfg();
$issuer = (string)($info['iss'] ?? '');
$validIssuer = $issuer === 'accounts.google.com' || $issuer === 'https://accounts.google.com';
$validAudience = isset($info['aud']) && hash_equals($g['client_id'], (string)$info['aud']);
$notExpired = isset($info['exp']) && (int)$info['exp'] > time();
if ($status !== 200 || empty($info['sub']) || !$validIssuer || !$validAudience || !$notExpired) {
  pa_json(['ok' => false, 'erro' => 'token Google inválido'], 401);
}

$r = pa_google_login_from_info($info, $_SERVER['HTTP_USER_AGENT'] ?? null, $_SERVER['REMOTE_ADDR'] ?? null);
pa_json($r, $r['ok'] ? 200 : 401);
