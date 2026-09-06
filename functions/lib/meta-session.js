const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SESSION_COOKIE = "politapp_meta_session";
const STATE_COOKIE = "politapp_meta_state";

function encode(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function keyFrom(secret, usage) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, usage);
}

export async function seal(payload, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(secret, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(payload)));
  return `${encode(iv)}.${encode(new Uint8Array(encrypted))}`;
}

export async function unseal(value, secret) {
  try {
    const [ivPart, dataPart] = String(value || "").split(".");
    if (!ivPart || !dataPart) return null;
    const key = await keyFrom(secret, ["decrypt"]);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(ivPart) }, key, decode(dataPart));
    return JSON.parse(decoder.decode(decrypted));
  } catch { return null; }
}

export function cookieValue(request, name) {
  const item = (request.headers.get("Cookie") || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return item ? item.slice(name.length + 1) : "";
}

export const sessionCookie = (value) => `${SESSION_COOKIE}=${value}; Path=/; Max-Age=5184000; HttpOnly; Secure; SameSite=Lax`;
export const stateCookie = (value) => `${STATE_COOKIE}=${value}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`;
export const clearSessionCookie = () => `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
export const clearStateCookie = () => `${STATE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
export { SESSION_COOKIE, STATE_COOKIE };

