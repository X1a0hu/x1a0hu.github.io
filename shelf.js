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

  // 构建侧脊元素（CDs / Tapes / DVD / 书脊）
  function buildSpineElement(item, index, spineType) {
    const btn = document.createElement('button');
    const typoClasses = ['', 'typo-serif', 'typo-upper', 'typo-italic', 'typo-serif'];
    const typoClass = typoClasses[index % typoClasses.length];
    btn.type = 'button';
    btn.className = `spine-item spine-${spineType}${typoClass ? ` ${typoClass}` : ''}${index === activeItemIndex ? ' is-selected' : ''}`;
    btn.dataset.idx = String(index);
    btn.setAttribute('aria-label', `#${index + 1} ${item.title} - ${item.creator}`);

    const paperColor = item.color || '#1f2937';
    const paperInk = getSpineInk(paperColor);

    if (spineType === 'cd') {
      const paper = document.createElement('div');
      paper.className = 'case-paper';
      paper.style.background = paperColor;
      paper.style.color = paperInk;

      const artTop = document.createElement('div');
      artTop.className = 'cd-art-top';
      artTop.appendChild(createCoverImg(item, activeCategory, '', index < 10));

      const textWrap = document.createElement('div');
      textWrap.className = 'cd-text';

      const artistText = String(item.creator || '');
      const titleText = String(item.title || '');
      const artist = document.createElement('span');
      artist.className = 'cd-artist';
      artist.textContent = artistText;

      const title = document.createElement('span');
      title.className = 'cd-title';
      title.textContent = titleText;

      // 根据中英文字符视觉长度自适应字号，避免超长专辑名在侧脊首尾被裁切
      const visualLen = str => [...str].reduce((n, ch) => n + (/[\u4e00-\u9fff]/.test(ch) ? 1.55 : 0.72), 0);
      const totalLen = visualLen(artistText) + visualLen(titleText);
      if (totalLen > 24) {
        artist.style.fontSize = '9px';
        title.style.fontSize = '10px';
        textWrap.style.gap = '4px';
      } else if (totalLen > 17) {
        artist.style.fontSize = '10px';
        title.style.fontSize = '11px';
        textWrap.style.gap = '5px';
      }

      if (paperColor === '#101012' && item.accent) {
        title.style.color = item.accent;
      }

      textWrap.append(artist, title);

      const cat = document.createElement('span');
      cat.className = 'cd-cat';
      cat.textContent = item.year || 'CD';

      paper.append(artTop, textWrap, cat);
      btn.appendChild(paper);

      btn.addEventListener('click', () => selectItem(index, true));
      btn.addEventListener('pointerenter', () => updateSpotlight(item, index));
      return btn;
    }

    if (spineType === 'tape') {
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

    btn.style.background = `linear-gradient(180deg, ${paperColor} 0%, color-mix(in srgb, ${paperColor} 76%, #000) 100%)`;

    const bgCover = createCoverImg(item, activeCategory, 'spine-bg', index < 8);
    bgCover.setAttribute('aria-hidden', 'true');
    btn.appendChild(bgCover);

    if (spineType === 'dvd') {
      const dvdHead = document.createElement('span');
      dvdHead.className = 'dvd-header';
      dvdHead.textContent = 'DVD';
      btn.appendChild(dvdHead);
    }

    const inner = document.createElement('div');
    inner.className = 'spine-inner';

    if (spineType === 'book') {
      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'spine-thumb';
      thumbWrap.appendChild(createCoverImg(item, activeCategory, '', index < 8));
      inner.appendChild(thumbWrap);
    }

    const textWrap = document.createElement('div');
    textWrap.className = 'spine-text';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'spine-title';
    titleSpan.textContent = item.title || '';

    const creatorSpan = document.createElement('span');
    creatorSpan.className = 'spine-creator';
    creatorSpan.textContent = item.creator || '';

    textWrap.append(titleSpan, creatorSpan);

    const foot = document.createElement('span');
    foot.className = 'spine-foot';
    foot.style.color = item.accent || '#ffffff';
    foot.textContent = spineType === 'dvd' ? 'HD' : String(item.year || '').slice(-2);

    inner.append(textWrap, foot);
    btn.appendChild(inner);

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
