---
title: 用 Astro 从零搭建个人博客
description: 项目日志：为什么选 Astro、内容集合如何组织、以及把写作后台交给 Pages CMS 的取舍。
pubDate: 2026-07-04
category: 项目日志
tags:
  - Astro
  - 博客
  - 工程
draft: false
pinned: true
---

## 为什么是 Astro

我想要的是**纯静态、零运行时、好维护**。Astro 的群岛架构让文章页默认零 JS，首屏快，且内容集合（Content Collections）自带类型校验，正好契合「不手写 Markdown 也要结构正确」的目标。

## 内容集合即契约

`src/content.config.ts` 把每篇文章的 frontmatter 变成 Zod schema：缺字段、字段类型错，构建期就报错，而不是上线后才发现。

```ts
const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    category: z.string(),
    tags: z.array(z.string()).default([]),
    // ...
  }),
});
```

## 把写作交给 Pages CMS

我不打算日常手写 Markdown。Pages CMS 读仓库里的 `.pages.yml`，提供一个浏览器后台，保存即提交到 GitHub，再触发 Actions 自动部署。这样写文章和「写代码」彻底解耦。

- 新建文章 → 填表单 → 上传封面 → 保存；
- 后台提交 → `main` 分支更新 → 自动构建部署。

## 进度

- [x] 主题与暗色模式
- [x] 文章 / 分类 / 标签 / 搜索
- [x] Giscus 评论
- [ ] 归档页与年度统计（待做）

下一步补一个归档时间线。欢迎在留言板催更。
