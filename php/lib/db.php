<?php
/** Conexão PDO (MySQL) — carregada por lib/auth.php. */

function pa_config(): array {
  static $cfg = null;
  if ($cfg === null) {
    $path = __DIR__ . '/../config.php';
    if (!is_file($path)) {
      http_response_code(500);
      exit('config.php ausente — copie config.example.php para config.php.');
    }
    $cfg = require $path;
  }
  return $cfg;
}

function pa_db(): PDO {
  static $pdo = null;
  if ($pdo === null) {
    $c = pa_config()['db'];
    $dsn = "mysql:host={$c['host']};dbname={$c['name']};charset={$c['charset']}";
    $pdo = new PDO($dsn, $c['user'], $c['pass'], [
      PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
  }
  return $pdo;
}
