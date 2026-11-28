// 修改此文件即可管理「手记 · 笔记」频道的文章列表。
// 以后写新文章只需两步：
// 1. 在 ./notes/ 文件夹里新建一个 .md 文本文档（直接写普通文字、# 标题、- 列表、代码块均可）；
// 2. 在下方 items 数组最前面加一条记录即可，无需修改任何网页代码。
window.NOTES_CONFIG = Object.freeze({
  eyebrow: 'NOTES & ESSAYS',
  title: '手记',
  subtitle: '留一点空间，给慢下来的想法与日常折腾记录。',
  items: [
    {
      slug: 'hello-hulab',
      title: '把散落各处的角落，收拢到同一个屋檐下',
      date: '2026.11.28',
      tag: '站务',
      summary: '重新整理了个人空间的四个房间：浮光放照片，拾音放实体唱片与演出票根，手记留给日常文字。',
      file: './notes/hello-hulab.md',
    },
  ],
});
