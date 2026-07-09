#!/usr/bin/env node

/**
 * 微信朋友圈 → 博客文章导入脚本
 *
 * 读取 data/wechat-moments/moments.csv，校验、复制图片、生成 Markdown。
 *
 * 用法：
 *   node scripts/import-wechat-moments.mjs          # 正常导入
 *   node scripts/import-wechat-moments.mjs --dry-run  # 只预览不写入
 *   node scripts/import-wechat-moments.mjs --force    # 覆盖已存在的文件
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// 配置路径
// ---------------------------------------------------------------------------
const CSV_PATH = path.join(ROOT, 'data/wechat-moments/moments.csv');
const MEDIA_DIR = path.join(ROOT, 'data/wechat-moments/media');
const OUTPUT_DIR = path.join(ROOT, 'src/content/blog');
const PUBLIC_UPLOADS = path.join(ROOT, 'public/uploads/wechat-moments');

// ---------------------------------------------------------------------------
// CLI 参数
// ---------------------------------------------------------------------------
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const FORCE = args.has('--force');

// ---------------------------------------------------------------------------
// 统计
// ---------------------------------------------------------------------------
let totalRows = 0;
let imported = 0;
let skipped = 0;
let errors = 0;
let warnings = 0;

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------
function red(s)   { return `\x1b[31m${s}\x1b[0m`; }
function green(s) { return `\x1b[32m${s}\x1b[0m`; }
function yellow(s){ return `\x1b[33m${s}\x1b[0m`; }
function cyan(s)  { return `\x1b[36m${s}\x1b[0m`; }

function error(msg) { errors++; console.error(`  ${red('✗')} ${msg}`); }
function warn(msg)  { warnings++; console.log(`  ${yellow('!')} ${msg}`); }
function ok(msg)    { console.log(`  ${green('✓')} ${msg}`); }
function info(msg)  { console.log(`  ${cyan('•')} ${msg}`); }

/**
 * 简单的 CSV 解析器，支持双引号包裹的字段。
 */
function parseCSV(text) {
  const lines = [];
  let current = [];
  let field = '';
  let inQuotes = false;
  let rowStarted = true;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field.trim());
        field = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        current.push(field.trim());
        field = '';
        if (rowStarted) lines.push(current);
        current = [];
        rowStarted = true;
        if (ch === '\r') i++; // skip \n after \r
      } else if (ch === '\r') {
        current.push(field.trim());
        field = '';
        if (rowStarted) lines.push(current);
        current = [];
        rowStarted = true;
      } else {
        field += ch;
      }
    }
  }

  // 最后一行
  if (field.trim() || current.length > 0 || rowStarted) {
    current.push(field.trim());
    if (rowStarted) lines.push(current);
  }

  return lines;
}

/**
 * 从内容生成安全的 URL slug（仅数字/英文/短横线）
 */
function slugify(text, maxLen = 40) {
  // 去掉中文和特殊字符，只保留字母数字和空格
  let s = text
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, maxLen)
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // 如果 slug 为空（内容全是中文），用短横线
  if (!s) s = 'moment';
  return s;
}

/**
 * 截取前 n 个字符作为 description
 */
function truncate(text, n = 80) {
  if (text.length <= n) return text;
  return text.slice(0, n).trimEnd() + '…';
}

/**
 * 格式化 pubDate 字符串，保留 +08:00 时区
 * 当有时同时用完整 ISO 格式，否则用 YYYY-MM-DD 日期格式
 */
function formatPubDate(dateStr, timeStr) {
  if (timeStr) {
    const [h, m] = timeStr.split(':');
    return `${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+08:00`;
  }
  return dateStr;
}

/**
 * 安全的文件名——去掉路径分隔符等危险字符
 */
function safeFilename(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, '-');
}

