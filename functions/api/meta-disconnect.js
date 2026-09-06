import { clearSessionCookie } from "../lib/meta-session.js";

export function onRequestPost() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie(), "Cache-Control": "no-store" } });
}

