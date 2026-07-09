# Disdorqin Field

> 科研、电力预测、项目日志与 Vibe Coding 实验场

一个基于 **Astro + TypeScript** 的个人博客，内容用 **Markdown/MDX 内容集合**管理，后台编辑交给 **Pages CMS**，部署在 **GitHub Pages**，评论功能支持 **Waline**（默认）与 **Giscus**（可选）。纯静态、零服务端运行时、不依赖数据库。

- 站点：`https://disdorqin.cn`
- 仓库：`disdorqin/disdorqin.github.io`

---

## 目录

- [技术栈](#技术栈)
- [功能特性](#功能特性)
- [项目结构](#项目结构)
- [本地运行命令](#本地运行命令)
- [上线前检查](#上线前检查)
- [部署步骤](#部署步骤)
- [自定义域名](#自定义域名)
- [Pages CMS 使用步骤](#pages-cms-使用步骤)
- [Pages CMS 发文检查](#pages-cms-发文检查)
- [文章排序说明](#文章排序说明)
- [Waline 配置步骤（默认评论系统）](#waline-配置步骤默认评论系统)
- [Giscus（可选方案）](#giscus可选方案)
- [如何写 / 发布第一篇文章](#如何写--发布第一篇文章)
- [写作后台](#写作后台)
- [常见问题排查](#常见问题排查)

---

## 技术栈

| 能力 | 选型 |
| --- | --- |
| 框架 | Astro 5（静态输出，零运行时） |
| 语言 | TypeScript |
| 内容 | Markdown / MDX + Astro Content Collections（Zod schema 校验） |
| 后台编辑 | Pages CMS（`.pages.yml`） |
| 评论 | Giscus（GitHub Discussions） |
| 搜索 | Pagefind（构建期生成静态索引） |
| 公式 | KaTeX（`remark-math` + `rehype-katex`） |
| 代码高亮 | Shiki（暗/亮双主题） |
| RSS / Sitemap | `@astrojs/rss` / `@astrojs/sitemap` |
| 部署 | GitHub Pages + GitHub Actions |

---

## 功能特性

- 默认暗色主题，支持亮/暗一键切换（无首屏闪烁，记忆偏好）
- 响应式布局，移动端友好
- 文章正文：代码高亮、LaTeX 数学公式、目录 TOC、阅读时间
- 草稿（`draft: true`）构建时自动过滤；置顶（`pinned: true`）在列表中优先
- 分类页 / 标签页（含聚合页与单页）
- 全站全文搜索（Pagefind）
- RSS、Sitemap、SEO meta 与 Open Graph
- 留言板（Giscus）

---

## 项目结构

```
disdorqin.github.io/
├── .pages.yml                 # Pages CMS 配置（字段与 content schema 对应）
├── .github/
│   └── workflows/
│       └── deploy.yml         # GitHub Pages 自动部署工作流
├── astro.config.mjs           # Astro 配置（site / 集成 / markdown 插件）
├── tsconfig.json
├── package.json
├── public/
│   ├── uploads/               # Pages CMS 上传的图片存放处
│   ├── favicon.svg
│   ├── og-default.svg
│   └── robots.txt
├── src/
│   ├── config/
│   │   └── site.ts            # ★ 站点信息 / 导航 / Giscus 配置集中处
│   ├── content.config.ts      # ★ Content Collection schema（frontmatter 校验）
│   ├── content/
│   │   └── blog/              # ★ 文章目录（.md / .mdx）
│   │       ├── research-note-attention.md
│   │       ├── power-forecast-baseline.md
│   │       ├── ml-feature-engineering.md
│   │       ├── project-log-astro-blog.md
│   │       ├── vibe-coding-pages-cms.mdx
│   │       └── misc-tools.md
│   ├── utils/
│   │   ├── index.ts           # 日期格式化 / 阅读时间 / slug
│   │   └── posts.ts           # 取已发布文章、分类、标签
│   ├── styles/
│   │   └── global.css         # 主题变量与全局样式
│   ├── layouts/
│   │   └── BaseLayout.astro   # HTML 骨架 / SEO / OG / KaTeX
│   ├── components/
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── ThemeToggle.astro
│   │   ├── GiscusComment.astro
│   │   ├── PostCard.astro
│   │   └── Toc.astro
│   └── pages/
│       ├── index.astro                # 首页
│       ├── blog/
│       │   ├── index.astro            # 文章列表
│       │   └── [slug].astro           # 文章详情
│       ├── categories/
│       │   ├── index.astro            # 分类聚合
│       │   └── [category].astro       # 单分类
│       ├── tags/
│       │   ├── index.astro            # 标签聚合
│       │   └── [tag].astro            # 单标签
│       ├── about.astro                # 关于
│       ├── guestbook.astro            # 留言板（Giscus）
│       ├── search.astro               # 搜索（Pagefind）
│       ├── 404.astro                  # 404
│       └── rss.xml.ts                 # RSS
└── .gitignore
```

> 所有「以后可能要改」的站点信息与 Giscus 参数都在 `src/config/site.ts`。

---

## 本地运行命令

要求：Node.js ≥ 18.17（推荐 22）。

```bash
# 安装依赖
npm install

# 本地预览（热更新）
npm run dev
# 打开 http://localhost:4321

# 生产构建（含 Pagefind 索引）
npm run build

# 本地预览构建产物
npm run preview
```

> 说明：`npm run build` 会先执行 `astro build`，再执行 `pagefind --site dist` 生成搜索索引。
> 本地 `npm run dev` 下搜索框可用但索引尚未生成，搜索在 `build` 部署后生效。

---

## 上线前检查

提交 / 推送前，建议先跑一遍内置检查，避免把错误配置推上 GitHub Pages：

```bash
npm run preflight   # 结构 + 暂存区 + 文章 frontmatter 校验
npm run check       # = preflight + astro check + build
```

`scripts/preflight.mjs` 会检查：

- 关键文件存在：`package.json` / `astro.config.mjs` / `.pages.yml` / `src/content.config.ts` / `.github/workflows/deploy.yml`
- `src/content/blog/` 至少 1 篇文章、`public/uploads/` 存在
- `astro.config.mjs` 中 `site` 为 `https://disdorqin.cn`，且不配置 `base`
- 暂存区**不包含** `dist/` 与 `node_modules/`
- 每篇文章 frontmatter：`title` / `description` / `pubDate` / `category` 必填，`tags` 为数组，`draft` / `pinned` 为 boolean 或可省略，`cover` 若存在须以 `/uploads/` 开头或合法外链
- 无重复 slug

> Giscus 仍为占位参数时 **不会** 导致检查失败，只会给出提示（见下文「Giscus 未配置时的说明」）。

## 部署步骤

1. 在 GitHub 新建仓库 **`disdorqin.github.io`**（用户/组织页仓库名必须精确）。
2. 把本项目推送到该仓库的 `main` 分支。
3. 仓库 **Settings → Pages → Source** 选择 **GitHub Actions**（不要选 "Deploy from a branch"）。
4. 推送后，Actions 会自动执行 `.github/workflows/deploy.yml`：
   - `build` 任务：`npm ci` → `npm run preflight`（上线前检查）→ `npm run build` → 上传 `dist/`
   - `deploy` 任务：发布到 GitHub Pages
5. 几分钟后访问 `https://disdorqin.cn`（或 `https://disdorqin.github.io`，后者会自动跳转）。

> 已配置自定义域名 `disdorqin.cn`，因此 `astro.config.mjs` 中 `site` 设为 `https://disdorqin.cn`，**不需要也不应该设置 `base`**。

---

## 自定义域名

本博客已启用自定义域名：

- **主域名（推荐）**：`https://disdorqin.cn`
- **备用**：`https://disdorqin.github.io`（会自动跳转到 `disdorqin.cn`）

### DNS 配置步骤

在域名 DNS 管理面板中添加以下记录：

| 类型  | 名称  | 目标 |
|-------|-------|------|
| A     | `@`   | `185.199.108.153` |
| A     | `@`   | `185.199.109.153` |
| A     | `@`   | `185.199.110.153` |
| A     | `@`   | `185.199.111.153` |
| CNAME | `www` | `disdorqin.github.io` |

> `@` 是根域名记录（disdorqin.cn 本身）。以上四个 A 记录是 GitHub Pages 的固定 IP，CNAME 记录用于 `www.disdorqin.cn` 跳转到 `disdorqin.cn`。

### GitHub Pages 配置

1. 进入仓库 **Settings → Pages → Custom domain**，填写 `disdorqin.cn`，点击 **Save**。
2. 等待 DNS 检查通过（可能需要几分钟到数小时，取决于 DNS 传播速度）。
3. DNS Check 通过后，勾选 **Enforce HTTPS**（启用后需等待 GitHub 签发证书，通常几分钟内完成）。

### 注意事项

- **不要使用 wildcard DNS（如 `*.disdorqin.cn`）**，GitHub Pages 不支持泛解析。
- 如果 `www.disdorqin.cn` 不能自动跳转，请检查 `www` 的 CNAME 记录是否正确指向 `disdorqin.github.io`。
- DNS 变更全球传播通常需要 10 分钟到 24 小时不等。
- 源码仓库仍然是 `disdorqin/disdorqin.github.io`，GitHub Actions 工作流无需变更。

---

## Pages CMS 使用步骤

Pages CMS 是一个跑在浏览器里的后台，读写你的 GitHub 仓库，**不需要数据库**。

### 1. 登录

打开 [https://app.pagescms.org](https://app.pagescms.org)，点击 **Login / Start**，选择 **GitHub** 登录。

### 2. 授权 GitHub App

首次使用时 Pages CMS 会请求授权一个 GitHub App：

- 选择仓库 `disdorqin/disdorqin.github.io`（可限定仅此仓库）；
- 授予「读取内容、提交内容、读取元数据」等权限；
- 确认授权。

> 之后 Pages CMS 就有权限把你在后台的编辑提交到仓库。

### 3. 选择站点

授权后，选择你的仓库与分支（`main`），Pages CMS 会自动读取根目录的 `.pages.yml`。

### 4. 新建文章

- 左侧进入「文章」集合 → 点击 **New**；
- 填写：
  - **标题**（必填）
  - **摘要**（必填）
  - **发布日期**（必填，格式 `YYYY-MM-DD`）
  - **更新日期**（可选）
  - **分类**（下拉选择：科研笔记 / 电力预测 / 机器学习 / 项目日志 / Vibe Coding / 杂谈）
  - **标签**（可添加多个）
  - **草稿**（开启则不会发布到线上）
  - **置顶**（开启则在列表置顶）
  - **正文**（富文本编辑器，支持 Markdown，可在文中插入图片）
- 点击 **Save**。

### 5. 上传图片

- 在「正文」编辑器里点插入图片，或直接编辑 **封面图** 字段；
- 选择本地图片 → Pages CMS 上传到 `public/uploads/`，文件名自动 slug 化（避免中文/空格），写入内容的地址形如 `/uploads/xxx.png`；
- 支持的格式：`png / jpg / jpeg / webp / gif`。

### 6. 发布文章

- 「保存」即把 Markdown 提交到 `main` 分支；
- 若 `draft` 为 `true`，线上列表与构建都会**忽略**该文章（草稿仅在仓库里）；
- 提交后 GitHub Actions 自动重新构建并部署，通常 1–2 分钟生效。

> 想用「预览后再发布」？先把 `draft` 设为 `true` 保存，确认无误再改回 `false` 保存即可。

---

## Pages CMS 发文检查

通过 Pages CMS 后台发文前，对照这张清单可避免常见问题：

- **分类**必须从下拉选择（科研笔记 / 电力预测 / 机器学习 / 项目日志 / Vibe Coding / 杂谈），不要手填，否则与 `src/content.config.ts` 的 `category: z.string()` 不匹配会导致构建失败。
- **标签**填写多个时用回车 / 逗号分隔，保存后为数组；不要写成单段逗号字符串（会被当成 1 个标签）。
- **封面图**：在正文或封面字段上传，文件会落到 `public/uploads/`，路径形如 `/uploads/xxx.svg`；frontmatter 里的 `cover` 自动写成 `/uploads/...`，不要改成相对路径或本地绝对路径。
- **草稿**：勾选 `draft` 后文章线上不显示，但仍在仓库里；确定发布时取消勾选再 Save。
- **置顶**：`pinned: true` 的文章在首页独立"置顶"区域展示，不影响最新文章列表排序。
- 保存即提交到 `main` → 触发 Actions 重新构建部署（通常 1–2 分钟生效）。若长时间不更新，先看 Actions 日志，再本地跑 `npm run preflight`。

---

## 文章排序说明

- **最新文章列表**（首页 / `/blog/` / 分类页 / 标签页）：严格按 **`pubDate` 倒序**排列，即最新发布的文章永远排在最前面。
- **`pinned: true`**：置顶文章**不会插入**到最新文章列表中间，而是在首页单独显示在「置顶」区域。不影响最新文章的按日期排序逻辑。
- **RSS 与搜索索引**也按此顺序生成，保持全站一致。
- 所有已标记 `draft: true` 的文章在构建时被过滤，线上不可见。

---

## Waline 配置步骤（默认评论系统）

Waline 是一个轻量评论系统，访客只需填写昵称即可评论，**不需要 GitHub 账号**。数据存储在 Waline 服务端连接的数据库中，不存放在 GitHub 仓库里。

> 为什么从 Giscus 换到 Waline？因为很多访客没有 GitHub 账号，Giscus 要求 GitHub 登录才能评论，门槛太高。

### 1. 部署 Waline 服务端

推荐使用 **Vercel + Neon Database** 零成本部署：

1. 打开 [Waline 部署文档](https://waline.js.org/guide/get-started/)，按指引一键部署到 Vercel；
2. 创建一个 [Neon](https://neon.tech) 数据库（免费版即可），获取数据库连接字符串 `postgresql://...`；
3. 在 Vercel 项目 Settings → Environment Variables 中配置 Waline 所需的环境变量（`LEAN_ID` / `LEAN_APPID` 或 `DATABASE_URL`，取决于你选的存储方案）；
4. 重新部署 Vercel 项目，获得服务地址，形如 `https://xxx.vercel.app`。

### 2. 注册管理员

首次配置完成后，打开 `https://你的服务地址/ui/register` 注册账号。第一个注册的账号会成为管理员，可管理评论。

### 3. 填写项目配置

把 Waline 服务地址填入 `src/config/site.ts`：

```ts
walineServerURL: 'https://你的服务地址.vercel.app',  // ← 替换为真实地址
```

### 4. 未配置时的说明

在 `walineServerURL` 为空时：
- 文章详情页与留言板页的评论区会显示「**评论系统待配置**」提示；
- 组件**不会**加载 Waline 脚本，也**不会**报错，不影响构建与部署；
- 等你部署了 Waline 服务并填好 `walineServerURL` 后，刷新页面即自动启用。

> 不要把数据库密码或任何 token 写进前端仓库。所有敏感信息只在 Waline 服务端环境变量中配置。

---

## Giscus（可选方案）

Giscus 使用 GitHub Discussions 存储评论，**免费、无需额外数据库**，但访客需要 **GitHub 账号**才能评论。当前项目默认使用 Waline，如果你偏好 Giscus，可以按以下步骤启用：

### 1. 开启仓库 Discussions

仓库 **Settings → General → Features → 勾选 Discussions**。

### 2. 安装 Giscus GitHub App

打开 [https://github.com/apps/giscus](https://github.com/apps/giscus)，点击 **Install**，选择 `disdorqin/disdorqin.github.io` 仓库授权。

### 3. 在 giscus.app 生成参数

打开 [https://giscus.app](https://giscus.app)：

- Repository 填 `disdorqin/disdorqin.github.io`；
- 选择 Discussions 分类（如 `Announcements`，需提前在 Discussions 里建好）；
- Page ↔ Discussions 映射选 `pathname`；
- 主题选 `preferred_color_scheme`；
- 页面会给出 `data-repo-id` 与 `data-category-id` 等参数。

### 4. 切换评论系统

要把评论从 Waline 切回 Giscus：

1. 在 `src/config/site.ts` 把 `walineServerURL` 设为空字符串 `''`（禁用 Waline）；
2. 把文章详情页 `src/pages/blog/[slug].astro` 和留言板页 `src/pages/guestbook.astro` 中的 `WalineComment` 替换为 `GiscusComment`；
3. 确保 `giscusRepoId` / `giscusCategoryId` 已填入真实值（已配置）；
4. 提交并推送，刷新页面后评论区即使用 Giscus。

> Giscus 的所有评论数据存在仓库的 Discussions 里，不占用外部数据库。Waliner 评论则存在 Waline 服务端连接的数据库中。

> 当前 `giscusRepoId` / `giscusCategoryId` 是占位值 `YOUR_REPO_ID` / `YOUR_CATEGORY_ID`，在替换前评论区不会显示，但页面其余功能正常。

---

## 如何写 / 发布第一篇文章

**方式 A：用 Pages CMS（推荐，无需手写 Markdown）**

1. 登录 Pages CMS → 文章 → New；
2. 填标题/摘要/分类/标签/正文，按需上传封面；
3. 保存 → 自动提交并部署。

**方式 B：直接提交 Markdown 文件**

1. 在 `src/content/blog/` 新建 `my-post.md`；
2. 顶部写 frontmatter（字段见下），正文用 Markdown；
3. `git push` 到 `main`。

最小 frontmatter 模板：

```markdown
---
title: 文章标题
description: 一句话摘要
pubDate: 2026-07-08
category: 机器学习
tags: [机器学习, 实战]
cover: /uploads/cover-ml.svg
draft: false
pinned: false
---

正文从这里开始……
```

> 字段与 `src/content.config.ts` 的 schema 完全一致；缺字段或类型不符会在构建时报错。

---

## 写作后台

本站提供了一个伪动态写作后台入口：**`/admin/`**（导航栏「后台」与页脚「写作后台」均指向它）。

需要澄清的关键点：

- **写文章不是在前台页面直接写。** 前台 `/admin/` 只是一个说明 + 跳转页，没有任何输入框、没有自建登录系统、不保存任何 token。
- **真正的后台是 Pages CMS。** 点击 `/admin/` 里的「进入写作后台」按钮会跳转到 [https://app.pagescms.org](https://app.pagescms.org)，站长用 GitHub 登录后即可在浏览器里新建、编辑、发布文章。
- **权限由 GitHub 决定。** Pages CMS 使用 GitHub OAuth 登录，能否编辑文章完全取决于登录账号是否拥有本仓库（`disdorqin/disdorqin.github.io`）的**写权限**：
  - 站长（有写权限）：可新建 / 编辑 / 发布。
  - 普通访客（无写权限）：能看到后台页面，但无法发布文章。
- **保存即发布。** 在 Pages CMS 保存文章后，内容会作为 Markdown 提交到仓库 `main` 分支，自动触发 GitHub Actions（`npm run preflight` → `npm run build` → 部署到 GitHub Pages），通常 1–2 分钟后新文章即上线。

`/admin/` 页面包含的内容：

1. 说明「本站文章由 Pages CMS 管理，不是前台直接写」；
2. 说明「谁有权限写 / 访客为何不能写」；
3. 说明「保存后如何自动触发 GitHub Actions 部署」；
4. 一个醒目的「进入写作后台 →」按钮，链接到 `https://app.pagescms.org`（新标签页打开，`rel="noopener noreferrer"`）。

> 安全边界：本站不引入数据库、不引入后端服务、不暴露任何 token。所有写权限判定与登录都发生在 GitHub / Pages CMS 一侧。

---

## 常见问题排查

**Q1：本地 `npm run dev` 搜索框没结果？**
A：正常。Pagefind 索引在 `npm run build` 时生成，`dev` 下索引不存在。部署到 GitHub Pages 后即可搜索。

**Q2：Pages CMS 里 `draft: true` 的文章为什么线上看不到？**
A：符合预期——构建时会过滤 `draft: true` 的文章。要发布就改为 `false` 再保存。

**Q3：推送后网站没更新？**
A：到仓库 **Actions** 看工作流是否成功；常见原因：依赖安装失败、构建报错（如 frontmatter 缺字段）。本地先 `npm run build` 复现错误最快。

**Q4：GitHub Pages 显示 404？**
A：确认 **Settings → Pages → Source = GitHub Actions**，且工作流已成功运行过一次（`deploy` 任务完成）。

**Q5：中文分类 / 标签的 URL 看起来是编码后的字符串？**
A：正常。路由使用 `encodeURIComponent`，浏览器会正确显示与跳转。想更干净可给文章取 ASCII 标题（文件名即 slug）。

**Q6：KaTeX 公式不渲染？**
A：确认正文用 `$...$`（行内）或 `$$...$$`（独立公式），且仓库依赖包含 `remark-math` / `rehype-katex` / `katex`（已默认安装）。

**Q7：Giscus 评论区空白？**
A：检查 `src/config/site.ts` 里的 `giscusRepoId` / `giscusCategoryId` 是否已替换为真实值；并确认仓库已开启 Discussions 且安装了 Giscus App。

**Q8：想改站点标题 / 导航 / 主题色？**
A：站点信息在 `src/config/site.ts`；主题颜色变量在 `src/styles/global.css` 顶部的 `:root` 与 `html.dark`。

### Actions 失败排查

- **push 被拒：`without workflow scope`**——推送含 `.github/workflows/*.yml` 的提交时，Git 凭据（PAT / `gh` token）必须有 `workflow` 作用域。解决：本机跑 `gh auth refresh -h github.com -s workflow` 完成浏览器设备流授权；或新建带 `workflow` 作用域的 PAT / fine-grained token（勾 `Workflows: write`）。仓库 owner 也可直接在 GitHub Web UI 新建该 workflow 文件（owner 的 OAuth 会话不受 PAT 作用域限制）。
- **preflight 失败**：Actions 在 build 前运行 `npm run preflight`。常见原因：文章 `tags` 不是数组、必填字段缺失、`cover` 路径不对、误把 `dist/` 或 `node_modules/` 暂存。本地先 `npm run preflight` 复现并修正。
- **构建失败（`astro build` 红）**：多半是某篇新文章的 frontmatter 不满足 `src/content.config.ts` 的 Zod schema（如 `category` 多了空格、日期格式非法）。本地 `npm run build` 看具体报错行。
- **部署成功但页面 404**：确认仓库 **Settings → Pages → Source = GitHub Actions**（不是 "Deploy from a branch"）；且 `deploy` 任务已成功运行过一次。
- **样式 / 评论没更新**：GitHub Pages 有 CDN 缓存，等 1–2 分钟硬刷新；Giscus 需先按上文配置并开启 Discussions。

---

## License

内容版权归作者所有；代码以仓库 LICENSE 为准。

> Last updated: 2026-07-09
