// functions/api/google-start.js
import { Router } from 'itty-router';
import mysql from 'mysql2/promise';

// Configuração de conexão MySQL
const db = mysql.createConnection({
  host: 'politicapp_bd.mysql.dbaas.com.br',
  user: 'root', // ou o usuário conforme necessário
  password: 'a#VhV5g9PbhpaR',
  database: 'politicapp_bd',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Conectar ao banco ao inicializar
db.connect((err) => {
  if (err) {
    console.error('Erro ao conectar no MySQL:', err.message);
  } else {
    console.log('Conexão MySQL estabelecida com sucesso');
  }
});

/* ── Helper: verificar se usuário existe no banco ─────────────────────── */
async function getUserByEmail(email) {
  const [rows] = await db.execute(
    'SELECT id, email, senha_hash, grupo, unidade_id, conta_status FROM usuarios WHERE email = ?',
    [email]
  );
  return rows.length > 0 ? rows[0] : null;
}

/* ── Helper: criar usuário se não existir ─────────────────────────────── */
async function upsertUser(email, nome) {
  const userId = crypto.randomUUID();
  await db.execute(
    `INSERT INTO usuarios (id, email, senha_hash, criado_em) VALUES (?, ?, NULL, NOW()) 
     ON DUPLICATE KEY UPDATE email = VALUES(email), criado_em = NOW()`,
    [userId, email]
  );
  // Também garante perfil
  await db.execute(
    `INSERT INTO profiles (id, grupo, unidade_id, conta_status, email) VALUES (?, 'operacoes', NULL, 'pendente', ?) 
     ON DUPLICATE KEY UPDATE email = VALUES(email)`,
    [userId, email]
  );
  return userId;
}

/* ── Rota: /api/google-start ─────────────────────────────────────────────── */
const router = Router();

router.get('/api/google-start', async (request, env) => {
  const url = new URL(request.url);
  const returnUrl = url.searchParams.get('return') || '';
  
  // Validar origin (mesma lógica do PHP antigo)
  const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
  const selfOrigin = `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host')}`;
  
  let isValidReturn = false;
  if (returnUrl === '') isValidReturn = true; // Allow empty (homepage)
  else {
    for (const origin of allowedOrigins) {
      if (returnUrl.startsWith(origin)) {
        isValidReturn = true;
        break;
      }
    }
    if (!isValidReturn && returnUrl.startsWith(selfOrigin)) isValidReturn = true;
  }
  
  if (!isValidReturn && returnUrl !== '') {
    return new Response('Unauthorized return URL', { status: 400 });
  }
  
  // Gerar state anti-CSRF
  const state = crypto.getRandomValues(new Uint8Array(16))
    .reduce((acc, byte) => acc + byte.toString(16).padStart(2, '0'), '');
  
  // Guardar state e returnUrl no banco de dados
  const secret = env.COOKIE_SECRET || 'default-secret-change-in-production';
  const data = JSON.stringify({ state, returnUrl });
  const signature = await signData(data, secret);
  
  // Formato: base64url(data).signature
  const dataB64 = btoa(String.fromCharCode(...new Uint8Array(new TextEncoder().encode(data))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  const signedValue = `${dataB64}.${signature}`;
  
  // Salvar no banco + cookie HttpOnly
  const cookie = setCookie('politcapp_auth_state', signedValue, {
    path: '/',
    maxAge: 600, // 10 minutes
    secure: true,
    sameSite: 'Lax',
    httpOnly: true
  });
  
  // Buscar/criar usuário no MySQL
  const existingUser = await getUserByEmail(url.searchParams.get('email') || '');
  if (!existingUser) {
    // Se veio email via parâmetro, usar; senão, o Google fornecerá depois
    await upsertUser(existingUser?.email || 'google-user@politapp.com', existingUser?.email || 'Google User');
  }
  
  // Build Google authorization URL
  const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  googleUrl.searchParams.set('redirect_uri', `${selfOrigin}/api/google-callback`);
  googleUrl.searchParams.set('response_type', 'code');
  googleUrl.searchParams.set('scope', 'openid email profile');
  googleUrl.searchParams.set('state', state);
  googleUrl.searchParams.set('access_type', 'online');
  googleUrl.searchParams.set('prompt', 'select_account');
  
  return Response.redirect(googleUrl.toString(), 302, {
    headers: {
      'Set-Cookie': cookie
    }
  });
});

/* ── Helper: signData (HMAC-SHA256) ───────────────────────────────────── */
async function signData(data, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  // Convert to base64url
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export default router;
