#!/usr/bin/env node

/**
 * 从 OCR 结果生成 review CSV。
 *
 * 读取最新 capture session 的 ocr/*.json，生成：
 *   data/wechat-moments/moments.review.csv
 *
 * 每张截图生成一行，内容为 OCR 提取的文本。
 * 日期/时间仅当 OCR 识别到类似格式时才预填，需人工校对。
 *
 * 用法：
 *   node scripts/build-wechat-moments-review.mjs
 *   node scripts/build-wechat-moments-review.mjs --session session-20260709-123456
 *   node scripts/build-wechat-moments-review.mjs --all-screens  # 每张截图单独一行
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const RAW_DIR = join(ROOT, 'data/wechat-moments/raw');
const REVIEW_CSV = join(ROOT, 'data/wechat-moments/moments.review.csv');

const args = process.argv.slice(2);
const SESSION_NAME = args.find(a => a.startsWith('--session='))?.split('=')[1];
const ALL_SCREENS = args.includes('--all-screens');

// ── Colors ────────────────────────────────────────────────────────────────
const G = (s) => `\x1b[32m${s}\x1b[0m`;
const Y = (s) => `\x1b[33m${s}\x1b[0m`;
const R = (s) => `\x1b[31m${s}\x1b[0m`;
const C = (s) => `\x1b[36m${s}\x1b[0m`;

// ── Find latest session ──────────────────────────────────────────────────
function findLatestSession() {
  if (SESSION_NAME) {
    const d = join(RAW_DIR, SESSION_NAME);
    if (!existsSync(d)) throw new Error(`Session 目录不存在: ${d}`);
    return d;
  }

  const dirs = readdirSync(RAW_DIR)
    .filter(d => d.startsWith('session-'))
    .map(d => ({ name: d, mtime: statSync(join(RAW_DIR, d)).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  if (dirs.length === 0) throw new Error(`未找到 session 目录（${RAW_DIR}/session-*）\n请先运行 npm run capture:wechat-moments`);
  return join(RAW_DIR, dirs[0].name);
}

// ── CSV helpers ──────────────────────────────────────────────────────────
function csvEscape(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ── Date detection ────────────────────────────────────────────────────────
const DATE_RE = /(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/;
const TIME_RE = /(\d{1,2}):(\d{2})(?::(\d{2}))?/;
const RELATIVE_TIME_RE = /(\d+)\s*(分钟|小时|天|月|年)\s*前/;

function detectDate(text) {
  const m = text.match(DATE_RE);
  if (m) {
    const y = m[1], mo = m[2].padStart(2, '0'), d = m[3].padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  return '';
}

function detectTime(text) {
  const m = text.match(TIME_RE);
  if (m) {
    return `${m[1].padStart(2, '0')}:${m[2]}`;
  }
  return '';
}

// ── Main ──────────────────────────────────────────────────────────────────
function main() {
  console.log(`\n${C('══════════════════════════════════════════')}`);
  console.log(`${C('  生成 review CSV')}`);
  console.log(`${C('══════════════════════════════════════════')}\n`);

  // Find session
  const sessionDir = findLatestSession();
  console.log(`  会话目录: ${sessionDir}`);

  // Load OCR JSONs
  const ocrDir = join(sessionDir, 'ocr');
  if (!existsSync(ocrDir)) {
    throw new Error(`OCR 目录不存在: ${ocrDir}\n请先运行 npm run ocr:wechat-moments`);
  }

  const ocrFiles = readdirSync(ocrDir)
    .filter(f => f.endsWith('.json'))
    .sort();

  if (ocrFiles.length === 0) {
    throw new Error(`OCR 目录为空: ${ocrDir}\n请先运行 npm run ocr:wechat-moments`);
  }

  console.log(`  OCR 文件: ${ocrFiles.length}\n`);

  // Load capture log for context
  const logPath = join(sessionDir, 'capture-log.json');
  let captureLog = null;
  if (existsSync(logPath)) {
    try {
      captureLog = JSON.parse(readFileSync(logPath, 'utf-8'));
    } catch {}
  }

  // Build rows
  const ROWS = [];
  let idCounter = 0;

  for (const ocrFile of ocrFiles) {
    const ocrPath = join(ocrDir, ocrFile);
    const data = JSON.parse(readFileSync(ocrPath, 'utf-8'));
    const lines = data.lines || [];
    const screenshotName = data.source || ocrFile.replace('.json', '.png');

    // Sort by Y-coordinate (top to bottom)
    lines.sort((a, b) => a.bbox?.[0]?.[1] ?? 0 - b.bbox?.[0]?.[1] ?? 0);

    // Extract text
    const allText = lines.map(l => l.text).join('\n');
    const avgConf = lines.length > 0
      ? (lines.reduce((s, l) => s + l.confidence, 0) / lines.length)
      : 0;

    // Detect date/time from OCR text
    const guessedDate = detectDate(allText);
    const guessedTime = detectTime(allText);

    // Generate notes
    const notes = [];
    if (avgConf > 0 && avgConf < 0.7) notes.push(`OCR置信度较低(${avgConf.toFixed(2)})`);
    if (avgConf === 0) notes.push(`无OCR结果，可能需手动填写`);
    if (guessedDate) notes.push(`自动检测到日期: ${guessedDate}（请核实）`);
    if (guessedTime) notes.push(`自动检测到时间: ${guessedTime}（请核实）`);
    notes.push(`来源截图: ${screenshotName}`);

    idCounter++;
    const rowId = `moment-review-${String(idCounter).padStart(3, '0')}`;

    ROWS.push({
      ready: 'false',
      id: rowId,
      date: guessedDate,
      time: guessedTime,
      title: guessedDate ? `${guessedDate} 的朋友圈` : '',
      content: allText,
      images: '',
      location: '',
      visibility: '',
      tags: '朋友圈;生活切片',
      draft: 'true',
      sourceScreenshot: screenshotName,
      notes: notes.join('；'),
    });
  }

  // Capture log summary
  if (captureLog) {
    console.log(`  ${C('会话信息:')}`);
    console.log(`  总截图: ${captureLog.totalScreenshots || '?'}`);
    console.log(`  不重复: ${captureLog.uniqueScreenshots || '?'}`);
    console.log(`  停止原因: ${captureLog.stoppedReason || '?'}`);
  }

  // Write CSV
  const HEADER = 'ready,id,date,time,title,content,images,location,visibility,tags,draft,sourceScreenshot,notes';
  const csvLines = [HEADER];

  for (const row of ROWS) {
    csvLines.push([
      row.ready,
      row.id,
      row.date,
      row.time,
      csvEscape(row.title),
      csvEscape(row.content),
      row.images,
      row.location,
      row.visibility,
      row.tags,
      row.draft,
      row.sourceScreenshot,
      csvEscape(row.notes),
    ].join(','));
  }

  writeFileSync(REVIEW_CSV, csvLines.join('\n') + '\n', 'utf-8');

  console.log(`\n  ${G('✓')} 已生成: ${REVIEW_CSV}`);
  console.log(`  行数: ${ROWS.length}（每行对应一张截图，单张截图可能含多条朋友圈）`);

  // Print preview
  console.log(`\n${C('前 3 行预览:')}`);
  for (let i = 0; i < Math.min(3, ROWS.length); i++) {
    const r = ROWS[i];
    const preview = r.content.replace(/\n/g, '↵').slice(0, 80);
    console.log(`  ${i+1}. [${r.date || '??'}] ${preview}...`);
  }

  console.log(`\n${Y('⚠ 重要提醒:')}`);
  console.log(`  1. 请用 Excel / VS Code / 文本编辑器打开 review CSV`);
  console.log(`  2. 每行对应一张截图（含多条朋友圈），请自行拆分/合并`);
  console.log(`  3. 确认日期(date)和时间(time)是否正确`);
  console.log(`  4. 如果有图片，手动放入 data/wechat-moments/media/`);
  console.log(`     并在 images 列填写文件名（如 2020-01-01-1.jpg）`);
  console.log(`  5. 确认无误后，把 ready 改为 true`);
  console.log(`  6. 运行 npm run promote:wechat-moments 导入`);
  console.log(`\n${C('下一步:')} 编辑 moments.review.csv → 改 ready=true → npm run promote:wechat-moments\n`);
}

main();
