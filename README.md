# HULAB · 个人空间

参考 Gx404 的一屏式个人主页，包含 WebGL 流体动画，以及 GitHub、项目、画廊、书影音、笔记和关于入口。

## 文件

- `index.html`：首页，以及笔记和关于弹窗。
- `gallery.html`、`gallery.css`、`gallery.js`、`gallery.config.js`：画廊「浮光」的暗房 35mm 胶卷与灯箱页面；照片放入 `photos/` 并在 `gallery.config.js` 中追加条目。
- `shelf.html`、`shelf.css`、`shelf.js`、`shelf.config.js`、`covers/`：书影音、实体唱片架（按实际拥有的 CD / 黑胶 / 白胶载体严格过滤与拟物呈现）及演出票根墙页面。在 `shelf.config.js` 中修改或追加作品与票根即可自动上架。
- `site.config.js`：名字、简介和 GitHub 地址。
- `styles.css`：桌面和手机布局。
- `app.js`：弹窗、动画控制、配置和无障碍交互。
- `vendor/fluid.js`：含 MIT 许可证的 WebGL 流体渲染器。
- `notes.html`、`about.html`：支持直接打开、禁用 JavaScript 时仍可访问的页面。

本站为静态页面，可直接预览。字体使用 Google Fonts，书影音支持外部封面图片。

## 本地查看

可以直接打开 `index.html`。推荐通过任意静态服务器预览，例如已安装 Python 时：

```sh
python -m http.server 4173
```

然后打开 `http://localhost:4173`。

## GitHub Pages

1. 在 `X1a0hu` 账号创建公开仓库 `x1a0hu.github.io`。
2. 将本目录文件提交到 `main` 分支。
3. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
4. 等待 GitHub Pages 发布。预期地址为 `https://x1a0hu.github.io/`。

仓库已包含 `.github/workflows/pages.yml`。启用 Pages 后，每次推送会自动发布；也可在 Actions 手动运行 `Deploy personal homepage`。

## 修改内容

优先修改 `site.config.js`。为了搜索引擎和无 JavaScript 场景保持一致，请同步更新 `index.html` 的默认文案、页面元信息，以及 `about.html` 的文案。

目前 GitHub 和项目入口指向真实账号；笔记为明确标识的待更新页面；关于页只有通用介绍，未包含姓名、学校、联系方式等个人资料。

## 动画

- 在首页空白处点击或拖动，注入彩色流体。
- 系统开启“减少动态效果”时不启动 WebGL。
- 切到后台或打开弹窗时暂停；不支持 WebGL 时保留静态背景。
- 支持键盘导航、弹窗焦点约束和 Escape 关闭。

来源及许可证见 `THIRD_PARTY_NOTICES.md`。保留 `vendor/fluid.js` 顶部的 MIT 声明。
