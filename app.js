(() => {
  'use strict';
  const config = window.SITE_CONFIG || {};
  const setText = (id, value) => { if (value) document.getElementById(id).textContent = value; };
  setText('site-title', config.name);
  setText('footer-name', config.name);
  setText('tagline', config.tagline);
  setText('intro', config.intro);
  setText('about-description', config.about);
  document.querySelectorAll('[data-profile-name]').forEach(node => { node.textContent = config.name || 'HULAB'; });
  document.getElementById('year').textContent = new Date().getFullYear();
  if (config.name) document.title = `${config.name} · 个人空间`;
  if (config.intro) {
    document.querySelector('meta[name="description"]').content = `${config.name} 的个人空间。${config.intro}`;
    document.querySelector('meta[property="og:description"]').content = config.intro;
  }
  document.querySelector('meta[property="og:title"]').content = document.title;
  function setLink(selector, value) {
    try {
      const url = new URL(value);
      if (url.protocol === 'https:') document.querySelectorAll(selector).forEach(node => { node.href = url.href; });
    } catch { /* Keep the working HTML fallback if the configuration is invalid. */ }
  }
  setLink('#github-link, [data-github-link]', config.github);
  setLink('#projects-link', config.projects);
  setLink('#source-link', config.source);

  const canvas = document.getElementById('fluid-background');
  const hint = document.getElementById('interaction-hint');
  const toggle = document.getElementById('motion-toggle');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let engine;
  let unavailable = false;
  let userPaused = false;
  let introPlayed = false;
  let introTimer;
  const activePointers = new Set();
  try { userPaused = localStorage.getItem('fluid-paused') === 'true'; } catch { /* Storage is optional. */ }
  const stopped = () => userPaused || motion.matches || document.hidden || Boolean(document.querySelector('dialog[open]'));
  function stopIntro() { clearTimeout(introTimer); introTimer = undefined; }
  function releasePointers() {
    activePointers.forEach(id => { engine?.end(id); if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id); });
    activePointers.clear();
  }
  function openingColors() {
    if (introPlayed || stopped() || !engine || unavailable) return;
    introPlayed = true;
    const total = innerWidth < 600 ? 3 : 4;
    let index = 0;
    const splash = () => {
      if (stopped() || unavailable) return;
      const bounds = document.querySelector('.hero').getBoundingClientRect();
      const x = bounds.left + bounds.width * (.14 + .72 * (index + Math.random()) / total);
      const y = bounds.top + bounds.height * (.2 + Math.random() * .5);
      engine.start('intro', x, y);
      engine.end('intro');
      if (++index < total) introTimer = setTimeout(splash, 240);
    };
    splash();
  }
  function updateMotion() {
    const pause = stopped();
    if (!engine && !unavailable && !pause) {
      try { engine = window.createFluid(canvas); canvas.dataset.renderer = 'webgl'; }
      catch { unavailable = true; canvas.dataset.renderer = 'unavailable'; canvas.hidden = true; }
    }
    engine?.setPaused(pause);
    document.body.classList.toggle('motion-paused', pause);
    toggle.hidden = unavailable || motion.matches;
    toggle.textContent = userPaused ? '开启光效' : '暂停光效';
    toggle.setAttribute('aria-pressed', String(userPaused));
    hint.hidden = pause || unavailable;
    if (pause) { stopIntro(); releasePointers(); }
    else openingColors();
  }
  toggle.addEventListener('click', () => {
    userPaused = !userPaused;
    try { localStorage.setItem('fluid-paused', String(userPaused)); } catch { /* Storage is optional. */ }
    updateMotion();
  });
  document.querySelectorAll('[data-dialog]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const dialog = document.getElementById(link.dataset.dialog);
      if (!dialog?.showModal) return;
      event.preventDefault();
      dialog.showModal();
      updateMotion();
    });
  });
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelector('.close-panel').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', updateMotion);
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
  });
  window.addEventListener('pointerdown', event => {
    if (stopped() || unavailable || !engine || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (!(event.target instanceof Element) || !event.target.closest('.hero')) return;
    introPlayed = true;
    stopIntro();
    activePointers.add(event.pointerId);
    engine.start(event.pointerId, event.clientX, event.clientY);
    document.body.classList.add('has-interacted');
    try { canvas.setPointerCapture(event.pointerId); } catch { /* Window listeners cover uncaptured pointers. */ }
  }, { passive: true });
  window.addEventListener('pointermove', event => {
    if (activePointers.has(event.pointerId)) engine?.move(event.pointerId, event.clientX, event.clientY);
  }, { passive: true });
  function endPointer(event) {
    activePointers.delete(event.pointerId);
    engine?.end(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }
  window.addEventListener('pointerup', endPointer, { passive: true });
  window.addEventListener('pointercancel', endPointer, { passive: true });
  window.addEventListener('blur', releasePointers);
  window.addEventListener('resize', () => engine?.resize(), { passive: true });
  document.addEventListener('visibilitychange', updateMotion);
  motion.addEventListener('change', updateMotion);
  window.addEventListener('pageshow', updateMotion);
  window.addEventListener('pagehide', () => { stopIntro(); releasePointers(); engine?.setPaused(true); });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    stopIntro();
    releasePointers();
    engine?.setPaused(true);
    engine = undefined;
    unavailable = true;
    canvas.hidden = true;
    canvas.dataset.renderer = 'unavailable';
    hint.hidden = true;
    toggle.hidden = true;
  });
  canvas.addEventListener('webglcontextrestored', () => { unavailable = false; canvas.hidden = false; updateMotion(); });
  updateMotion();
})();
