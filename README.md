# X1a0hu · 个人空间

参考 Gx404 的一屏式个人主页：深色背景、渐变标题、WebGL 流体动画和四个导航入口。

## 文件

- `index.html`：首页，以及笔记和关于弹窗。
- `site.config.js`：名字、标语、简介和 GitHub 地址。
- `styles.css`：桌面和手机布局。
- `app.js`：弹窗、动画控制、配置和无障碍交互。
- `vendor/fluid.js`：含 MIT 许可证的 WebGL 流体渲染器。
- `notes.html`、`about.html`：支持直接打开、禁用 JavaScript 时仍可访问的页面。

不需要安装依赖或构建。所有渲染资源都在本站内，没有字体 CDN、统计脚本和后端接口。

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
- 页脚可以暂停/恢复光效，选择保存在本地。
- 系统开启“减少动态效果”时不启动 WebGL。
- 切到后台或打开弹窗时暂停；不支持 WebGL 时保留静态背景。
- 支持键盘导航、弹窗焦点约束和 Escape 关闭。

来源及许可证见 `THIRD_PARTY_NOTICES.md`。保留 `vendor/fluid.js` 顶部的 MIT 声明。
