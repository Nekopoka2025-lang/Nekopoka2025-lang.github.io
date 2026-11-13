# My Journal

一本手账风格的静态博客：横线笔记本纸、树叶光影、硬阴影贴纸卡片，以及会在悬停时放大的小黑点光标。纯 HTML / CSS / JS，构建后可直接用 GitHub Pages 发布。

站点名、作者和地址在根目录的 [`site.config.json`](site.config.json) 里统一配置：

```json
{
  "name": "My Journal",
  "author": "Kellro",
  "description": "一本手账风格的静态博客，用来记下日常与灵感。",
  "baseUrl": "/",
  "siteUrl": "",
  "lang": "zh-CN"
}
```

- `baseUrl`：路径前缀。如果仓库是用户主页（`username.github.io`），保持 `"/"`。如果是项目主页，改成 `"/仓库名/"`。
- `siteUrl`：站点源，例如 `https://username.github.io`（不要带末尾斜杠，也不要重复写仓库路径）。填写后，RSS 与 sitemap 会使用绝对地址。没填时它们会写成相对路径，本地预览仍然可用。
- 先不要添加 `CNAME` 文件；自定义域名准备好后再放进 `docs/` 或让构建脚本写入。

## 本地预览

需要 Node.js 18+。

```bash
npm install
npm run build
npm run serve
```

然后打开提示的本地地址（默认 http://127.0.0.1:8080）。`docs/` 就是构建产物，也可以用任意静态服务器打开这个目录。

## 如何新增一篇文章

1. 在 `posts/` 目录里新建一个 Markdown 文件。推荐用日期作为文件名前缀，方便排序，例如：

   `posts/2026-11-20-a-new-page.md`

   日期后面的部分会成为网址，上例对应 `/posts/a-new-page/`。

2. 文件开头写 frontmatter（YAML 风格），正文用普通 Markdown：

   ```markdown
   ---
   title: 文章标题
   date: 2026-11-20
   tags: [随笔, 旅行]
   excerpt: 一句话摘要，会出现在首页和列表里。
   cover:
   ---

   正文从这里开始。可以用标题、列表、引用、图片和代码块。
   ```

   - `title`、`date`、`tags`、`excerpt` 是常用字段。
   - `cover` 可选。留空时会按标题生成一张单色渐变封面；也可以写成 `/assets/img/your.svg` 这样的站点路径。
   - 正文里的链接如果写成 `/about/`、`/assets/img/sunset.svg` 这种根路径，构建时会自动加上 `baseUrl`。

3. 把用到的图片放到 `src/img/`（会复制到 `docs/assets/img/`），或直接放进 `src/assets/`。

4. 重新构建：

   ```bash
   npm run build
   ```

   生成的页面在 `docs/`。这个目录需要一并提交，这样即使不跑 GitHub Actions，也可以在仓库设置里选择 “Deploy from a branch → /docs”。

## 部署到 GitHub Pages

仓库里已经有 [`.github/workflows/pages.yml`](.github/workflows/pages.yml)：推送到 `main` 后会安装依赖、构建，并用官方的 `configure-pages` / `upload-pages-artifact` / `deploy-pages` 发布。

第一次使用请在 GitHub 仓库打开 **Settings → Pages**，把 Source 设为 **GitHub Actions**。也可以改用 “Deploy from a branch”，文件夹选 `docs`。

发布前记得按需要填写 `site.config.json` 里的 `baseUrl` 和 `siteUrl`，然后本地再跑一次 `npm run build` 并提交 `docs/`。

## 目录结构

```
blog/
├── site.config.json      # 站点名、作者、baseUrl
├── build.js              # 把 Markdown 变成 HTML 的小构建脚本
├── package.json
├── posts/                # 文章源文件（Markdown + frontmatter）
├── src/
│   ├── assets/           # style.css、app.js、favicon.svg
│   └── img/              # 插画与占位图
├── docs/                 # 构建输出（提交到 Git，可供 Pages 直接托管）
└── .github/workflows/pages.yml
```

构建脚本只依赖 `marked`，没有其它打包器。服务站点时不需要再执行构建。
