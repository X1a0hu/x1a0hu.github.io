(() => {
  'use strict';

  const config = window.SITE_CONFIG || {};
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el && value) el.textContent = value;
  };

  setText('site-title', config.name || 'HULAB');
  setText('site-tagline', config.tagline || config.about);
  if (config.handle) {
    setText('hero-handle', `PERSONAL SPACE · ${config.handle}`);
  }

  if (config.name) {
    document.title = `${config.name} · 个人空间`;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = document.title;
  }

  const canvas = document.getElementById('fluid-background');
  const hint = document.getElementById('interaction-hint');
  if (!canvas) return;

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let engine;
  let unavailable = false;
  let introPlayed = false;
  let introTimer;
  const activePointers = new Set();
  const stopped = () => motion.matches || document.hidden;

  function stopIntro() {
    clearTimeout(introTimer);
    introTimer = undefined;
  }

  function releasePointers() {
    activePointers.forEach(id => {
      engine?.end(id);
      if (canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture(id);
    });
    activePointers.clear();
  }

  function openingColors() {
    if (introPlayed || stopped() || !engine || unavailable) return;
    introPlayed = true;
    const total = innerWidth < 600 ? 3 : 4;
    let index = 0;
    const splash = () => {
      if (stopped() || unavailable) return;
      const heroEl = document.querySelector('.hero');
      if (!heroEl) return;
      const bounds = heroEl.getBoundingClientRect();
      const x = bounds.left + bounds.width * (0.14 + (0.72 * (index + Math.random())) / total);
      const y = bounds.top + bounds.height * (0.2 + Math.random() * 0.5);
      engine.start('intro', x, y);
      engine.end('intro');
      if (++index < total) introTimer = setTimeout(splash, 240);
    };
    splash();
  }

  function updateMotion() {
    const pause = stopped();
    if (!engine && !unavailable && !pause && typeof window.createFluid === 'function') {
      try {
        engine = window.createFluid(canvas);
        canvas.dataset.renderer = 'webgl';
      } catch {
        unavailable = true;
        canvas.dataset.renderer = 'unavailable';
        canvas.hidden = true;
      }
    }
    engine?.setPaused(pause);
    document.body.classList.toggle('motion-paused', pause);
    if (hint) hint.hidden = pause || unavailable;
    if (pause) {
      stopIntro();
      releasePointers();
    } else {
      openingColors();
    }
  }

  window.addEventListener('pointerdown', event => {
    if (stopped() || unavailable || !engine || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (!(event.target instanceof Element) || !event.target.closest('.hero') || event.target.closest('a, button')) return;
    introPlayed = true;
    stopIntro();
    activePointers.add(event.pointerId);
    engine.start(event.pointerId, event.clientX, event.clientY);
    document.body.classList.add('has-interacted');
    try { canvas.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  }, { passive: true });

  window.addEventListener('pointermove', event => {
    if (activePointers.has(event.pointerId)) engine?.move(event.pointerId, event.clientX, event.clientY);
  }, { passive: true });

  function endPointer(event) {
    activePointers.delete(event.pointerId);
    engine?.end(event.pointerId);
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }

  window.addEventListener('pointerup', endPointer, { passive: true });
  window.addEventListener('pointercancel', endPointer, { passive: true });
  window.addEventListener('blur', releasePointers);
  window.addEventListener('resize', () => engine?.resize(), { passive: true });
  document.addEventListener('visibilitychange', updateMotion);
  motion.addEventListener('change', updateMotion);
  window.addEventListener('pageshow', updateMotion);
  window.addEventListener('pagehide', () => {
    stopIntro();
    releasePointers();
    engine?.setPaused(true);
  });

  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    stopIntro();
    releasePointers();
    engine?.setPaused(true);
    engine = undefined;
    unavailable = true;
    canvas.hidden = true;
    canvas.dataset.renderer = 'unavailable';
    if (hint) hint.hidden = true;
  });

  canvas.addEventListener('webglcontextrestored', () => {
    unavailable = false;
    canvas.hidden = false;
    updateMotion();
  });

  updateMotion();
})();
