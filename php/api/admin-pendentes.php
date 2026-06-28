<?php
/** GET — admin: lista contas com cadastro pendente de aprovação. */
require_once __DIR__ . '/../lib/api.php';
pa_require_admin();

$st = pa_db()->query(
  "SELECT p.id, p.email, p.grupo, p.unidade_id, p.conta_status, u.nome AS unidade_nome
   FROM profiles p
   LEFT JOIN unidades u ON u.id = p.unidade_id
   WHERE p.conta_status = 'pendente'
   ORDER BY p.email"
);
pa_json(['ok' => true, 'pendentes' => $st->fetchAll()]);
