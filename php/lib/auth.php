<?php
/**
 * Politapp — biblioteca de autenticação própria (PHP + MySQL).
 * Métodos: e-mail+senha, Google (OAuth2), telefone (OTP/SMS).
 * Sem dependências externas (PDO + cURL).
 */
require_once __DIR__ . '/db.php';

/* ── CORS + anti-CSRF por origem ────────────────────────────────────────── */
function pa_cors(): void {
  $origins = pa_config()['allowed_origins'] ?? [];
  $origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
  $metodo  = $_SERVER['REQUEST_METHOD'] ?? 'GET';

  // Origem do próprio servidor (same-origin é sempre confiável). Atrás de
  // Cloudflare, o protocolo real vem em X-Forwarded-Proto.
  $proto = $_SERVER['HTTP_X_FORWARDED_PROTO']
        ?? ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http');
  $selfOrigin = $proto . '://' . ($_SERVER['HTTP_HOST'] ?? '');
  $permitida = ($origin !== '' && (in_array($origin, $origins, true) || $origin === $selfOrigin));

  if ($permitida) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
  }
  header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type, Authorization');

  // preflight
  if ($metodo === 'OPTIONS') { http_response_code(204); exit; }

  // CSRF: POST só de origens autorizadas (ou same-origin, ou sem Origin).
  if ($metodo === 'POST' && $origin !== '' && !$permitida) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'erro' => 'origem não autorizada']);
    exit;
  }
}
// aplica CORS automaticamente em todo endpoint que inclui esta lib
pa_cors();

/* ── Helpers HTTP/JSON ─────────────────────────────────────────────────── */
function pa_json($data, int $code = 200): void {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}
function pa_input(): array {
  static $cache = null;
  if ($cache !== null) return $cache;
  $raw = file_get_contents('php://input');
  $j = json_decode($raw, true);
  $cache = is_array($j) ? $j : ($_POST ?: []);
  return $cache;
}
function pa_uuid(): string {
  $d = random_bytes(16);
  $d[6] = chr((ord($d[6]) & 0x0f) | 0x40); // versão 4
  $d[8] = chr((ord($d[8]) & 0x3f) | 0x80); // variante
  return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d), 4));
}
function pa_now(): string { return gmdate('Y-m-d H:i:s'); }

/* ── Usuários ──────────────────────────────────────────────────────────── */
function pa_find_user(string $coluna, $valor): ?array {
  $allowed = ['id', 'email', 'telefone'];
  if (!in_array($coluna, $allowed, true)) return null;
  $st = pa_db()->prepare("SELECT * FROM auth_users WHERE $coluna = ? LIMIT 1");
  $st->execute([$valor]);
  $u = $st->fetch();
  return $u ?: null;
}

/** Cria conta + profile (conta_status='pendente' para passar pela aprovação). */
function pa_create_user(array $f): string {
  $id = pa_uuid();
  $st = pa_db()->prepare(
    "INSERT INTO auth_users (id, email, telefone, senha_hash, nome, avatar_url, email_verificado, telefone_verificado, status)
     VALUES (?,?,?,?,?,?,?,?,?)"
  );
  $st->execute([
    $id,
    $f['email'] ?? null,
    $f['telefone'] ?? null,
    $f['senha_hash'] ?? null,
    $f['nome'] ?? null,
    $f['avatar_url'] ?? null,
    $f['email_verificado'] ?? null,
    $f['telefone_verificado'] ?? null,
    $f['status'] ?? 'ativo',
  ]);
  // cria o profile da aplicação (se a tabela existir); ignora se ainda não criada
  try {
    pa_db()->prepare("INSERT INTO profiles (id, email, grupo, conta_status) VALUES (?,?, 'operacoes', 'pendente')")
            ->execute([$id, $f['email'] ?? null]);
  } catch (Throwable $e) { /* profiles opcional nesta fase */ }
  return $id;
}

function pa_password_hash(string $senha): string {
  return password_hash($senha, PASSWORD_DEFAULT);
}

/* ── Rate limit (anti força-bruta) ─────────────────────────────────────── */
function pa_record_attempt(string $ident, ?string $ip, bool $ok): void {
  pa_db()->prepare("INSERT INTO auth_tentativas_login (identificador, ip, sucesso) VALUES (?,?,?)")
          ->execute([$ident, $ip, $ok ? 1 : 0]);
}
function pa_rate_limited(string $ident, ?string $ip): bool {
  // > 5 falhas nos últimos 15 min para o mesmo identificador
  $st = pa_db()->prepare(
    "SELECT COUNT(*) FROM auth_tentativas_login
     WHERE identificador = ? AND sucesso = 0 AND created_at > (NOW() - INTERVAL 15 MINUTE)"
  );
  $st->execute([$ident]);
  return (int)$st->fetchColumn() >= 5;
}

