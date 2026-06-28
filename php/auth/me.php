<?php
/** GET — retorna o usuário logado (ou 401). Use para proteger páginas. */
require_once __DIR__ . '/../lib/auth.php';
$u = pa_current_user();
if (!$u) pa_json(['ok' => false, 'autenticado' => false], 401);

// junta o profile da aplicação (grupo / unidade / status de aprovação)
$prof = null;
try {
  $st = pa_db()->prepare("SELECT grupo, unidade_id, conta_status FROM profiles WHERE id = ? LIMIT 1");
  $st->execute([$u['id']]);
  $prof = $st->fetch() ?: null;
  // auto-cura: se a conta não tem profile (cadastro antigo / insert falhou), cria como pendente
  if (!$prof) {
    pa_db()->prepare("INSERT INTO profiles (id, email, grupo, conta_status) VALUES (?,?, 'operacoes', 'pendente')")
            ->execute([$u['id'], $u['email']]);
    $st->execute([$u['id']]);
    $prof = $st->fetch() ?: null;
  }
} catch (Throwable $e) { /* profiles opcional */ }

pa_json([
  'ok' => true,
  'autenticado' => true,
  'user' => [
    'id'       => $u['id'],
    'email'    => $u['email'],
    'telefone' => $u['telefone'],
    'nome'     => $u['nome'],
    'avatar'   => $u['avatar_url'],
  ],
  'profile' => $prof,
]);
