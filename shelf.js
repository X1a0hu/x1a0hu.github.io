(() => {
  'use strict';

  const siteConfig = window.SITE_CONFIG || {};
  const shelfConfig = window.SHELF_CONFIG || {};
  const categories = shelfConfig.categories || {};
  const categoryKeys = Object.keys(categories);

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

  // 状态管理
  const params = new URLSearchParams(location.search);
  const initialKind = params.get('kind');
  let activeCategory = categories[initialKind] ? initialKind : (shelfConfig.defaultCategory || categoryKeys[0] || 'albums');
  let activeLook = categories[activeCategory]?.defaultLook || 'cds';
  let activeEra = 'all';
  let searchQuery = '';
  let showNumbers = false;
  let showTitles = true;
  let showJacket = false;
  let activeItemIndex = 0;
  let visibleItems = [];

  // 本地封面缓存（用于用户日后新增条目未手填 cover 时自动拉取官方封面）
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
    if (item?.cover) return item.cover;
    const cacheId = `${catKey}:${item?.title || ''}::${item?.creator || ''}`;
    return coverCache[cacheId] || '';
  }

  async function autoFetchCoverIfMissing(item, catKey, imgEl) {
    if (!item || item.cover) return;
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

  // 主题管理（默认暖白亮色，支持一键切换暗黑主题）
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

  // 顶部开关：封面展开、Aa 标题栏、# 序号
  const mediaStage = document.getElementById('media-stage');

  const jacketBtn = document.getElementById('toggle-jacket');
  jacketBtn?.addEventListener('click', () => {
    showJacket = !showJacket;
    jacketBtn.classList.toggle('is-on', showJacket);
    jacketBtn.setAttribute('aria-pressed', String(showJacket));
    renderStage();
  });

  const titlesBtn = document.getElementById('toggle-titles');
  titlesBtn?.addEventListener('click', () => {
    showTitles = !showTitles;
    titlesBtn.classList.toggle('is-on', showTitles);
    titlesBtn.setAttribute('aria-pressed', String(showTitles));
    mediaStage?.classList.toggle('hide-titles', !showTitles);
  });

  const numBtn = document.getElementById('toggle-numbers');
  numBtn?.addEventListener('click', () => {
    showNumbers = !showNumbers;
    numBtn.classList.toggle('is-on', showNumbers);
    numBtn.setAttribute('aria-pressed', String(showNumbers));
    mediaStage?.classList.toggle('hide-numbers', !showNumbers);
  });

  // 兜底 Canvas 封面生成器（仅当离线或无封面时触发）
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

  // 构建真实封面 <img> 元素（带自动检索与无图兜底）
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

  // 渲染 5 大分类导航 Tabs（展示各分类真实微缩封面）
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
      const count = key === 'books' ? 6 : key === 'albums' ? 3 : 4;
      const items = Array.isArray(cat.items) ? cat.items : [];
      for (let i = 0; i < count; i++) {
        const swatch = document.createElement('i');
        const sample = items[i] || {};
        swatch.style.background = sample.color || '#334155';
        const thumbUrl = getResolvedCover(sample, key);
        if (thumbUrl) {
          const thumbImg = document.createElement('img');
          thumbImg.src = thumbUrl;
          thumbImg.alt = '';
          thumbImg.loading = 'lazy';
          thumbImg.referrerPolicy = 'no-referrer';
          swatch.appendChild(thumbImg);
        }
        mini.appendChild(swatch);
      }

      const label = document.createElement('span');
      label.textContent = cat.label || key;

      btn.append(mini, label);
      btn.addEventListener('click', () => {
        if (activeCategory === key) return;
        activeCategory = key;
        activeLook = categories[key]?.defaultLook || categories[key]?.looks?.[0]?.id || 'covers';
        activeItemIndex = 0;
        const url = new URL(location.href);
        url.searchParams.set('kind', key);
        history.replaceState(null, '', url);
        renderTabs();
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
  };

  const lookBarEl = document.getElementById('look');
  function renderLooks() {
    if (!lookBarEl) return;
    lookBarEl.textContent = '';
    const cat = categories[activeCategory];
    const looks = Array.isArray(cat?.looks) ? cat.looks : [];

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
      txt.textContent = look.label;
      btn.append(swatch, txt);

      btn.addEventListener('click', () => {
        if (activeLook === look.id) return;
        activeLook = look.id;
        renderLooks();
        renderStage();
      });

      lookBarEl.appendChild(btn);
    });
  }

  // Era 时间范围筛选 & 搜索框
  document.querySelectorAll('#era-picker .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeEra = btn.dataset.era || 'all';
      activeItemIndex = 0;
      document.querySelectorAll('#era-picker .seg-btn').forEach(b => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      renderAll();
    });
  });

  const filterInput = document.getElementById('shelf-filter');
  filterInput?.addEventListener('input', () => {
    searchQuery = filterInput.value.trim().toLowerCase();
    activeItemIndex = 0;
    renderAll();
  });

  function computeVisibleItems() {
    const cat = categories[activeCategory];
    let list = Array.isArray(cat?.items) ? [...cat.items] : [];
    if (activeEra === '2026') {
      list = list.filter(item => item.era === '2026');
    }
    if (searchQuery) {
      list = list.filter(item =>
        [item.title, item.creator, item.year, item.note]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(searchQuery))
      );
    }
    visibleItems = list;
    if (activeItemIndex >= visibleItems.length) {
      activeItemIndex = Math.max(0, visibleItems.length - 1);
    }
  }

  const SPINE_MAP = { cds: 'cd', tapes: 'tape', dvd: 'dvd', spines: 'book' };

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

    // 若当前处于 Vinyl Spin 模式，同步更新唱机封套与唱片中心真实封面贴纸
    const item = visibleItems[activeItemIndex];
    const spinSleeve = mediaStage?.querySelector('.spin-sleeve');
    const spinLabel = mediaStage?.querySelector('.spin-label');
    if (spinSleeve && item) {
      spinSleeve.textContent = '';
      spinSleeve.appendChild(createCoverImg(item, activeCategory, 'art-img', true));
    }
    if (spinLabel && item) {
      spinLabel.style.background = item.accent || '#ffd60a';
      spinLabel.querySelector('img')?.remove();
      spinLabel.prepend(createCoverImg(item, activeCategory, '', true));
    }

    updateSpotlight(item, activeItemIndex);
  }

  // 构建展开的正面专辑/影视/书籍封面页（.active-jacket）
  function buildActiveJacket(item, index) {
    const isPoster = activeCategory === 'movies' || activeCategory === 'tv' || activeCategory === 'books';
    const wrap = document.createElement('div');
    wrap.className = `active-jacket${isPoster ? ' is-poster' : ''}`;

    const badge = document.createElement('span');
    badge.className = 'rank-badge';
    badge.style.top = '8px';
    badge.style.left = '8px';
    badge.style.transform = 'none';
    badge.textContent = String(index + 1);

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

    wrap.append(badge, img, cap);
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

  // 构建侧脊元素：1:1 复刻源站晶透塑料壳 + 实色纸卡（CDs / Tapes / DVD / 书脊）
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

    const badge = document.createElement('span');
    badge.className = 'rank-badge';
    badge.textContent = String(index + 1);
    btn.appendChild(badge);

    // 1. CD 晶透塑料壳 + 实色纸卡侧脊
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

      const artist = document.createElement('span');
      artist.className = 'cd-artist';
      artist.textContent = item.creator || '';

      const title = document.createElement('span');
      title.className = 'cd-title';
      title.textContent = item.title || '';

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

    // 2. 磁带 Norelco 晶透卡带盒 + 大号歌手名 + 标题 + 底部无边框渐隐封面
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

    // 3. DVD 与 书籍侧脊
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

  // 渲染核心拟物舞台 #media-stage
  function renderStage() {
    if (!mediaStage) return;
    mediaStage.textContent = '';
    mediaStage.classList.toggle('hide-numbers', !showNumbers);
    mediaStage.classList.toggle('hide-titles', !showTitles);

    if (visibleItems.length === 0) {
      const empty = document.createElement('p');
      empty.style.textAlign = 'center';
      empty.style.color = 'var(--g500)';
      empty.style.padding = '48px 16px';
      empty.textContent = '没有找到匹配当前筛选条件的作品。';
      mediaStage.appendChild(empty);
      return;
    }

    // 1. 侧脊排架类（CDs / Tapes / VHS / DVD / Book Spines）+ 选中项的真实正面封面页
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

    // 2. Vinyl Spin 动态旋转黑胶唱机模式（真实专辑封套 + 中心带真实封面的旋转黑胶）
    if (activeLook === 'spin') {
      const activeItem = visibleItems[activeItemIndex] || visibleItems[0];
      const stage = document.createElement('div');
      stage.className = 'turntable-stage';

      const platter = document.createElement('div');
      platter.className = 'platter-zone';

      const sleeve = document.createElement('div');
      sleeve.className = 'spin-sleeve';
      sleeve.appendChild(createCoverImg(activeItem, activeCategory, 'art-img', true));

      const record = document.createElement('div');
      record.className = 'spin-record';
      const label = document.createElement('div');
      label.className = 'spin-label';
      label.style.background = activeItem?.accent || '#ffd60a';
      label.appendChild(createCoverImg(activeItem, activeCategory, '', true));
      const hole = document.createElement('div');
      hole.className = 'spin-hole';
      label.appendChild(hole);
      record.appendChild(label);

      platter.append(sleeve, record);

      const picker = document.createElement('div');
      picker.className = 'spin-picker';
      visibleItems.forEach((item, idx) => {
        const tBtn = document.createElement('button');
        tBtn.type = 'button';
        tBtn.className = `spin-thumb-btn${idx === activeItemIndex ? ' is-selected' : ''}`;
        tBtn.dataset.idx = String(idx);
        tBtn.title = `#${idx + 1} ${item.title}`;
        tBtn.appendChild(createCoverImg(item, activeCategory, 'art-img', idx < 8));
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
        const img = createCoverImg(item, activeCategory, 'art-img', idx < 6);
        const badge = document.createElement('span');
        badge.className = 'rank-badge';
        badge.style.top = '4px';
        badge.style.left = '4px';
        badge.style.transform = 'none';
        badge.textContent = String(idx + 1);
        thumbWrap.append(img, badge);

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

    // 4. Vinyl / Covers / Posters / 3D Books / VHS 正面纸套 / Scenes 网格模式（全部使用真实封面）
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

      const img = createCoverImg(item, activeCategory, 'art-img', idx < 8);
      const badge = document.createElement('span');
      badge.className = 'rank-badge';
      if (isVhs) badge.style.top = '24px';
      badge.textContent = String(idx + 1);
      artWrap.append(img, badge);

      if (activeLook === 'vinyl') {
        const sleeveWrap = document.createElement('div');
        sleeveWrap.className = 'vinyl-sleeve-wrap';
        const disc = document.createElement('div');
        disc.className = 'vinyl-disc';
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

      card.appendChild(meta);
      card.addEventListener('click', () => selectItem(idx));
      grid.appendChild(card);
    });

    mediaStage.appendChild(grid);
  }

  // 更新 Spotlight 详情卡（带真实高清封面）
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
    setText('spotlight-year', item.year || '');
    setText('spotlight-rating', item.rating ? `★ ${item.rating}` : '');
    setText('spotlight-title', item.title || '');
    setText('spotlight-creator', item.creator || '');
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

  // 渲染底部完整列表索引 #titles（带真实微缩封面）
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
      who.textContent = [item.creator, item.year].filter(Boolean).join(' · ');
      meta.append(title, who);

      li.append(mark, num, meta);
      li.addEventListener('click', () => selectItem(idx, true));
      titlesEl.appendChild(li);
    });
  }

  function renderAll() {
    computeVisibleItems();
    const cat = categories[activeCategory] || {};
    setText('shelf-heading', `${cat.label || activeCategory} · ${cat.cnLabel || ''}`);
    setText('category-count', String(visibleItems.length));
    setText('post-handle', `${handle} · ${activeEra === 'all' ? '全部记录' : activeEra}`);
    setText('post-caption', `${cat.cnLabel || cat.label || activeCategory} · ${visibleItems.length} 项记录`);
    renderStage();
    updateSpotlight();
    renderIndexList();
  }

  // 一键导出排架高清 PNG 海报 (#download-png)
  document.getElementById('download-png')?.addEventListener('click', () => {
    if (visibleItems.length === 0) return;
    const cat = categories[activeCategory] || {};
    const isDark = rootEl.getAttribute('data-theme') === 'dark';
    const cols = Math.min(14, Math.max(8, visibleItems.length));
    const rows = Math.ceil(visibleItems.length / cols);
    const spineW = 54;
    const spineH = 340;
    const gapX = 10;
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

      ctx.fillStyle = item.color || '#1f2937';
      ctx.fillRect(x, y, spineW, spineH);

      ctx.fillStyle = item.accent || '#ffd60a';
      ctx.fillRect(x, y, spineW, 12);

      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x, y, 7, spineH);

      if (showNumbers) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(x + 12, y + 18, spineW - 24, 22);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 12px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), x + spineW / 2, y + 33);
      }

      ctx.save();
      ctx.translate(x + spineW / 2, y + 58);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '700 14px "Space Grotesk", "Noto Sans SC", sans-serif';
      ctx.fillText(String(item.title || '').slice(0, 18), 0, 0);
      ctx.restore();
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
  renderLooks();
  renderAll();
})();
