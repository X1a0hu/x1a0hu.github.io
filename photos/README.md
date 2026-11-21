# 画廊图片目录 (`photos/`)

将你要展示的照片或实况视频放入此文件夹，然后在根目录的 `gallery.config.js` 中添加或修改条目即可。

## 推荐格式与尺寸

- **静态照片**：推荐 `.webp` 或 `.jpg`（宽度 `1200px ~ 1920px` 即可，兼顾清晰度与加载速度）。
- **实况照片（Live Photo）**：准备一张封面静态图（如 `moment-01.jpg`）和一段 `1.5 ~ 3` 秒的短视频（如 `moment-01.mp4`），在 `gallery.config.js` 中同时填写 `image` 与 `liveVideo` 字段，卡片会自动显示 `LIVE` 实况标识并支持悬停/长按播放。
