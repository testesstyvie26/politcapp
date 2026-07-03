/**
 * site-interactions.js v1 — Camada de interações compartilhada
 * Enriquece qualquer página que inclua o tema Politapp, sem exigir markup novo.
 *
 *  • Scroll-reveal (IntersectionObserver + stagger)  → [data-reveal] ou auto em .panel
 *  • Contadores animados                              → [data-count] ou [data-counter]
 *  • Ripple em botões                                 → automático
 *  • Tooltips                                         → [data-tip] (CSS) — aqui só a11y
 *  • Toasts                                           → window.toast(msg, {type})
 *  • Tabs                                             → .pt-tabs
 *  • Acordeões                                        → <details class="pt-acc"> (CSS)
 *  • Botão "voltar ao topo"                           → automático
 *
 * Idempotente e defensivo: nunca quebra a página se algo não existir.
 * Respeita prefers-reduced-motion.
 */
(function initInteractions() {
  if (window.__ptInteractions) return;
  window.__ptInteractions = true;

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ready = (fn) =>
    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', fn, { once: true })
      : fn();

  /* ══════════════════════════════════════════════════
     1 · SCROLL-REVEAL
     ══════════════════════════════════════════════════ */
  function initReveal() {
    let targets = Array.from(document.querySelectorAll('[data-reveal]'));

    /* Auto-marca painéis/cards em <main> se o autor não marcou nada.
       Pula os 2 primeiros para não esconder o topo da página. */
    if (targets.length === 0) {
      const auto = document.querySelectorAll(
        'main .panel, main .card, main section > .panel, .wrap > main > *'
      );
      Array.from(auto).slice(2, 60).forEach((el) => {
        if (el.offsetParent !== null) { el.setAttribute('data-reveal', ''); targets.push(el); }
      });
    }
    if (!targets.length) return;
    if (REDUCED || !('IntersectionObserver' in window)) {
      targets.forEach((t) => t.classList.add('is-in'));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const delay = Math.min(i * 60, 240);
          el.style.transitionDelay = delay + 'ms';
          el.classList.add('is-in');
          io.unobserve(el);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -8% 0px' });

    targets.forEach((t) => io.observe(t));
  }

  /* ══════════════════════════════════════════════════
     2 · CONTADORES ANIMADOS
     ══════════════════════════════════════════════════ */
  function animateCount(el) {
    const raw = el.getAttribute('data-count') || el.getAttribute('data-counter') || el.textContent;
    const target = parseFloat(String(raw).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
    if (isNaN(target)) return;
    const decimals = (String(raw).split(/[.,]/)[1] || '').length && /[.,]\d+$/.test(String(raw).trim()) ? 0 : 0;
    const suffix = el.getAttribute('data-suffix') || '';
    const prefix = el.getAttribute('data-prefix') || '';
    const dur = parseInt(el.getAttribute('data-count-dur') || '1100', 10);
    if (REDUCED) { el.textContent = prefix + fmt(target) + suffix; return; }

    const start = performance.now();
    function fmt(n) { return Math.round(n).toLocaleString('pt-BR'); }
    function step(now) {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + fmt(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function initCounters() {
    const els = document.querySelectorAll('[data-count], [data-counter]');
    if (!els.length) return;
    if (REDUCED || !('IntersectionObserver' in window)) { els.forEach(animateCount); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { animateCount(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.4 });
    els.forEach((el) => io.observe(el));
  }

  /* ══════════════════════════════════════════════════
     3 · RIPPLE EM BOTÕES
     ══════════════════════════════════════════════════ */
  function initRipple() {
    if (REDUCED) return;
    document.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.classList.contains('pn-toggle') || btn.classList.contains('pn-brand')) return;
      if (btn.disabled) return;
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const ink = document.createElement('span');
      ink.className = 'ripple-ink';
      ink.style.width = ink.style.height = size + 'px';
      ink.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ink.style.top = (e.clientY - rect.top - size / 2) + 'px';
      const pos = getComputedStyle(btn).position;
      if (pos === 'static') btn.style.position = 'relative';
      btn.appendChild(ink);
      setTimeout(() => ink.remove(), 650);
    }, { passive: true });
  }

  /* ══════════════════════════════════════════════════
     4 · TOASTS  →  window.toast(msg, {type, timeout})
     ══════════════════════════════════════════════════ */
  function ensureToastHost() {
    let host = document.getElementById('pt-toasts');
    if (!host) {
      host = document.createElement('div');
      host.id = 'pt-toasts';
      host.setAttribute('aria-live', 'polite');
      host.setAttribute('aria-atomic', 'false');
      document.body.appendChild(host);
    }
    return host;
  }
  const ICONS = {
    info: '<i class="fa-solid fa-circle-info pt-toast__icon" aria-hidden="true"></i>',
    ok: '<i class="fa-solid fa-circle-check pt-toast__icon" aria-hidden="true"></i>',
    gold: '<i class="fa-solid fa-star pt-toast__icon" aria-hidden="true"></i>',
    danger: '<i class="fa-solid fa-triangle-exclamation pt-toast__icon" aria-hidden="true"></i>',
  };
  window.toast = function toast(message, opts = {}) {
    const type = opts.type || 'info';
    const timeout = opts.timeout == null ? 4200 : opts.timeout;
    const host = ensureToastHost();
    const el = document.createElement('div');
    el.className = 'pt-toast pt-' + type;
    el.setAttribute('role', 'status');
    el.innerHTML =
      (ICONS[type] || ICONS.info) +
      '<div class="pt-toast__msg"></div>' +
      '<button class="pt-toast__close" aria-label="Fechar">&times;</button>';
    el.querySelector('.pt-toast__msg').textContent = message;
    host.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
    const close = () => {
      el.classList.remove('is-in');
      setTimeout(() => el.remove(), 400);
    };
    el.querySelector('.pt-toast__close').addEventListener('click', close);
    if (timeout > 0) setTimeout(close, timeout);
    return { close };
  };

  /* ══════════════════════════════════════════════════
     5 · TABS  (.pt-tabs)
     Estrutura mínima:
       <div class="pt-tabs">
         <div class="pt-tablist" role="tablist">
           <button class="pt-tab" data-tab="a">A</button> ...
         </div>
         <div class="pt-tabpanel" data-panel="a"> ... </div> ...
       </div>
     ══════════════════════════════════════════════════ */
  function initTabs() {
    document.querySelectorAll('.pt-tabs').forEach((root) => {
      if (root.__ptTabsDone) return;
      root.__ptTabsDone = true;
      const tabs = Array.from(root.querySelectorAll('.pt-tab'));
      const panels = Array.from(root.querySelectorAll('.pt-tabpanel'));
      if (!tabs.length) return;

      function select(key, focus) {
        tabs.forEach((t) => {
          const on = t.getAttribute('data-tab') === key;
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          t.setAttribute('role', 'tab');
          t.setAttribute('tabindex', on ? '0' : '-1');
          if (on && focus) t.focus();
        });
        panels.forEach((p) => { p.hidden = p.getAttribute('data-panel') !== key; p.setAttribute('role', 'tabpanel'); });
      }

      tabs.forEach((t, i) => {
        t.addEventListener('click', () => select(t.getAttribute('data-tab')));
        t.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            const dir = e.key === 'ArrowRight' ? 1 : -1;
            const next = tabs[(i + dir + tabs.length) % tabs.length];
            select(next.getAttribute('data-tab'), true);
          }
        });
      });
      const initial = tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0];
      select(initial.getAttribute('data-tab'));
    });
  }

  /* ══════════════════════════════════════════════════
     6 · BOTÃO "VOLTAR AO TOPO"
     ══════════════════════════════════════════════════ */
  function initToTop() {
    if (document.getElementById('pt-totop')) return;
    const btn = document.createElement('button');
    btn.id = 'pt-totop';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Voltar ao topo');
    btn.innerHTML = '<i class="fa-solid fa-arrow-up" aria-hidden="true"></i>';
    document.body.appendChild(btn);
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
    });
    let tick = false;
    function upd() {
      btn.classList.toggle('is-visible', window.scrollY > 480);
      tick = false;
    }
    window.addEventListener('scroll', () => {
      if (!tick) { tick = true; requestAnimationFrame(upd); }
    }, { passive: true });
    upd();
  }

  /* ══════════════════════════════════════════════════
     7 · TOOLTIPS — acessibilidade
     ══════════════════════════════════════════════════ */
  function initTips() {
    document.querySelectorAll('[data-tip]').forEach((el) => {
      if (!el.hasAttribute('aria-label') && !el.getAttribute('title')) {
        el.setAttribute('aria-label', el.getAttribute('data-tip'));
      }
      if (!el.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
        el.setAttribute('tabindex', '0');
      }
    });
  }

  /* ══════════════════════════════════════════════════
     BOOT
     ══════════════════════════════════════════════════ */
  ready(() => {
    try { initReveal(); } catch (e) {}
    try { initCounters(); } catch (e) {}
    try { initRipple(); } catch (e) {}
    try { initTabs(); } catch (e) {}
    try { initToTop(); } catch (e) {}
    try { initTips(); } catch (e) {}
  });
})();
