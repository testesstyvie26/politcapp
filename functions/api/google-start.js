// functions/api/google-start.js
import { Router } from 'itty-router';
import { setCookie } from '../lib/auth.js';

const router = Router();

// Helper function to sign data (HMAC-SHA256)
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

router.get('/api/google-start', async (request, env) => {
  const url = new URL(request.url);
  const returnUrl = url.searchParams.get('return') || '';
  
  // Validation of origin (same logic as PHP)
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
    // Also allow same-origin
    if (!isValidReturn && returnUrl.startsWith(selfOrigin)) isValidReturn = true;
  }
  
  if (!isValidReturn && returnUrl !== '') {
    return new Response('Unauthorized return URL', { status: 400 });
  }
  
  // Generate anti-CSRF state
  const state = crypto.getRandomValues(new Uint8Array(16))
    .reduce((acc, byte) => acc + byte.toString(16).padStart(2, '0'), '');
  
  // We'll store state and returnUrl in a cookie, signed for tamper protection
  const secret = env.COOKIE_SECRET || 'default-secret-change-in-production';
  const data = JSON.stringify({ state, returnUrl });
  const signature = await signData(data, secret);
  
  // Format: base64url(data).signature
  const dataB64 = btoa(String.fromCharCode(...new Uint8Array(new TextEncoder().encode(data))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  const signedValue = `${dataB64}.${signature}`;
  
  const cookie = setCookie('politcapp_auth_state', signedValue, {
    path: '/',
    maxAge: 600, // 10 minutes
    secure: true, // Assuming HTTPS
    sameSite: 'Lax',
    httpOnly: true
  });
  
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

export default router;