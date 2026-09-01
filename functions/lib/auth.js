// functions/lib/auth.js
export const PA_COOKIE_NAME = 'politcapp_auth_state';
export const PA_COOKIE_MAX_AGE = 600; // 10 minutes in seconds

// Sign data using HMAC-SHA256 with a secret
export async function signData(data, secret) {
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

// Verify signature
export async function verifySignature(data, secret, signature) {
  const expected = await signData(data, secret);
  return expected === signature;
}

// Parse cookies from cookie string
export function parseCookies(cookieHeader) {
  return cookieHeader
    .split(';')
    .map(c => c.trim())
    .filter(c => c)
    .reduce((acc, c) => {
      const [name, value] = c.split('=');
      acc[name] = decodeURIComponent(value);
      return acc;
    }, {});
}

// Set cookie header
export function setCookie(name, value, options = {}) {
  const { path = '/', maxAge, secure = true, sameSite = 'Strict', httpOnly = true } = options;
  let cookie = `${name}=${encodeURIComponent(value)}`;
  cookie += `; path=${path}`;
  if (maxAge) cookie += `; max-age=${maxAge}`;
  if (secure) cookie += `; secure`;
  cookie += `; same-site=${sameSite}`;
  if (httpOnly) cookie += `; HttpOnly`;
  return cookie;
}