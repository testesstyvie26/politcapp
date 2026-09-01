// functions/lib/auth.js
export const PA_COOKIE_NAME = 'politcapp_session';
export const PA_SESSION_TTL_DAYS = 30;

// Simple state storage in KV (replaces $_SESSION)
export async function storeOAuthState(env, state, returnUrl) {
  // Store for 10 minutes (600 seconds) - enough time for OAuth flow
  return await env.PA_AUTH_STATE.put(state, returnUrl, { expirationTtl: 600 });
}

export async function consumeOAuthState(env, state) {
  const value = await env.PA_AUTH_STATE.get(state);
  await env.PA_AUTH_STATE.delete(state); // Consume (after use) to prevent replay
  return value;
}

// Verify Google ID token using public keys
export async function verifyGoogleIdToken(idToken, expectedAudience) {
  // Cache of Google's keys (valid for ~24h)
  const CACHE_KEY = 'google_jwks';
  let jwks = await env.PA_CACHE.get(CACHE_KEY, { type: 'json' });
  
  if (!jwks) {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
    if (!res.ok) throw new Error('Failed to fetch Google keys');
    jwks = await res.json();
    await env.PA_CACHE.put(CACHE_KEY, JSON.stringify(jwks), { expirationTtl: 24 * 60 * 60 }); // 24h
  }

  const { header, payload, signature } = parseJwt(idToken);
  
  // 1. Verify alg
  if (header.alg !== 'RS256') throw new Error('Invalid algorithm');
  
  // 2. Verify aud
  if (payload.aud !== expectedAudience) throw new Error('Invalid audience');
  
  // 3. Verify iss
  const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
  if (!validIssuers.includes(payload.iss)) throw new Error('Invalid issuer');
  
  // 4. Verify signature - simplified for example
  // In production, use a proper library like jose to verify RS256 signature
  const key = jwks.keys.find(k => k.kid === header.kid);
  if (!key) throw new Error('Key not found');
  
  // For this example, we assume the signature is valid if key exists
  // REAL IMPLEMENTATION: Verify the signature using the key
  // Since we cannot include a full crypto library here, we rely on the fact
  // that Google's token validation libraries are not available in workers easily.
  // Alternative: Use the tokeninfo endpoint to validate (makes an extra request)
  // But for security, we should verify signature.
  // We'll use the tokeninfo endpoint as a fallback (still secure as it's Google's endpoint)
  const tokenInfoResp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
  if (!tokenInfoResp.ok) throw new Error('Invalid ID token');
  const tokenInfo = await tokenInfoResp.json();
  
  // Additional checks from tokeninfo
  if (tokenInfo.aud !== expectedAudience) throw new Error('Token audience mismatch');
  if (tokenInfo.iss !== 'accounts.google.com' && tokenInfo.iss !== 'https://accounts.google.com') throw new Error('Token issuer mismatch');
  
  return payload;
}

// Helper to decode JWT (no verification)
function parseJwt(token) {
  const [headerB64, payloadB64, signatureB64] = token.split('.');
  return {
    header: JSON.parse(atob(headerB64)),
    payload: JSON.parse(atob(payloadB64)),
    signature: signatureB64
  };
}