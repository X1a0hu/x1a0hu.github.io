// HULAB 全局统一导航与页脚挂载脚本（改一处即可全站同步菜单与站点信息）
(() => {
  'use strict';

  const cfg = window.SITE_CONFIG || {};
  const siteName = cfg.name || 'HULAB';
  const githubUrl = cfg.github || 'https://github.com/X1a0hu';
  const sourceUrl = cfg.source || 'https://github.com/X1a0hu/x1a0hu.github.io';

  const NAV_ITEMS = [
    { id: 'home', label: '首页', href: './' },
    { id: 'gallery', label: '画廊', href: './gallery.html', section: '浮光' },
    { id: 'shelf', label: '书影音', href: './shelf.html', section: '拾音' },
    { id: 'notes', label: '笔记', href: './notes.html', section: '手记' },
    { id: 'about', label: '关于', href: './about.html', section: '关于' },
  ];

  const headerEl = document.querySelector('[data-site-header]');
  if (headerEl) {
    const activePage = headerEl.getAttribute('data-page') || '';
    const currentItem = NAV_ITEMS.find(item => item.id === activePage);
    const sectionName = headerEl.getAttribute('data-section') || currentItem?.section || '';

    headerEl.textContent = '';

    const brand = document.createElement('a');
    brand.className = 'site-brand';
    brand.href = './';
    brand.setAttribute('aria-label', `${siteName}，回到首页`);

    const brandName = document.createElement('span');
    brandName.className = 'site-brand-name';
    brandName.textContent = siteName;
    brand.appendChild(brandName);

    if (sectionName) {
      const sep = document.createElement('span');
      sep.className = 'site-brand-sep';
      sep.setAttribute('aria-hidden', 'true');
      sep.textContent = '/';

      const sec = document.createElement('span');
      sec.className = 'site-brand-section';
      sec.textContent = sectionName;

      brand.append(sep, sec);
    }

    const nav = document.createElement('nav');
    nav.className = 'site-nav';
    nav.setAttribute('aria-label', '全站主导航');

    NAV_ITEMS.forEach(item => {
      // 首页本身已有醒目的 HULAB 品牌位，无需重复显示“首页”胶囊，保持克制
      if (item.id === 'home' && activePage === 'home') return;
      const a = document.createElement('a');
      a.className = 'site-nav-link';
      a.href = item.href;
      a.textContent = item.label;
      if (item.id === activePage) {
        a.setAttribute('aria-current', 'page');
      }
      nav.appendChild(a);
    });

    const gh = document.createElement('a');
    gh.className = 'site-nav-link';
    gh.href = githubUrl;
    gh.target = '_blank';
    gh.rel = 'noopener noreferrer';
    gh.innerHTML = '<span>GitHub</span><span class="site-nav-ext" aria-hidden="true">↗</span>';
    nav.appendChild(gh);

    headerEl.append(brand, nav);
  }

  const footerEl = document.querySelector('[data-site-footer]');
  if (footerEl) {
    const showTop = footerEl.getAttribute('data-back-top') !== 'false';
    footerEl.textContent = '';

    const copy = document.createElement('p');
    copy.textContent = `© ${new Date().getFullYear()} ${siteName}`;

    const links = document.createElement('div');
    links.className = 'site-footer-links';

    const ghLink = document.createElement('a');
    ghLink.href = githubUrl;
    ghLink.target = '_blank';
    ghLink.rel = 'noopener noreferrer';
    ghLink.textContent = 'GitHub ↗';

    const srcLink = document.createElement('a');
    srcLink.href = sourceUrl;
    srcLink.target = '_blank';
    srcLink.rel = 'noopener noreferrer';
    srcLink.textContent = 'Source ↗';

    links.append(ghLink, srcLink);

    if (showTop) {
      const topLink = document.createElement('a');
      topLink.href = '#top';
      topLink.textContent = '回到顶部 ↑';
      links.appendChild(topLink);
    }

    footerEl.append(copy, links);
  }
})();
