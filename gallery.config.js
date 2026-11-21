// 修改此文件即可更新「画廊 · 实况」页面的当下状态与照片墙内容。
// 图片建议放在 ./photos/ 目录下；支持单图、多图（images 数组）以及实况视频（liveVideo）。
window.GALLERY_CONFIG = Object.freeze({
  eyebrow: 'A VISUAL JOURNAL',
  title: '浮光',
  subtitle: '一些日常，一些偶然。\n把经过的光，留在这里。',

  // 顶部「当下实况」状态栏（如果不想展示，可将 enabled 设为 false）
  nowStatus: {
    enabled: false,
    badge: '实况 · NOW',
    text: '正在搭建个人空间的暗房画廊，把日常随手拍和即时想法慢慢收纳进这里。',
    updatedAt: '2026.11.21',
    mood: '🌌 夜间模式',
  },

  // 照片墙条目：
  // - liveVideo: './photos/xxx.mp4' 开启 LIVE 标识；悬停预览，或在大图中点击播放
  // - images: 可选多图数组，点击卡片进入暗房灯箱后可左右翻看同一组照片
  items: [
    {
      id: 'night-universe',
      title: '静夜微光',
      note: '深夜关掉主灯之后，屏幕和窗外的天色刚好连成同一片深蓝。记下这一刻的安静。',
      date: '2026.11.21 · 22:15',
      tag: '实况',
      location: '窗边',
      meta: '24mm · f/1.4 · ISO 800',
      live: true,
      image: './photos/night-sky.svg',
      images: [
        './photos/night-sky.svg',
        './photos/coast-sunset.svg',
      ],
    },
    {
      id: 'rainy-bokeh',
      title: '雨夜玻璃上的散景',
      note: '下班路上的阵雨，隔着起雾的车窗拍了一张路灯虚焦。色彩比肉眼看到的还要柔和。',
      date: '2026.11.19 · 19:42',
      tag: '光影',
      location: '街角',
      meta: '50mm · f/1.8 · LIVE',
      live: true,
      image: './photos/rain-window.svg',
    },
    {
      id: 'late-night-desk',
      title: '凌晨一点的桌面实况',
      note: '咖啡还剩半杯，把个人主页的流体动画和画廊结构理顺了。循着直觉，让想法发生。',
      date: '2026.11.16 · 01:10',
      tag: '折腾',
      location: '书桌',
      meta: 'Desk Setup · Coding',
      live: false,
      image: './photos/late-desk.svg',
    },
    {
      id: 'coast-dusk',
      title: '日落前的最后十分钟',
      note: '太阳沉到海平线附近时，天际从冷灰慢慢烧成暖橘色。吹了一会儿风，什么也没想。',
      date: '2026.11.12 · 17:36',
      tag: '旅途',
      location: '海岸线',
      meta: '35mm · f/2.0 · Golden Hour',
      live: true,
      image: './photos/coast-sunset.svg',
    },
  ],
});
