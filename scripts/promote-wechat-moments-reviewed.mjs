#!/usr/bin/env node

/**
 * 将 review CSV 中 ready=true 的行 promote 到 moments.csv，供 import 脚本使用。
 *
 * 校验规则：
 *   - ready 必须为 true
 *   - date 必填（格式 YYYY-MM-DD）
 *   - content 必填
 *   - time 可选
 *   - title 可选（不填自动生成）
 *
 * 用法：
 *   node scripts/promote-wechat-moments-reviewed.mjs
 *   node scripts/promote-wechat-moments-reviewed.mjs --dry-run
 *   node scripts/promote-wechat-moments-reviewed.mjs --force
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const REVIEW_CSV = join(ROOT, 'data/wechat-moments/moments.review.csv');
const MOMENTS_CSV = join(ROOT, 'data/wechat-moments/moments.csv');

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const FORCE = args.has('--force');

// ── Colors ────────────────────────────────────────────────────────────────
const G = (s) => `\x1b[32m${s}\x1b[0m`;
const Y = (s) => `\x1b[33m${s}\x1b[0m`;
const R = (s) => `\x1b[31m${s}\x1b[0m`;
const C = (s) => `\x1b[36m${s}\x1b[0m`;

let promoted = 0;
let skipped = 0;
let errors = 0;
let warnings = 0;

function error(msg) { errors++; console.error(`  ${R('✗')} ${msg}`); }
function warn(msg)  { warnings++; console.log(`  ${Y('!')} ${msg}`); }
function ok(msg)    { console.log(`  ${G('✓')} ${msg}`); }
function info(msg)  { console.log(`  ${C('•')} ${msg}`); }

// ── CSV parser (same as import script) ──────────────────────────────────
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
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { current.push(field.trim()); field = ''; }
      else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        current.push(field.trim()); field = '';
        lines.push(current); current = [];
        if (ch === '\r') i++;
      } else if (ch === '\r') {
        current.push(field.trim()); field = '';
        lines.push(current); current = [];
      } else { field += ch; }
    }
  }

  if (field.trim() || current.length > 0) {
    current.push(field.trim());
    lines.push(current);
  }

  return lines;
}

function csvEscape(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ── Main ──────────────────────────────────────────────────────────────────
function main() {
  console.log(`\n${C('══════════════════════════════════════════')}`);
  console.log(`${C('  Promote review → moments.csv')}`);
  console.log(`${C('══════════════════════════════════════════')}\n`);

  if (DRY_RUN) info('DRY RUN 模式：只检查不写入\n');

  // Check review CSV
  if (!existsSync(REVIEW_CSV)) {
    error(`review CSV 不存在: ${REVIEW_CSV}\n请先编辑并保存 data/wechat-moments/moments.review.csv`);
    printSummary();
    process.exit(1);
  }

  const raw = readFileSync(REVIEW_CSV, 'utf-8');
  const rows = parseCSV(raw);

  if (rows.length < 2) {
    error('review CSV 为空或只有表头');
    printSummary();
    process.exit(1);
  }

  // Map headers
  const header = rows[0].map(h => h.trim().toLowerCase());
  const idx = {
    ready:        header.indexOf('ready'),
    id:           header.indexOf('id'),
    date:         header.indexOf('date'),
    time:         header.indexOf('time'),
    title:        header.indexOf('title'),
    content:      header.indexOf('content'),
    images:       header.indexOf('images'),
    location:     header.indexOf('location'),
    visibility:   header.indexOf('visibility'),
    tags:         header.indexOf('tags'),
    draft:        header.indexOf('draft'),
    sourceScreenshot: header.indexOf('sourcescreenshot'),
    notes:        header.indexOf('notes'),
  };

  // Date validation
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const TIME_RE = /^\d{2}:\d{2}$/;

  // Process rows
  const promotedRows = [];
  const dataRows = rows.slice(1).filter(row => row.some(c => c.length > 0));

  for (const row of dataRows) {
    const get = (i) => (i >= 0 && i < row.length ? row[i] : '');

    const ready       = get(idx.ready).toLowerCase();
    const id          = get(idx.id);
    const date        = get(idx.date);
    const time        = get(idx.time);
    const title       = get(idx.title);
    const content     = get(idx.content);
    const images      = get(idx.images);
    const location    = get(idx.location);
    const visibility  = get(idx.visibility);
    const tags        = get(idx.tags);
    const draft       = get(idx.draft);
    const notes       = get(idx.notes);

    if (ready !== 'true') {
      skipped++;
      info(`跳过: ${id || '?'} (ready=${ready})`);
      continue;
    }

    // Validate
    let rowErrors = 0;

    if (!date) { error(`${id || '?'}: date 必填`); rowErrors++; }
    else if (!DATE_RE.test(date)) { error(`${id || '?'}: date 格式错误（需 YYYY-MM-DD）: ${date}`); rowErrors++; }

    if (!content) { error(`${id || '?'}: content 必填`); rowErrors++; }

    if (time && !TIME_RE.test(time)) {
      warn(`${id || '?'}: time 格式建议 HH:mm，当前: ${time}，将忽略`);
    }

    if (rowErrors > 0) continue;

    // Determine draft value
    const draftVal = draft.toLowerCase() === 'false' ? 'false' : 'true';

    promotedRows.push({
      id: id || '',
      date,
      time,
      title,
      content,
      images,
      location,
      visibility,
      tags: tags || '朋友圈;生活切片',
      draft: draftVal,
    });

    const idDisplay = id || `auto-${date}`;
    ok(`${idDisplay}: ${date}${time ? ' ' + time : ''} — ${content.slice(0, 40)}...`);
    promoted++;
  }

  // Write moments.csv
  if (promotedRows.length === 0) {
    warn('没有 ready=true 的行可 promote');
  } else {
    const HEADER = 'id,date,time,title,content,images,location,visibility,tags,draft';
    const csvLines = [HEADER];

    for (const r of promotedRows) {
      const title = r.title || `${r.date} 的朋友圈`;
      csvLines.push([
        csvEscape(r.id),
        r.date,
        r.time,
        csvEscape(title),
        csvEscape(r.content),
        csvEscape(r.images),
        csvEscape(r.location),
        csvEscape(r.visibility),
        r.tags,
        r.draft,
      ].join(','));
    }

    // Load existing moments.csv and merge (avoid duplicate ids)
    let existingLines = [];
    if (existsSync(MOMENTS_CSV) && !FORCE) {
      const existingRaw = readFileSync(MOMENTS_CSV, 'utf-8');
      const existing = parseCSV(existingRaw);
      // Keep header
      existingLines = existing.slice(1).filter(r => r.some(c => c.length > 0));
      if (existingLines.length > 0) {
        info(`现有 moments.csv 有 ${existingLines.length} 行${FORCE ? '，将被覆盖' : '，不覆盖现有'}`);
        if (!FORCE) {
          warn('使用 --force 覆盖现有 moments.csv（保留表头）');
          // Keep existing rows - only append new ones that aren't duplicates
          // Simple approach: keep existing, we don't try to dedup by id here
        }
      }
    }

    // Dedup by id
    const existingIds = new Set(existingLines.map(r => r[0]?.trim()).filter(Boolean));
    const newRows = promotedRows.filter(r => !existingIds.has(r.id));

    const allRows = [];
    if (!FORCE && existingLines.length > 0) {
      // Keep existing header and rows, append only truly new
      const existingHeader = readFileSync(MOMENTS_CSV, 'utf-8').split('\n')[0];
      if (existingHeader) csvLines[0] = existingHeader;
      // Bring in existing rows
      for (const r of existingLines) {
        allRows.push(r.join(','));
      }
    }

    for (const r of newRows) {
      const title = r.title || `${r.date} 的朋友圈`;
      allRows.push([
        csvEscape(r.id),
        r.date,
        r.time,
        csvEscape(title),
        csvEscape(r.content),
        csvEscape(r.images),
        csvEscape(r.location),
        csvEscape(r.visibility),
        r.tags,
        r.draft,
      ].join(','));
    }

    const content = [csvLines[0], ...allRows].join('\n') + '\n';

    if (!DRY_RUN) {
      writeFileSync(MOMENTS_CSV, content, 'utf-8');
    }

    console.log(`\n${C('──────────────────────────────')}`);
    info(`新行: ${newRows.length}`);
    if (!FORCE && existingLines.length > 0) info(`保留现有: ${existingLines.length} 行`);
    if (DRY_RUN) info(`DRY RUN: 不写入 ${MOMENTS_CSV}`);
    else ok(`已写入: ${MOMENTS_CSV}`);
  }

  printSummary();
}

function printSummary() {
  console.log(`\n${C('──────────────────────────────')}`);
  console.log(`${G('Promote 完成')}:`);
  console.log(`  Promote:  ${G(String(promoted))}`);
  console.log(`  跳过:     ${skipped > 0 ? Y(String(skipped)) : String(skipped)}`);
  console.log(`  错误:     ${errors > 0 ? R(String(errors)) : String(errors)}`);
  console.log(`  警告:     ${warnings > 0 ? Y(String(warnings)) : String(warnings)}`);

  if (DRY_RUN) {
    info('DRY RUN 模式已启用，未写入任何文件');
  }

  if (promoted > 0 && !DRY_RUN) {
    info(`下一步: npm run import:wechat-moments`);
  }

  if (errors > 0) process.exit(1);
}

main();
