// 手记（笔记）页面逻辑：支持分类筛选与纯文本 Markdown (.md) 即时排版渲染
(() => {
  'use strict';

  const siteCfg = window.SITE_CONFIG || {};
  const notesCfg = window.NOTES_CONFIG || {};
  const items = Array.isArray(notesCfg.items) ? notesCfg.items : [];

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.textContent = val;
  };

  const siteName = siteCfg.name || 'HULAB';
  setText('notes-title', notesCfg.title || '手记');
  setText('notes-subtitle', notesCfg.subtitle);
  setText('notes-count', `共 ${items.length} 篇记录`);

  const listSection = document.getElementById('notes-index-view');
  const readerSection = document.getElementById('notes-reader-view');
  const listEl = document.getElementById('notes-list');
  const filterBar = document.getElementById('notes-filters');
  const proseEl = document.getElementById('reader-prose');

  let activeTag = 'all';

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatInline(raw) {
    let s = escapeHtml(raw);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\.\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
    return s;
  }

  // 轻量安全的 Markdown 转 HTML 解析器
  function renderMarkdown(md) {
    const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let inCode = false;
    let codeBuf = [];
    let listType = null;
    let paraBuf = [];

    const flushPara = () => {
      if (paraBuf.length > 0) {
        out.push(`<p>${formatInline(paraBuf.join(' '))}</p>`);
        paraBuf = [];
      }
    };

    const closeList = () => {
      if (listType) {
        out.push(`</${listType}>`);
        listType = null;
      }
    };

    for (const line of lines) {
      if (line.trim().startsWith('```')) {
        flushPara();
        closeList();
        if (!inCode) {
          inCode = true;
          codeBuf = [];
        } else {
          out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
          inCode = false;
        }
        continue;
      }

      if (inCode) {
        codeBuf.push(line);
        continue;
      }

      const trimmed = line.trim();
      if (!trimmed) {
        flushPara();
        closeList();
        continue;
      }

      if (/^---+$/.test(trimmed)) {
        flushPara();
        closeList();
        out.push('<hr />');
        continue;
      }

      const hMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
      if (hMatch) {
        flushPara();
        closeList();
        const level = Math.min(3, hMatch[1].length + 1); // 文章内 # 渲染为 h2，保持单页唯一 h1
        out.push(`<h${level}>${formatInline(hMatch[2])}</h${level}>`);
        continue;
      }

      if (trimmed.startsWith('>')) {
        flushPara();
        closeList();
        out.push(`<blockquote><p>${formatInline(trimmed.replace(/^>\s*/, ''))}</p></blockquote>`);
        continue;
      }

      const ulMatch = /^[-*]\s+(.+)$/.exec(trimmed);
      if (ulMatch) {
        flushPara();
        if (listType !== 'ul') {
          closeList();
          listType = 'ul';
          out.push('<ul>');
        }
        out.push(`<li>${formatInline(ulMatch[1])}</li>`);
        continue;
      }

      const olMatch = /^\d+\.\s+(.+)$/.exec(trimmed);
      if (olMatch) {
        flushPara();
        if (listType !== 'ol') {
          closeList();
          listType = 'ol';
          out.push('<ol>');
        }
        out.push(`<li>${formatInline(olMatch[1])}</li>`);
        continue;
      }

      closeList();
      paraBuf.push(trimmed);
    }

    flushPara();
    closeList();
    if (inCode && codeBuf.length > 0) {
      out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
    }
    return out.join('\n');
  }

  function renderFilters() {
    if (!filterBar) return;
    filterBar.textContent = '';
    const tags = ['all', ...new Set(items.map(i => i.tag).filter(Boolean))];
    if (tags.length <= 2) {
      filterBar.hidden = true;
      return;
    }
    filterBar.hidden = false;
    tags.forEach(tag => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `note-filter-btn${tag === activeTag ? ' is-active' : ''}`;
      btn.textContent = tag === 'all' ? '全部' : tag;
      btn.addEventListener('click', () => {
        activeTag = tag;
        renderFilters();
        renderList();
      });
      filterBar.appendChild(btn);
    });
  }

  function renderList() {
    if (!listEl) return;
    listEl.textContent = '';
    const visible = activeTag === 'all' ? items : items.filter(i => i.tag === activeTag);

    visible.forEach(item => {
      const a = document.createElement('a');
      a.className = 'note-row';
      a.href = `./notes.html?post=${encodeURIComponent(item.slug)}`;
      a.addEventListener('click', e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        openPost(item.slug, true);
      });

      const date = document.createElement('time');
      date.className = 'note-date';
      date.textContent = item.date || '';

      const body = document.createElement('div');
      body.className = 'note-row-body';
      const title = document.createElement('h2');
      title.className = 'note-row-title';
      title.textContent = item.title || '';
      body.appendChild(title);

      if (item.summary) {
        const sum = document.createElement('p');
        sum.className = 'note-row-summary';
        sum.textContent = item.summary;
        body.appendChild(sum);
      }

      a.append(date, body);

      if (item.tag) {
        const tag = document.createElement('span');
        tag.className = 'note-tag';
        tag.textContent = item.tag;
        a.appendChild(tag);
      }

      listEl.appendChild(a);
    });
  }

  async function openPost(slug, pushUrl = false) {
    const post = items.find(i => i.slug === slug);
    if (!post) {
      showIndex(pushUrl);
      return;
    }

    if (pushUrl) {
      const url = new URL(location.href);
      url.searchParams.set('post', slug);
      history.pushState({ post: slug }, '', url);
    }

    document.title = `${post.title} · ${notesCfg.title || '手记'} · ${siteName}`;
    if (listSection) listSection.hidden = true;
    if (readerSection) readerSection.hidden = false;

    setText('reader-date', post.date || '');
    setText('reader-tag', post.tag || '');
    setText('reader-title', post.title || '');
    if (proseEl) proseEl.innerHTML = '<p>正在加载内容…</p>';

    try {
      if (post.content) {
        if (proseEl) proseEl.innerHTML = renderMarkdown(post.content);
      } else if (post.file) {
        const res = await fetch(post.file);
        if (!res.ok) throw new Error('Failed to load markdown');
        const md = await res.text();
        if (proseEl) proseEl.innerHTML = renderMarkdown(md);
      }
    } catch {
      if (proseEl) proseEl.innerHTML = `<p>${escapeHtml(post.summary || '暂时无法加载正文内容。')}</p>`;
    }

    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function showIndex(pushUrl = false) {
    if (pushUrl) {
      const url = new URL(location.href);
      url.searchParams.delete('post');
      history.pushState({}, '', url);
    }
    document.title = `${notesCfg.title || '手记'} · ${siteName}`;
    if (readerSection) readerSection.hidden = true;
    if (listSection) listSection.hidden = false;
  }

  document.getElementById('reader-back')?.addEventListener('click', e => {
    e.preventDefault();
    showIndex(true);
  });

  window.addEventListener('popstate', () => {
    const slug = new URLSearchParams(location.search).get('post');
    if (slug) openPost(slug, false);
    else showIndex(false);
  });

  renderFilters();
  renderList();

  const initialSlug = new URLSearchParams(location.search).get('post');
  if (initialSlug) {
    openPost(initialSlug, false);
  }
})();
