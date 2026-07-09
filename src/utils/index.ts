/** 格式化日期为中文：2026年07月08日（使用 Asia/Shanghai 时区） */
export function formatDate(date: Date): string {
  const [y, m, d] = date
    .toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
    .split('-');
  return `${y}年${m}月${d}日`;
}

/** 估算阅读时间（分钟）。中文按字符数计，英文按词数计。 */
export function readingTime(text: string): number {
  const cjk = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
  const withoutCjk = text.replace(/[一-鿿㐀-䶿]/g, ' ');
  const words = (withoutCjk.match(/\b\w+\b/g) || []).length;
  const minutes = Math.ceil(cjk / 350 + words / 200);
  return Math.max(1, minutes);
}

/**
 * 将任意字符串转为 URL 安全的 slug。
 * 中文等非 ASCII 字符会被保留（Astro 会自动编码），
 * 空格与非法字符替换为连字符。
 */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** 对分类 / 标签 URL 参数做编码（避免中文空格导致 404） */
export function encodeParam(value: string): string {
  return encodeURIComponent(value);
}