/* ── Sessões (cookie com token; no banco só o hash) ────────────────────── */
function pa_start_session(string $userId, ?string $ua, ?string $ip): string {
  $cfg = pa_config()['session'];
  $token = bin2hex(random_bytes(32));
  $hash  = hash('sha256', $token);
  $exp   = gmdate('Y-m-d H:i:s', time() + ($cfg['ttl_days'] * 86400));
  pa_db()->prepare(
    "INSERT INTO auth_sessions (id, user_id, token_hash, user_agent, ip, expira_em)
     VALUES (?,?,?,?,?,?)"
  )->execute([pa_uuid(), $userId, $hash, $ua ? substr($ua, 0, 255) : null, $ip, $exp]);
  pa_db()->prepare("UPDATE auth_users SET ultimo_login = NOW() WHERE id = ?")->execute([$userId]);

  setcookie($cfg['cookie'], $token, [
    'expires'  => time() + ($cfg['ttl_days'] * 86400),
    'path'     => '/',
    'domain'   => $cfg['domain'] ?: '',
    'secure'   => (bool)$cfg['secure'],
    'httponly' => true,
    'samesite' => $cfg['samesite'],
  ]);
  return $token;
}

/** Lê o token Bearer do header Authorization (para auth cross-origin sem cookie). */
function pa_bearer_token(): string {
  $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
  if (!$h && function_exists('getallheaders')) {
    foreach (getallheaders() as $k => $v) {
      if (strtolower($k) === 'authorization') { $h = $v; break; }
    }
  }
  return preg_match('/Bearer\s+(\S+)/i', $h, $m) ? trim($m[1]) : '';
}

/** Token da requisição: header Bearer, ou _token na query/corpo (evita preflight CORS). */
function pa_request_token(): string {
  $t = pa_bearer_token();
  if ($t !== '') return $t;
  if (!empty($_GET['_token'])) return trim((string)$_GET['_token']);
  $in = pa_input();
  if (!empty($in['_token'])) return trim((string)$in['_token']);
  return '';
}

function pa_current_user(): ?array {
  $cfg = pa_config()['session'];
  // token (cross-origin) tem prioridade; senão, cookie (same-origin).
  $token = pa_request_token() ?: ($_COOKIE[$cfg['cookie']] ?? '');
  if (!$token) return null;
  $hash = hash('sha256', $token);
  $st = pa_db()->prepare(
    "SELECT s.id AS sid, u.* FROM auth_sessions s
     JOIN auth_users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.revogado_em IS NULL AND s.expira_em > NOW()
     LIMIT 1"
  );
  $st->execute([$hash]);
  $row = $st->fetch();
  if (!$row) return null;
  pa_db()->prepare("UPDATE auth_sessions SET ultimo_uso = NOW() WHERE id = ?")->execute([$row['sid']]);
  unset($row['sid'], $row['senha_hash']);
  return $row;
}

function pa_logout(): void {
  $cfg = pa_config()['session'];
  $token = $_COOKIE[$cfg['cookie']] ?? '';
  if ($token) {
    pa_db()->prepare("UPDATE auth_sessions SET revogado_em = NOW() WHERE token_hash = ?")
            ->execute([hash('sha256', $token)]);
  }
  setcookie($cfg['cookie'], '', ['expires' => time() - 3600, 'path' => '/']);
}

