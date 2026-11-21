(() => {
  'use strict';

  const siteConfig = window.SITE_CONFIG || {};
  const galleryConfig = window.GALLERY_CONFIG || {};
  const items = Array.isArray(galleryConfig.items) ? galleryConfig.items : [];

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) el.textContent = value;
  };

  const siteName = siteConfig.name || 'HULAB';
  setText('footer-name', siteName);
  setText('year', String(new Date().getFullYear()));
  setText('gallery-eyebrow', galleryConfig.eyebrow);
  setText('gallery-title', galleryConfig.title);
  const titlePeriod = document.createElement('span');
  titlePeriod.className = 'title-period';
  titlePeriod.setAttribute('aria-hidden', 'true');
  titlePeriod.textContent = '.';
  document.getElementById('gallery-title')?.appendChild(titlePeriod);
  setText('gallery-subtitle', galleryConfig.subtitle);
  document.title = `${galleryConfig.title || '画廊'} · ${siteName}`;

  const months = [...new Set(items.map(item => String(item.date || '').match(/^\d{4}\.\d{2}/)?.[0]).filter(Boolean))].sort();
  const dateRange = months.length > 1 ? `${months[0]} — ${months[months.length - 1]}` : months[0];
  setText('archive-range', [dateRange, `${String(items.length).padStart(2, '0')} MOMENTS`].filter(Boolean).join('   /   '));

  const nowCard = document.getElementById('now-card');
  const nowStatus = galleryConfig.nowStatus;
  if (nowCard) {
    if (!nowStatus || nowStatus.enabled === false) {
      nowCard.hidden = true;
    } else {
      nowCard.hidden = false;
      setText('now-badge', nowStatus.badge);
      setText('now-text', nowStatus.text);
      setText('now-mood', nowStatus.mood);
      setText('now-time', nowStatus.updatedAt);
    }
  }

  const gridEl = document.getElementById('gallery-grid');
  const filterBarEl = document.getElementById('filter-bar');
  const countEl = document.getElementById('gallery-count');

  let activeFilter = 'all';
  let filteredItems = [...items];
  let activeLightboxIndex = 0;
  let activeSubImageIndex = 0;
  let filmDrag = null;
  let filmScrollPos = 0;
  let filmAutoRaf = 0;
  let filmLastTime = 0;
  let suppressClickUntil = 0;
  const FILM_SPEED_PX_PER_SEC = 56;

  const isLiveItem = item => Boolean(item?.liveVideo);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const getItemImages = item => {
    if (Array.isArray(item.images) && item.images.length > 0) return item.images;
    return item.image ? [item.image] : [];
  };

  const formatIsoDate = raw => String(raw || '').split(' · ')[0].replace(/\./g, '-');

  const isFilmView = () => true;
  const canLoopFilm = () => filteredItems.length > 1;

  function getFilmMetrics() {
    const firstCard = gridEl.querySelector('.photo-card');
    if (!firstCard || !canLoopFilm()) return null;
    const frameWidth = firstCard.getBoundingClientRect().width;
    if (!frameWidth) return null;
    const repeatsPerSet = Number(gridEl.dataset.repeatsPerSet || 1);
    const framesPerSet = filteredItems.length * repeatsPerSet;
    const setWidth = frameWidth * framesPerSet;
    return { frameWidth, framesPerSet, setWidth };
  }

  function normalizeFilmScroll() {
    const metrics = getFilmMetrics();
    if (!metrics) return;
    const { setWidth } = metrics;
    let delta = 0;
    if (filmScrollPos < setWidth * 0.5) {
      delta = setWidth;
    } else if (filmScrollPos >= setWidth * 1.5) {
      delta = -setWidth;
    }
    if (delta !== 0) {
      filmScrollPos += delta;
      gridEl.scrollLeft = filmScrollPos;
      if (filmDrag) filmDrag.startScroll += delta;
    }
  }

  function tickFilmAutoScroll(now) {
    if (!canLoopFilm() || document.hidden || dialog?.open) {
      filmAutoRaf = 0;
      filmLastTime = 0;
      return;
    }
    if (!filmLastTime) filmLastTime = now;
    const dt = Math.min(64, now - filmLastTime);
    filmLastTime = now;

    if (!filmDrag) {
      filmScrollPos += (FILM_SPEED_PX_PER_SEC * dt) / 1000;
      gridEl.scrollLeft = filmScrollPos;
      normalizeFilmScroll();
    }
    filmAutoRaf = requestAnimationFrame(tickFilmAutoScroll);
  }

  function syncFilmAutoScroll() {
    if (canLoopFilm() && !document.hidden && !dialog?.open) {
      if (!filmAutoRaf) {
        filmLastTime = 0;
        filmAutoRaf = requestAnimationFrame(tickFilmAutoScroll);
      }
    } else if (filmAutoRaf) {
      cancelAnimationFrame(filmAutoRaf);
      filmAutoRaf = 0;
      filmLastTime = 0;
    }
  }

  gridEl.addEventListener('scroll', () => {
    if (!isFilmView()) return;
    if (!filmDrag && Math.abs(gridEl.scrollLeft - filmScrollPos) > 2) {
      filmScrollPos = gridEl.scrollLeft;
    }
    normalizeFilmScroll();
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (isFilmView()) normalizeFilmScroll();
  }, { passive: true });

  gridEl.addEventListener('wheel', event => {
    if (!isFilmView() || event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    const scale = event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? gridEl.clientWidth : 1;
    const delta = event.deltaY * scale;
    if (!canLoopFilm()) {
      const maximum = gridEl.scrollWidth - gridEl.clientWidth;
      if ((delta > 0 && gridEl.scrollLeft >= maximum - 1) || (delta < 0 && gridEl.scrollLeft <= 1)) return;
    }
    event.preventDefault();
    filmScrollPos += delta;
    gridEl.scrollLeft = filmScrollPos;
    normalizeFilmScroll();
  }, { passive: false });

  gridEl.addEventListener('pointerdown', event => {
    if (!isFilmView() || event.pointerType !== 'mouse' || event.button !== 0) return;
    normalizeFilmScroll();
    filmDrag = { pointerId: event.pointerId, startX: event.clientX, startScroll: filmScrollPos, moved: false };
  });

  window.addEventListener('pointermove', event => {
    if (!filmDrag || event.pointerId !== filmDrag.pointerId) return;
    const distance = event.clientX - filmDrag.startX;
    if (!filmDrag.moved && Math.abs(distance) < 6) return;
    if (!filmDrag.moved) {
      filmDrag.moved = true;
      gridEl.setPointerCapture(event.pointerId);
      gridEl.classList.add('is-dragging');
    }
    event.preventDefault();
    filmScrollPos = filmDrag.startScroll - distance;
    gridEl.scrollLeft = filmScrollPos;
    normalizeFilmScroll();
  }, { passive: false });

  function endFilmDrag() {
    if (!filmDrag) return;
    const { pointerId, moved } = filmDrag;
    filmDrag = null;
    if (moved) suppressClickUntil = performance.now() + 250;
    normalizeFilmScroll();
    gridEl.classList.remove('is-dragging');
    if (gridEl.hasPointerCapture(pointerId)) gridEl.releasePointerCapture(pointerId);
  }

  window.addEventListener('pointerup', endFilmDrag);
  window.addEventListener('pointercancel', endFilmDrag);
  window.addEventListener('blur', endFilmDrag);
  gridEl.addEventListener('lostpointercapture', endFilmDrag);
  gridEl.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
  gridEl.addEventListener('dragstart', event => {
    event.preventDefault();
  });

  function renderFilters() {
    if (!filterBarEl) return;
    filterBarEl.textContent = '';

    const filters = [{ key: 'all', label: '全部', count: items.length }];
    const liveCount = items.filter(isLiveItem).length;
    if (liveCount > 0) {
      filters.push({ key: '__live__', label: 'LIVE', count: liveCount });
    }

    const tagCounts = new Map();
    items.forEach(item => {
      if (item.tag) tagCounts.set(item.tag, (tagCounts.get(item.tag) || 0) + 1);
    });
    tagCounts.forEach((count, tag) => {
      filters.push({ key: `tag:${tag}`, label: tag, count });
    });

    filters.forEach(f => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `filter-chip${activeFilter === f.key ? ' is-active' : ''}`;
      btn.setAttribute('aria-pressed', String(activeFilter === f.key));
      btn.dataset.filter = f.key;

      const labelSpan = document.createElement('span');
      labelSpan.textContent = f.label;
      const countSpan = document.createElement('span');
      countSpan.className = 'chip-count';
      countSpan.textContent = String(f.count);

      btn.append(labelSpan, countSpan);
      btn.addEventListener('click', () => {
        activeFilter = f.key;
        filterBarEl.querySelectorAll('.filter-chip').forEach(filter => {
          const selected = filter.dataset.filter === activeFilter;
          filter.classList.toggle('is-active', selected);
          filter.setAttribute('aria-pressed', String(selected));
        });
        renderGrid();
      });
      filterBarEl.appendChild(btn);
    });
  }

  function startCardLive(card, videoEl) {
    if (reducedMotion.matches || dialog?.open) return;
    card.classList.add('is-live-playing');
    if (videoEl) {
      videoEl.currentTime = 0;
      videoEl.play().catch(() => {});
    }
  }

  function stopCardLive(card, videoEl) {
    card.classList.remove('is-live-playing');
    if (videoEl) {
      videoEl.pause();
    }
  }

  function buildPhotoCard(item, index, copyIdx, primaryCopyIdx) {
    const isClone = copyIdx !== primaryCopyIdx;
    const card = document.createElement('article');
    card.className = 'photo-card';
    card.dataset.itemIndex = String(index);
    card.dataset.copyIndex = String(copyIdx);
    card.tabIndex = isClone ? -1 : 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `查看照片：${item.title || '未命名'}`);
    card.setAttribute('aria-haspopup', 'dialog');

    const media = document.createElement('div');
    media.className = 'card-media';

    const imgs = getItemImages(item);
    const img = document.createElement('img');
    img.className = 'card-img';
    img.src = imgs[0] || '';
    img.alt = item.title || '画廊图片';
    img.loading = !isClone && index < 2 ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.draggable = false;
    media.appendChild(img);

    let videoEl = null;
    if (item.liveVideo) {
      videoEl = document.createElement('video');
      videoEl.className = 'card-video';
      videoEl.src = item.liveVideo;
      videoEl.muted = true;
      videoEl.loop = true;
      videoEl.playsInline = true;
      videoEl.preload = 'metadata';
      media.appendChild(videoEl);
    }

    const body = document.createElement('div');
    body.className = 'card-body';

    const metaLine = document.createElement('p');
    metaLine.className = 'card-meta-line';
    const frameNo = String(items.indexOf(item) + 1).padStart(2, '0');
    const parts = isFilmView()
      ? [frameNo, formatIsoDate(item.date), item.location, item.tag].filter(Boolean)
      : [formatIsoDate(item.date), item.location, item.tag].filter(Boolean);
    metaLine.textContent = parts.join(' · ');
    body.appendChild(metaLine);

    card.append(media, body);

    if (isLiveItem(item)) {
      card.addEventListener('pointerenter', () => startCardLive(card, videoEl));
      card.addEventListener('pointerleave', () => stopCardLive(card, videoEl));
      card.addEventListener('blur', () => stopCardLive(card, videoEl));
    }

    card.addEventListener('click', () => openLightbox(index));
    card.addEventListener('keydown', event => {
      if (isFilmView() && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        const nextIndex = (index + delta + filteredItems.length) % filteredItems.length;
        const metrics = getFilmMetrics();
        if (metrics) {
          filmScrollPos += delta * metrics.frameWidth;
          gridEl.scrollLeft = filmScrollPos;
          normalizeFilmScroll();
        }
        const primaryTarget = gridEl.querySelector(`.photo-card[data-copy-index="${primaryCopyIdx}"][data-item-index="${nextIndex}"]`);
        primaryTarget?.focus({ preventScroll: true });
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openLightbox(index);
      }
    });

    return card;
  }

  function renderGrid() {
    if (!gridEl) return;
    endFilmDrag();
    gridEl.querySelectorAll('video').forEach(video => video.pause());
    gridEl.textContent = '';

    filteredItems = items.filter(item => {
      if (activeFilter === 'all') return true;
      if (activeFilter === '__live__') return isLiveItem(item);
      if (activeFilter.startsWith('tag:')) return item.tag === activeFilter.slice(4);
      return true;
    });

    if (countEl) {
      countEl.textContent = `共 ${filteredItems.length} 条记录`;
    }

    if (filteredItems.length === 0) {
      delete gridEl.dataset.repeatsPerSet;
      filmScrollPos = 0;
      gridEl.scrollLeft = 0;
      syncFilmAutoScroll();
      const empty = document.createElement('div');
      empty.className = 'empty-note';
      const star = document.createElement('span');
      star.className = 'small-star';
      star.setAttribute('aria-hidden', 'true');
      star.textContent = '✳';
      const p = document.createElement('p');
      p.textContent = '当前分类下还没有实况或照片记录。';
      empty.append(star, p);
      gridEl.appendChild(empty);
      return;
    }

    if (canLoopFilm()) {
      const repeatsPerSet = Math.max(1, Math.ceil(4 / filteredItems.length));
      gridEl.dataset.repeatsPerSet = String(repeatsPerSet);
      const totalCopies = 3 * repeatsPerSet;
      const primaryCopyIdx = repeatsPerSet;

      for (let copyIdx = 0; copyIdx < totalCopies; copyIdx++) {
        filteredItems.forEach((item, index) => {
          gridEl.appendChild(buildPhotoCard(item, index, copyIdx, primaryCopyIdx));
        });
      }

      const metrics = getFilmMetrics();
      filmScrollPos = metrics ? metrics.setWidth : 0;
      gridEl.scrollLeft = filmScrollPos;
      syncFilmAutoScroll();
      return;
    }

    delete gridEl.dataset.repeatsPerSet;
    filteredItems.forEach((item, index) => {
      gridEl.appendChild(buildPhotoCard(item, index, 0, 0));
    });
    filmScrollPos = 0;
    gridEl.scrollLeft = 0;
    syncFilmAutoScroll();
  }

  // 全屏沉浸式 Lightbox 逻辑
  const dialog = document.getElementById('lightbox-dialog');
  const closeBtn = document.getElementById('lightbox-close');
  const prevBtn = document.getElementById('lightbox-prev');
  const nextBtn = document.getElementById('lightbox-next');
  const mediaWrap = document.getElementById('lightbox-media-wrap');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxVideo = document.getElementById('lightbox-video');

  function setLightboxLivePlaying(playing) {
    if (!mediaWrap) return;
    mediaWrap.classList.toggle('is-live-playing', playing);
    if (lightboxVideo && !lightboxVideo.hidden) {
      if (playing) {
        lightboxVideo.currentTime = 0;
        lightboxVideo.play().catch(() => {});
      } else {
        lightboxVideo.pause();
      }
    }
  }

  function updateLightboxContent() {
    const item = filteredItems[activeLightboxIndex];
    if (!item) return;

    const imgs = getItemImages(item);
    const currentSrc = imgs[activeSubImageIndex] || imgs[0] || '';

    setLightboxLivePlaying(false);

    if (lightboxImg) {
      lightboxImg.src = currentSrc;
      lightboxImg.alt = item.title || '大图预览';
    }

    if (lightboxVideo) {
      if (item.liveVideo && activeSubImageIndex === 0) {
        lightboxVideo.src = item.liveVideo;
        lightboxVideo.hidden = false;
      } else {
        lightboxVideo.pause();
        lightboxVideo.removeAttribute('src');
        lightboxVideo.hidden = true;
      }
    }

    const pad = n => String(n).padStart(2, '0');
    const summaryParts = [
      `${pad(activeLightboxIndex + 1)} / ${pad(filteredItems.length)}`,
      formatIsoDate(item.date),
      item.location,
      item.tag,
      item.meta,
    ].filter(Boolean);

    setText('lightbox-index', summaryParts.join(' · '));
    setText('lightbox-tag', '');
    setText('lightbox-date', '');
    setText('lightbox-title', item.title ? `· ${item.title}` : '');
    setText('lightbox-note', item.note ? `— ${item.note}` : '');

    if (prevBtn) prevBtn.disabled = filteredItems.length < 2;
    if (nextBtn) nextBtn.disabled = filteredItems.length < 2;
  }

  function openLightbox(index) {
    if (!dialog?.showModal || !filteredItems[index]) return;
    gridEl.querySelectorAll('.photo-card').forEach(card => stopCardLive(card, card.querySelector('video')));
    activeLightboxIndex = index;
    activeSubImageIndex = 0;
    updateLightboxContent();
    if (!dialog.open) dialog.showModal();
    syncFilmAutoScroll();
  }

  function stepLightbox(delta) {
    if (filteredItems.length === 0) return;
    activeLightboxIndex = (activeLightboxIndex + delta + filteredItems.length) % filteredItems.length;
    activeSubImageIndex = 0;
    updateLightboxContent();
  }

  prevBtn?.addEventListener('click', () => stepLightbox(-1));
  nextBtn?.addEventListener('click', () => stepLightbox(1));
  closeBtn?.addEventListener('click', () => dialog?.close());

  dialog?.addEventListener('close', () => {
    setLightboxLivePlaying(false);
    syncFilmAutoScroll();
    const primaryCopyIdx = Number(gridEl.dataset.repeatsPerSet || 0);
    const activeCard =
      gridEl.querySelector(`.photo-card[data-copy-index="${primaryCopyIdx}"][data-item-index="${activeLightboxIndex}"]`) ||
      gridEl.querySelector(`.photo-card[data-item-index="${activeLightboxIndex}"]`);
    activeCard?.focus({ preventScroll: true });
  });

  document.addEventListener('visibilitychange', () => {
    syncFilmAutoScroll();
    if (!document.hidden) return;
    gridEl.querySelectorAll('.photo-card').forEach(card => stopCardLive(card, card.querySelector('video')));
    setLightboxLivePlaying(false);
  });

  dialog?.addEventListener('click', event => {
    if (event.target === dialog || event.target === mediaWrap) {
      dialog.close();
    }
  });

  window.addEventListener('keydown', event => {
    if (!dialog?.open) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      stepLightbox(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      stepLightbox(1);
    }
  });

  renderFilters();
  renderGrid();
})();
