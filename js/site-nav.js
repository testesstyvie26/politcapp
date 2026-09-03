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

  /* Arquitetura de informação única em todas as páginas. O menu escrito no
     HTML permanece como fallback, mas a experiência ativa deixa de variar. */
  const currentPathPart = location.pathname.replace(/^.*\//, '') || 'index.html';
  const currentFile = currentPathPart.includes('.') ? currentPathPart : currentPathPart + '.html';
  const adminArea = /^admin(?:-|\.)/.test(currentFile);
  const dropdown = (label, group, links) =>
    '<details class="site-nav-dropdown" data-nav-group="' + group + '">' +
      '<summary class="site-nav-dropdown__summary">' + label + '</summary>' +
      '<div class="site-nav-dropdown__panel" role="group" aria-label="' + label + '">' +
        links.map(([href, text]) => '<a href="' + href + '">' + text + '</a>').join('') +
      '</div>' +
    '</details>';

  nav.innerHTML =
    '<a href="executivo.html">Visão geral</a>' +
    '<a href="presidencial-2026.html">Presidencial 2026</a>' +
    dropdown('Dados eleitorais', 'dados', [
      ['index.html', 'Deputados atuais'],
      ['eleicao-2022-deputado-federal.html', 'Eleição federal 2022'],
      ['prefeituras-rj.html', 'Prefeituras do RJ'],
      ['vereadores-rj.html', 'Vereadores do RJ'],
      ['vereadores-caxias-ordem-votos.html', 'Vereadores de Caxias'],
      ['vereadores-rj-mapa-votos.html', 'Mapa de votos']
    ]) +
    dropdown('Análises', 'analises', [
      ['insights-rj.html', 'Insights do RJ'],
      ['transparencia.html', 'Transparência e verbas'],
      ['vereador-heitor-queiroz-2024.html', 'Análise Heitor Queiroz'],
      ['vereador-heitor-comparativo-2024.html', 'Comparativo eleitoral']
    ]) +
    dropdown('Comunicação', 'comunicacao', [
      ['midia-social.html', 'Painel de mídia social'],
      ['whatsapp.html', 'WhatsApp'],
      ['instagram.html', 'Instagram']
    ]) +
    '<a href="tarefas.html">Tarefas</a>' +
    dropdown('Ajuda', 'ajuda', [
      ['guia-uso.html', 'Guia de uso'],
      ['conta.html', 'Minha conta'],
      ['privacidade.html', 'Privacidade'],
      ['termos-uso.html', 'Termos de uso']
    ]) +
    (adminArea ? dropdown('Administração', 'admin', [
      ['admin.html', 'Painel administrativo'],
      ['admin-unidades.html', 'Unidades'],
      ['admin-aprovacoes.html', 'Aprovar contas'],
      ['admin-usuarios.html', 'Usuários cadastrados']
    ]) : '') +
    '<a class="pn-login" href="login.html">Entrar</a>';

  /* Garante um destino consistente para teclado e leitores de tela inclusive
     nas landing pages antigas. */
  let mainTarget = document.getElementById('politapp-main');
  if (!mainTarget) {
    mainTarget = document.querySelector('main') || document.querySelector('h1');
    if (mainTarget) {
      mainTarget.id = 'politapp-main';
      mainTarget.setAttribute('tabindex', '-1');
    }
  }
  if (mainTarget && !document.querySelector('.politapp-skip')) {
    const skip = Object.assign(document.createElement('a'), {
      className: 'politapp-skip', href: '#politapp-main', textContent: 'Ir ao conteúdo'
    });
    document.body.prepend(skip);
  }

  /* ── Botão "Sair" (oculto; o guard revela e liga quando logado) ── */
  if (!nav.querySelector('.pn-logout')) {
    const sair = Object.assign(document.createElement('a'), {
      href: '#', className: 'pn-logout', textContent: 'Sair',
    });
    sair.setAttribute('data-politapp-logout', '');
    sair.hidden = true;
    nav.appendChild(sair);
  }

  /** Mantém os controles de conta consistentes em páginas públicas e protegidas. */
  function setAuthNavState(loggedIn) {
    const accountLink = nav.querySelector('.pn-login');
    const logoutLink = nav.querySelector('.pn-logout');
    if (accountLink) {
      accountLink.hidden = false;
      accountLink.href = loggedIn ? 'conta.html' : 'login.html';
      accountLink.textContent = loggedIn ? 'Minha conta' : 'Entrar';
      accountLink.setAttribute('aria-label', loggedIn ? 'Abrir minha conta' : 'Entrar no Politapp');
    }
    if (logoutLink) logoutLink.hidden = !loggedIn;
  }
  window.politappSetAuthNavState = setAuthNavState;
  setAuthNavState(false);

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
    panel._ownerDetails = details;

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
  const path = currentFile;
  document.querySelectorAll('nav.site-nav a[href], body > .pn-dd-panel a[href]').forEach(a => {
    if (a.getAttribute('href') === path) {
      a.setAttribute('aria-current', 'page');
      const parentGroup = a.closest('.pn-dd-panel');
      parentGroup?._ownerDetails?.querySelector('summary')?.setAttribute('aria-current', 'page');
    }
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
    setTimeout(() => nav.querySelector('a, summary')?.focus(), 0);
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
  document.addEventListener('keydown', e => {
    if (!drawerOpen || e.key !== 'Tab') return;
    const focusable = [...drawer.querySelectorAll('a[href], summary, button:not([disabled])')]
      .filter(el => !el.hidden && el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  MQ.addEventListener('change', e => { if (!e.matches) closeDrawer(); });

  /* Fechar drawer ao clicar em link (mobile) */
  nav.addEventListener('click', e => {
    if (e.target.closest('a') && MQ.matches) setTimeout(closeDrawer, 80);
  });
})();
