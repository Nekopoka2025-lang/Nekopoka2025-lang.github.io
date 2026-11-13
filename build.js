#!/usr/bin/env node
/**
 * Tiny static blog builder.
 * Reads site.config.json + posts/*.md, writes a complete site into docs/.
 */
const fs = require("fs");
const path = require("path");
const { marked } = require("marked");

const ROOT = __dirname;
const POSTS_DIR = path.join(ROOT, "posts");
const SRC = path.join(ROOT, "src");
const OUT = path.join(ROOT, "docs");

const config = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));
const BASE = normalizeBase(config.baseUrl || "/");
const SITE_URL = String(config.siteUrl || "").replace(/\/$/, "");
const LANG = config.lang || "zh-CN";
const NAME = config.name || "My Journal";
const AUTHOR = config.author || "Kellro";
const DESCRIPTION = config.description || "";

function normalizeBase(base) {
  if (!base || base === "/") return "/";
  if (/^https?:\/\//.test(base)) {
    try {
      const u = new URL(base);
      const p = u.pathname.endsWith("/") ? u.pathname : u.pathname + "/";
      return p === "//" ? "/" : p;
    } catch {
      return "/";
    }
  }
  let b = base.startsWith("/") ? base : "/" + base;
  if (!b.endsWith("/")) b += "/";
  return b;
}

