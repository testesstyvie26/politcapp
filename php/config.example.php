<?php
/**
 * Politapp — configuração do auth PHP.
 * Copie para config.php e preencha. NUNCA comite config.php com segredos reais.
 * Em produção, prefira variáveis de ambiente (getenv) a valores fixos.
 */
return [
  'db' => [
    'host'    => getenv('DB_HOST') ?: 'politicapp_bd.mysql.dbaas.com.br',
    'name'    => getenv('DB_NAME') ?: 'politicapp_bd',
    'user'    => getenv('DB_USER') ?: 'politicapp_bd',
    'pass'    => getenv('DB_PASS') ?: '',   // defina via env DB_PASS — não escreva a senha aqui
    'charset' => 'utf8mb4',
  ],
  'session' => [
    'cookie'    => 'politapp_sess',
    'ttl_days'  => 30,
    'secure'    => true,   // exige HTTPS (mantenha true em produção)
    'samesite'  => 'Lax',
    'domain'    => '',      // ex.: 'politcapp.com.br'
  ],
  'google' => [
    'client_id'     => getenv('GOOGLE_CLIENT_ID') ?: '',
    'client_secret' => getenv('GOOGLE_CLIENT_SECRET') ?: '',
    'redirect_uri'  => getenv('GOOGLE_REDIRECT_URI') ?: 'https://politcapp.com.br/auth/google-callback.php',
  ],
  'otp' => [
    'ttl_minutes'    => 10,
    'length'         => 6,
    'max_tentativas' => 5,
  ],
  // Front a redirecionar após login bem-sucedido
  'app_url' => getenv('APP_URL') ?: 'https://politcapp.com.br/index.html',
];
