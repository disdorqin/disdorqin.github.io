#!/usr/bin/env node

/**
 * 微信朋友圈截图采集脚本（MVP）
 *
 * 前提：手机已通过 USB 连接 / 模拟器已启动，adb 可识别。
 *       手机已手动打开 微信 → 我 → 朋友圈 → 我的朋友圈
 *
 * 用法：
 *   node scripts/capture-wechat-moments.mjs
 *   node scripts/capture-wechat-moments.mjs --max-screens 30 --delay 1500
 *   node scripts/capture-wechat-moments.mjs --dry-run
 */

import { execSync, exec } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const RAW_DIR = join(ROOT, 'data/wechat-moments/raw');

// ── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const MAX_SCREENS = parseInt(args.find(a => a.startsWith('--max-screens='))?.split('=')[1] ?? '50', 10);
const DELAY_MS    = parseInt(args.find(a => a.startsWith('--delay='))?.split('=')[1] ?? '1500', 10);
const DRY_RUN     = args.includes('--dry-run');

// ── Colors ────────────────────────────────────────────────────────────────
const G = (s) => `\x1b[32m${s}\x1b[0m`;
const Y = (s) => `\x1b[33m${s}\x1b[0m`;
const R = (s) => `\x1b[31m${s}\x1b[0m`;
const C = (s) => `\x1b[36m${s}\x1b[0m`;

// ── Helpers ───────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function adb(...args) {
  const cmd = `adb ${args.join(' ')}`;
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 10000 }).trim();
  } catch (e) {
    throw new Error(`adb 命令失败: ${cmd}\n${e.stderr?.toString() || e.message}`);
  }
}

function md5(buf) {
  return createHash('md5').update(buf).digest('hex');
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function waitForEnter(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, () => { rl.close(); resolve(); });
  });
}

// ── Check adb ─────────────────────────────────────────────────────────────
function checkAdb() {
  try {
    const ver = execSync('adb version', { encoding: 'utf-8', timeout: 5000 });
    console.log(`  ${G('✓')} adb 可用: ${ver.split('\n')[0]}`);
  } catch {
    console.error(`  ${R('✗')} adb 未安装。请先安装 Android Platform Tools:`);
    console.error(`      1. 下载 https://developer.android.com/studio/releases/platform-tools`);
    console.error(`      2. 解压到 C:\\platform-tools`);
    console.error(`      3. 将 C:\\platform-tools 添加到系统 PATH`);
    console.error(`      4. 重新打开终端运行 adb version 验证`);
    process.exit(1);
  }
}

function checkDevice() {
  const out = adb('devices');
  const lines = out.split('\n').filter(l => l.includes('\tdevice'));
  if (lines.length === 0) {
    console.error(`  ${R('✗')} 未检测到安卓设备。`);
    console.error(`    请连接手机并开启 USB 调试（或启动安卓模拟器）。`);
    console.error(`    运行 'adb devices' 确认设备已列出。`);
    process.exit(1);
  }
  console.log(`  ${G('✓')} 已识别设备:`);
  for (const l of lines) {
    console.log(`       ${l.trim()}`);
  }
}

// ── Get screen size for swipe ─────────────────────────────────────────────
function getScreenSize() {
  try {
    const out = adb('shell', 'wm', 'size');
    const m = out.match(/(\d+)x(\d+)/);
    if (m) {
      const w = parseInt(m[1], 10);
      const h = parseInt(m[2], 10);
      console.log(`  ${G('✓')} 屏幕分辨率: ${w}x${h}`);
      return { width: w, height: h };
    }
  } catch {
    // fallback
  }
  console.log(`  ${Y('!')} 无法获取屏幕分辨率，使用默认值 1080x2400`);
  return { width: 1080, height: 2400 };
}

// ── Capture screenshot ────────────────────────────────────────────────────
function captureScreenshot(sessionDir, idx) {
  // adb exec-out screencap -p outputs raw PNG bytes to stdout
  const buf = execSync('adb exec-out screencap -p', { timeout: 10000, maxBuffer: 50 * 1024 * 1024 });
  const hash = md5(buf);
  const filename = `screenshot-${String(idx).padStart(4, '0')}.png`;
  const filepath = join(sessionDir, 'screenshots', filename);
  if (!DRY_RUN) {
    writeFileSync(filepath, buf);
  }
  return { filename, filepath, hash, size: buf.length };
}

