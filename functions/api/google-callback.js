// functions/api/google-callback.js
import { Router } from 'itty-router';
import { consumeOAuthState, verifyGoogleIdToken } from '../lib/auth.js';

const router = Router();

router.get('/api/google-callback', async (request, env) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  
  if (!code || !state) {
    return new Response('Missing parameters', { status: 400 });
  }
  
  // Consume and validate state
  const returnUrl = await consumeOAuthState(env, state);
  if (returnUrl === null) {
    return new Response('Invalid or expired state', { status: 400 });
  }
  
  try {
    // Exchange code for tokens
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code: code,
        redirect_uri: `${new URL(request.url).origin}/api/google-callback`,
        grant_type: 'authorization_code'
      })
    });
    
    if (!tokenResp.ok) {
      const errorText = await tokenResp.text();
      throw new Error(`Failed to exchange code: ${errorText}`);
    }
    const tokens = await tokenResp.json();
    
    if (!tokens.id_token) throw new Error('ID token missing');
    
    // Verify the ID token
    const payload = await verifyGoogleIdToken(tokens.id_token, env.GOOGLE_CLIENT_ID);
    
    // In a real app, you would create a session or JWT here.
    // For this example, we'll redirect with user data in a hash (NOT secure for production!)
    // PRODUCTION: Use secure, HttpOnly cookie or signed JWT with short TTL.
    const userData = btoa(JSON.stringify({
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      sub: payload.sub,
      email_verified: payload.email_verified
    }));
    
    const finalUrl = new URL(returnUrl, new URL(request.url).origin);
    finalUrl.hash = `#user=${userData}`; // In production: use secure cookie or KV storage
    
    return Response.redirect(finalUrl.toString(), 302);
    
  } catch (error) {
    console.error('Error in Google callback:', error);
    return new Response('Authentication failed', { status: 500 });
  }
});

export default router;