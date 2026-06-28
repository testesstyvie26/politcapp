<?php
/** POST { email, senha, nome } — cadastro por e-mail + senha. */
require_once __DIR__ . '/../lib/auth.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') pa_json(['ok' => false, 'erro' => 'método inválido'], 405);

$in    = pa_input();
$email = trim(strtolower($in['email'] ?? ''));
$senha = (string)($in['senha'] ?? '');
$nome  = trim($in['nome'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) pa_json(['ok' => false, 'erro' => 'e-mail inválido'], 422);
if (strlen($senha) < 8) pa_json(['ok' => false, 'erro' => 'senha precisa de 8+ caracteres'], 422);
if (pa_find_user('email', $email)) pa_json(['ok' => false, 'erro' => 'e-mail já cadastrado'], 409);

$id = pa_create_user([
  'email'      => $email,
  'senha_hash' => pa_password_hash($senha),
  'nome'       => $nome ?: null,
  'status'     => 'ativo',
]);
$tok = pa_start_session($id, $_SERVER['HTTP_USER_AGENT'] ?? null, $_SERVER['REMOTE_ADDR'] ?? null);
pa_json(['ok' => true, 'user_id' => $id, 'token' => $tok]);
