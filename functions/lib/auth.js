const COOKIE_NAME = "politapp_oauth_state";
const encoder = new TextEncoder();

function base64UrlEncode(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}
async function hmac(data, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}
async function verifyHmac(data, secret, signature) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("HMAC", key, signature, encoder.encode(data));
}
export function safeReturnUrl(candidate, origin) {
  try {
    const url = new URL(candidate || "/login", origin);
    return url.origin === origin ? url.toString() : `${origin}/login`;
  } catch { return `${origin}/login`; }
}
export async function createSignedStateCookie(payload, secret) {
  const data = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = base64UrlEncode(await hmac(data, secret));
  return `${COOKIE_NAME}=${data}.${signature}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`;
}
export async function readSignedStateCookie(header, secret) {
  const pair = header.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE_NAME}=`));
  if (!pair) return null;
  const value = pair.slice(COOKIE_NAME.length + 1);
  const separator = value.lastIndexOf(".");
  if (separator < 1) return null;
  const data = value.slice(0, separator);
  const provided = base64UrlDecode(value.slice(separator + 1));
  if (!(await verifyHmac(data, secret, provided))) return null;
  try { return JSON.parse(new TextDecoder().decode(base64UrlDecode(data))); } catch { return null; }
}
export function clearStateCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}
