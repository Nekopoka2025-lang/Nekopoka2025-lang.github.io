---
title: 一篇带代码和图片的测试文章
date: 2026-11-13
tags: [测试, 代码]
excerpt: 用来确认代码块、行内代码、图片和引用在这张“白纸贴纸”上是否好读。
cover:
---

这是一篇故意写得很“完整”的测试文，用来检查排版：标题层级、列表、引用、图片，还有深色代码块。

## 一张占位图

下面这张图是站点里的 SVG 插画，被放成拍立得的样子——白边、硬阴影、轻微倾斜。

![黄昏色块插画](/assets/img/sunset.svg)

再来一张更冷静的纸纹理色块：

![纸面色块](/assets/img/paper.svg)

## 代码好不好读？

行内代码长这样：把构建命令写成 `npm run build`，把文章放进 `posts/` 目录。

一段用来计算贴纸旋转角度的小函数：

```js
function rotation(slug) {
  let h = 0;
  for (const ch of slug) {
    h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return (h % 31) - 15;
}

console.log(rotation("hello-world"));
```

以及一小段样式，正好对照站点里的贴纸规则：

```css
.sticker {
  background: #fff;
  padding: 10px 22px;
  border-radius: 18px;
  box-shadow: 3px 4px 0 #0003;
}
```

## 清单与引用

构建一篇新文章大约只要三步：

1. 在 `posts/` 里新建 Markdown，写好 frontmatter。
2. 运行 `npm run build`。
3. 打开 `docs/` 里生成的页面看一眼。

> 测试通过的标准很朴素：代码能复制，图片能显示，手机上也能把这张纸读完。

若你正在写下一篇，记得在 `site.config.json` 里先确认站点名和作者。然后，去[所有文章](/posts/)看看筛选和排序是否也工作正常。
