---
name: politcapp-cloudflare-migration
description: "Migrate Politcapp authentication from PHP/Locaweb to Cloudflare Workers with Google OAuth flow and optional MySQL reconnection"
version: "1.0.0"
author: Hermes Agent
license: "MIT"
---
# Skill: politcapp-cloudflare-migration

## Overview
Migrate Politcapp authentication from PHP/Locaweb external hosting to Cloudflare Workers-only architecture. This skill covers the complete migration including Google OAuth flow, frontend JavaScript updates, Cloudflare Workers deployment, and optional MySQL reconnection.

## When to Use
Use when migrating auth flows from PHP/Locaweb to Cloudflare Workers, or when fixing Google OAuth redirects that point to old `cmbusinesstoken.com` endpoints.

## Trigger Phrases
- "Migrate from Locaweb to Cloudflare"
- "Fix Google OAuth redirect to cmbusinesstoken.com"
- "Deploy Politcapp with Cloudflare Workers"
- "Update auth-config.js for Cloudflare"
- "Rewrite locaweb-auth.js for Workers"
- "Politcapp login Google redirect loop"
- "Reconnect Politcapp MySQL"

## Trigger (First 57 chars)
"Use when migrating auth flows from PHP/Locaweb to Cloudflare Workers..."

## Steps (Core Workflow)

### 1. Update Frontend JavaScript Files
**Files**: `js/auth-config.js`, `js/locaweb-auth.js`

**Changes**:
- Remove all references to `cmbusinesstoken.com`
- Replace `auth/google-start.php` with `/api/google-start`
- Replace `auth/google-callback` with `/api/google-callback`
- Set `POLITAPP_AUTH_PROVIDER` to `"cloudflare"` by default
- Set `POLITAPP_GOOGLE_START_URL` to `"/api/google-start"`
- Set `POLITAPP_GOOGLE_CALLBACK_URL` to `"/api/google-callback"`

**Example auth-config.js update**:
```javascript
window.POLITAPP_AUTH_PROVIDER = window.POLITAPP_AUTH_PROVIDER || "cloudflare";
window.POLITAPP_AUTH_BASE = window.POLITAPP_AUTH_BASE || "/";
window.POLITAPP_GOOGLE_START_URL = window.POLITAPP_GOOGLE_START_URL || "/api/google-start";
window.POLITAPP_GOOGLE_CALLBACK_URL = window.POLITAPP_GOOGLE_CALLBACK_URL || "/api/google-callback";
```

### 2. Update Worker Functions
**Files**: `functions/api/google-start.js`, `functions/api/google-callback.js`

**Changes**:
- Add MySQL connection using `mysql2` package
- Configure database credentials in `wrangler.jsonc` vars
- Add DB connection on Worker initialization
- Query `politicapp_bd` for user management
- Keep cookie-based OAuth state as primary session store

### 3. Configure wrangler.jsonc
**Changes**:
- Add MySQL connection variables:
  ```json
  "vars": {
    "ALLOWED_ORIGINS": "https://politcapp.com.br,https://YOUR_DOMAIN.politcapp.pages.dev",
    "GOOGLE_CLIENT_ID": "YOUR_GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET": "YOUR_GOOGLE_CLIENT_SECRET",
    "COOKIE_SECRET": "strong-32-char-secret"
  }
  ```
- Ensure `compatibility_flags` includes `nodejs_compat`

### 4. Update Build Script
**File**: `scripts/build-site.mjs`

**Changes**:
- Add function to copy `functions/` folder to `dist/functions/`
- This ensures Cloudflare Workers are included in the deploy
- The build must copy: `css`, `data`, `docs`, `js`, `vendor`, AND `functions/`

### 5. Deploy
**Command**: `npm run deploy:pages`

**Expected Output**:
```
✨ Compiled Worker successfully
✨ Uploading _headers
✨ Uploading _redirects
✨ Uploading Functions bundle
🌎 Deployment complete! Take a peek over at https://<subdomain>.politcapp.pages.dev
```

