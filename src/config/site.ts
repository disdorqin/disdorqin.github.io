/**
 * 站点全局配置。修改站点信息、导航、Giscus 评论参数都在这里集中处理。
 */
export const SITE = {
  // —— 基础信息 ——
  title: 'Disdorqin Field',
  description: '科研、电力预测、项目日志与 Vibe Coding 实验场',
  author: 'Disdorqin',
  githubUsername: 'disdorqin',
  url: 'https://disdorqin.github.io',
  lang: 'zh-CN',

  // GitHub 仓库（用于导航、GitHub 入口、RSS 等）
  repo: 'disdorqin/disdorqin.github.io',

  // —— 导航 ——
  nav: [
    { label: '首页', href: '/' },
    { label: '博客', href: '/blog/' },
    { label: '分类', href: '/categories/' },
    { label: '标签', href: '/tags/' },
    { label: '关于', href: '/about/' },
    { label: '留言', href: '/guestbook/' },
    { label: '搜索', href: '/search/' },
  ],

  // —— 分类定义（与 .pages.yml 的 select options 保持一致）——
  categories: ['科研笔记', '电力预测', '机器学习', '项目日志', 'Vibe Coding', '杂谈'] as const,

  // —— Giscus 评论系统（占位配置，部署前请替换为真实值）——
  // 生成真实参数见 README：https://giscus.app
  giscusRepo: 'disdorqin/disdorqin.github.io',
  giscusRepoId: 'YOUR_REPO_ID', // ← 替换为真实 repoId
  giscusCategory: 'Announcements',
  giscusCategoryId: 'YOUR_CATEGORY_ID', // ← 替换为真实 categoryId
  giscusMapping: 'pathname',
  giscusTheme: 'dark',
} as const;

export type SiteConfig = typeof SITE;