/** Join a site-absolute path with the configured baseUrl. */
function url(p) {
  const clean = String(p || "/").replace(/^\//, "");
  if (!clean) return BASE;
  return BASE + clean;
}

function absUrl(p) {
  const rel = url(p);
  if (!SITE_URL) return rel;
  return SITE_URL + rel;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, content: raw };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const i = line.indexOf(":");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (val === "" || val === "null" || val === "~") {
      data[key] = "";
      continue;
    }
    if (val.startsWith("[") && val.endsWith("]")) {
      data[key] = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      data[key] = val.replace(/^["']|["']$/g, "");
    }
  }
  return { data, content: m[2] };
}

function slugFromFilename(filename) {
  const base = filename.replace(/\.md$/i, "");
  const m = base.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
  return m ? m[1] : base;
}

function formatDate(iso) {
  const [y, m, d] = String(iso).split("-");
  if (!y || !m || !d) return String(iso);
  return `${y}年${Number(m)}月${Number(d)}日`;
}

function hash(str) {
  let h = 2166136261;
  for (const ch of String(str)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hueFor(slug) {
  return hash(slug) % 360;
}

function coverStyle(post) {
  if (post.cover && /\.(svg|png|jpe?g|webp|gif)$/i.test(post.cover)) {
    return `url('${url(post.cover.replace(/^\//, ""))}') center/cover no-repeat`;
  }
  if (post.cover && (post.cover.includes("gradient") || post.cover.includes("url("))) {
    return post.cover;
  }
  const h = post.hue;
  return `linear-gradient(135deg, hsl(${h} 12% 72%), hsl(${(h + 40) % 360} 10% 38%))`;
}

function rewriteMarkdownUrls(html) {
  // Prefix site-root paths in href/src with baseUrl (if base is not "/").
  return html.replace(/(href|src)="\/(?!\/)/g, (_, attr) => `${attr}="${BASE}`);
}

marked.setOptions({ gfm: true, breaks: false });

function rmDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function readPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"));
  const posts = files.map((file) => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
    const { data, content } = parseFrontmatter(raw);
    const slug = data.slug || slugFromFilename(file);
    const date = String(data.date || file.slice(0, 10));
    const tags = Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [];
    const title = data.title || slug;
    const excerpt = data.excerpt || "";
    const post = {
      file,
      slug,
      title,
      date,
      dateLabel: formatDate(date),
      tags,
      excerpt,
      cover: data.cover || "",
      content,
      hue: hueFor(slug),
      url: url(`posts/${slug}/`),
      path: `posts/${slug}/`,
    };
    post.coverCss = coverStyle(post);
    post.html = rewriteMarkdownUrls(marked.parse(content));
    return post;
  });
  posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  posts.forEach((p, i) => {
    p.prev = posts[i + 1] || null; // older
    p.next = posts[i - 1] || null; // newer
  });
  return posts;
}

function collectTags(posts) {
  const map = new Map();
  for (const p of posts) {
    for (const t of p.tags) {
      if (!map.has(t)) map.set(t, []);
      map.get(t).push(p);
    }
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "zh"));
}

function layout({ title, description, path: pagePath, body, pageClass = "", headerAlways = true, extraHead = "" }) {
  const fullTitle = title && title !== NAME ? `${title} · ${NAME}` : NAME;
  const desc = description || DESCRIPTION;
  const canonical = absUrl(pagePath || "/");
  const headerClass = headerAlways ? "sticker always" : "sticker";
  return `<!DOCTYPE html>
<html lang="${escapeHtml(LANG)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(desc)}">
  <meta name="author" content="${escapeHtml(AUTHOR)}">
  <meta name="generator" content="My Journal static builder">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="icon" href="${url("favicon.svg")}" type="image/svg+xml">
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(NAME)}" href="${url("feed.xml")}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Patrick+Hand&family=ZCOOL+KuaiLe&family=Ma+Shan+Zheng&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${url("assets/style.css")}">
  ${extraHead}
</head>
<body class="${escapeHtml(pageClass)}">
  <a class="skip" href="#main">跳到正文</a>
  <div class="leaves" aria-hidden="true"></div>
  <div id="cur" hidden></div>
  <header id="hdr" class="${headerClass}">
    <a class="logo" href="${url("")}">${escapeHtml(NAME)}</a>
    <nav>
      <a href="${url("posts/")}">文章</a>
      <a href="${url("tags/")}">标签</a>
      <a href="${url("about/")}">关于</a>
    </nav>
  </header>
  <main id="main">
    ${body}
  </main>
  <footer>
    <p class="sticker">© ${new Date().getFullYear()} ${escapeHtml(AUTHOR)} · ${escapeHtml(NAME)}</p>
  </footer>
  <script src="${url("assets/app.js")}"></script>
</body>
</html>
`;
}

function tagPills(tags) {
  return tags
    .map((t) => `<a class="tag" href="${url("tags/" + encodeURIComponent(t) + "/")}">${escapeHtml(t)}</a>`)
    .join("");
}

function postCardList(posts) {
  return posts
    .map(
      (p) => `<article class="item">
        <a class="cover-link thumb" href="${p.url}" aria-hidden="true" tabindex="-1"><div style="background:${escapeHtml(p.coverCss)}"></div></a>
        <div>
          <h3><a class="plain" href="${p.url}">${escapeHtml(p.title)}</a></h3>
          <time datetime="${escapeHtml(p.date)}">${escapeHtml(p.dateLabel)}</time>
          ${p.excerpt ? `<p class="excerpt">${escapeHtml(p.excerpt)}</p>` : ""}
          <div class="tags">${tagPills(p.tags)}</div>
        </div>
      </article>`
    )
    .join("\n");
}

function pilePositions(count) {
  // Deterministic scattered layout for up to 9 cards.
  const slots = [
    [6, 20],
    [36, 8],
    [66, 24],
    [10, 180],
    [38, 170],
    [68, 200],
    [8, 340],
    [40, 330],
    [70, 350],
  ];
  return Array.from({ length: count }, (_, i) => slots[i] || [8 + (i % 3) * 30, Math.floor(i / 3) * 160]);
}

function renderHome(posts) {
  const latest = posts.slice(0, 9);
  const positions = pilePositions(latest.length);
  const pile = latest
    .map((p, i) => {
      const rot = (hash(p.slug) % 31) - 15;
      const [left, top] = positions[i];
      return `<a class="card" href="${p.url}" style="left:${left}%;top:${top}px;transform:rotate(${rot}deg);z-index:${i + 1};background:${escapeHtml(p.coverCss)}"><span>${escapeHtml(p.title)}</span></a>`;
    })
    .join("\n");

  const body = `
  <div class="hero">
    <div class="notes">
      <a class="note" href="${url("posts/")}" style="top:26%;left:16%;transform:rotate(-8deg)">文章 ✎</a>
      <a class="note" href="${url("about/")}" style="top:28%;right:16%;transform:rotate(6deg)">关于</a>
    </div>
    <div class="sticker big">${escapeHtml(NAME)}</div>
    <div class="notes notes-bottom">
      <a class="note" href="${url("tags/")}" style="bottom:26%;left:44%;transform:rotate(-3deg)">标签</a>
    </div>
    <p class="sub sticker">一本属于 ${escapeHtml(AUTHOR)} 的手账</p>
  </div>
  <section id="latest">
    <h2 class="section-title sticker">最新文章</h2>
    <div class="pile" id="pile" style="height:${Math.max(220, Math.ceil(Math.max(latest.length,1)/3)*190+30)}px">
      ${pile || '<p class="empty">还没有文章。</p>'}
    </div>
    <div class="recent">
      ${postCardList(posts.slice(0, 6))}
    </div>
    <p style="margin-top:28px;font-size:22px"><a href="${url("posts/")}">查看全部文章 →</a></p>
  </section>`;

  return layout({
    title: NAME,
    description: DESCRIPTION,
    path: "/",
    body,
    headerAlways: false,
    pageClass: "home",
  });
}

function postsIndexData(posts) {
  return posts.map((p) => ({
    title: p.title,
    date: p.date,
    dateLabel: p.dateLabel,
    tags: p.tags,
    excerpt: p.excerpt,
    url: p.url,
    cover: p.coverCss,
  }));
}

function renderPostsIndex(posts, tags) {
  const chips = tags
    .map(
      ([t, list]) =>
        `<button type="button" class="chip" data-tag="${escapeHtml(t)}" aria-pressed="false">${escapeHtml(t)} <small>${list.length}</small></button>`
    )
    .join("");

  const body = `
  <section id="posts-app" class="wrap" data-active-tag="">
    <h1 class="page-title sticker">全部文章</h1>
    <div class="bar">
      <label class="search">🔍 <input id="q" type="search" placeholder="搜索标题、标签或摘要..." autocomplete="off"></label>
      <div class="toggle" role="group" aria-label="排序">
        <button type="button" class="on" data-s="new" aria-pressed="true">newest</button>
        <button type="button" data-s="old" aria-pressed="false">oldest</button>
      </div>
    </div>
    <div class="chip-row" aria-label="标签筛选">
      ${chips}
    </div>
    <div id="info" aria-live="polite"></div>
    <div class="grid" id="g"></div>
    <p class="empty" id="empty" hidden>没有找到匹配的页。</p>
    <script type="application/json" id="posts-data">${JSON.stringify(postsIndexData(posts)).replace(/</g, "\\u003c")}</script>
  </section>`;

  return layout({
    title: "文章",
    description: `${NAME} 的全部文章`,
    path: "posts/",
    body,
    pageClass: "page-posts",
  });
}

function renderPost(post, allTags) {
  const prev = post.prev
    ? `<a class="prev" href="${post.prev.url}">← ${escapeHtml(post.prev.title)}</a>`
    : `<span></span>`;
  const next = post.next
    ? `<a class="next" href="${post.next.url}">${escapeHtml(post.next.title)} →</a>`
    : "";

  const body = `
  <div class="article-wrap">
    <article class="article sticker">
      <a class="back" href="${url("posts/")}">← 返回文章列表</a>
      <h1>${escapeHtml(post.title)}</h1>
      <p class="lead-meta">
        <time datetime="${escapeHtml(post.date)}">${escapeHtml(post.dateLabel)}</time>
      </p>
      <div class="tags" style="margin:-8px 0 28px">${tagPills(post.tags)}</div>
      <div class="prose">
        ${post.html}
      </div>
      <nav class="post-nav">
        ${prev}
        ${next}
      </nav>
    </article>
  </div>`;

  return layout({
    title: post.title,
    description: post.excerpt || `${post.title} — ${NAME}`,
    path: post.path,
    body,
    pageClass: "page-post",
  });
}

function renderAbout() {
  const body = `
  <div class="article-wrap">
    <div class="page-card sticker">
      <h1>关于</h1>
      <div class="about-prose prose">
        <p>你好，我是 <strong>${escapeHtml(AUTHOR)}</strong>。</p>
        <p>${escapeHtml(NAME)} 是一本手账风格的静态博客：横线纸做底，树叶光影在上面慢慢晃，文章被贴成一张张带硬阴影的白底贴纸。它没有框架，构建完成后就是普通的 HTML、CSS 和一点 JavaScript，适合放在 GitHub Pages 上。</p>
        <p>想翻以前写下的页，去<a href="${url("posts/")}">文章列表</a>；想按主题找，去<a href="${url("tags/")}">标签</a>。</p>
        <p>站点名、作者和地址都可以在仓库根目录的 <code>site.config.json</code> 里改。</p>
      </div>
    </div>
  </div>`;
  return layout({
    title: "关于",
    description: `关于 ${NAME} 与 ${AUTHOR}`,
    path: "about/",
    body,
    pageClass: "page-about",
  });
}

function renderTagsIndex(tags) {
  const cloud = tags
    .map(([t, list], i) => {
      const rot = ((hash(t) % 15) - 7);
      return `<a class="sticker" style="--r:${rot}deg;transform:rotate(${rot}deg)" href="${url("tags/" + encodeURIComponent(t) + "/")}">${escapeHtml(t)} <small>(${list.length})</small></a>`;
    })
    .join("\n");
  const body = `
  <div class="article-wrap">
    <div class="page-card sticker">
      <h1>标签</h1>
      <p class="about-prose" style="margin-bottom:18px">把类似的页用一枚贴纸归在一起。</p>
      <div class="tag-cloud">
        ${cloud || "<p>还没有标签。</p>"}
      </div>
    </div>
  </div>`;
  return layout({
    title: "标签",
    description: `${NAME} 的标签`,
    path: "tags/",
    body,
    pageClass: "page-tags",
  });
}

function renderTagPage(tag, list, allPosts) {
  const body = `
  <section class="wrap" id="posts-app" data-active-tag="${escapeHtml(tag)}">
    <h1 class="page-title sticker"># ${escapeHtml(tag)}</h1>
    <p style="margin:-12px 0 24px;font-size:22px"><a href="${url("tags/")}">← 所有标签</a></p>
    <div class="recent">
      ${postCardList(list)}
    </div>
  </section>`;
  return layout({
    title: `#${tag}`,
    description: `标签「${tag}」下的文章`,
    path: `tags/${encodeURIComponent(tag)}/`,
    body,
    pageClass: "page-tag",
  });
}

function render404() {
  const body = `
  <div class="not-found">
    <div class="sticker">
      <h1>404</h1>
      <p>这一页好像从手账里掉出去了。</p>
      <p><a href="${url("")}">回到封面</a> · <a href="${url("posts/")}">去文章列表</a></p>
    </div>
  </div>`;
  return layout({
    title: "页面不存在",
    description: "找不到这一页",
    path: "404.html",
    body,
    pageClass: "page-404",
    headerAlways: true,
  });
}

function renderSitemap(posts, tags) {
  const today = new Date().toISOString().slice(0, 10);
  const pages = [
    { loc: absUrl("/"), lastmod: posts[0] ? posts[0].date : today, pri: "1.0" },
    { loc: absUrl("posts/"), lastmod: posts[0] ? posts[0].date : today, pri: "0.8" },
    { loc: absUrl("about/"), lastmod: today, pri: "0.5" },
    { loc: absUrl("tags/"), lastmod: today, pri: "0.5" },
    ...posts.map((p) => ({ loc: absUrl(p.path), lastmod: p.date, pri: "0.7" })),
    ...tags.map(([t]) => ({ loc: absUrl("tags/" + encodeURIComponent(t) + "/"), lastmod: today, pri: "0.4" })),
  ];
  const urls = pages
    .map(
      (u) => `  <url>
    <loc>${escapeHtml(u.loc)}</loc>
    <lastmod>${escapeHtml(u.lastmod)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${u.pri}</priority>
  </url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function renderRss(posts) {
  const items = posts
    .map((p) => {
      const link = absUrl(p.path);
      return `    <item>
      <title>${escapeHtml(p.title)}</title>
      <link>${escapeHtml(link)}</link>
      <guid>${escapeHtml(link)}</guid>
      <pubDate>${new Date(p.date + "T00:00:00Z").toUTCString()}</pubDate>
      <description>${escapeHtml(p.excerpt || p.title)}</description>
      ${(p.tags || []).map((t) => `<category>${escapeHtml(t)}</category>`).join("\n      ")}
    </item>`;
    })
    .join("\n");
  const last = posts[0] ? new Date(posts[0].date + "T00:00:00Z").toUTCString() : new Date().toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeHtml(NAME)}</title>
    <link>${escapeHtml(absUrl("/"))}</link>
    <description>${escapeHtml(DESCRIPTION)}</description>
    <language>${escapeHtml(LANG)}</language>
    <lastBuildDate>${last}</lastBuildDate>
    <atom:link href="${escapeHtml(absUrl("feed.xml"))}" rel="self" type="application/rss+xml"/>
    <managingEditor>${escapeHtml(AUTHOR)}</managingEditor>
${items}
  </channel>
</rss>
`;
}

function build() {
  const posts = readPosts();
  const tags = collectTags(posts);

  rmDir(OUT);
  fs.mkdirSync(path.join(OUT, "assets", "img"), { recursive: true });

  copyDir(path.join(SRC, "assets"), path.join(OUT, "assets"));
  if (fs.existsSync(path.join(SRC, "img"))) {
    copyDir(path.join(SRC, "img"), path.join(OUT, "assets", "img"));
  }
  fs.copyFileSync(path.join(SRC, "assets", "favicon.svg"), path.join(OUT, "favicon.svg"));

  writeFile(path.join(OUT, "index.html"), renderHome(posts));
  writeFile(path.join(OUT, "posts", "index.html"), renderPostsIndex(posts, tags));
  writeFile(path.join(OUT, "about", "index.html"), renderAbout());
  writeFile(path.join(OUT, "tags", "index.html"), renderTagsIndex(tags));
  writeFile(path.join(OUT, "404.html"), render404());
  writeFile(path.join(OUT, "feed.xml"), renderRss(posts));
  writeFile(path.join(OUT, "sitemap.xml"), renderSitemap(posts, tags));
  writeFile(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${absUrl("sitemap.xml")}\n`);

  for (const post of posts) {
    writeFile(path.join(OUT, "posts", post.slug, "index.html"), renderPost(post, tags));
  }
  for (const [tag, list] of tags) {
    writeFile(path.join(OUT, "tags", tag, "index.html"), renderTagPage(tag, list, posts));
  }

  console.log(`Built ${posts.length} post(s), ${tags.length} tag(s) → ${path.relative(ROOT, OUT) || "docs"}/`);
}

build();
