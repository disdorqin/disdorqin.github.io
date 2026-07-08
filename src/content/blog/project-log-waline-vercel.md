---
title: 给博客接上评论：Vercel + Waline 踩坑记
description: 项目日志：为什么从 Giscus 切到 Waline，Waline 为什么"太难搞"，以及 Vercel 部署 + 数据库配置的全过程复盘。
pubDate: 2026-07-08
category: 项目日志
tags:
  - Waline
  - Vercel
  - 评论系统
  - 部署
  - 踩坑
draft: false
pinned: false
---

## 为什么不用 Giscus 了

博客第一版评论用的是 Giscus——它直接挂在 GitHub Discussions 上，零后端、零数据库，配置几个 repoId / categoryId 就能跑。听起来很美，但有个硬伤：**访客必须登录 GitHub 才能评论**。

这对技术博客还好，但我想让更多人不登录也能留句话。于是换成 **Waline**：访客只需填昵称（甚至邮箱、网址都可省），体验更轻。

代价是——Waline **不是一个纯前端组件**。

## Waline 的真相：它是一套"前后端分离"

很多人（包括我）一开始以为，像贴 Giscus 那样贴一段 `<script>` 就完事了。错。Waline 的架构是：

```
浏览器（前端脚本）──┐
                    ├──▶  Waline 服务端（你部署的，比如 Vercel）
GitHub Pages（前端）┘         │
                             └──▶  数据库（MySQL / PostgreSQL / SQLite）
```

前端只是个脚本，评论要**存下来**，必须你自己有一个服务端 + 一个数据库。这也就是它"太难搞"的根源：**评论系统变成了一个需要部署、需要配数据库的小项目**。

## 部署到 Vercel：前半段很顺

Vercel 上 Waline 有一键模板（Vercel 按钮 / 导入仓库），连上 GitHub 账号，选 Waline 的官方仓库，点几下就部署出一个 `xxx.vercel.app` 的服务地址。这一步几分钟搞定。

拿到服务地址后，填进 `src/config/site.ts`：

```ts
walineServerURL: 'https://你的-waline.vercel.app',
```

前端这边就接上了。但——**点提交评论，报错了**。因为数据库还没配。

## 真正的坑：数据库与环境变量

Waline 支持三种数据库，坑深浅不同：

1. **SQLite**：最省事，但 **Vercel 的 Serverless 文件系统是只读/临时的**，实例一重启数据就没。所以 SQLite 在 Vercel 上**不持久**，等于没存。❌ 不能用。
2. **MySQL / PostgreSQL**：要自己有一台数据库。可以开个云数据库，或用一个 Serverless 数据库（比如 Neon 的 Postgres）。✅ 正解。

我在 Vercel 项目里配了一组环境变量（以 MySQL 为例，名字**必须完全一致**，大小写敏感）：

```
MYSQL_HOST=...
MYSQL_PORT=3306
MYSQL_DB=waline
MYSQL_USER=...
MYSQL_PASSWORD=...
MYSQL_PREFIX=wl_
```

踩过的雷，按痛感排序：

- **环境变量名拼错一个字母**（比如 `MYSQL_PASS` 而不是 `MYSQL_PASSWORD`）→ Waline 静默回退到 SQLite，评论"提交成功"但其实没存进你的库，刷新就没了。**没有任何报错提示**，最阴。
- **改完环境变量没重新部署** → Vercel 不会热加载 env，必须手动 Redeploy 一次才生效。改了半天才发现是没 redeploy。
- **数据库没建库 / 账号没授权** → 服务端连不上，前端一直转圈或 500。先拿 `mysql -h ... -u ... -p` 手动连一下验证网络和密码，比盲目改配置快得多。
- **白名单 / 防火墙** → 云数据库默认可能不允许 Vercel 的出口 IP，要在数据库侧把连接来源放开（或允许所有，看安全取舍）。

## 前端接好后的两个小修

服务端通了之后，前端还有两件事：

1. **暗色模式**：Waline v3 的 `dark` 参数传字符串选择器（如 `'html.dark'`）比传函数稳。当初我一度写成 `dark: isDark`（函数），后来改成从 DOM 的 `data-dark` 属性读 `SITE.walineDark`，构建更干净。
2. **占位保护**：`walineServerURL` 为空时，组件不加载外部脚本，只显示"评论系统待配置"提示——这样还没部署后端时，本地构建也不会去拉一个不存在的服务。

## 关机了博客还能开吗

能。这正是静态托管的爽点：

- 文章页托管在 **GitHub Pages**，域名 `disdorqin.cn` 指向 GitHub 的服务器，跟我电脑开不开没关系；
- 评论后端托管在 **Vercel**，也是外部服务器，关机照样能提交；
- 唯一会随关机消失的，是我本机起的那個 `localhost:4321` 预览服务——那只是开发时看效果用的，和线上无关。

换句话说：**我关机 = 世界上其他人照样能看博客、照样能留言。**

## 小结

Waline 比 Giscus 多了一层"自己运维后端 + 数据库"的成本，换来的是"免登录即可评论"的低门槛。值不值看你博客的调性。如果只想最少折腾，Giscus 依然是最省心的；想要开放评论，Waline + Vercel + 一个外部数据库是当下最顺的一条路——只要别在环境变量名和 redeploy 上栽跟头。

下次折腾：把 Waline 的邮件通知 / 反垃圾配一配，再写续集。