### 6. Test Endpoints
**Verify**:
- `GET /api/google-start?return=<url>` → 200 OK (Worker responds)
- `GET /api/google-callback?code=...` → OAuth flow completes
- No redirects to `cmbusinesstoken.com`
- Site loads at `https://<subdomain>.politcapp.pages.dev`

### 7. MySQL Reconnection (Optional)
If using MySQL:
- Ensure `mysql2` package is installed: `npm install mysql2`
- Configure `wrangler.jsonc` with DB vars
- The Worker will auto-connect on startup
- Tables created via: `locaweb-mysql-schema.sql`

## Pitfalls & Gotchas

| Pitfall | Fix |
|---------|-----|
| **KV namespace Error 8000022** | Remove KV config from wrangler.jsonc entirely; use cookie-based state instead |
| **404 on /api/google-start from curl** | Expected: Workers only execute from frontend, not CLI curl |
| **MIME type errors (text/html for CSS/JS)** | Old Locaweb PHP not serving correctly — fully migrate to Cloudflare |
| **Browser still redirects to cmbusinesstoken.com** | Clean browser cache, verify auth-config.js has no cmbusinesstoken references |
| **Deploy fails due to dirty git repo** | Commit all changes before `npm run deploy:pages` |
| **Functions not included in deploy** | Ensure build-site.mjs copies `functions/` to `dist/functions/` |
| **Google OAuth not configured in Cloud Console** | Add Authorized redirect URI: `https://<SUBDOMAIN>.politcapp.pages.dev/api/google-callback` |
| **Cookie not being set properly** | Verify `COOKIE_SECRET` is set in Cloudflare vars, `secure: true`, `sameSite: 'Lax'` |
| **MySQL connection fails on deploy** | Verify `mysql2` is in dependencies, DB creds in wrangler.jsonc vars |

## Files Modified/Created

| File | Action | Outcome |
|------|--------|---------|
| `js/auth-config.js` | Rewrite | Remove Locaweb/cmbusinesstoken refs, use `/api/` endpoints |
| `js/locaweb-auth.js` | Rewrite | Cloudflare Workers endpoints only |
| `functions/api/google-start.js` | Create | Cloudflare Worker OAuth initiation |
| `functions/api/google-callback.js` | Create | Cloudflare Worker OAuth callback |
| `functions/_routes.js` | Create | Routes export for Worker API |
| `wrangler.jsonc` | Modify | Simplified config — no KV, vars for credentials |
| `scripts/build-site.mjs` | Rewrite | Copy `functions/` to `dist/functions/` for Workers deploy |
| `package.json` | Modify | Add `mysql2` dependency |
| `dist/` (build output) | Regenerate | Includes `functions/` folder, `_headers`, `_redirects` |

## Support Files

### references/migration-notes.md
Session-specific migration details, error transcripts, and provider quirks. Contains the exact error messages and fix sequences from this session.

### templates/wrangler.jsonc
Starter configuration file for Cloudflare Workers deploy with MySQL support. Can be copied and modified with actual credentials.

### scripts/verify-mysql-connection.cjs
Verification script that tests the MySQL connection and validates the Politcapp database schema is accessible from the Worker.

### scripts/build-site.mjs
Build script that copies functions/ to dist/functions/ — the core enabler for Workers deployment including MySQL.

## Example Commands

```bash
# Install dependencies
npm install mysql2 itty-router

# Build and deploy
npm run build
npm run deploy:pages

# Verify endpoints
curl -I "https://YOUR_DOMAIN.politcapp.pages.dev/api/google-start?return=https%3A%2F%2FYOUR_DOMAIN.politcapp.pages.dev%2Flogin"

# Check MySQL connection in Worker logs
# Look for: "Conexão MySQL estabelecida com sucesso" or "Conexão MySQL estabelecida no Callback Worker"
```

## Related Skills
- `hermes-agent`: For skill authoring and orchestration
- `cloudflare-workers-auth`: For Google OAuth flow reference (if needed as reference)

## Version History
- **v1.0.0**: Initial release — Cloudflare Workers migration, Google OAuth fix, MySQL reconnection
- **v1.1.0**: Added build-site.mjs functions/ copy, enhanced pitfalls section
- **v1.2.0**: Updated with MySQL reconnection workflow and verification scripts
---