import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const folders = ['css', 'data', 'docs', 'js', 'vendor'];
const rootFiles = ['favicon.svg', 'CNAME', 'tse-votos-2022.js'];
const assetVersion = '20260905-3';

// Remove e cria dist
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

// Copiar pastas normais
for (const folder of folders) {
  await cp(path.join(root, folder), path.join(output, folder), { recursive: true });
}

// Copiar arquivos-root (HTML .html na raiz)
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.html') && entry.name !== '404.html') {
    const source = await readFile(path.join(root, entry.name), 'utf8');
    const versioned = source
      .replace(/(css\/site-shell-nav\.css)(?:\?v=[^"']+)?/g, `$1?v=${assetVersion}`)
      .replace(/(css\/site-theme\.css)(?:\?v=[^"']+)?/g, `$1?v=${assetVersion}`)
      .replace(/(js\/site-nav\.js)(?:\?v=[^"']+)?/g, `$1?v=${assetVersion}`)
      .replace(/(js\/auth-config\.js)(?:\?v=[^"']+)?/g, `$1?v=${assetVersion}`)
      .replace(/(js\/auth-guard\.js)(?:\?v=[^"']+)?/g, `$1?v=${assetVersion}`)
      .replace(/(js\/politapp-logout-if-session\.js)(?:\?v=[^"']+)?/g, `$1?v=${assetVersion}`);
    await writeFile(path.join(output, entry.name), versioned, 'utf8');
  }
}

// Copiar arquivos-root extras (favicon, CNAME, etc.)
for (const file of rootFiles) {
  await cp(path.join(root, file), path.join(output, file));
}

// Escrever _headers e _redirects no dist
await writeFile(path.join(output, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  X-Frame-Options: SAMEORIGIN\n\n/css/*\n  Cache-Control: public, max-age=604800\n\n/js/*\n  Cache-Control: public, max-age=604800\n\n/data/*\n  Cache-Control: public, max-age=3600\n`, 'utf8');

await writeFile(path.join(output, '_redirects'), `/ /landing-app.html 302\n/inicio /landing-app.html 302\n/entrar /login.html 302\n/app /index.html 302\n`, 'utf8');

console.log(`Politapp pronto em ${path.relative(root, output)}.`);
