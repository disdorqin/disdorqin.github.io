// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// 使用自定义域名 disdorqin.cn，site 设为其根域名，不配置 base。
export default defineConfig({
  site: 'https://disdorqin.cn',
  trailingSlash: 'ignore',
  integrations: [mdx(), sitemap()],
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
    shikiConfig: {
      // 双主题：根据 <html> 的 dark/light class 切换
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      wrap: true,
    },
  },
});
