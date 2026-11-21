(() => {
  'use strict';

  const siteConfig = window.SITE_CONFIG || {};
  const galleryConfig = window.GALLERY_CONFIG || {};
  const items = Array.isArray(galleryConfig.items) ? galleryConfig.items : [];

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el && value) el.textContent = value;
  };

  const siteName = siteConfig.name || 'HULAB';
  setText('footer-name', siteName);
  setText('year', String(new Date().getFullYear()));
  setText('gallery-eyebrow', galleryConfig.eyebrow);
  setText('gallery-title', galleryConfig.title);
  setText('gallery-subtitle', galleryConfig.subtitle);
  document.title = `${galleryConfig.title || '画廊'} · ${siteName}`;

  // 渲染顶部「当下实况」卡片
  const nowCard = document.getElementById('now-card');
  const nowStatus = galleryConfig.nowStatus;
  if (nowCard) {
    if (!nowStatus || nowStatus.enabled === false) {
      nowCard.hidden = true;
    } else {
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

  const isLiveItem = item => Boolean(item && (item.live || item.liveVideo));
  const getItemImages = item => {
    if (Array.isArray(item.images) && item.images.length > 0) return item.images;
    return item.image ? [item.image] : [];
  };

  // 视图切换（Bento 画廊 / 拍立得墙）
  document.querySelectorAll('[data-view-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.viewMode;
      document.querySelectorAll('[data-view-mode]').forEach(b => {
        const active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      gridEl.classList.toggle('is-bento', mode === 'bento');
      gridEl.classList.toggle('is-polaroid', mode === 'polaroid');
    });
  });

  // 构建分类筛选栏
  function renderFilters() {
    if (!filterBarEl) return;
    filterBarEl.textContent = '';

    const filters = [{ key: 'all', label: '全部', count: items.length }];
    const liveCount = items.filter(isLiveItem).length;
    if (liveCount > 0) {
      filters.push({ key: '__live__', label: '◉ LIVE 实况', count: liveCount });
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

      const labelSpan = document.createElement('span');
      labelSpan.textContent = f.label;
      const countSpan = document.createElement('span');
      countSpan.className = 'chip-count';
      countSpan.textContent = String(f.count);

      btn.append(labelSpan, countSpan);
      btn.addEventListener('click', () => {
        activeFilter = f.key;
        renderFilters();
        renderGrid();
      });
      filterBarEl.appendChild(btn);
    });
  }

  function startCardLive(card, videoEl) {
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

  // 渲染照片墙卡片
  function renderGrid() {
    if (!gridEl) return;
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
      const empty = document.createElement('div');
      empty.className = 'empty-note';
      empty.style.gridColumn = '1 / -1';
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

    filteredItems.forEach((item, index) => {
      const card = document.createElement('article');
      card.className = 'photo-card';
      card.dataset.span = item.span || 'normal';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `查看实况：${item.title || '未命名'}`);

      const media = document.createElement('div');
      media.className = 'card-media';

      const imgs = getItemImages(item);
      const img = document.createElement('img');
      img.className = 'card-img';
      img.src = imgs[0] || '';
      img.alt = item.title || '画廊图片';
      img.loading = 'lazy';
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

      const badges = document.createElement('div');
      badges.className = 'card-badges';

      const leftBadgeHolder = document.createElement('div');
      if (isLiveItem(item)) {
        const liveBadge = document.createElement('span');
        liveBadge.className = 'live-pill';
        const icon = document.createElement('span');
        icon.className = 'live-icon';
        icon.setAttribute('aria-hidden', 'true');
        const txt = document.createElement('span');
        txt.textContent = 'LIVE';
        liveBadge.append(icon, txt);
        leftBadgeHolder.appendChild(liveBadge);
      }
      badges.appendChild(leftBadgeHolder);

      if (imgs.length > 1) {
        const multiBadge = document.createElement('span');
        multiBadge.className = 'multi-pill';
        multiBadge.textContent = `${imgs.length} 张`;
        badges.appendChild(multiBadge);
      }

      media.appendChild(badges);

      const body = document.createElement('div');
      body.className = 'card-body';

      const metaTop = document.createElement('div');
      metaTop.className = 'card-meta-top';
      if (item.tag) {
        const tagSpan = document.createElement('span');
        tagSpan.className = 'card-tag';
        tagSpan.textContent = item.tag;
        metaTop.appendChild(tagSpan);
      }
      if (item.date) {
        const dateSpan = document.createElement('time');
        dateSpan.textContent = item.date;
        metaTop.appendChild(dateSpan);
      }
      if (item.location) {
        const locSpan = document.createElement('span');
        locSpan.className = 'card-location';
        locSpan.textContent = `· ${item.location}`;
        metaTop.appendChild(locSpan);
      }

      const titleEl = document.createElement('h2');
      titleEl.className = 'card-title';
      titleEl.textContent = item.title || '';

      const noteEl = document.createElement('p');
      noteEl.className = 'card-note';
      noteEl.textContent = item.note || '';

      const footer = document.createElement('div');
      footer.className = 'card-footer';
      const exifSpan = document.createElement('span');
      exifSpan.textContent = item.meta || (isLiveItem(item) ? 'Live Moment' : 'Photo Note');
      const openHint = document.createElement('span');
      openHint.className = 'card-open-hint';
      openHint.textContent = '暗房查看 ↗';
      footer.append(exifSpan, openHint);

      body.append(metaTop, titleEl, noteEl, footer);
      card.append(media, body);

      // 实况悬停 / 触摸预览
      if (isLiveItem(item)) {
        card.addEventListener('pointerenter', () => startCardLive(card, videoEl));
        card.addEventListener('pointerleave', () => stopCardLive(card, videoEl));
      }

      card.addEventListener('click', () => openLightbox(index));
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openLightbox(index);
        }
      });

      gridEl.appendChild(card);
    });
  }

  // 暗房灯箱逻辑
  const dialog = document.getElementById('lightbox-dialog');
  const closeBtn = document.getElementById('lightbox-close');
  const prevBtn = document.getElementById('lightbox-prev');
  const nextBtn = document.getElementById('lightbox-next');
  const mediaWrap = document.getElementById('lightbox-media-wrap');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxVideo = document.getElementById('lightbox-video');
  const lightboxLiveBtn = document.getElementById('lightbox-live-btn');
  const lightboxThumbs = document.getElementById('lightbox-thumbs');

  function setLightboxLivePlaying(playing) {
    if (!mediaWrap) return;
    mediaWrap.classList.toggle('is-live-playing', playing);
    lightboxLiveBtn?.classList.toggle('is-active', playing);
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
      lightboxImg.alt = item.title || '暗房大图';
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

    if (lightboxLiveBtn) {
      lightboxLiveBtn.hidden = !isLiveItem(item);
    }

    // 渲染多图缩略图切换器
    if (lightboxThumbs) {
      lightboxThumbs.textContent = '';
      if (imgs.length > 1) {
        lightboxThumbs.hidden = false;
        imgs.forEach((src, idx) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `thumb-btn${idx === activeSubImageIndex ? ' is-active' : ''}`;
          btn.setAttribute('aria-label', `第 ${idx + 1} 张照片`);
          const tImg = document.createElement('img');
          tImg.src = src;
          tImg.alt = '';
          btn.appendChild(tImg);
          btn.addEventListener('click', () => {
            activeSubImageIndex = idx;
            updateLightboxContent();
          });
          lightboxThumbs.appendChild(btn);
        });
      } else {
        lightboxThumbs.hidden = true;
      }
    }

    const pad = n => String(n).padStart(2, '0');
    setText('lightbox-index', `MOMENT · ${pad(activeLightboxIndex + 1)} / ${pad(filteredItems.length)}`);
    setText('lightbox-tag', item.tag || '记录');
    setText('lightbox-date', item.date || '');
    setText('lightbox-title', item.title || '');
    setText('lightbox-note', item.note || '');

    const locWrap = document.getElementById('lightbox-location-wrap');
    if (locWrap) {
      locWrap.hidden = !item.location;
      setText('lightbox-location', item.location || '');
    }

    const exifWrap = document.getElementById('lightbox-exif-wrap');
    if (exifWrap) {
      const metaText = item.meta || (isLiveItem(item) ? 'LIVE 实况记录' : '静态影像');
      setText('lightbox-exif', metaText);
    }
  }

  function openLightbox(index) {
    if (!dialog?.showModal || !filteredItems[index]) return;
    activeLightboxIndex = index;
    activeSubImageIndex = 0;
    updateLightboxContent();
    if (!dialog.open) dialog.showModal();
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

  lightboxLiveBtn?.addEventListener('pointerenter', () => setLightboxLivePlaying(true));
  lightboxLiveBtn?.addEventListener('pointerleave', () => setLightboxLivePlaying(false));
  lightboxLiveBtn?.addEventListener('click', () => {
    const active = mediaWrap?.classList.contains('is-live-playing');
    setLightboxLivePlaying(!active);
  });

  dialog?.addEventListener('close', () => setLightboxLivePlaying(false));
  dialog?.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)
    ) {
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