/* ── Google OAuth2 ─────────────────────────────────────────────────────── */
function pa_google_cfg(): array {
  $g = pa_config()['google'];
  // remove espaços/quebras de linha acidentais (causa comum de invalid_client)
  return [
    'client_id'     => trim((string)($g['client_id'] ?? '')),
    'client_secret' => trim((string)($g['client_secret'] ?? '')),
    'redirect_uri'  => trim((string)($g['redirect_uri'] ?? '')),
  ];
}
function pa_google_auth_url(string $state): string {
  $g = pa_google_cfg();
  $q = http_build_query([
    'client_id'     => $g['client_id'],
    'redirect_uri'  => $g['redirect_uri'],
    'response_type' => 'code',
    'scope'         => 'openid email profile',
    'state'         => $state,
    'access_type'   => 'online',
    'prompt'        => 'select_account',
  ]);
  return "https://accounts.google.com/o/oauth2/v2/auth?$q";
}
function pa_http_post(string $url, array $fields): array {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => http_build_query($fields),
    CURLOPT_TIMEOUT => 15,
  ]);
  $res = curl_exec($ch); curl_close($ch);
  return json_decode($res ?: '[]', true) ?: [];
}
function pa_http_get(string $url, string $bearer): array {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer $bearer"],
    CURLOPT_TIMEOUT => 15,
  ]);
  $res = curl_exec($ch); curl_close($ch);
  return json_decode($res ?: '[]', true) ?: [];
}
/** Troca o code por dados do usuário Google e faz upsert (cria/liga a conta). */
function pa_google_login(string $code, ?string $ua, ?string $ip): array {
  $g = pa_google_cfg();
  $tok = pa_http_post('https://oauth2.googleapis.com/token', [
    'code'          => $code,
    'client_id'     => $g['client_id'],
    'client_secret' => $g['client_secret'],
    'redirect_uri'  => $g['redirect_uri'],
    'grant_type'    => 'authorization_code',
  ]);
  if (empty($tok['access_token'])) return ['ok' => false, 'erro' => 'falha ao trocar code'];
  $info = pa_http_get('https://www.googleapis.com/oauth2/v3/userinfo', $tok['access_token']);
  if (empty($info['sub'])) return ['ok' => false, 'erro' => 'userinfo inválido'];

  $sub   = $info['sub'];
  $email = $info['email'] ?? null;
  $nome  = $info['name'] ?? null;
  $foto  = $info['picture'] ?? null;

  $db = pa_db();
  // já existe identidade google?
  $st = $db->prepare("SELECT user_id FROM auth_identities WHERE provider='google' AND provider_uid=? LIMIT 1");
  $st->execute([$sub]);
  $userId = $st->fetchColumn();

  if (!$userId) {
    // tenta casar por e-mail já cadastrado
    $u = $email ? pa_find_user('email', $email) : null;
    $userId = $u['id'] ?? pa_create_user([
      'email' => $email, 'nome' => $nome, 'avatar_url' => $foto,
      'email_verificado' => !empty($info['email_verified']) ? pa_now() : null,
    ]);
    $db->prepare("INSERT INTO auth_identities (id, user_id, provider, provider_uid, email) VALUES (?,?, 'google', ?, ?)")
       ->execute([pa_uuid(), $userId, $sub, $email]);
  }
  $tok = pa_start_session($userId, $ua, $ip);
  return ['ok' => true, 'user_id' => $userId, 'token' => $tok];
}

/* ── Telefone / OTP ────────────────────────────────────────────────────── */
function pa_normalize_phone_br(string $raw): string {
  $d = preg_replace('/\D/', '', $raw);
  $d = ltrim($d, '0');
  if (strpos($d, '55') === 0 && (strlen($d) === 12 || strlen($d) === 13)) return '+' . $d;
  if (strlen($d) === 10 || strlen($d) === 11) return '+55' . $d;
  return '';
}
function pa_create_otp(string $destino, string $canal, string $finalidade, ?string $userId = null): string {
  $cfg = pa_config()['otp'];
  $codigo = str_pad((string)random_int(0, (10 ** $cfg['length']) - 1), $cfg['length'], '0', STR_PAD_LEFT);
  $exp = gmdate('Y-m-d H:i:s', time() + $cfg['ttl_minutes'] * 60);
  pa_db()->prepare(
    "INSERT INTO auth_otp (id, user_id, destino, canal, finalidade, codigo_hash, expira_em)
     VALUES (?,?,?,?,?,?,?)"
  )->execute([pa_uuid(), $userId, $destino, $canal, $finalidade, password_hash($codigo, PASSWORD_DEFAULT), $exp]);
  return $codigo; // entregue ao gateway de envio (NÃO retorne ao cliente)
}
/** Integre seu provedor de SMS aqui (Zenvia, Twilio, etc.). */
function pa_send_sms(string $telefone, string $mensagem): bool {
  // TODO: chamar a API do gateway de SMS contratado.
  error_log("[OTP/SMS] para $telefone: $mensagem");
  return true;
}
/** Verifica o código; se válido para login, cria a conta/sessão. */
function pa_verify_otp(string $destino, string $finalidade, string $codigo): array {
  $cfg = pa_config()['otp'];
  $db = pa_db();
  $st = $db->prepare(
    "SELECT * FROM auth_otp
     WHERE destino=? AND finalidade=? AND consumido_em IS NULL AND expira_em > NOW()
     ORDER BY created_at DESC LIMIT 1"
  );
  $st->execute([$destino, $finalidade]);
  $otp = $st->fetch();
  if (!$otp) return ['ok' => false, 'erro' => 'código expirado ou inexistente'];
  if ((int)$otp['tentativas'] >= (int)$cfg['max_tentativas']) return ['ok' => false, 'erro' => 'tentativas excedidas'];

  if (!password_verify($codigo, $otp['codigo_hash'])) {
    $db->prepare("UPDATE auth_otp SET tentativas = tentativas + 1 WHERE id = ?")->execute([$otp['id']]);
    return ['ok' => false, 'erro' => 'código incorreto'];
  }
  $db->prepare("UPDATE auth_otp SET consumido_em = NOW() WHERE id = ?")->execute([$otp['id']]);
  return ['ok' => true, 'otp' => $otp];
}
