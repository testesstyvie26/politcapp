<?php
/** GET — admin: lista todos os usuários cadastrados, sem dados secretos. */
require_once __DIR__ . '/../lib/api.php';
pa_require_admin();

$st = pa_db()->query(
  "SELECT au.id, au.nome, au.email, au.status AS auth_status,
          au.created_at, au.ultimo_login,
          p.grupo, p.unidade_id, p.conta_status,
          un.nome AS unidade_nome,
          CASE
            WHEN EXISTS (
              SELECT 1 FROM auth_identities ai
              WHERE ai.user_id = au.id AND ai.provider = 'google'
            ) THEN 'Google'
            WHEN au.senha_hash IS NOT NULL THEN 'E-mail e senha'
            WHEN au.telefone IS NOT NULL THEN 'Telefone'
            ELSE 'Outro'
          END AS metodo_acesso
   FROM auth_users au
   LEFT JOIN profiles p ON p.id = au.id
   LEFT JOIN unidades un ON un.id = p.unidade_id
   ORDER BY au.created_at DESC, au.email ASC"
);

pa_json(['ok' => true, 'usuarios' => $st->fetchAll()]);

