(() => {
  'use strict';

  const siteConfig = window.SITE_CONFIG || {};
  const shelfConfig = window.SHELF_CONFIG || {};
  const categories = shelfConfig.categories || {};
  const categoryKeys = Object.keys(categories).filter(
    key => Array.isArray(categories[key]?.items) && categories[key].items.length > 0
  );

  const FORMAT_META = {
    cd: { label: 'CD', shortLabel: 'CD', className: 'fmt-cd' },
    'black-vinyl': { label: '黑胶', shortLabel: '黑胶', className: 'fmt-black-vinyl' },
    'white-vinyl': { label: '白胶', shortLabel: '白胶', className: 'fmt-white-vinyl' },
    'color-vinyl': { label: '彩胶', shortLabel: '彩胶', className: 'fmt-color-vinyl' },
    tape: { label: '磁带', shortLabel: '磁带', className: 'fmt-tape' },
  };
  const FORMAT_ORDER = ['cd', 'black-vinyl', 'white-vinyl', 'color-vinyl', 'tape'];

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) el.textContent = value;
  };

  const siteName = siteConfig.name || 'HULAB';
  const handle = shelfConfig.handle || '@X1a0hu';
  const shelfTitle = shelfConfig.title || '书影音';
  setText('shelf-title', shelfTitle);
  setText('shelf-handle', handle);
  setText('post-author', siteName);
  setText('post-avatar', siteName.slice(0, 1).toUpperCase());

  const totalCurated = categoryKeys.reduce(
    (sum, key) => sum + (Array.isArray(categories[key]?.items) ? categories[key].items.length : 0),
    0
  );
  setText('total-count', totalCurated.toLocaleString());

  function itemFormats(item) {
    return Array.isArray(item?.formats) ? item.formats.filter(Boolean) : [];
  }

  function itemHasFormat(item, fmt) {
    return itemFormats(item).includes(fmt);
  }

  function itemMatchesLook(item, look) {
    if (!look || !Array.isArray(look.requiresFormats) || look.requiresFormats.length === 0) {
      return true;
    }
    const fmts = itemFormats(item);
    return look.requiresFormats.some(req => fmts.includes(req));
  }

  function getLookDisplayLabel(look, items) {
    if (look?.id === 'vinyl' && Array.isArray(look.requiresFormats)) {
      const hasBlack = items.some(it => itemHasFormat(it, 'black-vinyl'));
      const hasWhite = items.some(it => itemHasFormat(it, 'white-vinyl'));
      if (hasBlack && hasWhite) return '黑胶 / 白胶';
      if (hasWhite) return '白胶';
      if (hasBlack) return '黑胶';
    }
    return look?.label || '';
  }

  function getAvailableLooks(catKey) {
    const cat = categories[catKey];
    const rawLooks = Array.isArray(cat?.looks) ? cat.looks : [];
    const items = Array.isArray(cat?.items) ? cat.items : [];
    const available = rawLooks.filter(look => {
      if (!Array.isArray(look.requiresFormats) || look.requiresFormats.length === 0) return true;
      return items.some(item => itemMatchesLook(item, look));
    });
    return available.length > 0 ? available : rawLooks;
  }

  function getVinylVariant(item) {
    const fmts = itemFormats(item);
    if (activeSubFilter === 'white-vinyl' && fmts.includes('white-vinyl')) return 'white';
    if (activeSubFilter === 'black-vinyl' && fmts.includes('black-vinyl')) return 'black';
    if (fmts.includes('white-vinyl') && !fmts.includes('black-vinyl')) return 'white';
    if (fmts.includes('white-vinyl')) return 'white';
    return 'black';
  }

  function createFormatBadge(fmt, compact = false) {
    const meta = FORMAT_META[fmt];
    if (!meta) return null;
    const span = document.createElement('span');
    span.className = `format-tag ${meta.className}${compact ? ' is-compact' : ''}`;
    span.textContent = compact ? meta.shortLabel : meta.label;
    return span;
  }

  function appendFormatBadges(container, formats, compact = false) {
    if (!container || !Array.isArray(formats) || formats.length === 0) return;
    formats.forEach(fmt => {
      const badge = createFormatBadge(fmt, compact);
      if (badge) container.appendChild(badge);
    });
  }

  // 状态管理
  const params = new URLSearchParams(location.search);
  const initialKind = params.get('kind');
  let activeCategory = categoryKeys.includes(initialKind)
    ? initialKind
    : (categoryKeys.includes(shelfConfig.defaultCategory) ? shelfConfig.defaultCategory : (categoryKeys[0] || 'albums'));
  let activeLook = '';
  let activeSubFilter = 'all';
  let searchQuery = '';
  let showJacket = false;
  let activeItemIndex = 0;
  let visibleItems = [];

  function resolveInitialLook(catKey) {
    const available = getAvailableLooks(catKey);
    const preferred = categories[catKey]?.defaultLook;
    if (available.some(l => l.id === preferred)) return preferred;
    return available[0]?.id || 'covers';
  }

  activeLook = resolveInitialLook(activeCategory);

  // 本地封面缓存（用于日后新增条目未手填 cover 时自动拉取官方封面）
  const COVER_CACHE_KEY = 'hulab_shelf_cover_cache_v1';
  let coverCache = {};
  try {
    coverCache = JSON.parse(localStorage.getItem(COVER_CACHE_KEY) || '{}');
  } catch {
    coverCache = {};
  }
  const pendingLookups = new Set();

  function saveCoverCache() {
    try {
      localStorage.setItem(COVER_CACHE_KEY, JSON.stringify(coverCache));
    } catch { /* ignore storage quota */ }
  }

  function getResolvedCover(item, catKey) {
    if (catKey === 'tickets') {
      return item?.cover || item?.photo || item?.ticketArt || '';
    }
    if (item?.cover) return item.cover;
    const cacheId = `${catKey}:${item?.title || ''}::${item?.creator || ''}`;
    return coverCache[cacheId] || '';
  }

  async function autoFetchCoverIfMissing(item, catKey, imgEl) {
    if (!item || item.cover || catKey === 'tickets') return;
    const cacheId = `${catKey}:${item.title || ''}::${item.creator || ''}`;
    if (coverCache[cacheId]) {
      imgEl.src = coverCache[cacheId];
      return;
    }
    if (pendingLookups.has(cacheId)) return;
    pendingLookups.add(cacheId);

    try {
      let found = '';
      const q = `${item.title || ''} ${item.creator || ''}`.trim();
      if (catKey === 'tv') {
        const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(item.title || q)}`);
        const arr = await res.json();
        const img = arr?.[0]?.show?.image;
        found = img?.original || img?.medium || '';
      } else {
        const entity = catKey === 'albums' ? 'album' : catKey === 'songs' ? 'song' : catKey === 'books' ? 'ebook' : 'movie';
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=${entity}&limit=3`);
        const data = await res.json();
        const art = data?.results?.[0]?.artworkUrl100;
        if (art) found = art.replace('100x100bb', '600x600bb');
      }
      if (found) {
        coverCache[cacheId] = found;
        saveCoverCache();
        imgEl.src = found;
      }
    } catch { /* fallback canvas handles missing cover */ }
  }

  // 主题管理
  const rootEl = document.documentElement;
  const themeBtn = document.getElementById('toggle-theme');
  const metaThemeColor = document.getElementById('meta-theme-color');

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    if (isDark) rootEl.setAttribute('data-theme', 'dark');
    else rootEl.removeAttribute('data-theme');
    themeBtn?.classList.toggle('is-on', isDark);
    themeBtn?.setAttribute('aria-pressed', String(isDark));
    if (metaThemeColor) metaThemeColor.content = isDark ? '#000000' : '#f3f2ed';
  }

  applyTheme(shelfConfig.defaultTheme === 'dark' ? 'dark' : 'light');

  themeBtn?.addEventListener('click', () => {
    const nextTheme = rootEl.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    if (document.startViewTransition) {
      document.startViewTransition(() => applyTheme(nextTheme));
    } else {
      applyTheme(nextTheme);
    }
  });

  // 顶部开关：封面展开（仅在侧脊模式显示）
  const mediaStage = document.getElementById('media-stage');
  const jacketBtn = document.getElementById('toggle-jacket');
  const SPINE_MAP = { cds: 'cd', tapes: 'tape', dvd: 'dvd', spines: 'book' };

  function syncJacketToggleVisibility() {
    if (!jacketBtn) return;
    jacketBtn.hidden = !SPINE_MAP[activeLook];
  }

  jacketBtn?.addEventListener('click', () => {
    showJacket = !showJacket;
    jacketBtn.classList.toggle('is-on', showJacket);
    jacketBtn.setAttribute('aria-pressed', String(showJacket));
    renderStage();
  });

  // 兜底 Canvas 封面生成器
  function hashStr(str) {
    let h = 2166136261;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function makeFallbackDataUrl(item) {
    const c = document.createElement('canvas');
    c.width = 180;
    c.height = 180;
    const ctx = c.getContext('2d');
    if (!ctx) return '';
    const grad = ctx.createLinearGradient(0, 0, 180, 180);
    grad.addColorStop(0, item.color || '#1f2937');
    grad.addColorStop(1, '#0d1017');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 180, 180);

    const seed = hashStr(`${item.title}-${item.creator}`);
    ctx.fillStyle = item.accent || '#ffd60a';
    ctx.globalAlpha = 0.78;
    ctx.beginPath();
    ctx.arc(90 + ((seed % 30) - 15), 76, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '700 16px "Space Grotesk", "Noto Sans SC", sans-serif';
    ctx.fillText(String(item.title || '').slice(0, 12), 14, 152);
    return c.toDataURL('image/png');
  }

  function createCoverImg(item, catKey, className = 'art-img', eager = false) {
    const img = document.createElement('img');
    img.className = className;
    img.alt = item.title || '封面';
    img.loading = eager ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';

    const url = getResolvedCover(item, catKey);
    if (url) {
      img.src = url;
    } else {
      img.src = makeFallbackDataUrl(item);
      autoFetchCoverIfMissing(item, catKey, img);
    }

    img.addEventListener('error', () => {
      if (!img.dataset.fallbackApplied) {
        img.dataset.fallbackApplied = '1';
        img.src = makeFallbackDataUrl(item);
      }
    });

    return img;
  }

  // 渲染分类导航 Tabs
  const tabsEl = document.getElementById('tabs');
  function renderTabs() {
    if (!tabsEl) return;
    tabsEl.textContent = '';

    categoryKeys.forEach(key => {
      const cat = categories[key];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `tab-btn${key === activeCategory ? ' is-active' : ''}`;
      btn.setAttribute('aria-pressed', String(key === activeCategory));

      const mini = document.createElement('span');
      mini.className = `mini mini-${key}`;
      mini.setAttribute('aria-hidden', 'true');
      const count = key === 'books' ? 6 : key === 'albums' ? 3 : key === 'tickets' ? 3 : 4;
      const items = Array.isArray(cat.items) ? cat.items : [];
      for (let i = 0; i < Math.min(count, Math.max(count, items.length)); i++) {
        const swatch = document.createElement('i');
        const sample = items[i] || {};
        swatch.style.background = sample.color || '#334155';
        if (key === 'tickets') {
          swatch.style.borderRight = `3px solid ${sample.accent || '#ffd60a'}`;
        } else {
          const thumbUrl = getResolvedCover(sample, key);
          if (thumbUrl) {
            const thumbImg = document.createElement('img');
            thumbImg.src = thumbUrl;
            thumbImg.alt = '';
            thumbImg.loading = 'lazy';
            thumbImg.referrerPolicy = 'no-referrer';
            swatch.appendChild(thumbImg);
          }
        }
        mini.appendChild(swatch);
      }

      const label = document.createElement('span');
      label.textContent = cat.label || key;

      btn.append(mini, label);
      btn.addEventListener('click', () => {
        if (activeCategory === key) return;
        activeCategory = key;
        activeSubFilter = 'all';
        activeLook = resolveInitialLook(key);
        activeItemIndex = 0;
        const url = new URL(location.href);
        url.searchParams.set('kind', key);
        history.replaceState(null, '', url);
        renderTabs();
        renderSubFilters();
        renderLooks();
        renderAll();
      });

      tabsEl.appendChild(btn);
    });
  }

  // 各拟物样式专属线性图标
  const LOOK_ICONS = {
    cds: '<rect x="3" y="4" width="4" height="16" rx="1"/><rect x="10" y="4" width="4" height="16" rx="1"/><rect x="17" y="4" width="4" height="16" rx="1"/>',
    tapes: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><path d="M9 14h6"/>',
    covers: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
    vinyl: '<rect x="3" y="5" width="12" height="14" rx="1.5"/><path d="M15 7a5 5 0 1 1 0 10"/>',
    spin: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v2"/>',
    player: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m10 9 5 3-5 3V9z"/>',
    vhs: '<rect x="2" y="6" width="20" height="12" rx="1.5"/><path d="M6 10h12M8 14h8"/>',
    dvd: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.2"/>',
    spines: '<rect x="3" y="4" width="4" height="16" rx=".8"/><rect x="9" y="3" width="5" height="17" rx=".8"/><rect x="16" y="5" width="5" height="15" rx=".8"/>',
    books: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    scenes: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 9h20M2 15h20"/>',
    stubs: '<path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7z"/><path d="M15 5v14" stroke-dasharray="2 2"/>',
    timeline: '<path d="M7 5v14"/><circle cx="7" cy="7" r="2"/><circle cx="7" cy="12" r="2"/><circle cx="7" cy="17" r="2"/><path d="M12 7h8M12 12h8M12 17h6"/>',
    wall: '<rect x="3" y="4" width="7" height="10" rx="1.5"/><rect x="14" y="4" width="7" height="6" rx="1.5"/><rect x="14" y="13" width="7" height="7" rx="1.5"/><rect x="3" y="17" width="7" height="3" rx="1"/>',
  };

  // 动态渲染顶部载体 / 年份 / 时间范围筛选条 (#era-picker)
  const subFilterEl = document.getElementById('era-picker');
  function renderSubFilters() {
    if (!subFilterEl) return;
    subFilterEl.textContent = '';

    const cat = categories[activeCategory];
    const items = Array.isArray(cat?.items) ? cat.items : [];
    let options = [];

    if (cat?.filterMode === 'format') {
      options.push({ id: 'all', label: '全部' });
      FORMAT_ORDER.forEach(fmt => {
        const cnt = items.filter(it => itemHasFormat(it, fmt)).length;
        if (cnt > 0) {
          options.push({ id: fmt, label: `${FORMAT_META[fmt].label} ${cnt}` });
        }
      });
    } else if (cat?.filterMode === 'year') {
      options.push({ id: 'all', label: '全部' });
      const years = [...new Set(items.map(it => String(it.year || '')).filter(Boolean))].sort((a, b) => b.localeCompare(a));
      years.forEach(y => options.push({ id: y, label: y }));
    } else {
      options = [
        { id: 'all', label: '全部' },
        { id: '2026', label: '2026' },
      ];
    }

    if (!options.some(o => o.id === activeSubFilter)) {
      activeSubFilter = 'all';
    }

    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `seg-btn${opt.id === activeSubFilter ? ' is-active' : ''}`;
      btn.dataset.filter = opt.id;
      btn.setAttribute('aria-pressed', String(opt.id === activeSubFilter));
      btn.textContent = opt.label;

      btn.addEventListener('click', () => {
        activeSubFilter = opt.id;
        activeItemIndex = 0;

        // 在实体唱片分类下，按载体筛选时自动匹配最合适的拟物视图
        if (cat?.filterMode === 'format' && opt.id !== 'all') {
          const looks = getAvailableLooks(activeCategory);
          const currentLookObj = looks.find(l => l.id === activeLook);
          const compatible = !currentLookObj?.requiresFormats || currentLookObj.requiresFormats.includes(opt.id);
          if (!compatible) {
            const preferred = looks.find(l => Array.isArray(l.requiresFormats) && l.requiresFormats.includes(opt.id));
            if (preferred) activeLook = preferred.id;
          }
        }

        renderSubFilters();
        renderLooks();
        renderAll();
      });

      subFilterEl.appendChild(btn);
    });
  }

  const lookBarEl = document.getElementById('look');
  function renderLooks() {
    if (!lookBarEl) return;
    lookBarEl.textContent = '';
    const cat = categories[activeCategory];
    const items = Array.isArray(cat?.items) ? cat.items : [];
    const looks = getAvailableLooks(activeCategory);

    if (!looks.some(l => l.id === activeLook) && looks[0]) {
      activeLook = looks[0].id;
    }

    looks.forEach(look => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `look-btn${look.id === activeLook ? ' is-active' : ''}`;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(look.id === activeLook));

      const swatch = document.createElement('span');
      swatch.className = 'look-swatch';
      swatch.setAttribute('aria-hidden', 'true');
      swatch.innerHTML = `<svg viewBox="0 0 24 24">${LOOK_ICONS[look.id] || LOOK_ICONS.covers}</svg>`;

      const txt = document.createElement('span');
      txt.textContent = getLookDisplayLabel(look, items);
      btn.append(swatch, txt);

      if (cat?.filterMode === 'format') {
        const matchCount = items.filter(it => itemMatchesLook(it, look)).length;
        const badge = document.createElement('span');
        badge.className = 'look-count';
        badge.textContent = String(matchCount);
        btn.appendChild(badge);
      }

      btn.addEventListener('click', () => {
        if (activeLook === look.id) return;
        activeLook = look.id;

        // 切换到不兼容当前单载体筛选的视图时自动切回「全部」，避免空架
        if (cat?.filterMode === 'format' && activeSubFilter !== 'all') {
          if (Array.isArray(look.requiresFormats) && !look.requiresFormats.includes(activeSubFilter)) {
            activeSubFilter = 'all';
            renderSubFilters();
          }
        }

        activeItemIndex = 0;
        renderLooks();
        renderAll();
      });

      lookBarEl.appendChild(btn);
    });

    syncJacketToggleVisibility();
  }

  // 搜索框
  const filterInput = document.getElementById('shelf-filter');
  filterInput?.addEventListener('input', () => {
    searchQuery = filterInput.value.trim().toLowerCase();
    activeItemIndex = 0;
    renderAll();
  });

  function computeVisibleItems() {
    const cat = categories[activeCategory];
    const looks = getAvailableLooks(activeCategory);
    const currentLookObj = looks.find(l => l.id === activeLook);
    let list = Array.isArray(cat?.items) ? [...cat.items] : [];

    // 1. 按载体 / 年份 / era 筛选
    if (cat?.filterMode === 'format') {
      if (activeSubFilter !== 'all') {
        list = list.filter(item => itemHasFormat(item, activeSubFilter));
      }
      // 严格按当前视图要求的实体载体过滤（没有的就不放）
      list = list.filter(item => itemMatchesLook(item, currentLookObj));
    } else if (cat?.filterMode === 'year') {
      if (activeSubFilter !== 'all') {
        list = list.filter(item => String(item.year || '') === activeSubFilter);
      }
    } else if (activeSubFilter === '2026') {
      list = list.filter(item => item.era === '2026');
    }

    // 2. 关键词检索
    if (searchQuery) {
      list = list.filter(item => {
        const fmtLabels = itemFormats(item).map(f => FORMAT_META[f]?.label || f);
        return [
          item.title,
          item.creator,
          item.year,
          item.date,
          item.edition,
          item.city,
          item.venue,
          item.seat,
          item.note,
          ...fmtLabels,
        ]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(searchQuery));
      });
    }

    visibleItems = list;
    if (activeItemIndex >= visibleItems.length) {
      activeItemIndex = Math.max(0, visibleItems.length - 1);
    }
  }

  function selectItem(index, rerenderSpineJacket = false) {
    if (index < 0 || index >= visibleItems.length) return;
    activeItemIndex = index;

    if (rerenderSpineJacket && SPINE_MAP[activeLook] && showJacket) {
      renderStage();
    } else {
      mediaStage?.querySelectorAll('[data-idx]').forEach(node => {
        node.classList.toggle('is-selected', Number(node.dataset.idx) === activeItemIndex);
      });
    }

    document.querySelectorAll('#titles .line').forEach(node => {
      node.classList.toggle('is-selected', Number(node.dataset.idx) === activeItemIndex);
    });

    // 若当前处于 Vinyl Spin 模式，同步更新唱机封套、唱片材质（黑胶/白胶）与中心贴纸
    const item = visibleItems[activeItemIndex];
    const spinSleeve = mediaStage?.querySelector('.spin-sleeve');
    const spinRecord = mediaStage?.querySelector('.spin-record');
    const spinLabel = mediaStage?.querySelector('.spin-label');
    const spinBadge = mediaStage?.querySelector('.spin-spec-badge');
    if (spinSleeve && item) {
      spinSleeve.textContent = '';
      spinSleeve.appendChild(createCoverImg(item, activeCategory, 'art-img', true));
    }
    if (spinRecord && item) {
      const isWhite = getVinylVariant(item) === 'white';
      spinRecord.classList.toggle('is-white-vinyl', isWhite);
      if (spinBadge) {
        spinBadge.className = `spin-spec-badge ${isWhite ? 'is-white' : 'is-black'}`;
        spinBadge.textContent = isWhite ? '白胶 · 33⅓ RPM' : '黑胶 · 33⅓ RPM';
      }
    }
    if (spinLabel && item) {
      spinLabel.style.background = item.accent || '#ffd60a';
      spinLabel.querySelector('img')?.remove();
      spinLabel.prepend(createCoverImg(item, activeCategory, '', true));
    }

    updateSpotlight(item, activeItemIndex);
  }

  function buildActiveJacket(item) {
    const isPoster = activeCategory === 'movies' || activeCategory === 'tv' || activeCategory === 'books';
    const wrap = document.createElement('div');
    wrap.className = `active-jacket${isPoster ? ' is-poster' : ''}`;

    const img = createCoverImg(item, activeCategory, 'art-img', true);

    const cap = document.createElement('div');
    cap.className = 'jacket-caption';
    const t = document.createElement('p');
    t.className = 'jacket-title';
    t.textContent = item.title || '';
    const c = document.createElement('p');
    c.className = 'jacket-creator';
    c.textContent = item.creator || '';
    cap.append(t, c);

    wrap.append(img, cap);
    return wrap;
  }

  function getSpineInk(hexColor) {
    const clean = String(hexColor || '#1f2937').replace('#', '');
    if (clean.length !== 6) return '#f6f5f0';
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    return luma > 148 ? '#191816' : '#f6f5f0';
  }

  function hasCJK(str) {
    return /[\u4e00-\u9fff]/.test(String(str || ''));
  }

  // ==========================================================================
  // 高清 Canvas 实体侧脊渲染引擎（参考 taylor.fyi/top/ 晶透 CD 盒 / 精装书脊 / DVD 工艺）
  // ==========================================================================
  const SPINE_H = 1024;
  const SPINE_ART_CACHE = new Map();
  let SPINE_GRAIN_TILE = null;

  function hexToRgbArr(hex) {
    const clean = String(hex || '#1f2937').replace('#', '');
    if (clean.length !== 6) return [31, 41, 55];
    return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
  }

  function rgbCss(c, alpha = 1) {
    const r = Math.max(0, Math.min(255, Math.round(c[0])));
    const g = Math.max(0, Math.min(255, Math.round(c[1])));
    const b = Math.max(0, Math.min(255, Math.round(c[2])));
    return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
  }

  function relLum(c) {
    const t = c.map(v => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2];
  }

  function contrastRatio(a, b) {
    const l1 = relLum(a);
    const l2 = relLum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  function getSpineGrain() {
    if (SPINE_GRAIN_TILE) return SPINE_GRAIN_TILE;
    const n = 192;
    const c = document.createElement('canvas');
    c.width = n;
    c.height = n;
    const ctx = c.getContext('2d');
    if (!ctx) return c;
    const d = ctx.createImageData(n, n);
    let s = 7;
    for (let i = 0; i < d.data.length; i += 4) {
      s = (Math.imul(s, 1103515245) + 12345) >>> 0;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = 94 + ((s >>> 16) % 68);
      d.data[i + 3] = 255;
    }
    ctx.putImageData(d, 0, 0);
    SPINE_GRAIN_TILE = c;
    return c;
  }

  function makeLinearBand(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([at, col]) => g.addColorStop(at, col));
    return g;
  }

  function traceRounded(ctx, x, y, w, h, r) {
    const rad = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, rad);
    } else {
      ctx.moveTo(x + rad, y);
      ctx.arcTo(x + w, y, x + w, y + h, rad);
      ctx.arcTo(x + w, y + h, x, y + h, rad);
      ctx.arcTo(x, y + h, x, y, rad);
      ctx.arcTo(x, y, x + w, y, rad);
      ctx.closePath();
    }
  }

  // 从真实封面像素采样主色、高对比字色、跳色及左缘平滑度（跨域不可读时平滑回退到配置配色）
  function extractSpinePalette(art, item) {
    const fallbackGround = hexToRgbArr(item.color || '#222428');
    const fallbackAccent = hexToRgbArr(item.accent || '#f3f2ed');
    const fallbackInk = contrastRatio(fallbackGround, [248, 246, 240]) >= contrastRatio(fallbackGround, [20, 19, 17])
      ? [246, 244, 238]
      : [20, 19, 17];
    const fallbackSecond = contrastRatio(fallbackAccent, fallbackGround) >= 3.2 ? fallbackAccent : fallbackInk;

    if (!art || !art.naturalWidth || !art.naturalHeight) {
      return { ground: fallbackGround, ink: fallbackInk, second: fallbackSecond, even: false };
    }

    try {
      const w = 24;
      const h = 36;
      const sc = document.createElement('canvas');
      sc.width = w;
      sc.height = h;
      const sx = sc.getContext('2d', { willReadFrequently: true });
      if (!sx) throw new Error('no ctx');
      sx.drawImage(art, 0, 0, w, h);
      const d = sx.getImageData(0, 0, w, h).data;

      const all = new Map();
      const edge = new Map();
      const rim = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4;
          const key = ((d[o] >> 5) << 6) | ((d[o + 1] >> 5) << 3) | (d[o + 2] >> 5);
          const targets = x < 4 ? [all, edge] : [all];
          for (const m of targets) {
            const g = m.get(key) || [0, 0, 0, 0];
            g[0] += d[o];
            g[1] += d[o + 1];
            g[2] += d[o + 2];
            g[3]++;
            m.set(key, g);
          }
          if (x < 2) rim.push(relLum([d[o], d[o + 1], d[o + 2]]));
        }
      }

      const avg = g => [g[0] / g[3], g[1] / g[3], g[2] / g[3]];
      const groups = [...all.values()].map(g => ({ c: avg(g), share: g[3] / (w * h) }));
      const edgeSorted = [...edge.values()].sort((a, b) => b[3] - a[3]);
      const ground = edgeSorted[0] ? avg(edgeSorted[0]) : fallbackGround;
      const sat = c => {
        const hi = Math.max(c[0], c[1], c[2]);
        const lo = Math.min(c[0], c[1], c[2]);
        return hi ? (hi - lo) / hi : 0;
      };

      const plain = contrastRatio(ground, [248, 246, 240]) >= contrastRatio(ground, [20, 19, 17])
        ? [248, 246, 240]
        : [20, 19, 17];
      const bestInk = groups
        .filter(g => g.share >= 0.02)
        .sort((a, b) => contrastRatio(b.c, ground) - contrastRatio(a.c, ground))[0];
      const ink = bestInk && contrastRatio(bestInk.c, ground) >= 4.6 ? bestInk.c : plain;

      const loud = groups
        .filter(g => g.share >= 0.014 && sat(g.c) > 0.36 && contrastRatio(g.c, ground) >= 4.2)
        .sort((a, b) => sat(b.c) - sat(a.c))[0];
      let second = loud ? loud.c : (contrastRatio(fallbackAccent, ground) >= 4.2 ? fallbackAccent : ink);
      if (contrastRatio(second, ground) < 4.0) second = ink;

      const meanRim = rim.reduce((a, b) => a + b, 0) / Math.max(1, rim.length);
      const spread = Math.sqrt(rim.reduce((a, b) => a + (b - meanRim) ** 2, 0) / Math.max(1, rim.length));
      const rimSpan = Math.max(...rim) - Math.min(...rim);
      return { ground, ink, second, even: spread < 0.025 && rimSpan < 0.08 && relLum(ground) > 0.04 };
    } catch {
      return { ground: fallbackGround, ink: fallbackInk, second: fallbackSecond, even: false };
    }
  }

  function loadSpineArt(url) {
    if (!url) return Promise.resolve(null);
    if (SPINE_ART_CACHE.has(url)) return SPINE_ART_CACHE.get(url);

    const isLocal = url.startsWith('./') || url.startsWith('/') || url.startsWith('data:');
    const loadOne = withCors => new Promise((resolve, reject) => {
      const img = new Image();
      if (withCors) img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
      img.onload = () => (img.naturalWidth > 0 ? resolve(img) : reject(new Error('empty')));
      img.onerror = () => reject(new Error('load err'));
      img.src = url;
    });

    const p = loadOne(true)
      .catch(() => (isLocal ? null : loadOne(false).catch(() => null)));
    SPINE_ART_CACHE.set(url, p);
    return p;
  }

  // 提炼真实唱片厂牌短标（显示在 CD 侧脊底部，呼应实盘厂牌印记）
  function extractImprint(item) {
    const ed = String(item.edition || '');
    if (/PANDA RECORD/i.test(ed)) return 'PANDA';
    if (/局部娱乐/.test(ed)) return '局部娱乐';
    if (/郊眠寺/.test(ed)) return '郊眠寺';
    if (/东方影音/.test(ed)) return '东方影音';
    if (/Pink Floyd/i.test(String(item.creator || ''))) return 'HARVEST';
    return item.year ? String(item.year) : 'CD';
  }

  // 竖排中文/中日混排引擎（中文直立、标点顺转、英文长词顺排、1-2位数字纵中横）
  const TATE_TURN = /[—–\-~～·•（）()【】「」『』《》〈〉：:；;\/]/u;
  const TATE_RAISE = /[、。，．]/u;

  function tateCells(str) {
    const out = [];
    const ch = [...String(str || '').trim()];
    for (let i = 0; i < ch.length; i++) {
      if (/[A-Za-z0-9]/.test(ch[i])) {
        let j = i + 1;
        while (
          j < ch.length &&
          (/[A-Za-z0-9.'’&~!?,-]/.test(ch[j]) || (ch[j] === ' ' && /[A-Za-z0-9]/.test(ch[j + 1] || '')))
        ) {
          j++;
        }
        const run = ch.slice(i, j).join('');
        out.push({ s: run, how: run.length <= 2 ? 'pair' : 'run' });
        i = j - 1;
      } else if (/\s/.test(ch[i])) {
        out.push({ s: ' ', how: 'gap' });
      } else {
        out.push({
          s: ch[i],
          how: TATE_RAISE.test(ch[i]) ? 'raise' : TATE_TURN.test(ch[i]) ? 'turn' : 'up',
        });
      }
    }
    return out;
  }

  const TATE_COMPACT = /[·•（）()]/u;

  function tateMeasure(ctx, cells, px, gap) {
    let n = 0;
    for (const c of cells) {
      if (c.how === 'gap') n += px * 0.38;
      else if (c.how === 'run') n += ctx.measureText(c.s).width + px * 0.16;
      else if (c.how === 'turn' && TATE_COMPACT.test(c.s)) n += px * (0.58 + gap * 0.5);
      else n += px * (1 + gap);
    }
    return Math.max(0, n - (cells.length ? px * gap : 0));
  }

  function tateDraw(ctx, cells, cx, y, px, gap) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const c of cells) {
      if (c.how === 'gap') {
        y += px * 0.38;
        continue;
      }
      if (c.how === 'run') {
        const w = ctx.measureText(c.s).width;
        ctx.save();
        ctx.translate(cx, y + px * 0.06 + w / 2);
        ctx.rotate(Math.PI / 2);
        ctx.fillText(c.s, 0, 0);
        ctx.restore();
        y += w + px * 0.16;
        continue;
      }
      const isCompact = c.how === 'turn' && TATE_COMPACT.test(c.s);
      const cellH = isCompact ? px * 0.58 : px;
      const mid = y + cellH / 2;
      if (c.how === 'turn') {
        ctx.save();
        ctx.translate(cx, mid);
        ctx.rotate(Math.PI / 2);
        ctx.fillText(c.s, 0, 0);
        ctx.restore();
      } else if (c.how === 'raise') {
        ctx.fillText(c.s, cx + px * 0.46, mid - px * 0.46);
      } else if (c.how === 'pair') {
        ctx.fillText(c.s, cx, mid, px * 0.92);
      } else {
        ctx.fillText(c.s, cx, mid);
      }
      y += cellH + px * (isCompact ? gap * 0.5 : gap);
    }
  }

  function tateSplit(cells) {
    const n = cells.length;
    let at = -1;
    for (let i = 1; i < n; i++) {
      const good = /[、。，·：！？ ]/.test(cells[i - 1].s) || /[「『（【《]/.test(cells[i].s);
      if (good && i >= n * 0.25 && i <= n * 0.75 && (at < 0 || Math.abs(i - n / 2) < Math.abs(at - n / 2))) {
        at = i;
      }
    }
    if (at < 0) at = Math.ceil(n / 2);
    const trim = arr => {
      while (arr.length && arr[0].how === 'gap') arr.shift();
      while (arr.length && arr[arr.length - 1].how === 'gap') arr.pop();
      return arr;
    };
    return [trim(cells.slice(0, at)), trim(cells.slice(at))];
  }

  // 多样化侧脊字体人格池（衬线 / 窄体黑 / 几何无衬线 / 斜体衬线）
  const SPINE_FACES = [
    { name: 'condensed', font: px => `700 ${px}px "Oswald", "Space Grotesk", "Noto Sans SC", sans-serif`, cjkFont: px => `700 ${px}px "Noto Sans SC", "Space Grotesk", sans-serif`, em: 0.76, caps: true, track: '0.03em', gap: 0.08 },
    { name: 'editorial', font: px => `700 ${px}px "Playfair Display", "Noto Serif SC", Georgia, serif`, cjkFont: px => `700 ${px}px "Noto Serif SC", Georgia, serif`, em: 0.68, caps: false, track: '0.05em', gap: 0.1 },
    { name: 'grotesk', font: px => `700 ${px}px "Space Grotesk", "Noto Sans SC", sans-serif`, cjkFont: px => `700 ${px}px "Noto Sans SC", sans-serif`, em: 0.68, caps: true, track: '0.06em', gap: 0.08 },
    { name: 'italic', font: px => `italic 700 ${px}px "Playfair Display", "Noto Serif SC", Georgia, serif`, cjkFont: px => `700 ${px}px "Noto Serif SC", Georgia, serif`, em: 0.66, caps: false, track: '0.04em', gap: 0.1 },
  ];

  // 绘制印刷纸卡内芯（CD 纸卡 / 书籍布面 / DVD 插页通用内核）
  function paintSpineInsert(art, item, W, H, spineType, index) {
    const seed = hashStr(`${item.title || ''}|${item.creator || ''}|${spineType}`);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d');
    if (!x) return c;

    const face = SPINE_FACES[(seed + index) % SPINE_FACES.length];
    const palette = extractSpinePalette(art, item);
    const { ground, ink, second, even } = palette;
    const isCJKTitle = hasCJK(item.title || '');
    const isBook = spineType === 'book';
    const isDvd = spineType === 'dvd';
    const isCd = spineType === 'cd';

    // 1. 底色或真实封面左缘延展包裹（wraparound）
    const wrap = isCd && art && even && ((seed >>> 6) % 3 !== 0);
    if (wrap) {
      x.imageSmoothingQuality = 'high';
      x.drawImage(art, 0, 0, Math.max(2, art.naturalWidth * 0.04), art.naturalHeight, 0, 0, W, H);
    } else {
      x.fillStyle = rgbCss(ground);
      x.fillRect(0, 0, W, H);
    }

    // 2. 顶部或底部截取一段真实封面画块（保持真实比例，绝不拉伸变形）
    const margin = Math.round(H * 0.036);
    const showPiece = Boolean(art) && !wrap && (
      isCd ? ((seed >>> 4) % 5 < 3) : isBook ? ((seed >>> 4) % 5 < 3) : ((seed >>> 4) % 2 === 0)
    );
    const piecePos = showPiece ? (((seed >>> 8) & 1) ? 'foot' : 'head') : null;
    let pieceH = 0;
    if (piecePos && art) {
      const ratio = art.naturalHeight / Math.max(1, art.naturalWidth);
      pieceH = Math.round(W * Math.min(isCd ? 1.15 : 1.18, ratio));
      const aw = art.naturalWidth;
      const ah = Math.min(art.naturalHeight, (aw * pieceH) / W);
      const ay = Math.max(0, Math.min(art.naturalHeight - ah, art.naturalHeight * 0.36 - ah / 2));
      x.imageSmoothingQuality = 'high';
      const py = piecePos === 'head' ? 0 : H - pieceH;
      x.drawImage(art, 0, ay, aw, ah, 0, py, W, pieceH);

      // 柔和过渡边线，让封面画块自然融入纸卡
      const fadeH = Math.round(pieceH * 0.16);
      const fy0 = piecePos === 'head' ? pieceH - fadeH : py;
      const fy1 = piecePos === 'head' ? pieceH : py + fadeH;
      const fg = x.createLinearGradient(0, fy0, 0, fy1);
      fg.addColorStop(0, piecePos === 'head' ? rgbCss(ground, 0) : rgbCss(ground, 1));
      fg.addColorStop(1, piecePos === 'head' ? rgbCss(ground, 1) : rgbCss(ground, 0));
      x.fillStyle = fg;
      x.fillRect(0, fy0, W, fadeH);
    }

    let top = (piecePos === 'head' ? pieceH : 0) + margin;
    let bottom = H - (piecePos === 'foot' ? pieceH : 0) - margin;

    // 3. 底部厂牌 / DVD 标 / 年份印记
    if (isDvd) {
      const px = Math.round(W * 0.21);
      x.font = `800 ${px}px "Space Grotesk", "Noto Sans SC", sans-serif`;
      const pad = Math.round(px * 0.32);
      const bw = Math.ceil(x.measureText('DVD').width) + pad * 2;
      const bh = Math.round(px * 1.32);
      const bx = Math.round((W - bw) / 2);
      const vy = Math.round(bottom - bh);
      x.strokeStyle = x.fillStyle = rgbCss(ink, 0.9);
      x.lineWidth = Math.max(2, Math.round(px * 0.1));
      x.strokeRect(bx, vy, bw, bh);
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('DVD', W / 2, vy + bh / 2 + px * 0.04);
      bottom -= bh + Math.round(margin * 0.75);
    } else if (isCd) {
      const imprint = extractImprint(item);
      let px = Math.round(W * (hasCJK(imprint) ? 0.22 : 0.2));
      x.font = `700 ${px}px "Space Grotesk", "Noto Sans SC", sans-serif`;
      const tw = x.measureText(imprint).width;
      if (tw > W * 0.84) {
        px = Math.max(10, Math.floor((px * W * 0.84) / tw));
        x.font = `700 ${px}px "Space Grotesk", "Noto Sans SC", sans-serif`;
      }
      x.textAlign = 'center';
      x.textBaseline = 'alphabetic';
      x.fillStyle = rgbCss(second, 0.9);
      x.fillText(imprint, W / 2, bottom);
      bottom -= px + Math.round(margin * 0.72);
    } else if (isBook && item.year) {
      // 精装书脊底部细装饰线 + 年份
      const ruleW = Math.round(W * 0.46);
      x.fillStyle = rgbCss(second, 0.52);
      x.fillRect(Math.round((W - ruleW) / 2), bottom - Math.round(W * 0.32), ruleW, 2);
      const px = Math.round(W * 0.2);
      x.font = `600 ${px}px "JetBrains Mono", monospace`;
      x.textAlign = 'center';
      x.textBaseline = 'alphabetic';
      x.fillStyle = rgbCss(ink, 0.78);
      x.fillText(String(item.year), W / 2, bottom);
      bottom -= Math.round(W * 0.44) + Math.round(margin * 0.45);
    }

    // 4. 主标题与作者/乐队排版（微透明油墨，随后覆盖纸张颗粒让文字“印进纸里”）
    x.globalAlpha = 0.93;
    const titleStr = String(item.title || '');
    const creatorStr = String(item.creator || '');

    if (isCJKTitle && (isBook || isCd)) {
      // 中文直排工艺（日版 CD 侧标 & 中文精装书脊风格）
      const gap = isBook ? face.gap : 0.06;
      const byCells = creatorStr ? tateCells(creatorStr) : [];
      const setCjk = (px, isBy = false) => {
        x.font = isBy
          ? `600 ${Math.max(10, Math.round(px))}px "Noto Sans SC", "Space Grotesk", sans-serif`
          : face.cjkFont(Math.max(12, Math.round(px)));
      };

      const unitLen = (cells, g, isBy = false) => {
        setCjk(100, isBy);
        return tateMeasure(x, cells, 100, g) / 100;
      };

      let byPx = 0;
      let byLen = 0;
      if (byCells.length > 0) {
        const uBy = unitLen(byCells, 0.08, true);
        byPx = Math.min(W * (isBook ? 0.24 : 0.38), ((bottom - top) * 0.28) / Math.max(0.1, uBy));
        byLen = uBy * byPx;
      }

      const byAtHead = isCd; // CD 习惯乐队在上、专辑名在下；书脊习惯书名在上、作者在下
      const availRoom = bottom - top - (byLen ? byLen + Math.round(margin * 1.15) : 0);
      const titleTop = byAtHead && byLen ? top + byLen + Math.round(margin * 1.15) : top;

      const tCells = tateCells(titleStr);
      const uTitle = unitLen(tCells, gap, false);
      const maxTitlePx = W * (isBook ? 0.58 : 0.64);
      let px = Math.min(maxTitlePx, availRoom / Math.max(0.1, uTitle));
      let cols = [tCells];

      // 书籍超长中文名自动双栏直排（右起第一栏）
      if (isBook && px < W * 0.3 && tCells.length >= 8) {
        const [colA, colB] = tateSplit(tCells);
        const maxU = Math.max(unitLen(colA, gap, false), unitLen(colB, gap, false));
        const twoPx = Math.min(W * 0.36, availRoom / Math.max(0.1, maxU));
        if (twoPx > px * 1.16) {
          cols = [colA, colB];
          px = twoPx;
        }
      }

      if (byLen) {
        setCjk(byPx, true);
        x.fillStyle = rgbCss(second);
        const byY = byAtHead ? top : bottom - byLen;
        tateDraw(x, byCells, W / 2, byY, byPx, 0.08);
      }

      const colH = cols.length === 1
        ? unitLen(cols[0], gap, false) * px
        : Math.max(unitLen(cols[0], gap, false), unitLen(cols[1], gap, false)) * px;
      const startY = isCd
        ? titleTop + Math.max(0, (availRoom - colH) * 0.42)
        : titleTop + Math.max(0, (availRoom - colH) * 0.14);

      x.fillStyle = rgbCss(ink);
      setCjk(px, false);
      if (cols.length === 1) {
        tateDraw(x, cols[0], W / 2, startY, px, gap);
      } else {
        const stepX = px * 1.16;
        tateDraw(x, cols[0], W / 2 + stepX / 2, startY, px, gap);
        tateDraw(x, cols[1], W / 2 - stepX / 2, startY, px, gap);
      }
    } else {
      // 西文 / DVD 经典 90° 顺时针侧脊排版
      x.save();
      x.translate(W / 2, 0);
      x.rotate(Math.PI / 2);
      x.textBaseline = 'middle';

      const setFont = (fontStr, track = '0em') => {
        x.font = fontStr;
        try { x.letterSpacing = track; } catch { /* ignore */ }
      };

      const byText = creatorStr ? creatorStr.toUpperCase() : '';
      const byPx = Math.round(W * (isBook ? 0.24 : 0.34));
      let byLen = 0;
      if (byText) {
        setFont(`600 ${byPx}px "Space Grotesk", "Noto Sans SC", sans-serif`, '0.1em');
        byLen = x.measureText(byText).width;
        const capLen = Math.min(byLen, (bottom - top) * 0.34);
        const headFirst = isCd ? true : ((seed >>> 10) & 1) === 0;
        x.fillStyle = rgbCss(second);
        if (headFirst) {
          x.textAlign = 'left';
          x.fillText(byText, top, 0, capLen);
          top += capLen + Math.round(margin * 1.1);
        } else {
          x.textAlign = 'right';
          x.fillText(byText, bottom, 0, capLen);
          bottom -= capLen + Math.round(margin * 1.1);
        }
      }

      const displayTitle = face.caps && !isCJKTitle ? titleStr.toUpperCase() : titleStr;
      const room = Math.max(40, bottom - top);
      let px = Math.round(W * face.em);
      setFont(face.font(px), face.track);
      let lines = [displayTitle];
      let wide = x.measureText(displayTitle).width;

      if (wide > room && wide * 0.6 > room && displayTitle.includes(' ')) {
        const spaces = [...displayTitle].map((ch, idx) => (ch === ' ' ? idx : -1)).filter(idx => idx > 0);
        const mid = spaces.sort((a, b) => Math.abs(a - displayTitle.length / 2) - Math.abs(b - displayTitle.length / 2))[0];
        lines = [displayTitle.slice(0, mid), displayTitle.slice(mid + 1)];
        px = Math.round(W * Math.min(face.em * 0.58, 0.42));
        setFont(face.font(px), face.track);
        wide = Math.max(...lines.map(l => x.measureText(l).width));
      }
      if (wide > room) {
        px = Math.max(12, Math.floor((px * room) / wide));
        setFont(face.font(px), face.track);
        wide = Math.min(room, x.measureText(lines[0]).width);
      }

      const at = lines.length === 1 && ((seed >>> 12) % 3 === 0)
        ? top + Math.max(0, (room - wide) / 2)
        : top;
      x.textAlign = 'left';
      x.fillStyle = rgbCss(ink);
      if (lines.length === 1) {
        x.fillText(lines[0], at, 0, room);
      } else {
        const lh = px * 1.06;
        x.fillText(lines[0], at, -lh / 2, room);
        x.fillText(lines[1], at, lh / 2, room);
      }
      x.restore();
      try { x.letterSpacing = '0em'; } catch { /* ignore */ }
    }

    // 5. 纸张细微颗粒叠加（让油墨真正融进印刷纸面）
    x.globalAlpha = isBook ? 0.09 : 0.075;
    x.globalCompositeOperation = 'overlay';
    x.fillStyle = x.createPattern(getSpineGrain(), 'repeat');
    x.fillRect(0, 0, W, H);
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';

    return c;
  }

  // 纸卡在晶透塑料盒内四缘的内凹投影（创造真实盒内纵深）
  function shadeInsetCard(ctx, X, Y, w, h, s) {
    ctx.fillStyle = makeLinearBand(ctx, X, 0, X + s, 0, [[0, 'rgba(0,0,0,.32)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(X, Y, s, h);
    ctx.fillStyle = makeLinearBand(ctx, X + w, 0, X + w - s, 0, [[0, 'rgba(0,0,0,.24)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(X + w - s, Y, s, h);
    ctx.fillStyle = makeLinearBand(ctx, 0, Y, 0, Y + s, [[0, 'rgba(0,0,0,.34)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(X, Y, w, s);
    ctx.fillStyle = makeLinearBand(ctx, 0, Y + h, 0, Y + h - s, [[0, 'rgba(0,0,0,.24)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(X, Y + h - s, w, s);
  }

  // 精致矢量唱片厂牌徽标（呼应 taylor.fyi/top/ 实盘底标质感）
  function drawLabelBadge(x, kind, cx, bottomY, W, colorStr) {
    x.save();
    x.fillStyle = colorStr;
    x.strokeStyle = colorStr;
    if (kind === 'panda') {
      const r = W * 0.21;
      const cy = bottomY - r - 4;
      x.lineWidth = Math.max(1.5, W * 0.032);
      x.beginPath();
      x.arc(cx, cy, r, 0, Math.PI * 2);
      x.stroke();
      // 极简双耳与双目点
      x.beginPath();
      x.arc(cx - r * 0.68, cy - r * 0.68, r * 0.32, 0, Math.PI * 2);
      x.arc(cx + r * 0.68, cy - r * 0.68, r * 0.32, 0, Math.PI * 2);
      x.fill();
      x.beginPath();
      x.arc(cx - r * 0.3, cy - r * 0.06, r * 0.16, 0, Math.PI * 2);
      x.arc(cx + r * 0.3, cy - r * 0.06, r * 0.16, 0, Math.PI * 2);
      x.fill();
      x.restore();
      return r * 2 + 10;
    }
    if (kind === 'harvest') {
      const bw = W * 0.62;
      const bh = W * 0.34;
      const y = bottomY - bh;
      x.lineWidth = Math.max(1.4, W * 0.028);
      x.strokeRect(cx - bw / 2, y, bw, bh);
      x.font = `700 ${Math.round(W * 0.15)}px "Space Grotesk", sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('HARVEST', cx, y + bh / 2 + 1, bw - 4);
      x.restore();
      return bh + 8;
    }
    if (kind === 'seal') {
      const sz = W * 0.56;
      const y = bottomY - sz;
      x.lineWidth = Math.max(1.6, W * 0.03);
      x.strokeRect(cx - sz / 2, y, sz, sz);
      x.font = `700 ${Math.round(sz * 0.34)}px "Noto Serif SC", serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('郊眠', cx, y + sz * 0.32);
      x.fillText('寺印', cx, y + sz * 0.69);
      x.restore();
      return sz + 8;
    }
    if (kind === 'jubu') {
      const bw = W * 0.72;
      const bh = W * 0.36;
      const y = bottomY - bh;
      x.fillRect(cx - bw / 2, y, bw, bh);
      x.fillStyle = '#d8d7d2';
      x.font = `700 ${Math.round(W * 0.18)}px "Space Grotesk", sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('3CD', cx, y + bh / 2 + 1);
      x.restore();
      return bh + 8;
    }
    x.restore();
    return 0;
  }

  // 一专一版 · 真实封面元素融合的定制 CD 内芯渲染器（11 张实盘各有独立视觉语言）
  function paintBespokeCdInsert(art, item, W, H) {
    const id = item.spineId;
    if (!id) return null;

    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d');
    if (!x) return null;
    x.imageSmoothingQuality = 'high';

    const drawRot = (text, yCenter, font, color, maxLen, track = '0.04em', align = 'center') => {
      x.save();
      x.translate(W / 2, yCenter);
      x.rotate(Math.PI / 2);
      x.font = font;
      try { x.letterSpacing = track; } catch { /* ignore */ }
      x.fillStyle = color;
      x.textAlign = align;
      x.textBaseline = 'middle';
      x.fillText(text, 0, 0, maxLen);
      x.restore();
      try { x.letterSpacing = '0em'; } catch { /* ignore */ }
    };

    const drawGrain = (alpha = 0.085) => {
      x.save();
      x.globalAlpha = alpha;
      x.globalCompositeOperation = 'overlay';
      x.fillStyle = x.createPattern(getSpineGrain(), 'repeat');
      x.fillRect(0, 0, W, H);
      x.restore();
    };

    const margin = Math.round(H * 0.028);

    // 1. 万能青年旅店 — 原版芥末黄纸 + 真实跳水者剪影 + 无缝融入原版手书书法「万能青年旅店」
    if (id === 'oys-self') {
      const baseHex = '#a69c4f';
      x.fillStyle = baseHex;
      x.fillRect(0, 0, W, H);
      if (art) {
        // 顶部截取真实封面跳水者油墨画块并柔和融入芥末黄
        const divH = Math.round(W * 1.9);
        x.drawImage(art, art.naturalWidth * 0.14, art.naturalHeight * 0.05, art.naturalWidth * 0.66, art.naturalHeight * 0.72, 0, 0, W, divH);
        const fg = makeLinearBand(x, 0, divH * 0.58, 0, divH, [[0, 'rgba(166,156,79,0)'], [1, 'rgba(166,156,79,1)']]);
        x.fillStyle = fg;
        x.fillRect(0, Math.round(divH * 0.58), W, Math.ceil(divH * 0.44));

        // 中部无缝贴入封面右侧原版手写毛笔字「万能青年旅店」（同底色直出+柔边，无灰框）
        const calliY = Math.round(H * 0.22);
        const calliH = Math.round(H * 0.5);
        x.drawImage(
          art,
          art.naturalWidth * 0.825,
          art.naturalHeight * 0.01,
          art.naturalWidth * 0.175,
          art.naturalHeight * 0.98,
          0,
          calliY,
          W,
          calliH
        );
        const topFade = makeLinearBand(x, 0, calliY, 0, calliY + 18, [[0, 'rgba(166,156,79,1)'], [1, 'rgba(166,156,79,0)']]);
        x.fillStyle = topFade;
        x.fillRect(0, calliY, W, 18);
        const botFade = makeLinearBand(x, 0, calliY + calliH - 18, 0, calliY + calliH, [[0, 'rgba(166,156,79,0)'], [1, 'rgba(166,156,79,1)']]);
        x.fillStyle = botFade;
        x.fillRect(0, calliY + calliH - 18, W, 18);
      } else {
        x.fillStyle = '#181712';
        x.font = `700 ${Math.round(W * 0.62)}px "Noto Serif SC", serif`;
        tateDraw(x, tateCells('万能青年旅店'), W / 2, H * 0.24, W * 0.62, 0.12);
      }
      drawRot('OMNIPOTENT YOUTH SOCIETY', H * 0.84, `700 ${Math.round(W * 0.2)}px "Space Grotesk", sans-serif`, 'rgba(24,23,18,.84)', H * 0.2, '0.1em');
      x.fillStyle = 'rgba(24,23,18,.8)';
      x.font = `700 ${Math.round(W * 0.22)}px "JetBrains Mono", monospace`;
      x.textAlign = 'center';
      x.textBaseline = 'alphabetic';
      x.fillText('2010', W / 2, H - margin);
      drawGrain(0.1);
      return c;
    }

    // 2. 冀西南林路行 — 石拓深褐纸 + 麒麟石刻画框 + 宋体直排 + 郊眠寺方印
    if (id === 'oys-cable') {
      x.fillStyle = '#5f574d';
      x.fillRect(0, 0, W, H);
      if (art) {
        const artH = Math.round(W * 1.72);
        x.drawImage(art, art.naturalWidth * 0.08, art.naturalHeight * 0.28, art.naturalWidth * 0.84, art.naturalHeight * 0.46, 0, 0, W, artH);
        const fg = makeLinearBand(x, 0, artH * 0.72, 0, artH, [[0, 'rgba(95,87,77,0)'], [1, 'rgba(95,87,77,1)']]);
        x.fillStyle = fg;
        x.fillRect(0, Math.round(artH * 0.72), W, Math.ceil(artH * 0.3));
      }
      // 细黑框饰线
      x.fillStyle = 'rgba(20,18,16,.55)';
      x.fillRect(Math.round(W * 0.18), Math.round(H * 0.16), Math.round(W * 0.64), 2);

      x.fillStyle = 'rgba(244,239,228,.92)';
      const px = Math.round(W * 0.56);
      x.font = `700 ${px}px "Noto Serif SC", Georgia, serif`;
      tateDraw(x, tateCells('冀西南林路行'), W / 2, Math.round(H * 0.21), px, 0.18);

      drawRot('INSIDE THE CABLE TEMPLE', H * 0.73, `600 ${Math.round(W * 0.18)}px "Space Grotesk", sans-serif`, 'rgba(232,224,208,.76)', H * 0.26, '0.12em');
      drawLabelBadge(x, 'seal', W / 2, H - margin, W, 'rgba(232,224,208,.82)');
      drawGrain(0.11);
      return c;
    }

    // 3. 李志 Best Selection Vol.1 — 日版 PANDA RECORD 拼贴彩条 + 纯白 OBI 侧标
    if (id === 'lizhi-v1') {
      x.fillStyle = '#f6f4ee';
      x.fillRect(0, 0, W, H);
      if (art) {
        const stripH = Math.round(W * 1.45);
        x.drawImage(art, 0, 0, art.naturalWidth, art.naturalHeight * 0.38, 0, 0, W, stripH);
        x.drawImage(art, 0, art.naturalHeight * 0.62, art.naturalWidth, art.naturalHeight * 0.38, 0, H - stripH, W, stripH);
        // 细红分隔线（日版侧标特征）
        x.fillStyle = '#b91c1c';
        x.fillRect(0, stripH, W, 4);
        x.fillRect(0, H - stripH - 4, W, 4);
      }
      // 红字「李志」+ 黑字横排副标 + 紧凑旋转英文标题
      const lzPx = Math.round(W * 0.54);
      x.fillStyle = '#b91c1c';
      x.font = `700 ${lzPx}px "Noto Serif SC", serif`;
      tateDraw(x, tateCells('李志'), W / 2, Math.round(H * 0.145), lzPx, 0.08);

      drawRot('BEST SELECTION 2004~2018', H * 0.5, `700 ${Math.round(W * 0.34)}px "Oswald", "Space Grotesk", sans-serif`, 'rgba(20,19,17,.94)', H * 0.44, '0.04em');

      // 红色 VOL.1 小标签块
      const pillY = Math.round(H * 0.745);
      x.fillStyle = '#b91c1c';
      traceRounded(x, Math.round(W * 0.12), pillY, Math.round(W * 0.76), Math.round(W * 0.42), 4);
      x.fill();
      x.fillStyle = '#faf8f3';
      x.font = `700 ${Math.round(W * 0.2)}px "Space Grotesk", sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('VOL.1', W / 2, pillY + Math.round(W * 0.21));

      drawLabelBadge(x, 'panda', W / 2, Math.round(H * 0.875), W, 'rgba(20,19,17,.82)');
      drawGrain(0.07);
      return c;
    }

    // 4. 李志 叙事歌 Vol.2 — 全幅复古暖黄胶片天空草场实景延伸（taylor.fyi 实景侧脊风）
    if (id === 'lizhi-v2') {
      if (art) {
        // 全幅取用真实复古胶片封面做纵向视觉延伸
        x.drawImage(art, art.naturalWidth * 0.22, 0, art.naturalWidth * 0.56, art.naturalHeight, 0, 0, W, H);
        // 柔和压暗文字区确保极高可读性，同时保留天空颗粒与底部草场人物暖光
        const scrim = makeLinearBand(x, 0, 0, 0, H, [
          [0, 'rgba(34,42,46,.32)'],
          [0.2, 'rgba(38,44,44,.48)'],
          [0.64, 'rgba(46,38,28,.54)'],
          [0.84, 'rgba(32,24,18,.26)'],
          [1, 'rgba(22,16,12,.58)'],
        ]);
        x.fillStyle = scrim;
        x.fillRect(0, 0, W, H);
      } else {
        x.fillStyle = '#7e715b';
        x.fillRect(0, 0, W, H);
      }
      const lzPx = Math.round(W * 0.48);
      x.fillStyle = 'rgba(252,247,236,.96)';
      x.font = `700 ${lzPx}px "Noto Serif SC", serif`;
      tateDraw(x, tateCells('李志'), W / 2, Math.round(H * 0.055), lzPx, 0.08);

      // 细金短横线
      x.fillStyle = 'rgba(245,220,175,.72)';
      x.fillRect(Math.round(W * 0.26), Math.round(H * 0.195), Math.round(W * 0.48), 2);

      const tPx = Math.round(W * 0.56);
      x.fillStyle = 'rgba(255,250,240,.96)';
      x.font = `700 ${tPx}px "Noto Serif SC", serif`;
      tateDraw(x, tateCells('叙事歌'), W / 2, Math.round(H * 0.24), tPx, 0.14);

      drawRot('“BALLADS” · VOL.2', H * 0.64, `italic 700 ${Math.round(W * 0.26)}px "Playfair Display", Georgia, serif`, 'rgba(248,229,188,.94)', H * 0.28, '0.06em');
      drawLabelBadge(x, 'panda', W / 2, H - margin, W, 'rgba(252,245,232,.86)');
      drawGrain(0.09);
      return c;
    }

    // 5. 李志 倒影 Vol.3 — 日版米白宣纸 + 朱红圆形首版贴标 + 无缝原版墨迹书法「倒影」
    if (id === 'lizhi-v3') {
      x.fillStyle = '#dddad2';
      x.fillRect(0, 0, W, H);

      // 顶部经典日版圆形朱红贴纸徽记
      const dotR = W * 0.25;
      const dotY = Math.round(H * 0.068);
      x.fillStyle = '#b91c1c';
      x.beginPath();
      x.arc(W / 2, dotY, dotR, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = '#faf7f0';
      x.font = `700 ${Math.round(dotR * 0.85)}px "Noto Serif SC", serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('叁', W / 2, dotY + 1);

      const lzPx = Math.round(W * 0.48);
      x.fillStyle = '#b91c1c';
      x.font = `700 ${lzPx}px "Noto Serif SC", serif`;
      tateDraw(x, tateCells('李志'), W / 2, Math.round(H * 0.135), lzPx, 0.08);

      if (art) {
        // 无缝贴入封面原版宣纸水墨「倒影」狂草（同宣纸色+上下羽化，零矩形色差）
        const cy = Math.round(H * 0.27);
        const ch = Math.round(H * 0.31);
        x.drawImage(
          art,
          art.naturalWidth * 0.35,
          art.naturalHeight * 0.17,
          art.naturalWidth * 0.33,
          art.naturalHeight * 0.68,
          0,
          cy,
          W,
          ch
        );
        const tf = makeLinearBand(x, 0, cy, 0, cy + 20, [[0, 'rgba(221,218,210,1)'], [1, 'rgba(221,218,210,0)']]);
        x.fillStyle = tf;
        x.fillRect(0, cy, W, 20);
        const bf = makeLinearBand(x, 0, cy + ch - 20, 0, cy + ch, [[0, 'rgba(221,218,210,0)'], [1, 'rgba(221,218,210,1)']]);
        x.fillStyle = bf;
        x.fillRect(0, cy + ch - 20, W, 20);
      } else {
        x.fillStyle = '#181816';
        x.font = `700 ${Math.round(W * 0.6)}px "Noto Serif SC", serif`;
        tateDraw(x, tateCells('倒影'), W / 2, Math.round(H * 0.32), W * 0.6, 0.14);
      }

      drawRot('REFLECTION · VOL.3', H * 0.72, `600 ${Math.round(W * 0.22)}px "Space Grotesk", sans-serif`, 'rgba(32,30,26,.82)', H * 0.26, '0.09em');
      drawLabelBadge(x, 'panda', W / 2, H - margin, W, '#b91c1c');
      drawGrain(0.08);
      return c;
    }

    // 6. 李志 叁缺壹·东京演唱会 2024 — 高反差黑白银盐舞台侧影 + 极简日版黑脊
    if (id === 'lizhi-tokyo') {
      x.fillStyle = '#09090b';
      x.fillRect(0, 0, W, H);
      if (art) {
        // 顶部全幅融入高反差黑白舞台肖像（呼应 taylor.fyi Ariana 黑白实景侧脊）
        const ph = Math.round(H * 0.26);
        x.drawImage(art, art.naturalWidth * 0.32, art.naturalHeight * 0.04, art.naturalWidth * 0.44, art.naturalHeight * 0.62, 0, 0, W, ph);
        const fg = makeLinearBand(x, 0, ph * 0.56, 0, ph, [[0, 'rgba(9,9,11,0)'], [1, 'rgba(9,9,11,1)']]);
        x.fillStyle = fg;
        x.fillRect(0, Math.round(ph * 0.56), W, Math.ceil(ph * 0.46));
      }
      const lzPx = Math.round(W * 0.48);
      x.fillStyle = 'rgba(246,246,248,.96)';
      x.font = `700 ${lzPx}px "Noto Serif SC", serif`;
      tateDraw(x, tateCells('李志'), W / 2, Math.round(H * 0.28), lzPx, 0.08);

      const tPx = Math.round(W * 0.46);
      x.fillStyle = 'rgba(230,232,238,.92)';
      x.font = `700 ${tPx}px "Noto Serif SC", serif`;
      tateDraw(x, tateCells('叁缺壹·东京演唱会'), W / 2, Math.round(H * 0.42), tPx, 0.05);

      drawRot('TOKYO 2024', H * 0.84, `italic 700 ${Math.round(W * 0.22)}px "Playfair Display", Georgia, serif`, 'rgba(200,204,212,.78)', H * 0.16, '0.1em');
      drawLabelBadge(x, 'panda', W / 2, H - margin, W, 'rgba(240,242,246,.82)');
      drawGrain(0.08);
      return c;
    }

    // 7. 李志 叁缺壹·吉隆坡现场 2025 — 满版赤红舞台逆光渐变 + 实盘白色 LIVE ALBUM 胶囊标
    if (id === 'lizhi-kl') {
      if (art) {
        x.drawImage(art, art.naturalWidth * 0.35, 0, art.naturalWidth * 0.58, art.naturalHeight, 0, 0, W, H);
        const scrim = makeLinearBand(x, 0, 0, 0, H, [
          [0, 'rgba(58,6,10,.62)'],
          [0.42, 'rgba(105,12,18,.44)'],
          [0.7, 'rgba(130,18,22,.28)'],
          [1, 'rgba(42,6,10,.72)'],
        ]);
        x.fillStyle = scrim;
        x.fillRect(0, 0, W, H);
      } else {
        x.fillStyle = '#6b0f14';
        x.fillRect(0, 0, W, H);
      }
      const lzPx = Math.round(W * 0.5);
      x.fillStyle = '#fff5f5';
      x.font = `700 ${lzPx}px "Noto Serif SC", serif`;
      tateDraw(x, tateCells('李志'), W / 2, Math.round(H * 0.055), lzPx, 0.08);

      const tPx = Math.round(W * 0.48);
      x.fillStyle = '#ffffff';
      x.font = `700 ${tPx}px "Noto Serif SC", serif`;
      tateDraw(x, tateCells('叁缺壹·吉隆坡现场'), W / 2, Math.round(H * 0.22), tPx, 0.06);

      drawRot('2025.11.11-13', H * 0.72, `600 ${Math.round(W * 0.2)}px "JetBrains Mono", monospace`, 'rgba(255,222,224,.88)', H * 0.2, '0.06em');

      // 呼应封面左侧官方白色「LIVE ALBUM」竖胶囊
      const boxY = Math.round(H * 0.82);
      const boxH = Math.round(H * 0.13);
      x.fillStyle = 'rgba(255,255,255,.9)';
      traceRounded(x, Math.round(W * 0.2), boxY, Math.round(W * 0.6), boxH, 4);
      x.fill();
      drawRot('LIVE ALBUM', boxY + boxH / 2, `700 ${Math.round(W * 0.2)}px "Space Grotesk", sans-serif`, '#6b0f14', boxH - 10, '0.08em');
      drawGrain(0.08);
      return c;
    }

    // 8. Pink Floyd — The Dark Side of the Moon：深邃亚光黑 + 三棱镜折射六色彩虹光谱 + HARVEST
    if (id === 'pf-dsotm') {
      x.fillStyle = '#08080a';
      x.fillRect(0, 0, W, H);

      // 经典六色彩虹光谱斜带（位于下中段，辨识度瞬间拉满）
      const specY = Math.round(H * 0.79);
      const spectrum = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#38bdf8', '#8b5cf6'];
      x.save();
      x.beginPath();
      x.rect(0, specY - 26, W, 62);
      x.clip();
      spectrum.forEach((col, si) => {
        x.strokeStyle = col;
        x.lineWidth = 4.5;
        x.beginPath();
        x.moveTo(-4, specY - 12 + si * 5.2);
        x.lineTo(W + 4, specY - 2 + si * 5.2);
        x.stroke();
      });
      // 左侧入射白光微线
      x.strokeStyle = 'rgba(255,255,255,.85)';
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(0, specY - 4);
      x.lineTo(W * 0.34, specY - 10);
      x.stroke();
      x.restore();

      drawRot('PINK FLOYD', H * 0.145, `700 ${Math.round(W * 0.29)}px "Space Grotesk", sans-serif`, '#ef4444', H * 0.22, '0.12em');
      drawRot('THE DARK SIDE OF THE MOON', H * 0.51, `700 ${Math.round(W * 0.44)}px "Oswald", "Space Grotesk", sans-serif`, 'rgba(248,248,250,.95)', H * 0.46, '0.04em');
      drawLabelBadge(x, 'harvest', W / 2, H - margin, W, 'rgba(240,240,244,.82)');
      drawGrain(0.08);
      return c;
    }

    // 9. Pink Floyd — Wish You Were Here：画廊白纸 + 燃烧握手蓝天摄影切片 + 焦橙烫边
    if (id === 'pf-wywh') {
      x.fillStyle = '#f4f2ec';
      x.fillRect(0, 0, W, H);
      if (art) {
        const ph = Math.round(W * 2.15);
        x.drawImage(art, art.naturalWidth * 0.24, art.naturalHeight * 0.16, art.naturalWidth * 0.52, art.naturalHeight * 0.68, 0, 0, W, ph);
        // 底部焦橙色炙烤边界线
        const scorch = makeLinearBand(x, 0, ph - 8, 0, ph + 6, [[0, 'rgba(224,108,40,0)'], [0.5, 'rgba(224,108,40,.9)'], [1, 'rgba(244,242,236,1)']]);
        x.fillStyle = scorch;
        x.fillRect(0, ph - 8, W, 14);
      }
      drawRot('PINK FLOYD', H * 0.285, `700 ${Math.round(W * 0.27)}px "Space Grotesk", sans-serif`, '#d95d1e', H * 0.2, '0.12em');
      drawRot('Wish You Were Here', H * 0.61, `italic 700 ${Math.round(W * 0.42)}px "Playfair Display", Georgia, serif`, 'rgba(22,20,18,.94)', H * 0.42, '0.03em');
      drawLabelBadge(x, 'harvest', W / 2, H - margin, W, 'rgba(28,26,22,.82)');
      drawGrain(0.08);
      return c;
    }

    // 10. 寸鐵 aLIVE IN CHINA 2017-2023 — 真实压纹工业灰纸板 + 原版黑胶带「寸鐵」剪影 + 3CD 盒标
    if (id === 'cuntie') {
      if (art) {
        // 用封面原版灰色粗糙压纹纸板平铺打底
        x.drawImage(art, art.naturalWidth * 0.62, art.naturalHeight * 0.35, art.naturalWidth * 0.36, art.naturalHeight * 0.6, 0, 0, W, H);
        // 顶部无缝贴入封面原版撕纸黑胶带「寸鐵」字标（同灰板底+柔边羽化）
        const ctY = Math.round(H * 0.03);
        const ctH = Math.round(W * 1.72);
        x.drawImage(
          art,
          art.naturalWidth * 0.05,
          art.naturalHeight * 0.08,
          art.naturalWidth * 0.54,
          art.naturalHeight * 0.86,
          0,
          ctY,
          W,
          ctH
        );
        const ctFade = makeLinearBand(x, 0, ctY + ctH - 16, 0, ctY + ctH, [[0, 'rgba(182,181,177,0)'], [1, 'rgba(182,181,177,1)']]);
        x.fillStyle = ctFade;
        x.fillRect(0, ctY + ctH - 16, W, 16);
      } else {
        x.fillStyle = '#bab9b5';
        x.fillRect(0, 0, W, H);
      }
      // 工业细黑横标
      x.fillStyle = '#121212';
      x.fillRect(Math.round(W * 0.14), Math.round(H * 0.215), Math.round(W * 0.72), 3);

      drawRot('aLIVE IN CHINA 2017-2023', H * 0.54, `700 ${Math.round(W * 0.35)}px "Space Grotesk", "Helvetica Neue", sans-serif`, '#111111', H * 0.54, '0.03em');
      drawLabelBadge(x, 'jubu', W / 2, Math.round(H * 0.89), W, '#121212');
      x.fillStyle = 'rgba(18,18,18,.84)';
      x.font = `700 ${Math.round(W * 0.2)}px "Noto Sans SC", sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'alphabetic';
      x.fillText('局部娱乐', W / 2, H - margin);
      drawGrain(0.1);
      return c;
    }

    // 11. 南青乐队 我在三月的早晨看到了七月的黄昏 — 全幅 35mm 胶片橘红黄昏天际线 → 暗绿走廊渐层
    if (id === 'nanqing') {
      if (art) {
        // 全幅取用封面顶部炽热橘红黄昏 + 下方潮湿墨绿天台实景
        x.drawImage(art, art.naturalWidth * 0.4, 0, art.naturalWidth * 0.44, art.naturalHeight, 0, 0, W, H);
        const scrim = makeLinearBand(x, 0, 0, 0, H, [
          [0, 'rgba(227,139,41,.14)'],
          [0.16, 'rgba(32,48,40,.46)'],
          [0.52, 'rgba(26,42,35,.64)'],
          [0.86, 'rgba(22,34,29,.72)'],
          [1, 'rgba(16,24,20,.82)'],
        ]);
        x.fillStyle = scrim;
        x.fillRect(0, 0, W, H);
      } else {
        x.fillStyle = '#3b4a40';
        x.fillRect(0, 0, W, H);
      }
      // 橘红黄昏亮线
      x.fillStyle = '#f59e0b';
      x.fillRect(0, Math.round(H * 0.145), W, 4);

      const nqPx = Math.round(W * 0.34);
      x.fillStyle = '#fcd34d';
      x.font = `700 ${nqPx}px "Noto Sans SC", sans-serif`;
      tateDraw(x, tateCells('南青乐队'), W / 2, Math.round(H * 0.175), nqPx, 0.08);

      const tPx = Math.round(W * 0.46);
      x.fillStyle = 'rgba(248,246,238,.95)';
      x.font = `700 ${tPx}px "Noto Serif SC", serif`;
      tateDraw(x, tateCells('我在三月的早晨看到了七月的黄昏'), W / 2, Math.round(H * 0.34), tPx, 0.04);

      x.fillStyle = 'rgba(245,220,175,.78)';
      x.font = `600 ${Math.round(W * 0.19)}px "Noto Sans SC", sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'alphabetic';
      x.fillText('东方影音', W / 2, H - margin);
      drawGrain(0.11);
      return c;
    }

    return null;
  }

  // 1. 晶透 CD 塑料盒高清 Canvas 渲染器（1:1 复刻 taylor.fyi/top/ 真实透光暗折射聚碳酸酯外壳）
  function renderCdJewelCanvas(targetCanvas, art, item, index) {
    const H = SPINE_H;
    const W = Math.round(H * 0.075); // 77px × 1024px，与 taylor.fyi/top/ 实测比例完全一致
    const u = W / 150;
    const wall = Math.round(W * 0.118);
    const head = Math.round(W * 0.432);
    const foot = Math.round(W * 0.432);
    const r = Math.round(W * 0.24); // 真实实拍 CD 盒圆润胶囊端角
    const iw = W - wall * 2;
    const ih = H - head - foot;

    targetCanvas.width = W;
    targetCanvas.height = H;
    const x = targetCanvas.getContext('2d');
    if (!x) return;

    x.clearRect(0, 0, W, H);
    const line = (x0, y0, x1, y1, lw, col) => {
      x.beginPath();
      x.moveTo(x0, y0);
      x.lineTo(x1, y1);
      x.lineWidth = lw;
      x.strokeStyle = col;
      x.stroke();
    };

    x.save();
    traceRounded(x, 0, 0, W, H, r);
    x.clip();

    // 底层深透灰塑基底（告别惨白平块）
    x.fillStyle = '#242930';
    x.fillRect(0, 0, W, H);

    // 内芯纸卡：优先一专一版定制实景侧脊，其次通用高清印刷侧脊
    const card = paintBespokeCdInsert(art, item, iw, ih) || paintSpineInsert(art, item, iw, ih, 'cd', index);
    x.drawImage(card, wall, head);

    // 纸卡深嵌在塑料壳内 2mm 的真实四边压影
    shadeInsetCard(x, wall, head, iw, ih, Math.max(4, Math.round(wall * 0.9)));

    // 左右透明聚碳酸酯侧壁（真实深暗玻璃全内反射 + 锐利亮白折射脊线）
    for (const [x0, dir] of [[0, 1], [W, -1]]) {
      x.fillStyle = makeLinearBand(x, x0, 0, x0 + dir * wall, 0, [
        [0, 'rgba(18,22,28,.86)'],
        [0.18, 'rgba(236,242,248,.92)'],
        [0.42, 'rgba(98,108,120,.76)'],
        [0.68, 'rgba(214,222,230,.86)'],
        [0.86, 'rgba(42,48,56,.82)'],
        [1, 'rgba(16,20,26,.92)'],
      ]);
      x.fillRect(Math.min(x0, x0 + dir * wall), 0, wall, H);
      for (const [at, lw, col] of [
        [0.16, 1.5, 'rgba(255,255,255,.94)'],
        [0.36, 1.1, 'rgba(14,18,24,.58)'],
        [0.66, 1.3, 'rgba(255,255,255,.88)'],
        [0.9, 1.2, 'rgba(10,14,18,.72)'],
      ]) {
        line(x0 + dir * wall * at, 0, x0 + dir * wall * at, H, lw * u, col);
      }
    }

    // 上下透明玻璃铰链端头（深色玻璃折射暗环 + 亮白胶囊反光 + 深嵌铰链插槽）
    const drawEndCap = (y0, y1, isBottom) => {
      const h = y1 - y0;
      const sx = wall * 1.15;
      const sw = W - sx * 2;
      const sy = y0 + h * (isBottom ? 0.36 : 0.24);
      const sh = h * 0.4;
      const ey = isBottom ? y0 : y1;
      const oy = isBottom ? y1 : y0;
      const d = isBottom ? 1 : -1;

      // 端头透镜级深浅折射过渡
      x.fillStyle = makeLinearBand(x, 0, isBottom ? y1 : y0, 0, isBottom ? y0 : y1, [
        [0, 'rgba(30,36,44,.92)'],
        [0.14, 'rgba(242,247,252,.94)'],
        [0.32, 'rgba(126,136,148,.84)'],
        [0.54, 'rgba(54,62,72,.86)'],
        [0.78, 'rgba(206,214,224,.9)'],
        [0.92, 'rgba(84,92,102,.88)'],
        [1, 'rgba(22,26,32,.95)'],
      ]);
      x.fillRect(0, y0, W, h);

      // 端头两侧曲面暗影收边（造出圆柱玻璃立体感）
      x.fillStyle = makeLinearBand(x, 0, 0, W, 0, [
        [0, 'rgba(10,14,18,.68)'],
        [0.18, 'rgba(255,255,255,.22)'],
        [0.5, 'rgba(255,255,255,.04)'],
        [0.82, 'rgba(255,255,255,.18)'],
        [1, 'rgba(10,14,18,.72)'],
      ]);
      x.fillRect(0, y0, W, h);

      // 内部透明铰链槽（深色折射腔 + 锐白内缘高光）
      traceRounded(x, sx, sy, sw, sh, sh * 0.34);
      x.fillStyle = makeLinearBand(x, 0, sy, 0, sy + sh, [
        [0, 'rgba(18,22,28,.88)'],
        [0.48, 'rgba(68,76,88,.72)'],
        [1, 'rgba(188,196,206,.78)'],
      ]);
      x.fill();
      x.lineWidth = 1.6 * u;
      x.strokeStyle = 'rgba(12,16,22,.72)';
      x.stroke();

      traceRounded(x, sx + 1.8 * u, sy + 1.8 * u, sw - 3.6 * u, sh - 3.6 * u, sh * 0.26);
      x.lineWidth = 1.2 * u;
      x.strokeStyle = 'rgba(255,255,255,.78)';
      x.stroke();

      // 端盖衔接亮线与阴影缝
      line(wall * 0.5, ey + d * 1.4 * u, W - wall * 0.5, ey + d * 1.4 * u, 1.5 * u, 'rgba(255,255,255,.86)');
      line(wall * 0.5, ey + d * 3.4 * u, W - wall * 0.5, ey + d * 3.4 * u, 1.2 * u, 'rgba(12,16,22,.65)');
      line(wall * 0.8, oy - d * 3.2 * u, W - wall * 0.8, oy - d * 3.2 * u, 1.4 * u, 'rgba(255,255,255,.84)');
    };

    drawEndCap(0, head, false);
    drawEndCap(H - foot, H, true);

    // 托盘黑边内框 + 透明亚克力表层双道玻璃扫光
    x.lineWidth = 1.8 * u;
    x.strokeStyle = 'rgba(12,16,22,.76)';
    x.strokeRect(wall, head, iw, ih);

    x.fillStyle = makeLinearBand(x, wall, 0, wall + iw, 0, [
      [0, 'rgba(255,255,255,0)'],
      [0.06, 'rgba(255,255,255,.34)'],
      [0.13, 'rgba(255,255,255,.09)'],
      [0.3, 'rgba(255,255,255,0)'],
      [0.74, 'rgba(255,255,255,0)'],
      [0.88, 'rgba(255,255,255,.11)'],
      [0.94, 'rgba(255,255,255,.24)'],
      [1, 'rgba(255,255,255,.03)'],
    ]);
    x.fillRect(wall, head, iw, ih);
    x.restore();

    // 外圈晶体微弱暗边 + 内圈锐利折射白边
    traceRounded(x, 0.8 * u, 0.8 * u, W - 1.6 * u, H - 1.6 * u, r);
    x.lineWidth = 1.4 * u;
    x.strokeStyle = 'rgba(18,22,28,.62)';
    x.stroke();
    traceRounded(x, 2.4 * u, 2.4 * u, W - 4.8 * u, H - 4.8 * u, r - 1.6 * u);
    x.lineWidth = 1.1 * u;
    x.strokeStyle = 'rgba(255,255,255,.68)';
    x.stroke();
  }

  // 2. 精装书籍侧脊高清 Canvas 渲染器（圆弧圆柱体阴影 + 书脊厚薄错落 + 烫金线）
  function renderBookSpineCanvas(targetCanvas, art, item, index) {
    const seed = hashStr(`${item.title || ''}|${item.creator || ''}`);
    const widthRatios = [0.112, 0.128, 0.144, 0.118, 0.136];
    const H = SPINE_H;
    const W = Math.round(H * widthRatios[(seed + index) % widthRatios.length]);

    targetCanvas.width = W;
    targetCanvas.height = H;
    const x = targetCanvas.getContext('2d');
    if (!x) return;

    x.clearRect(0, 0, W, H);
    x.save();
    traceRounded(x, 0, 0, W, H, 8);
    x.clip();

    const insert = paintSpineInsert(art, item, W, H, 'book', index);
    x.drawImage(insert, 0, 0);

    // 精装书脊圆柱体左右弧光与书脊压槽（hinge groove）
    const cyl = makeLinearBand(x, 0, 0, W, 0, [
      [0, 'rgba(0,0,0,.32)'],
      [0.08, 'rgba(255,255,255,.18)'],
      [0.16, 'rgba(0,0,0,.1)'],
      [0.2, 'rgba(255,255,255,.06)'],
      [0.8, 'rgba(0,0,0,0)'],
      [0.86, 'rgba(0,0,0,.09)'],
      [0.93, 'rgba(255,255,255,.08)'],
      [1, 'rgba(0,0,0,.36)'],
    ]);
    x.fillStyle = cyl;
    x.fillRect(0, 0, W, H);

    // 书脊顶底轻微天头地脚压光
    const cap = makeLinearBand(x, 0, 0, 0, H, [
      [0, 'rgba(255,255,255,.16)'],
      [0.018, 'rgba(255,255,255,0)'],
      [0.98, 'rgba(0,0,0,0)'],
      [1, 'rgba(0,0,0,.24)'],
    ]);
    x.fillStyle = cap;
    x.fillRect(0, 0, W, H);
    x.restore();
  }

  // 3. DVD 塑膜盒侧脊高清 Canvas 渲染器
  function renderDvdSpineCanvas(targetCanvas, art, item, index) {
    const H = SPINE_H;
    const W = Math.round(H * 0.076);
    targetCanvas.width = W;
    targetCanvas.height = H;
    const x = targetCanvas.getContext('2d');
    if (!x) return;

    x.clearRect(0, 0, W, H);
    x.save();
    traceRounded(x, 0, 0, W, H, 7);
    x.clip();

    const insert = paintSpineInsert(art, item, W, H, 'dvd', index);
    x.drawImage(insert, 0, 0);

    // 透明塑膜斜光条 + 盒脊弧影
    x.fillStyle = makeLinearBand(x, 0, 0, W, 0, [
      [0, 'rgba(0,0,0,.26)'],
      [0.1, 'rgba(255,255,255,.2)'],
      [0.2, 'rgba(255,255,255,0)'],
      [0.84, 'rgba(0,0,0,0)'],
      [0.92, 'rgba(255,255,255,.12)'],
      [1, 'rgba(0,0,0,.3)'],
    ]);
    x.fillRect(0, 0, W, H);
    x.restore();
  }

  // 构建侧脊元素（CDs / Books / DVD 使用高清 Canvas 拟物引擎；Tapes 保留卡带盒样式）
  function buildSpineElement(item, index, spineType) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.idx = String(index);
    btn.setAttribute('aria-label', `#${index + 1} ${item.title} - ${item.creator}`);

    if (spineType === 'cd' || spineType === 'book' || spineType === 'dvd') {
      const seed = hashStr(`${item.title || ''}|${item.creator || ''}`);
      btn.className = `spine-item spine-canvas-item spine-canvas-${spineType}${index === activeItemIndex ? ' is-selected' : ''}`;

      const cv = document.createElement('canvas');
      cv.className = 'spine-canvas';
      if (spineType === 'book') {
        const heights = [324, 344, 356, 332, 348];
        cv.style.height = `${heights[(seed + index) % heights.length]}px`;
      }
      btn.appendChild(cv);

      const draw = art => {
        if (spineType === 'cd') renderCdJewelCanvas(cv, art, item, index);
        else if (spineType === 'book') renderBookSpineCanvas(cv, art, item, index);
        else renderDvdSpineCanvas(cv, art, item, index);
      };

      // 先以配置色快速首帧绘制，封面及 WebFont 就绪后自动重绘高清版
      draw(null);
      const coverUrl = getResolvedCover(item, activeCategory);
      loadSpineArt(coverUrl).then(art => {
        if (!cv.isConnected) return;
        draw(art);
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(() => {
            if (cv.isConnected) draw(art);
          });
        }
      });

      btn.addEventListener('click', () => selectItem(index, true));
      btn.addEventListener('pointerenter', () => updateSpotlight(item, index));
      return btn;
    }

    const typoClasses = ['', 'typo-serif', 'typo-upper', 'typo-italic', 'typo-serif'];
    const typoClass = typoClasses[index % typoClasses.length];
    btn.className = `spine-item spine-${spineType}${typoClass ? ` ${typoClass}` : ''}${index === activeItemIndex ? ' is-selected' : ''}`;

    const paperColor = item.color || '#1f2937';
    const paperInk = getSpineInk(paperColor);

    const paper = document.createElement('div');
    paper.className = 'case-paper';
    paper.style.background = paperColor;
    paper.style.color = paperInk;

    const artistText = String(item.creator || '');
    const artist = document.createElement('span');
    artist.className = 'tape-artist';
    const isArtistCJK = hasCJK(artistText);
    const artistLen = artistText.length;
    if (isArtistCJK) {
      artist.style.fontSize = artistLen >= 6 ? '18px' : artistLen >= 4 ? '22px' : '26px';
    } else {
      artist.style.fontSize = artistLen >= 16 ? '13.5px' : artistLen >= 11 ? '17.5px' : artistLen >= 9 ? '21px' : '25px';
    }
    artist.textContent = artistText;
    if (paperInk === '#f6f5f0' && item.accent && index % 3 === 2) {
      artist.style.color = item.accent;
    }

    const titleText = String(item.title || '');
    const titleIsCJK = hasCJK(titleText);
    const title = document.createElement('div');
    title.className = `tape-title${titleIsCJK ? ' is-cjk' : ''}${titleIsCJK && titleText.length >= 5 ? ' is-long' : ''}`;
    if (!titleIsCJK && titleText.indexOf(' ') === -1 && titleText.length >= 8) {
      title.style.fontSize = '8px';
    }
    title.textContent = titleText;

    const artBottom = document.createElement('div');
    artBottom.className = 'tape-art-bottom';
    artBottom.appendChild(createCoverImg(item, activeCategory, '', index < 10));

    paper.append(artist, title, artBottom);
    btn.appendChild(paper);

    btn.addEventListener('click', () => selectItem(index, true));
    btn.addEventListener('pointerenter', () => updateSpotlight(item, index));
    return btn;
  }

  // 构建高密度 Code-128 风格矢量条形码（真实锐利细密条纹，告别粗塑料块）
  function buildBarcode(seedStr) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'ticket-barcode-svg');
    svg.setAttribute('viewBox', '0 0 46 112');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');

    let h = hashStr(seedStr || 'ticket');
    let y = 2;
    const widths = [1.2, 2.2, 1.0, 3.0, 1.4, 2.5];
    const gaps = [1.1, 1.8, 1.2, 2.4, 1.3];

    // 首尾保护条
    const addBar = (top, thickness) => {
      const r = document.createElementNS(svgNS, 'rect');
      r.setAttribute('x', '0');
      r.setAttribute('y', top.toFixed(1));
      r.setAttribute('width', '46');
      r.setAttribute('height', thickness.toFixed(1));
      r.setAttribute('fill', 'currentColor');
      r.setAttribute('shape-rendering', 'crispEdges');
      svg.appendChild(r);
    };

    addBar(y, 1.6); y += 2.8;
    addBar(y, 1.2); y += 2.6;

    let i = 0;
    while (y < 102) {
      h = Math.imul(h ^ (i * 31 + 17), 16777619) >>> 0;
      const barH = widths[h % widths.length];
      const gapH = gaps[(h >>> 4) % gaps.length];
      if (y + barH > 103) break;
      addBar(y, barH);
      y += barH + gapH;
      i++;
    }

    addBar(105.4, 1.2);
    addBar(108.0, 1.8);
    return svg;
  }

  function makeSpecCell(label, value, extraClass = '') {
    const cell = document.createElement('div');
    cell.className = `tk-spec${extraClass ? ` ${extraClass}` : ''}`;
    const k = document.createElement('span');
    k.className = 'tk-spec-k';
    k.textContent = label;
    const v = document.createElement('strong');
    v.className = 'tk-spec-v';
    v.textContent = value || '—';
    cell.append(k, v);
    return cell;
  }

  // 构建四套按官方海报深度定制布局与材质的典藏实体票根
  function buildTicketStub(item, index) {
    if (item.photo) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ticket-art-card${index === activeItemIndex ? ' is-selected' : ''}`;
      btn.dataset.idx = String(index);
      btn.setAttribute('aria-label', `${item.title} - ${item.creator} (${item.date || item.year || ''})`);

      const img = document.createElement('img');
      img.className = 'ticket-art-img';
      img.src = item.photo;
      img.alt = `${item.title || ''} 实拍演出票根`;
      img.loading = index < 6 ? 'eager' : 'lazy';
      img.decoding = 'async';
      btn.appendChild(img);

      btn.addEventListener('click', () => selectItem(index));
      btn.addEventListener('pointerenter', () => updateSpotlight(item, index));
      return btn;
    }

    const theme = item.ticketTheme || 'ocean';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `ticket-card tk-${theme}${index === activeItemIndex ? ' is-selected' : ''}`;
    btn.dataset.idx = String(index);
    btn.style.setProperty('--tk-accent', item.accent || '#ffd60a');
    btn.setAttribute('aria-label', `${item.title} - ${item.creator} (${item.date || item.year || ''})`);

    // 1. 左侧全出血艺术海报舞台（根据每场海报比例做融合羽化或版画框）
    const art = document.createElement('div');
    art.className = 'tk-art';
    if (item.cover) {
      art.appendChild(createCoverImg(item, 'tickets', 'tk-art-img', index < 6));
    }

    // 2. 中部：按每场演出的视觉语言构建专属实体票排版
    const body = document.createElement('div');
    body.className = 'tk-body';

    if (theme === 'ocean') {
      // 【李志 · 跨海登机纪念票】
      const head = document.createElement('div');
      head.className = 'tk-head';

      const kicker = document.createElement('span');
      kicker.className = 'tk-kicker';
      kicker.textContent = 'BOARDING PASS · FANTOPIA LIVE';

      const route = document.createElement('span');
      route.className = 'tk-route-badge';
      route.innerHTML = '<span>LIVE</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 3 10.5l7.2 2.4L13.5 21 21 3Z"/></svg><strong>KUL</strong>';

      head.append(kicker, route);

      const hero = document.createElement('div');
      hero.className = 'tk-hero';

      const artist = document.createElement('p');
      artist.className = 'tk-artist';
      artist.textContent = item.creator || '';

      const title = document.createElement('h3');
      title.className = 'tk-title';
      title.textContent = item.displayTitle || item.title || '';

      const enSub = document.createElement('p');
      enSub.className = 'tk-ocean-en';
      enSub.textContent = item.subtitle || '';

      hero.append(artist, title, enSub);

      const specs = document.createElement('div');
      specs.className = 'tk-specs tk-specs-3';
      specs.append(
        makeSpecCell('DATE', item.date || item.year),
        makeSpecCell('SHOWTIME', item.time || '20:00'),
        makeSpecCell('VENUE', item.venue || item.city, 'is-wide'),
      );

      body.append(head, hero, specs);
    } else if (theme === 'prism') {
      // 【岛屿心情 · 虹彩全息烫印纪念票】
      const vRail = document.createElement('span');
      vRail.className = 'tk-vertical-credit';
      vRail.textContent = item.verticalTag || item.creator || '';
      body.appendChild(vRail);

      const inner = document.createElement('div');
      inner.className = 'tk-prism-inner';

      const head = document.createElement('div');
      head.className = 'tk-head';

      const kicker = document.createElement('span');
      kicker.className = 'tk-kicker';
      kicker.textContent = item.subtitle || '2026 NATIONAL TOUR';

      const foilTag = document.createElement('span');
      foilTag.className = 'tk-foil-pill';
      foilTag.textContent = 'SHANGHAI · 04/17';

      head.append(kicker, foilTag);

      const hero = document.createElement('div');
      hero.className = 'tk-hero';

      const title = document.createElement('h3');
      title.className = 'tk-title';
      title.textContent = item.displayTitle || item.title || '';

      const sub = document.createElement('p');
      sub.className = 'tk-subline';
      sub.textContent = item.displaySub || '';

      hero.append(title, sub);

      const specs = document.createElement('div');
      specs.className = 'tk-specs tk-specs-3';
      specs.append(
        makeSpecCell('DATE', `${item.date || ''} FRI`),
        makeSpecCell('TIME', '20:00'),
        makeSpecCell('VENUE', item.venue || item.city, 'is-wide'),
      );

      inner.append(head, hero, specs);
      body.appendChild(inner);
    } else if (theme === 'mint') {
      // 【自然友谊 2024 · 荧光薄荷丝网独立印刷票】
      const head = document.createElement('div');
      head.className = 'tk-head tk-mint-head';

      const brandWrap = document.createElement('div');
      brandWrap.className = 'tk-mint-brand';
      const big = document.createElement('strong');
      big.className = 'tk-mint-logo';
      big.textContent = item.displayTitle || 'NF2024';
      const outline = document.createElement('span');
      outline.className = 'tk-mint-outline';
      outline.textContent = 'LIVE & SHOP';
      brandWrap.append(big, outline);

      const motto = document.createElement('span');
      motto.className = 'tk-mint-motto';
      motto.textContent = '自然而然 · 友谊第一';

      head.append(brandWrap, motto);

      const lineupWrap = document.createElement('div');
      lineupWrap.className = 'tk-lineup';
      const bands = Array.isArray(item.lineup) ? item.lineup : String(item.creator || '').split('/').map(s => s.trim()).filter(Boolean);
      bands.forEach(name => {
        const pill = document.createElement('span');
        pill.className = 'tk-band-chip';
        pill.textContent = name;
        lineupWrap.appendChild(pill);
      });

      const schedGrid = document.createElement('div');
      schedGrid.className = 'tk-mint-grid';
      const scheds = Array.isArray(item.schedule) ? item.schedule : [];
      scheds.forEach(s => schedGrid.appendChild(makeSpecCell(s.k, s.v)));
      schedGrid.appendChild(makeSpecCell('VENUE', item.venue || item.city, 'is-full'));

      body.append(head, lineupWrap, schedGrid);
    } else {
      // 【南青乐队 · 朱砂矿翠木刻版画套框典藏票】
      const frame = document.createElement('div');
      frame.className = 'tk-wood-frame';

      const head = document.createElement('div');
      head.className = 'tk-head';

      const kicker = document.createElement('span');
      kicker.className = 'tk-kicker';
      kicker.textContent = item.subtitle || '2024 TOUR';

      const seal = document.createElement('span');
      seal.className = 'tk-seal-chop';
      seal.textContent = item.seal || '不插电';

      head.append(kicker, seal);

      const hero = document.createElement('div');
      hero.className = 'tk-hero';

      const artist = document.createElement('p');
      artist.className = 'tk-artist';
      artist.textContent = `${item.creator || ''} · ${item.displaySub || ''}`;

      const title = document.createElement('h3');
      title.className = 'tk-title';
      title.textContent = item.displayTitle || item.title || '';

      hero.append(artist, title);

      const specs = document.createElement('div');
      specs.className = 'tk-specs tk-specs-2';
      specs.append(
        makeSpecCell('日期 DATE', [item.date, item.time].filter(Boolean).join(' · ')),
        makeSpecCell('场馆 VENUE', item.venue || item.city),
      );

      frame.append(head, hero, specs);
      body.appendChild(frame);
    }

    // 3. 右侧：真实微孔撕裂线 + 专属副券 + 高密度矢量条形码
    const stub = document.createElement('div');
    stub.className = 'tk-stub';

    const stubHead = document.createElement('div');
    stubHead.className = 'tk-stub-head';
    const stubDate = document.createElement('strong');
    stubDate.className = 'tk-stub-date';
    stubDate.textContent = item.stubDate || item.date || item.year || 'LIVE';
    const stubDay = document.createElement('span');
    stubDay.className = 'tk-stub-day';
    stubDay.textContent = item.stubDay || item.cityCode || 'ADMIT';
    stubHead.append(stubDate, stubDay);

    const barcodeWrap = document.createElement('div');
    barcodeWrap.className = 'tk-barcode-wrap';
    barcodeWrap.appendChild(buildBarcode(`${item.title}-${item.date}-${item.serial}`));

    const serial = document.createElement('span');
    serial.className = 'tk-serial';
    serial.textContent = item.serial || `NO.${String(index + 1).padStart(4, '0')}`;

    stub.append(stubHead, barcodeWrap, serial);

    btn.append(art, body, stub);
    btn.addEventListener('click', () => selectItem(index));
    btn.addEventListener('pointerenter', () => updateSpotlight(item, index));
    return btn;
  }

  // 渲染核心拟物舞台 #media-stage
  function renderStage() {
    if (!mediaStage) return;
    mediaStage.textContent = '';

    if (visibleItems.length === 0) {
      const empty = document.createElement('p');
      empty.style.textAlign = 'center';
      empty.style.color = 'var(--g500)';
      empty.style.padding = '48px 16px';
      empty.textContent = '没有找到匹配当前筛选条件的馆藏。';
      mediaStage.appendChild(empty);
      return;
    }

    // 0. 演出票根类展示（票根墙 Stubs / 观演志 Timeline / 实拍墙 Wall）
    if (activeCategory === 'tickets') {
      if (activeLook === 'stubs') {
        const grid = document.createElement('div');
        grid.className = 'tickets-grid';
        visibleItems.forEach((item, idx) => grid.appendChild(buildTicketStub(item, idx)));
        mediaStage.appendChild(grid);
        return;
      }

      if (activeLook === 'timeline') {
        const list = document.createElement('div');
        list.className = 'ticket-timeline';
        visibleItems.forEach((item, idx) => {
          const row = document.createElement('button');
          row.type = 'button';
          row.className = `timeline-row${idx === activeItemIndex ? ' is-selected' : ''}`;
          row.dataset.idx = String(idx);

          const dateCol = document.createElement('div');
          dateCol.className = 'timeline-date';
          dateCol.textContent = item.date || item.year || '—';

          const dot = document.createElement('span');
          dot.className = 'timeline-dot';
          dot.style.background = item.accent || 'var(--accent)';

          const body = document.createElement('div');
          body.className = 'timeline-body';

          const head = document.createElement('div');
          head.className = 'timeline-head';
          const title = document.createElement('strong');
          title.className = 'timeline-title';
          title.textContent = item.title || '';
          const artist = document.createElement('span');
          artist.className = 'timeline-artist';
          artist.textContent = item.creator || '';
          head.append(title, artist);
          if (item.isSample) {
            const sp = document.createElement('span');
            sp.className = 'ticket-sample-pill is-inline';
            sp.textContent = '示例';
            head.appendChild(sp);
          }

          const place = document.createElement('p');
          place.className = 'timeline-place';
          place.textContent = [item.city, item.venue, item.seat, item.price].filter(Boolean).join(' · ');

          const note = document.createElement('p');
          note.className = 'timeline-note';
          note.textContent = item.note || '';

          body.append(head, place, note);
          row.append(dateCol, dot, body);
          row.addEventListener('click', () => selectItem(idx));
          list.appendChild(row);
        });
        mediaStage.appendChild(list);
        return;
      }

      // 演出海报墙 wall
      const grid = document.createElement('div');
      grid.className = 'media-grid is-ticket-wall';
      visibleItems.forEach((item, idx) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `grid-card${idx === activeItemIndex ? ' is-selected' : ''}`;
        card.dataset.idx = String(idx);

        const artWrap = document.createElement('div');
        artWrap.className = 'art-wrap is-ticket-card';
        artWrap.style.background = item.color || 'var(--g200)';
        if (item.cover || item.photo || item.ticketArt) {
          const wallBg = createCoverImg(item, 'tickets', 'ticket-wall-bg', idx < 6);
          wallBg.setAttribute('aria-hidden', 'true');
          artWrap.appendChild(wallBg);
          artWrap.appendChild(createCoverImg(item, 'tickets', 'art-img', idx < 6));
        }

        const stamp = document.createElement('span');
        stamp.className = 'ticket-wall-badge';
        stamp.textContent = item.date || item.year || 'LIVE';
        artWrap.appendChild(stamp);

        const meta = document.createElement('div');
        meta.className = 'grid-meta';
        const t = document.createElement('p');
        t.className = 'grid-title';
        t.textContent = item.title || '';
        const sub = document.createElement('p');
        sub.className = 'grid-sub';
        sub.textContent = [item.creator, item.city].filter(Boolean).join(' · ');
        meta.append(t, sub);

        card.append(artWrap, meta);
        card.addEventListener('click', () => selectItem(idx));
        grid.appendChild(card);
      });
      mediaStage.appendChild(grid);
      return;
    }

    // 1. 侧脊排架类（CDs / Tapes / DVD / Book Spines）
    if (SPINE_MAP[activeLook]) {
      const rack = document.createElement('div');
      rack.className = 'shelf-rack';
      visibleItems.forEach((item, idx) => {
        rack.appendChild(buildSpineElement(item, idx, SPINE_MAP[activeLook]));
        if (showJacket && idx === activeItemIndex) {
          rack.appendChild(buildActiveJacket(item, idx));
        }
      });
      mediaStage.appendChild(rack);
      return;
    }

    // 2. Vinyl Spin 动态旋转黑胶 / 白胶唱机模式
    if (activeLook === 'spin') {
      const activeItem = visibleItems[activeItemIndex] || visibleItems[0];
      const isWhite = getVinylVariant(activeItem) === 'white';
      const stage = document.createElement('div');
      stage.className = 'turntable-stage';

      const platter = document.createElement('div');
      platter.className = 'platter-zone';

      const specBadge = document.createElement('span');
      specBadge.className = `spin-spec-badge ${isWhite ? 'is-white' : 'is-black'}`;
      specBadge.textContent = isWhite ? '白胶 · 33⅓ RPM' : '黑胶 · 33⅓ RPM';

      const sleeve = document.createElement('div');
      sleeve.className = 'spin-sleeve';
      sleeve.appendChild(createCoverImg(activeItem, activeCategory, 'art-img', true));

      const record = document.createElement('div');
      record.className = `spin-record${isWhite ? ' is-white-vinyl' : ''}`;
      const label = document.createElement('div');
      label.className = 'spin-label';
      label.style.background = activeItem?.accent || '#ffd60a';
      label.appendChild(createCoverImg(activeItem, activeCategory, '', true));
      const hole = document.createElement('div');
      hole.className = 'spin-hole';
      label.appendChild(hole);
      record.appendChild(label);

      const tonearm = document.createElement('div');
      tonearm.className = 'spin-tonearm';
      tonearm.setAttribute('aria-hidden', 'true');

      platter.append(specBadge, sleeve, record, tonearm);

      const picker = document.createElement('div');
      picker.className = 'spin-picker';
      visibleItems.forEach((item, idx) => {
        const tBtn = document.createElement('button');
        tBtn.type = 'button';
        const thumbWhite = getVinylVariant(item) === 'white';
        tBtn.className = `spin-thumb-btn${idx === activeItemIndex ? ' is-selected' : ''}`;
        tBtn.dataset.idx = String(idx);
        tBtn.title = `#${idx + 1} ${item.title} (${thumbWhite ? '白胶' : '黑胶'})`;
        tBtn.appendChild(createCoverImg(item, activeCategory, 'art-img', idx < 8));

        const dot = document.createElement('span');
        dot.className = `spin-thumb-dot ${thumbWhite ? 'is-white' : 'is-black'}`;
        dot.setAttribute('aria-hidden', 'true');
        tBtn.appendChild(dot);

        tBtn.addEventListener('click', () => selectItem(idx));
        picker.appendChild(tBtn);
      });

      stage.append(platter, picker);
      mediaStage.appendChild(stage);
      return;
    }

    // 3. Player 播放器卡片墙模式
    if (activeLook === 'player') {
      const grid = document.createElement('div');
      grid.className = 'media-grid is-player-grid';
      visibleItems.forEach((item, idx) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `player-card${idx === activeItemIndex ? ' is-selected' : ''}`;
        card.dataset.idx = String(idx);

        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'player-thumb';
        thumbWrap.appendChild(createCoverImg(item, activeCategory, 'art-img', idx < 6));

        const info = document.createElement('div');
        info.className = 'player-info';
        const title = document.createElement('p');
        title.className = 'grid-title';
        title.textContent = item.title || '';
        const sub = document.createElement('p');
        sub.className = 'grid-sub';
        sub.textContent = `${item.creator || ''} · ${item.year || ''}`;
        const bar = document.createElement('div');
        bar.className = 'player-bar';
        const fill = document.createElement('span');
        fill.className = 'player-bar-fill';
        fill.style.width = `${45 + ((idx * 17) % 45)}%`;
        fill.style.background = item.color || 'var(--ink)';
        bar.appendChild(fill);

        info.append(title, sub, bar);
        card.append(thumbWrap, info);
        card.addEventListener('click', () => selectItem(idx));
        grid.appendChild(card);
      });
      mediaStage.appendChild(grid);
      return;
    }

    // 4. Vinyl（黑胶 / 白胶半抽出）/ Covers / Posters / 3D Books / VHS / Scenes 网格模式
    const grid = document.createElement('div');
    grid.className = `media-grid${activeLook === 'vinyl' ? ' is-vinyl-grid' : activeLook === 'scenes' ? ' is-scenes-grid' : ''}`;

    const isPosterRatio = (activeCategory === 'movies' || activeCategory === 'tv' || activeCategory === 'books') && activeLook === 'covers';
    const isBook3D = activeLook === 'books';
    const isVhs = activeLook === 'vhs';
    const isScene = activeLook === 'scenes';

    visibleItems.forEach((item, idx) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `grid-card${idx === activeItemIndex ? ' is-selected' : ''}`;
      card.dataset.idx = String(idx);

      const artWrap = document.createElement('div');
      artWrap.className = `art-wrap${isPosterRatio ? ' is-poster' : ''}${isBook3D ? ' is-book3d' : ''}${isVhs ? ' is-vhs' : ''}${isScene ? ' is-scene' : ''}`;

      if (isVhs) {
        const banner = document.createElement('div');
        banner.className = 'vhs-banner';
        banner.innerHTML = '<span>VHS</span><span>HI-FI</span>';
        artWrap.appendChild(banner);
      }

      artWrap.appendChild(createCoverImg(item, activeCategory, 'art-img', idx < 8));

      if (activeLook === 'vinyl') {
        const isWhite = getVinylVariant(item) === 'white';
        const sleeveWrap = document.createElement('div');
        sleeveWrap.className = 'vinyl-sleeve-wrap';
        const disc = document.createElement('div');
        disc.className = `vinyl-disc${isWhite ? ' is-white-vinyl' : ''}`;
        disc.style.setProperty('--disc-accent', item.accent || '#ffd60a');
        const discLabel = document.createElement('div');
        discLabel.className = 'vinyl-disc-label';
        discLabel.appendChild(createCoverImg(item, activeCategory, '', idx < 6));
        disc.appendChild(discLabel);
        sleeveWrap.append(artWrap, disc);
        card.appendChild(sleeveWrap);
      } else {
        card.appendChild(artWrap);
      }

      const meta = document.createElement('div');
      meta.className = 'grid-meta';
      const title = document.createElement('p');
      title.className = 'grid-title';
      title.textContent = item.title || '';
      const sub = document.createElement('p');
      sub.className = 'grid-sub';
      sub.textContent = item.creator || '';
      meta.append(title, sub);

      const fmts = itemFormats(item);
      if (fmts.length > 0) {
        const badges = document.createElement('div');
        badges.className = 'grid-formats';
        const displayFmts = activeLook === 'vinyl'
          ? fmts.filter(f => f === 'black-vinyl' || f === 'white-vinyl' || f === 'color-vinyl')
          : fmts;
        appendFormatBadges(badges, displayFmts.length > 0 ? displayFmts : fmts, true);
        meta.appendChild(badges);
      }

      card.appendChild(meta);
      card.addEventListener('click', () => selectItem(idx));
      grid.appendChild(card);
    });

    mediaStage.appendChild(grid);
  }

  // 更新 Spotlight 详情卡
  function updateSpotlight(itemOverride, idxOverride) {
    const spotlightEl = document.getElementById('spotlight');
    const idx = idxOverride !== undefined ? idxOverride : activeItemIndex;
    const item = itemOverride || visibleItems[idx];
    if (!spotlightEl) return;
    if (!item) {
      spotlightEl.hidden = true;
      return;
    }
    spotlightEl.hidden = false;

    const coverWrap = document.getElementById('spotlight-cover-wrap');
    if (coverWrap) {
      coverWrap.textContent = '';
      coverWrap.appendChild(createCoverImg(item, activeCategory, 'art-img', true));
    }

    const pad = n => String(n).padStart(2, '0');
    setText('spotlight-rank', `#${pad(idx + 1)}`);
    setText('spotlight-year', activeCategory === 'tickets' ? (item.date || item.year || '') : (item.year || ''));

    const ratingEl = document.getElementById('spotlight-rating');
    if (ratingEl) {
      if (activeCategory === 'tickets') {
        const ticketMeta = [item.city, item.price].filter(Boolean).join(' · ');
        ratingEl.textContent = ticketMeta;
        ratingEl.hidden = !ticketMeta;
      } else {
        ratingEl.textContent = '';
        ratingEl.hidden = true;
      }
    }

    const formatsEl = document.getElementById('spotlight-formats');
    if (formatsEl) {
      formatsEl.textContent = '';
      if (activeCategory === 'tickets') {
        if (item.seat) {
          const seatTag = document.createElement('span');
          seatTag.className = 'format-tag fmt-ticket';
          seatTag.textContent = item.seat;
          formatsEl.appendChild(seatTag);
        }
        if (item.isSample) {
          const sp = document.createElement('span');
          sp.className = 'ticket-sample-pill is-inline';
          sp.textContent = '示例票根';
          formatsEl.appendChild(sp);
        }
      } else {
        appendFormatBadges(formatsEl, itemFormats(item));
      }
    }

    setText('spotlight-title', item.title || '');
    setText(
      'spotlight-creator',
      activeCategory === 'tickets'
        ? [item.creator, item.venue].filter(Boolean).join(' · ')
        : (item.creator || '')
    );

    const editionEl = document.getElementById('spotlight-edition');
    if (editionEl) {
      const editionText = activeCategory === 'tickets'
        ? (item.serial ? `票号 ${item.serial}` : '')
        : (item.edition || '');
      editionEl.textContent = editionText;
      editionEl.hidden = !editionText;
    }

    setText('spotlight-note', item.note || '');
  }

  document.getElementById('spot-prev')?.addEventListener('click', () => {
    if (visibleItems.length === 0) return;
    selectItem((activeItemIndex - 1 + visibleItems.length) % visibleItems.length, true);
  });

  document.getElementById('spot-next')?.addEventListener('click', () => {
    if (visibleItems.length === 0) return;
    selectItem((activeItemIndex + 1) % visibleItems.length, true);
  });

  // 渲染底部完整列表索引 #titles
  const titlesEl = document.getElementById('titles');
  function renderIndexList() {
    if (!titlesEl) return;
    titlesEl.textContent = '';
    setText('index-summary', `Showing ${visibleItems.length} items`);

    visibleItems.forEach((item, idx) => {
      const li = document.createElement('li');
      li.className = `line${idx === activeItemIndex ? ' is-selected' : ''}`;
      li.dataset.idx = String(idx);

      const mark = document.createElement('div');
      mark.className = 'line-mark';
      mark.appendChild(createCoverImg(item, activeCategory, '', idx < 10));

      const num = document.createElement('span');
      num.className = 'line-num';
      num.textContent = String(idx + 1);

      const meta = document.createElement('div');
      meta.className = 'line-meta';
      const title = document.createElement('p');
      title.className = 'line-title';
      title.textContent = item.title || '';
      const who = document.createElement('p');
      who.className = 'line-who';
      who.textContent = activeCategory === 'tickets'
        ? [item.creator, item.date || item.year, item.city].filter(Boolean).join(' · ')
        : [item.creator, item.year].filter(Boolean).join(' · ');
      meta.append(title, who);

      const fmts = itemFormats(item);
      if (fmts.length > 0) {
        const tagWrap = document.createElement('div');
        tagWrap.className = 'line-formats';
        appendFormatBadges(tagWrap, fmts, true);
        li.append(mark, num, meta, tagWrap);
      } else {
        li.append(mark, num, meta);
      }

      li.addEventListener('click', () => selectItem(idx, true));
      titlesEl.appendChild(li);
    });
  }

  function renderAll() {
    computeVisibleItems();
    const cat = categories[activeCategory] || {};
    const looks = getAvailableLooks(activeCategory);
    const currentLookObj = looks.find(l => l.id === activeLook);

    setText('shelf-heading', `${cat.label || activeCategory} · ${cat.cnLabel || ''}`);
    setText('category-count', String(visibleItems.length));

    let subLabel = '全部馆藏';
    if (cat.filterMode === 'format') {
      const allCatItems = Array.isArray(cat.items) ? cat.items : [];
      subLabel = activeSubFilter === 'all'
        ? (getLookDisplayLabel(currentLookObj, allCatItems) || '实体唱片')
        : `${FORMAT_META[activeSubFilter]?.label || activeSubFilter}`;
    } else if (activeSubFilter !== 'all') {
      subLabel = activeSubFilter;
    }

    setText('post-handle', `${handle} · ${subLabel}`);
    setText(
      'well-label',
      activeCategory === 'tickets'
        ? 'Preview · Concert Ticket Stubs'
        : cat.filterMode === 'format'
          ? 'Preview · Owned Physical Media'
          : 'Preview · Physical Shelf'
    );

    if (cat.filterMode === 'format') {
      const cdCount = visibleItems.filter(it => itemHasFormat(it, 'cd')).length;
      const blackCount = visibleItems.filter(it => itemHasFormat(it, 'black-vinyl')).length;
      const whiteCount = visibleItems.filter(it => itemHasFormat(it, 'white-vinyl')).length;
      const parts = [];
      if (activeLook === 'cds') {
        if (cdCount) parts.push(`CD ${cdCount}`);
      } else if (activeLook === 'vinyl' || activeLook === 'spin') {
        if (blackCount) parts.push(`黑胶 ${blackCount}`);
        if (whiteCount) parts.push(`白胶 ${whiteCount}`);
      } else {
        if (cdCount) parts.push(`CD ${cdCount}`);
        if (blackCount) parts.push(`黑胶 ${blackCount}`);
        if (whiteCount) parts.push(`白胶 ${whiteCount}`);
      }
      const statStr = parts.length ? `（${parts.join(' · ')}）` : '';
      setText('post-caption', `${cat.cnLabel || '实体唱片'} · ${visibleItems.length} 张${statStr}`);
    } else if (activeCategory === 'tickets') {
      setText('post-caption', `演出票根 · ${visibleItems.length} 场现场记录`);
    } else {
      setText('post-caption', `${cat.cnLabel || cat.label || activeCategory} · ${visibleItems.length} 项记录`);
    }

    syncJacketToggleVisibility();
    renderStage();
    updateSpotlight();
    renderIndexList();
  }

  // 一键导出排架高清 PNG 海报 (#download-png)
  document.getElementById('download-png')?.addEventListener('click', () => {
    if (visibleItems.length === 0) return;
    const cat = categories[activeCategory] || {};
    const isDark = rootEl.getAttribute('data-theme') === 'dark';
    const cols = Math.min(12, Math.max(6, visibleItems.length));
    const rows = Math.ceil(visibleItems.length / cols);
    const spineW = 62;
    const spineH = 340;
    const gapX = 12;
    const gapY = 28;
    const padX = 60;
    const padY = 110;
    const width = Math.max(760, padX * 2 + cols * spineW + (cols - 1) * gapX);
    const height = padY + rows * spineH + (rows - 1) * gapY + 70;

    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const ctx = out.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = isDark ? '#131311' : '#f3f2ed';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = isDark ? '#f3f2ed' : '#131311';
    ctx.font = '700 28px "Space Grotesk", "Noto Sans SC", sans-serif';
    ctx.fillText(`${siteName} · ${shelfTitle} · ${cat.cnLabel || cat.label || activeCategory} (${visibleItems.length})`, padX, 58);

    ctx.fillStyle = isDark ? '#8a877e' : '#6a675f';
    ctx.font = '500 15px "JetBrains Mono", sans-serif';
    ctx.fillText(`${handle} · ${new Date().getFullYear()}`, padX, 84);

    visibleItems.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = padX + col * (spineW + gapX);
      const y = padY + row * (spineH + gapY);
      const bg = item.color || '#1f2937';
      const ink = getSpineInk(bg);

      ctx.fillStyle = bg;
      ctx.fillRect(x, y, spineW, spineH);

      ctx.fillStyle = item.accent || '#ffd60a';
      ctx.fillRect(x, y, spineW, 12);

      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(x, y, 7, spineH);

      ctx.save();
      ctx.translate(x + spineW / 2, y + 48);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = ink;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '700 14px "Space Grotesk", "Noto Sans SC", sans-serif';
      ctx.fillText(String(item.title || '').slice(0, 18), 0, 0);
      ctx.restore();

      const badgeText = activeCategory === 'tickets'
        ? String(item.year || '')
        : itemFormats(item).map(f => FORMAT_META[f]?.shortLabel || f).join('/');
      if (badgeText) {
        ctx.fillStyle = ink;
        ctx.globalAlpha = 0.72;
        ctx.font = '600 9px "JetBrains Mono", "Noto Sans SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(badgeText.slice(0, 8), x + spineW / 2, y + spineH - 12);
        ctx.globalAlpha = 1;
      }
    });

    const link = document.createElement('a');
    link.download = `${siteName.toLowerCase()}-shelf-${activeCategory}.png`;
    link.href = out.toDataURL('image/png');
    link.click();
  });

  // 顶部旋转线框地球仪 (#globe)
  const globeCanvas = document.getElementById('globe');
  if (globeCanvas) {
    const gCtx = globeCanvas.getContext('2d');
    let angle = 0;
    const drawGlobe = () => {
      if (!gCtx) return;
      const w = globeCanvas.width;
      const h = globeCanvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const r = w * 0.42;
      const isDark = rootEl.getAttribute('data-theme') === 'dark';

      gCtx.clearRect(0, 0, w, h);
      gCtx.strokeStyle = isDark ? 'rgba(243,242,237,0.28)' : 'rgba(19,19,17,0.22)';
      gCtx.lineWidth = 1.3;

      gCtx.beginPath();
      gCtx.arc(cx, cy, r, 0, Math.PI * 2);
      gCtx.stroke();

      [-0.5, 0, 0.5].forEach(lat => {
        const y = cy + lat * r;
        const rx = Math.sqrt(Math.max(0, r * r - (lat * r) * (lat * r)));
        gCtx.beginPath();
        gCtx.ellipse(cx, y, rx, rx * 0.22, 0, 0, Math.PI * 2);
        gCtx.stroke();
      });

      for (let i = 0; i < 3; i++) {
        const a = angle + (i * Math.PI) / 3;
        const rx = Math.abs(Math.cos(a)) * r;
        gCtx.beginPath();
        gCtx.ellipse(cx, cy, Math.max(1, rx), r, 0, 0, Math.PI * 2);
        gCtx.stroke();
      }

      angle += 0.012;
      requestAnimationFrame(drawGlobe);
    };
    requestAnimationFrame(drawGlobe);
  }

  renderTabs();
  renderSubFilters();
  renderLooks();
  renderAll();
})();
