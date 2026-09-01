import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const folders = ['css', 'data', 'docs', 'js', 'vendor'];
const rootFiles = ['favicon.svg', 'CNAME', 'tse-votos-2022.js'];
const assetVersion = '20260901-2';

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const folder of folders) {
  await cp(path.join(root, folder), path.join(output, folder), { recursive: true });
}

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.html')) {
    const source = await readFile(path.join(root, entry.name), 'utf8');
    const versioned = source
      .replace(/(css\/site-shell-nav\.css)(?:\?v=[^"']+)?/g, `$1?v=${assetVersion}`)
      .replace(/(css\/site-theme\.css)(?:\?v=[^"']+)?/g, `$1?v=${assetVersion}`)
      .replace(/(js\/site-nav\.js)(?:\?v=[^"']+)?/g, `$1?v=${assetVersion}`);
    await writeFile(path.join(output, entry.name), versioned, 'utf8');
  }
}

for (const file of rootFiles) {
  await cp(path.join(root, file), path.join(output, file));
}

await writeFile(path.join(output, '_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-Frame-Options: SAMEORIGIN

/css/*
  Cache-Control: public, max-age=604800

/js/*
  Cache-Control: public, max-age=604800

/data/*
  Cache-Control: public, max-age=3600
`, 'utf8');

await writeFile(path.join(output, '_redirects'), `/ /landing-app.html 302
/inicio /landing-app.html 302
/entrar /login.html 302
/app /index.html 302
`, 'utf8');

console.log(`Politapp pronto em ${path.relative(root, output)}.`);
