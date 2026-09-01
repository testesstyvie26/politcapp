// functions/api/google-start.js
import { Router } from 'itty-router';
import { storeOAuthState } from '../lib/auth.js';

const router = Router();

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
  
  // Store state in KV (expires in 10 min)
  await storeOAuthState(env, state, returnUrl);
  
  // Build Google authorization URL
  const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  googleUrl.searchParams.set('redirect_uri', `${selfOrigin}/api/google-callback`);
  googleUrl.searchParams.set('response_type', 'code');
  googleUrl.searchParams.set('scope', 'openid email profile');
  googleUrl.searchParams.set('state', state);
  googleUrl.searchParams.set('access_type', 'online');
  googleUrl.searchParams.set('prompt', 'select_account');
  
  return Response.redirect(googleUrl.toString(), 302);
});

export default router;