/**
 * 站点全局配置。修改站点信息、导航、Giscus 评论参数都在这里集中处理。
 */
export const SITE = {
  // —— 基础信息 ——
  title: 'Disdorqin Field',
  description: '科研、电力预测、项目日志与 Vibe Coding 实验场',
  author: 'Disdorqin',
  githubUsername: 'disdorqin',
  url: 'https://disdorqin.cn',
  lang: 'zh-CN',

  // GitHub 仓库（用于导航、GitHub 入口、RSS 等）
  repo: 'disdorqin/disdorqin.github.io',

  // —— 导航 ——
  nav: [
    { label: '首页', href: '/' },
    { label: '博客', href: '/blog/' },
    { label: 'ECUST', href: '/ecust/' },
    { label: '归档', href: '/moments/' },
    { label: '分类', href: '/categories/' },
    { label: '标签', href: '/tags/' },
    { label: '关于', href: '/about/' },
    { label: '留言', href: '/guestbook/' },
    { label: '搜索', href: '/search/' },
    { label: '后台', href: '/admin/' },
  ],

  // —— 分类定义（与 .pages.yml 的 select options 保持一致）——
  categories: ['科研笔记', '电力预测', '机器学习', '项目日志', 'Vibe Coding', '杂谈', '朋友圈归档', '生活切片'] as const,

  // —— Giscus 评论系统（占位配置，部署前请替换为真实值）——
  // 生成真实参数见 README：https://giscus.app
  giscusRepo: 'disdorqin/disdorqin.github.io',
  giscusRepoId: 'R_kgDOTA6eqg',
  giscusCategory: 'Announcements',
  giscusCategoryId: 'DIC_kwDOTA6eqs4DAwiT',
  giscusMapping: 'pathname',
  giscusTheme: 'preferred_color_scheme',

  // —— Waline 评论系统（默认启用）——
  // Waline 需要单独部署服务端，数据存储在 Waline 连接的数据库中。
  // walineServerURL 为空时页面显示配置提示，不会加载 Waline 脚本。
  commentProvider: 'waline',
  walineServerURL: 'https://my-waline-eta-swart.vercel.app',
  walineLang: 'zh-CN',
  walineDark: 'html.dark',
  walineLogin: 'disable',
  walineRequiredMeta: ['nick'],
  walineMeta: ['nick', 'mail', 'link'],
  walineCommentSorting: 'latest',

  // —— 评论图片上传（MVP：前端压缩后转 Base64 写入评论，不建后端）——
  walineImageUpload: true,
  walineImageMaxSizeMB: 5,
  walineImageMaxWidth: 1600,
  walineImageQuality: 0.82,
} as const;

export type SiteConfig = typeof SITE;