// ---------------------------------------------------------------------------
// 主逻辑
// ---------------------------------------------------------------------------
function main() {
  console.log('');
  console.log(cyan('══════════════════════════════════════════'));
  console.log(cyan('  微信朋友圈 → 博客文章导入'));
  console.log(cyan('══════════════════════════════════════════'));
  console.log('');

  if (DRY_RUN) info('DRY RUN 模式：只预览不写入\n');
  if (FORCE)   info('FORCE 模式：覆盖已存在的文件\n');

  // 1. 检查 CSV 是否存在
  if (!fs.existsSync(CSV_PATH)) {
    error(`CSV 文件不存在：${CSV_PATH}`);
    printSummary();
    process.exit(1);
  }

  // 2. 读取并解析 CSV
  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = parseCSV(raw);

  if (lines.length < 2) {
    error('CSV 文件为空或只有表头');
    printSummary();
    process.exit(1);
  }

  // 3. 解析表头
  const header = lines[0].map(h => h.trim().toLowerCase());
  const colIdx = {
    id: header.indexOf('id'),
    date: header.indexOf('date'),
    time: header.indexOf('time'),
    title: header.indexOf('title'),
    content: header.indexOf('content'),
    images: header.indexOf('images'),
    location: header.indexOf('location'),
    visibility: header.indexOf('visibility'),
    tags: header.indexOf('tags'),
    draft: header.indexOf('draft'),
  };

  if (colIdx.date === -1) { error('CSV 缺少必填列：date'); printSummary(); process.exit(1); }
  if (colIdx.content === -1) { error('CSV 缺少必填列：content'); printSummary(); process.exit(1); }

  // 4. 确保输出目录存在
  if (!DRY_RUN) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 5. 逐行处理
  const dataRows = lines.slice(1).filter(row => row.some(c => c.length > 0));

  for (const row of dataRows) {
    totalRows++;

    const get = (idx) => (idx >= 0 && idx < row.length ? row[idx] : '');

    const id = get(colIdx.id);
    const date = get(colIdx.date);
    const time = get(colIdx.time);
    const title = get(colIdx.title);
    const content = get(colIdx.content);
    const images = get(colIdx.images);
    const location = get(colIdx.location);
    const visibility = get(colIdx.visibility);
    const tags = get(colIdx.tags);
    const draftRaw = get(colIdx.draft);

    // 校验必填字段
    if (!date) { error(`第 ${totalRows + 1} 行：date 必填`); continue; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { error(`第 ${totalRows + 1} 行：date 格式错误（需 YYYY-MM-DD）：${date}`); continue; }
    if (!content) { error(`第 ${totalRows + 1} 行（${date}）：content 必填`); continue; }

    // 校验可选 time
    if (time && !/^\d{2}:\d{2}$/.test(time)) { warn(`第 ${totalRows + 1} 行（${date}）：time 格式建议 HH:mm，当前：${time}，将忽略`); }

    // 生成 pubDate 字符串，保留 +08:00 时区
    const pubDateStr = formatPubDate(date, time);

    // 生成 title
    const finalTitle = title || `${date} 的朋友圈`;

    // 自动生成 id（如果没有）
    const finalId = id || `moment-${date.replace(/-/g, '')}-${time ? time.replace(/:/g, '') : '0000'}`;

    // 生成 slug
    const slugBase = slugify(content);
    const slugTime = time ? `-${time.replace(/:/g, '-')}` : '';
    const slug = `moment-${date}${slugTime}-${slugBase}`;

    const filename = `${safeFilename(slug)}.md`;
    const filepath = path.join(OUTPUT_DIR, filename);

    // 检查是否已存在
    if (fs.existsSync(filepath) && !FORCE) {
      warn(`文件已存在，跳过：${filename}（使用 --force 覆盖）`);
      skipped++;
      continue;
    }

    // 处理图片
    const imageList = images
      ? images.split(';').map(s => s.trim()).filter(Boolean)
      : [];

    const copiedImages = [];
    if (imageList.length > 0) {
      const year = date.slice(0, 4);
      const month = date.slice(5, 7);
      const targetDir = path.join(PUBLIC_UPLOADS, year, month);
      const publicPrefix = `/uploads/wechat-moments/${year}/${month}/`;

      if (!DRY_RUN) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      for (const img of imageList) {
        const srcPath = path.join(MEDIA_DIR, img);
        if (!fs.existsSync(srcPath)) {
          warn(`图片不存在：${img}（将跳过此图片）`);
          continue;
        }
        const targetPath = path.join(targetDir, img);
        if (!DRY_RUN) {
          fs.copyFileSync(srcPath, targetPath);
        }
        copiedImages.push(`${publicPrefix}${img}`);
      }
    }

    // 处理 tags
    const tagList = ['朋友圈'];
    if (tags) {
      tags.split(';').map(t => t.trim()).filter(Boolean).forEach(t => {
        if (!tagList.includes(t)) tagList.push(t);
      });
    }

    // 处理 draft
    const isDraft = draftRaw.toLowerCase() === 'true' || draftRaw === '1' || draftRaw === '';

    // 生成 description
    const description = truncate(content);

    // 构建 frontmatter
    const fmLines = [
      '---',
      `title: "${finalTitle.replace(/"/g, '\\"')}"`,
      `description: "${description.replace(/"/g, '\\"')}"`,
      `pubDate: ${pubDateStr}`,
      `category: "朋友圈归档"`,
    ];

    if (tagList.length > 0) {
      fmLines.push(`tags: [${tagList.map(t => `"${t}"`).join(', ')}]`);
    }

    if (copiedImages.length > 0) {
      fmLines.push(`cover: "${copiedImages[0]}"`);
    }

    fmLines.push(`draft: ${isDraft}`);
    fmLines.push('pinned: false');
    fmLines.push('---');

    // 构建正文
    const bodyLines = [];

    // 朋友圈原文
    bodyLines.push(content);
    bodyLines.push('');

    // 位置
    if (location) {
      bodyLines.push(`> **位置**：${location}`);
    }

    // 可见范围
    if (visibility) {
      bodyLines.push(`> **可见范围**：${visibility}`);
    }

    // 图片
    if (copiedImages.length > 0) {
      bodyLines.push('');
      for (const img of copiedImages) {
        const imgName = path.basename(img);
        bodyLines.push(`![${imgName}](${img})`);
      }
    }

    const markdown = fmLines.join('\n') + '\n\n' + bodyLines.join('\n') + '\n';

    // 写入文件
    if (!DRY_RUN) {
      fs.writeFileSync(filepath, markdown, 'utf-8');
    }

    imported++;
    const action = DRY_RUN ? yellow('[DRY-RUN]') : green('[OK]');
    console.log(`  ${action} ${filename}`);
    if (copiedImages.length > 0) {
      info(`     图片：${copiedImages.length} 张`);
    }
  }

  printSummary();
}

function printSummary() {
  console.log('');
  console.log(cyan('──────────────────────────────'));
  console.log(`${green('导入完成')}：`);
  console.log(`  总行数：   ${totalRows}`);
  console.log(`  已导入：   ${green(String(imported))}`);
  console.log(`  跳过：     ${skipped > 0 ? yellow(String(skipped)) : String(skipped)}`);
  console.log(`  错误：     ${errors > 0 ? red(String(errors)) : String(errors)}`);
  console.log(`  警告：     ${warnings > 0 ? yellow(String(warnings)) : String(warnings)}`);

  if (DRY_RUN && imported > 0) {
    info('这只是预览，未写入任何文件。去掉 --dry-run 执行实际导入。');
  }

  if (imported > 0 && !DRY_RUN) {
    info(`文章已生成到 src/content/blog/`);
    if (imported > 0) {
      info(`所有文章默认 draft: true，检查无误后改为 draft: false 即可发布。`);
    }
  }

  if (errors > 0) {
    process.exit(1);
  }
}

main();
