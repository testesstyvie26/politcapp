/**
 * site-bg.js v2 — Fundo animado: rede de dados vibrante
 * Nós azul/ciano/violeta/dourado, linhas gradiente, pulsos e leve
 * atração ao cursor. Leve (~46 nós), 60fps, respeita reduced-motion,
 * pausa quando a aba fica oculta.
 */
(function initDataBg() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (document.getElementById('politapp-bg-canvas')) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'politapp-bg-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    zIndex: '0',
    pointerEvents: 'none',
    opacity: '1',
  });
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  /* ── Paleta vibrante ────────────────────────────── */
  const PALETTE = [
    '59,130,246',   // azul elétrico
    '34,211,238',   // ciano
    '139,92,246',   // violeta
    '245,158,11',   // dourado (mais raro)
  ];
  const PALETTE_WEIGHTS = [0.42, 0.26, 0.20, 0.12];

  function pickColor() {
    let r = Math.random(), acc = 0;
    for (let i = 0; i < PALETTE.length; i++) {
      acc += PALETTE_WEIGHTS[i];
      if (r <= acc) return PALETTE[i];
    }
    return PALETTE[0];
  }

  /* ── Configuração ───────────────────────────────── */
  const CFG = {
    count:        46,
    speed:        0.30,
    linkDist:     165,
    dotR:         1.9,
    dotOpacity:   0.28,
    lineOpacity:  0.10,
    pulseInterval: 2600,
    mouseRadius:  180,   // raio de influência do cursor
    mousePull:    0.020, // força de atração
  };

  /* ── Estado ─────────────────────────────────────── */
  let W, H, nodes, raf, lastPulse = 0;
  const mouse = { x: -9999, y: -9999, active: false };

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function makeNode() {
    const angle = Math.random() * Math.PI * 2;
    const spd   = (Math.random() * 0.6 + 0.4) * CFG.speed;
    return {
      x:  Math.random() * W,
      y:  Math.random() * H,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      r:  CFG.dotR * (Math.random() * 0.5 + 0.75),
      color: pickColor(),
      pulse: 0,
    };
  }

  function init() {
    resize();
    nodes = Array.from({ length: CFG.count }, makeNode);
  }

  /* ── Loop ───────────────────────────────────────── */
  function tick(now) {
    raf = requestAnimationFrame(tick);
    ctx.clearRect(0, 0, W, H);

    if (now - lastPulse > CFG.pulseInterval) {
      lastPulse = now;
      nodes[Math.floor(Math.random() * nodes.length)].pulse = 1;
    }

    /* Mover nós + atração ao cursor */
    for (const n of nodes) {
      if (mouse.active) {
        const dx = mouse.x - n.x, dy = mouse.y - n.y;
        const d2 = dx * dx + dy * dy;
        const R = CFG.mouseRadius;
        if (d2 < R * R) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / R) * CFG.mousePull;
          n.vx += (dx / d) * f;
          n.vy += (dy / d) * f;
        }
      }
      /* leve amortecimento p/ não acumular velocidade */
      n.vx *= 0.995; n.vy *= 0.995;
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < -20) n.x = W + 20;
      if (n.x > W + 20) n.x = -20;
      if (n.y < -20) n.y = H + 20;
      if (n.y > H + 20) n.y = -20;
      if (n.pulse > 0) n.pulse -= 0.012;
    }

    /* Linhas entre nós próximos (cor do nó mais "quente") */
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > CFG.linkDist) continue;

        const fade = 1 - dist / CFG.linkDist;
        const pBoost = Math.max(a.pulse, b.pulse);
        const alpha = (CFG.lineOpacity + pBoost * 0.22) * fade;
        const col = pBoost === a.pulse ? a.color : b.color;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(${col},${alpha.toFixed(3)})`;
        ctx.lineWidth = 0.8 + pBoost * 0.7;
        ctx.stroke();
      }
    }

    /* Nós */
    for (const n of nodes) {
      const pBoost = n.pulse;
      const alpha  = CFG.dotOpacity + pBoost * 0.6;
      const radius = n.r + pBoost * 3.5;

      if (pBoost > 0.02) {
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, radius + pBoost * 22);
        g.addColorStop(0, `rgba(${n.color},${(pBoost * 0.35).toFixed(3)})`);
        g.addColorStop(1, `rgba(${n.color},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius + pBoost * 22, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${n.color},${alpha.toFixed(3)})`;
      ctx.fill();
    }
  }

  /* ── Lifecycle ──────────────────────────────────── */
  init();
  raf = requestAnimationFrame(tick);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  window.addEventListener('pointermove', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
  }, { passive: true });
  window.addEventListener('pointerleave', () => { mouse.active = false; });
  window.addEventListener('blur', () => { mouse.active = false; });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(tick);
    }
  });
})();