// ── Swipe to scroll ──────────────────────────────────────────────────────
function scrollUp(screen, delayMs) {
  // Swipe from 60% height to 30% height (upward scroll)
  const x = Math.floor(screen.width / 2);
  const y1 = Math.floor(screen.height * 0.65);
  const y2 = Math.floor(screen.height * 0.25);
  adb('shell', 'input', 'swipe', String(x), String(y1), String(x), String(y2), String(delayMs));
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${C('══════════════════════════════════════════')}`);
  console.log(`${C('  微信朋友圈截图采集 (MVP)')}`);
  console.log(`${C('══════════════════════════════════════════')}\n`);

  // 1. Check env
  checkAdb();
  checkDevice();
  const screen = getScreenSize();

  // 2. User confirmation
  await waitForEnter(`\n${Y('请确认：')}手机已打开 微信 → 我 → 朋友圈 → 我的朋友圈\n${G('按回车开始采集')}（或 Ctrl+C 取消）...\n${C('>')} `);

  // 3. Setup session dir
  const sessionId = `session-${timestamp()}`;
  const sessionDir = join(RAW_DIR, sessionId);
  const screenshotsDir = join(sessionDir, 'screenshots');
  if (!DRY_RUN) {
    mkdirSync(screenshotsDir, { recursive: true });
    mkdirSync(join(sessionDir, 'ocr'), { recursive: true });
  }

  console.log(`\n  ${C('会话目录:')} ${sessionDir}`);
  console.log(`  ${C('最大截图:')} ${MAX_SCREENS}`);
  console.log(`  ${C('滚动延迟:')} ${DELAY_MS}ms`);
  if (DRY_RUN) console.log(`  ${Y('DRY RUN: 不会保存任何文件')}`);

  // 4. Capture loop
  const log = {
    sessionId,
    timestamp: new Date().toISOString(),
    maxScreens: MAX_SCREENS,
    delayMs: DELAY_MS,
    deviceScreen: screen,
    screenshots: [],
    stoppedReason: '',
  };

  let consecutiveDup = 0;
  const prevHashes = [];
  const DUP_THRESHOLD = 3;

  console.log(`\n${C('开始采集...')}\n`);

  for (let i = 0; i < MAX_SCREENS; i++) {
    // Capture
    let shot;
    try {
      shot = captureScreenshot(sessionDir, i);
    } catch (e) {
      console.error(`  ${R('✗')} 截图失败: ${e.message}`);
      log.stoppedReason = `截图失败: ${e.message}`;
      break;
    }

    // Check for duplicate (exact hash match)
    if (prevHashes.includes(shot.hash)) {
      consecutiveDup++;
      console.log(`  ${Y(`[${i+1}/${MAX_SCREENS}]`)} 重复截图 (${consecutiveDup}/${DUP_THRESHOLD}) — ${shot.filename}`);
    } else {
      consecutiveDup = 0;
      const sizeKb = (shot.size / 1024).toFixed(1);
      console.log(`  ${G(`[${i+1}/${MAX_SCREENS}]`)} ${shot.filename} (${sizeKb} KB)`);
    }

    prevHashes.push(shot.hash);
    log.screenshots.push({
      index: i,
      filename: shot.filename,
      hash: shot.hash,
      size: shot.size,
      duplicate: consecutiveDup > 0,
    });

    // Stop if too many consecutive duplicates (scrolled past end)
    if (consecutiveDup >= DUP_THRESHOLD) {
      console.log(`\n  ${Y('连续 3 次截图重复，已到达朋友圈底部，停止采集。')}`);
      log.stoppedReason = 'duplicate_limit';
      break;
    }

    // Scroll for next capture (except last iteration)
    if (i < MAX_SCREENS - 1) {
      const scrollDelay = Math.floor(DELAY_MS * 0.4);
      try {
        scrollUp(screen, scrollDelay);
      } catch (e) {
        console.error(`  ${R('✗')} 滚动失败: ${e.message}`);
        log.stoppedReason = `滚动失败: ${e.message}`;
        break;
      }
      // Randomised wait: 1.2x - 1.8x base delay
      const waitMs = Math.floor(DELAY_MS * (0.8 + Math.random() * 0.6));
      await sleep(waitMs);
    }
  }

  // 5. Save log
  log.totalScreenshots = log.screenshots.length;
  log.uniqueScreenshots = new Set(log.screenshots.filter(s => !s.duplicate).map(s => s.hash)).size;

  if (!DRY_RUN) {
    writeFileSync(join(sessionDir, 'capture-log.json'), JSON.stringify(log, null, 2), 'utf-8');
  }

  // 6. Summary
  console.log(`\n${C('══════════════════════════════════════════')}`);
  console.log(`${G('采集完成')}`);
  console.log(`  会话目录:    ${sessionDir}`);
  console.log(`  总截图数:    ${log.totalScreenshots}`);
  console.log(`  不重复截图:  ${log.uniqueScreenshots}`);
  console.log(`  停止原因:    ${log.stoppedReason || 'max_screens'}`);
  if (DRY_RUN) {
    console.log(`  ${Y('DRY RUN 模式下未保存任何文件。')}`);
  } else {
    console.log(`\n  下一步: npm run ocr:wechat-moments`);
  }
  console.log('');
}

main().catch(e => {
  console.error(`\n${R('错误:')} ${e.message}`);
  process.exit(1);
});
