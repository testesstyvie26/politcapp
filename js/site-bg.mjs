/**
 * site-bg.mjs — Animação de fundo: rede de dados (nós + conexões)
 * Leve, 60fps limitado a ~40 partículas, pausa com prefers-reduced-motion
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

  /* ── Configuração ───────────────────────────── */
  const CFG = {
    count:        38,    // número de nós
    speed:        0.28,  // velocidade máxima
    linkDist:     160,   // distância máxima para traçar linha
    dotR:         1.8,   // raio dos nós
    dotOpacity:   0.22,  // opacidade dos nós
    lineOpacity:  0.08,  // opacidade máxima das linhas
    colorNode:    '59,130,246',   // azul elétrico
    colorLine:    '59,130,246',
    pulseInterval: 3200, // ms entre pulsos de destaque
  };

  /* ── Estado ─────────────────────────────────── */
  let W, H, nodes, raf, lastPulse = 0, pulseNode = -1;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
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
      pulse: 0,   // 0..1, decai por frame
    };
  }

  function init() {
    resize();
    nodes = Array.from({ length: CFG.count }, makeNode);
  }

  /* ── Loop ───────────────────────────────────── */
  function tick(now) {
    raf = requestAnimationFrame(tick);
    ctx.clearRect(0, 0, W, H);

    /* Pulso periódico num nó aleatório */
    if (now - lastPulse > CFG.pulseInterval) {
      lastPulse = now;
      pulseNode = Math.floor(Math.random() * nodes.length);
      nodes[pulseNode].pulse = 1;
    }

    /* Mover nós */
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < -20) n.x = W + 20;
      if (n.x > W + 20) n.x = -20;
      if (n.y < -20) n.y = H + 20;
      if (n.y > H + 20) n.y = -20;
      if (n.pulse > 0) n.pulse -= 0.012;
    }

    /* Linhas entre nós próximos */
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > CFG.linkDist) continue;

        const fade = 1 - dist / CFG.linkDist;
        const pBoost = Math.max(a.pulse, b.pulse);
        const alpha = (CFG.lineOpacity + pBoost * 0.18) * fade;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(${CFG.colorLine},${alpha.toFixed(3)})`;
        ctx.lineWidth = 0.8 + pBoost * 0.6;
        ctx.stroke();
      }
    }

    /* Nós */
    for (const n of nodes) {
      const pBoost = n.pulse;
      const alpha  = CFG.dotOpacity + pBoost * 0.55;
      const radius = n.r + pBoost * 3;

      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${CFG.colorNode},${alpha.toFixed(3)})`;
      ctx.fill();

      /* Anel de pulso */
      if (pBoost > 0.05) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius + pBoost * 18, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${CFG.colorNode},${(pBoost * 0.12).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  /* ── Lifecycle ──────────────────────────────── */
  init();
  raf = requestAnimationFrame(tick);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); }, 120);
  });

  /* Pausar quando fora da tela (performance) */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(tick);
    }
  });
})();
