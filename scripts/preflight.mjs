/**
 * 上线前检查（preflight）。
 * 不依赖任何第三方包，纯 Node 内置模块。
 *
 * 退出码：
 *   0 = 全部通过（含 Giscus 未配置的“仅提示”）
 *   1 = 存在阻断性问题（应阻止构建/部署）
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// 预期站点地址（自定义域名 disdorqin.cn，无 base）
const EXPECTED_SITE = 'https://disdorqin.cn';
const GISCUS_PLACEHOLDER_REPO_ID = 'YOUR_REPO_ID';
const GISCUS_PLACEHOLDER_CATEGORY_ID = 'YOUR_CATEGORY_ID';

let failures = 0;
let warnings = 0;

function ok(msg) {
  console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
}
function fail(msg) {
  failures++;
  console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
}
function warn(msg) {
  warnings++;
  console.log(`  \x1b[33m!\x1b[0m ${msg}`);
}
function info(msg) {
  console.log(`  \x1b[36m•\x1b[0m ${msg}`);
}
function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

// ---------------------------------------------------------------------------
// 1) 结构检查
// ---------------------------------------------------------------------------
section('结构检查');
const mustExist = [
  'package.json',
  'astro.config.mjs',
  '.pages.yml',
  'src/content.config.ts',
  'public/uploads',
  '.github/workflows/deploy.yml',
];
for (const p of mustExist) {
  if (existsSync(join(ROOT, p))) ok(`${p} 存在`);
  else fail(`${p} 缺失`);
}

// src/content/blog 至少一篇文章
const blogDir = join(ROOT, 'src/content/blog');
let posts = [];
if (existsSync(blogDir)) {
  posts = readdirSync(blogDir).filter((f) => /\.(md|mdx)$/i.test(f));
  if (posts.length > 0) ok(`src/content/blog/ 有 ${posts.length} 篇文章`);
  else fail('src/content/blog/ 没有任何文章');
} else {
  fail('src/content/blog/ 目录不存在');
}

// astro.config.mjs 的 site / base
const cfgPath = join(ROOT, 'astro.config.mjs');
if (existsSync(cfgPath)) {
  const cfg = readFileSync(cfgPath, 'utf8');
  const siteMatch = cfg.match(/site\s*:\s*['"`]([^'"`]+)['"`]/);
  if (siteMatch && siteMatch[1] === EXPECTED_SITE) ok(`site = ${siteMatch[1]}`);
  else fail(`astro.config.mjs 中 site 必须为 ${EXPECTED_SITE}`);

  // base 不应配置（用户页 / 自定义域名场景无需 base）
  if (/\bbase\s*:\s*['"`]/.test(cfg)) fail('astro.config.mjs 不应配置 base（用户页仓库无需 base）');
  else ok('未配置 base（符合用户页仓库规范）');
}

// ---------------------------------------------------------------------------
// 2) 暂存区不应包含构建产物
// ---------------------------------------------------------------------------
section('Git 暂存区检查（dist/ 与 node_modules/ 不得被提交）');
let staged = '';
try {
  staged = execSync('git diff --cached --name-only', { cwd: ROOT, encoding: 'utf8' });
} catch {
  staged = '';
}
const stagedLines = staged.split('\n').filter(Boolean);
const badStaged = stagedLines.filter((l) => l.startsWith('dist/') || l.startsWith('node_modules/'));
if (badStaged.length === 0) ok('暂存区不含 dist/ 或 node_modules/');
else badStaged.forEach((l) => fail(`暂存区包含不应提交的文件：${l}`));

// ---------------------------------------------------------------------------
// 3) Frontmatter 校验
// ---------------------------------------------------------------------------
section('文章 Frontmatter 校验');
const slugSet = new Map();

function unquote(s) {
  return s.replace(/^['"]|['"]$/g, '').trim();
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const body = m[1];
  const data = {};
  let currentKey = null;
  let expectList = false;
  for (const line of body.split(/\r?\n/)) {
    const listItem = line.match(/^\s*-\s+(.+)$/);
    if (listItem && currentKey && expectList) {
      data[currentKey].push(unquote(listItem[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (kv) {
      currentKey = kv[1];
      let v = kv[2].trim();
      if (v === '') {
        data[currentKey] = [];
        expectList = true;
        continue;
      }
      expectList = false;
      if (v.startsWith('[') && v.endsWith(']')) {
        const inner = v.slice(1, -1).trim();
        data[currentKey] = inner === '' ? [] : inner.split(',').map((x) => unquote(x));
      } else {
        let val = unquote(v);
        // 还原 YAML 基础标量类型，使其与 Astro content schema 一致
        if (val === 'true') val = true;
        else if (val === 'false') val = false;
        else if (val === 'null') val = null;
        else if (/^-?\d+$/.test(val)) val = Number(val);
        data[currentKey] = val;
      }
    }
  }
  return data;
}

function isUrl(s) {
  return /^https?:\/\//i.test(s);
}

for (const file of posts) {
  const full = join(blogDir, file);
  const raw = readFileSync(full, 'utf8');
  const fm = parseFrontmatter(raw);
  const slug = file.replace(/\.(md|mdx)$/i, '');
  const label = `《${file}》`;

  if (!fm) {
    fail(`${label} 缺少有效 frontmatter（--- 包裹的 YAML）`);
    continue;
  }

  if (typeof fm.title === 'string' && fm.title.length > 0) ok(`${label} title 存在`);
  else fail(`${label} title 必填`);

  if (typeof fm.description === 'string' && fm.description.length > 0) ok(`${label} description 存在`);
  else fail(`${label} description 必填`);

  if (fm.pubDate) ok(`${label} pubDate 存在`);
  else fail(`${label} pubDate 必填`);

  if (typeof fm.category === 'string' && fm.category.length > 0) ok(`${label} category 存在`);
  else fail(`${label} category 必填`);

  if (Array.isArray(fm.tags)) ok(`${label} tags 为数组（${fm.tags.length}）`);
  else fail(`${label} tags 必须是数组`);

  // draft / pinned 必须是 boolean 或可省略
  for (const boolKey of ['draft', 'pinned']) {
    if (!(boolKey in fm)) {
      ok(`${label} ${boolKey} 省略（默认 false）`);
    } else if (fm[boolKey] === true || fm[boolKey] === false) {
      ok(`${label} ${boolKey} 为 boolean`);
    } else {
      fail(`${label} ${boolKey} 必须是 boolean（当前：${JSON.stringify(fm[boolKey])}）`);
    }
  }

  // cover 若存在，须以 /uploads/ 开头或合法外链
  if ('cover' in fm && fm.cover) {
    if (fm.cover.startsWith('/uploads/') || isUrl(fm.cover)) ok(`${label} cover 路径合法（${fm.cover}）`);
    else fail(`${label} cover 必须以 /uploads/ 开头或合法外链（当前：${fm.cover}）`);
  }

  // 重复 slug
  if (slugSet.has(slug)) fail(`检测到重复 slug：${slug}（${file} 与 ${slugSet.get(slug)}）`);
  else slugSet.set(slug, file);
}

// ---------------------------------------------------------------------------
// 4) Giscus 配置（占位仅提示，不阻断构建）
// ---------------------------------------------------------------------------
section('Giscus 评论配置');
const siteTsPath = join(ROOT, 'src/config/site.ts');
let giscusPlaceholder = false;
if (existsSync(siteTsPath)) {
  const s = readFileSync(siteTsPath, 'utf8');
  if (s.includes(GISCUS_PLACEHOLDER_REPO_ID) || s.includes(GISCUS_PLACEHOLDER_CATEGORY_ID)) {
    giscusPlaceholder = true;
  }
}
if (giscusPlaceholder) {
  warn('Giscus 仍为占位参数（YOUR_REPO_ID / YOUR_CATEGORY_ID）。组件将只显示“评论系统待配置”，不影响构建与部署。见 README「Giscus 配置步骤」替换真实值。');
} else {
  ok('Giscus 已配置真实参数');
}

// ---------------------------------------------------------------------------
// 结果
// ---------------------------------------------------------------------------
console.log('\n────────────────────────────');
if (failures === 0) {
  console.log(`\x1b[32mPASSED\x1b[0m：结构、暂存区、frontmatter 全部通过${warnings ? `（${warnings} 条提示）` : ''}`);
  process.exit(0);
} else {
  console.log(`\x1b[31mFAILED\x1b[0m：发现 ${failures} 个阻断性问题${warnings ? `，${warnings} 条提示` : ''}`);
  process.exit(1);
}
