import { chromium } from 'playwright';
const EXEC = '/sessions/youthful-clever-fermi/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';
const pages = ['index.html','executivo.html','transparencia.html','login.html','landing-publico.html'];
const browser = await chromium.launch({ executablePath: EXEC });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
let anyErr = false;
for (const p of pages) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto('file://' + process.cwd() + '/' + p, { waitUntil: 'networkidle', timeout: 20000 }).catch(e => errors.push('NAV: ' + e.message));
  await page.waitForTimeout(900);
  const checks = await page.evaluate(() => ({
    topbar: !!document.querySelector('.pn-topbar'),
    progress: !!document.querySelector('.pn-progress'),
    canvas: !!document.getElementById('politapp-bg-canvas'),
    totop: !!document.getElementById('pt-totop'),
    toastFn: typeof window.toast === 'function',
    reveals: document.querySelectorAll('[data-reveal]').length,
  }));
  const real = errors.filter(e => !/font-awesome|fonts\.g(oogle|static)|cdnjs|ERR_|net::|Failed to load resource/i.test(e));
  if (real.length) anyErr = true;
  console.log('\n== ' + p + ' ==');
  console.log('  elements:', JSON.stringify(checks));
  console.log('  errors:', real.length ? real : 'none');
  if (p === 'index.html') await page.screenshot({ path: '/sessions/youthful-clever-fermi/mnt/outputs/index_shot.png' });
  if (p === 'executivo.html') await page.screenshot({ path: '/sessions/youthful-clever-fermi/mnt/outputs/executivo_shot.png' });
  await page.close();
}
await browser.close();
console.log('\nRESULT:', anyErr ? 'ERRORS FOUND' : 'CLEAN');
