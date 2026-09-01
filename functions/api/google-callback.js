// functions/api/google-callback.js
import { Router } from 'itty-router';
import { parseCookies, verifySignature } from '../lib/auth.js';

const router = Router();

router.get('/api/google-callback', async (request, env) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  
  if (!code || !state) {
    return new Response('Missing parameters', { status: 400 });
  }
  
  // Get and verify the auth cookie
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const authCookie = cookies['politcapp_auth_state'];
  
  if (!authCookie) {
    return new Response('Missing authentication cookie', { status: 400 });
  }
  
  // Verify cookie format: base64url(data).signature
  const parts = authCookie.split('.');
  if (parts.length !== 2) {
    return new Response('Invalid cookie format', { status: 400 });
  }
  
  const [dataB64, signature] = parts;
  
  // Decode data
  let data;
  try {
    // Add padding if needed
    let padded = dataB64.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding until length is multiple of 4
    while (padded.length % 4) {
      padded += '=';
    }
    const rawData = atob(padded);
    data = JSON.parse(rawData);
  } catch (e) {
    return new Response('Invalid cookie data', { status: 400 });
  }
  
  // Verify state matches
  if (data.state !== state) {
    return new Response('State mismatch', { status: 400 });
  }
  
  // Verify signature
  const secret = env.COOKIE_SECRET || 'default-secret-change-in-production';
  const isValid = await verifySignature(data, secret, signature);
  if (!isValid) {
    return new Response('Invalid cookie signature', { status: 400 });
  }
  
  const returnUrl = data.returnUrl || '/';
  
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
    
    // Verify the ID token using Google's tokeninfo endpoint (simpler than signature verification)
    const tokenInfoResp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${tokens.id_token}`);
    if (!tokenInfoResp.ok) throw new Error('Failed to verify ID token');
    const payload = await tokenInfoResp.json();
    
    // Validate audience and issuer
    if (payload.aud !== env.GOOGLE_CLIENT_ID) throw new Error('Invalid audience');
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) 
      throw new Error('Invalid issuer');
    
    // In a production app, you would create a session here (JWT, secure cookie, etc.)
    // For this example, we'll redirect to the return URL with user data in a hash
    // NOTE: This is NOT secure for production - user data exposed in URL!
    // REAL IMPLEMENTATION: Set secure, HttpOnly cookie with session ID or JWT
    
    const userData = btoa(JSON.stringify({
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      sub: payload.sub,
      email_verified: payload.email_verified
    }));
    
    const finalUrl = new URL(returnUrl, new URL(request.url).origin);
    finalUrl.hash = `#user=${userData}`;
    
    // Clear the auth cookie
    const clearCookie = `politcapp_auth_state=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    
    return Response.redirect(finalUrl.toString(), 302, {
      headers: {
        'Set-Cookie': clearCookie
      }
    });
    
  } catch (error) {
    console.error('Error in Google callback:', error);
    return new Response('Authentication failed: ' + error.message, { status: 500 });
  }
});

export default router;