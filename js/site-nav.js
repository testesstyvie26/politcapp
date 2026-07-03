/**
 * site-nav.js v15 — Topbar Politapp
 * Dropdown panels em position:fixed posicionados via JS
 * (evita todos os problemas de overflow / stacking context)
 */
(function initTopbar() {
  if (document.querySelector('.pn-topbar')) return;
  const nav = document.querySelector('nav.site-nav[aria-label]');
  if (!nav) return;
  if (nav.closest('.pn-topbar')) return;

  /* ── Botão "Sair" (oculto; o guard revela e liga quando logado) ── */
  if (!nav.querySelector('.pn-logout')) {
    const sair = Object.assign(document.createElement('a'), {
      href: '#', className: 'pn-logout', textContent: 'Sair',
    });
    sair.setAttribute('data-politapp-logout', '');
    sair.hidden = true;
    nav.appendChild(sair);
  }

  /* ── Brand ─────────────────────────────────────── */
  const brand = Object.assign(document.createElement('a'), {
    href: 'index.html',
    className: 'pn-brand',
  });
  brand.setAttribute('aria-label', 'Politapp — início');
  brand.innerHTML =
    '<svg class="pn-brand__icon" width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">' +
      '<rect width="32" height="32" rx="7" fill="#060c18"/>' +
      '<rect x="6"  y="19" width="5" height="9"  rx="1.5" fill="#3b82f6"/>' +
      '<rect x="13.5" y="13" width="5" height="15" rx="1.5" fill="#f59e0b"/>' +
      '<rect x="21" y="8"  width="5" height="20" rx="1.5" fill="#3b82f6"/>' +
    '</svg>' +
    '<span class="pn-brand__name">Politapp</span>';

  /* ── Hamburger ──────────────────────────────────── */
  const toggle = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'pn-toggle',
  });
  toggle.setAttribute('aria-label', 'Abrir menu');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<span></span><span></span><span></span>';

  /* ── Drawer (painel de nav) ─────────────────────── */
  const drawer = Object.assign(document.createElement('div'), {
    className: 'pn-drawer',
    id: 'pn-drawer',
  });
  drawer.setAttribute('aria-label', 'Menu principal');
  drawer.appendChild(nav);

  /* ── Backdrop ───────────────────────────────────── */
  const backdrop = Object.assign(document.createElement('div'), {
    className: 'pn-backdrop',
  });
  backdrop.setAttribute('aria-hidden', 'true');

  /* ── Topbar ─────────────────────────────────────── */
  const inner = document.createElement('div');
  inner.className = 'pn-inner';
  inner.appendChild(brand);
  inner.appendChild(drawer);
  inner.appendChild(toggle);

  const topbar = document.createElement('header');
  topbar.className = 'pn-topbar';
  topbar.setAttribute('role', 'banner');
  topbar.appendChild(inner);

  /* Inserir ANTES do primeiro .wrap/.page */
  const anchor = document.querySelector('.wrap, .page') || null;
  const parent = anchor ? anchor.parentNode : document.body;
  parent.insertBefore(topbar, anchor);
  parent.insertBefore(backdrop, anchor);
  document.body.classList.add('pn-has-topbar');

  /* ── Barra de progresso de leitura ──────────────── */
  const progress = document.createElement('div');
  progress.className = 'pn-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.appendChild(progress);

  let progressTick = false;
  function updateProgress() {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - doc.clientHeight;
    const pct = scrollable > 0 ? (doc.scrollTop / scrollable) * 100 : 0;
    progress.style.width = Math.min(100, Math.max(0, pct)) + '%';
    progressTick = false;
  }
  window.addEventListener('scroll', () => {
    if (!progressTick) { progressTick = true; requestAnimationFrame(updateProgress); }
  }, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });
  updateProgress();

  /* Sombra reforçada ao rolar */
  window.addEventListener('scroll', () => {
    topbar.classList.toggle('pn-scrolled', window.scrollY > 8);
  }, { passive: true });

  /* ── Dropdowns: painel em position:fixed ─────────── */
  const summaries = nav.querySelectorAll('details.site-nav-dropdown > summary');

  summaries.forEach(summary => {
    const details = summary.closest('details');
    const panel   = details.querySelector('.site-nav-dropdown__panel, .site-nav-dropdown-panel');
    if (!panel) return;

    /* Move o panel para o body (position:fixed, z-index alto) */
    document.body.appendChild(panel);
    panel.classList.add('pn-dd-panel');

    function positionPanel() {
      const r = summary.getBoundingClientRect();
      panel.style.top  = (r.bottom + 6) + 'px';
      /* Alinhar à esquerda do summary, mas não sair da tela */
      let left = r.left;
      const pw = panel.offsetWidth || 220;
      if (left + pw > window.innerWidth - 12) left = window.innerWidth - pw - 12;
      panel.style.left = Math.max(8, left) + 'px';
    }

    function openPanel() {
      document.querySelectorAll('details.site-nav-dropdown[open]').forEach(d => {
        if (d !== details) d.removeAttribute('open');
      });
      document.querySelectorAll('.pn-dd-panel.is-open').forEach(p => {
        if (p !== panel) {
          p.classList.remove('is-open');
          p.style.setProperty('opacity', '0');
          p.style.setProperty('pointer-events', 'none');
        }
      });

      details.setAttribute('open', '');
      positionPanel();
      /* Força reflow antes de adicionar is-open para disparar a transição CSS */
      panel.style.setProperty('transition', 'none', 'important');
      panel.style.setProperty('opacity', '0');
      void panel.offsetHeight; /* reflow */
      panel.style.removeProperty('transition');
      panel.classList.add('is-open');
      panel.style.setProperty('opacity', '1', 'important');
      panel.style.setProperty('transform', 'translateY(0) scale(1)', 'important');
      panel.style.setProperty('pointer-events', 'auto', 'important');
    }

    function closePanel() {
      details.removeAttribute('open');
      panel.classList.remove('is-open');
      panel.style.setProperty('opacity', '0');
      panel.style.setProperty('pointer-events', 'none');
      panel.style.removeProperty('transform');
    }

    summary.addEventListener('click', e => {
      e.preventDefault();
      if (panel.classList.contains('is-open')) closePanel();
      else openPanel();
    });

    summary.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (panel.classList.contains('is-open')) closePanel();
        else openPanel();
      }
      if (e.key === 'Escape') closePanel();
    });

    /* Reposicionar em resize/scroll */
    window.addEventListener('resize', () => { if (panel.classList.contains('is-open')) positionPanel(); });
    window.addEventListener('scroll', () => { if (panel.classList.contains('is-open')) positionPanel(); }, { passive: true });

    /* Fechar ao clicar fora */
    document.addEventListener('click', e => {
      if (!panel.contains(e.target) && !summary.contains(e.target)) closePanel();
    }, true);
  });

  /* ── Página ativa ───────────────────────────────── */
  const path = location.pathname.replace(/^.*\//, '') || 'index.html';
  nav.querySelectorAll('a[href]').forEach(a => {
    if (a.getAttribute('href') === path) a.setAttribute('aria-current', 'page');
  });

  /* ── Abertura/fechamento do drawer mobile ─────────── */
  let drawerOpen = false;
  const MQ = window.matchMedia('(max-width: 768px)');

  function openDrawer() {
    drawerOpen = true;
    drawer.classList.add('is-open');
    backdrop.classList.add('is-visible');
    toggle.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Fechar menu');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    drawerOpen = false;
    drawer.classList.remove('is-open');
    backdrop.classList.remove('is-visible');
    toggle.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menu');
    document.body.style.overflow = '';
    /* Fechar painéis de dropdown ao fechar drawer */
    document.querySelectorAll('.pn-dd-panel.is-open').forEach(p => p.classList.remove('is-open'));
    document.querySelectorAll('details.site-nav-dropdown[open]').forEach(d => d.removeAttribute('open'));
  }

  toggle.addEventListener('click', () => drawerOpen ? closeDrawer() : openDrawer());
  backdrop.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDrawer(); } });
  MQ.addEventListener('change', e => { if (!e.matches) closeDrawer(); });

  /* Fechar drawer ao clicar em link (mobile) */
  nav.addEventListener('click', e => {
    if (e.target.closest('a') && MQ.matches) setTimeout(closeDrawer, 80);
  });
})();
