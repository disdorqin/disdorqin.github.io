#!/usr/bin/env node
// Incremental editorial gate for NEW daily-learning articles and draft -> published promotions.
// Existing short historical posts are intentionally not retroactively blocked.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const blogPrefix = 'src/content/blog/';
const isDaily = (path) => /^src\/content\/blog\/(?:[^/]+\/)*daily-learning-[^/]+\.(?:md|mdx)$/i.test(path);
const frontmatter = (text) => text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
const isDraft = (text) => /^\s*draft\s*:\s*true\s*$/mi.test(frontmatter(text)?.[1] ?? '');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const errors = [];

function selectedFiles() {
  if (process.argv.length > 2) {
    if (process.argv.length !== 4 || process.argv[2] !== '--file' || !isDaily(process.argv[3])) {
      throw new Error('Usage: node scripts/check-new-learning-posts.mjs [--file src/content/blog/daily-learning-....md]');
    }
    return [process.argv[3]];
  }
  const base = process.env.CHECK_BASE_SHA ?? '';
  if (!base && process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    console.log('Manual CI run: no PR diff; existing preflight/build still run.');
    return [];
  }
  if (!/^[a-f0-9]{40}$/i.test(base)) throw new Error('Valid comparison base SHA is required for pull requests and pushes (fetch-depth: 0).');
  const output = git('diff', '--name-status', '-z', '--diff-filter=AM', base + '...HEAD', '--', blogPrefix);
  const items = output.split('\0').filter(Boolean);
  const files = [];
  for (let i = 0; i + 1 < items.length; i += 2) {
    const [status, path] = [items[i], items[i + 1]];
    if (!isDaily(path)) continue;
    if (status === 'A') {
      files.push(path);
    } else if (status === 'M') {
      const oldText = git('show', base + ':' + path);
      const newText = readFileSync(resolve(root, path), 'utf8');
      if (isDraft(oldText) && !isDraft(newText)) files.push(path);
    }
  }
  return files;
}

function check(path) {
  const full = resolve(root, path);
  if (!full.startsWith(root + sep) || !existsSync(full)) {
    errors.push(path + ': missing article file');
    return;
  }
  const raw = readFileSync(full, 'utf8');
  if (!frontmatter(raw)) {
    errors.push(path + ': missing YAML frontmatter');
    return;
  }
  if (isDraft(raw)) {
    console.log('DRAFT SKIPPED ' + path);
    return;
  }
  const body = raw.slice(frontmatter(raw)[0].length);
  // Exclude code blocks, inline code and HTML comments when counting Chinese prose.
  const prose = body
    .replace(/^[ \t]*`{3,}[^\n]*\r?\n[\s\S]*?^[ \t]*`{3,}[ \t]*$/gm, '')
    .replace(/^[ \t]*~{3,}[^\n]*\r?\n[\s\S]*?^[ \t]*~{3,}[ \t]*$/gm, '')
    .replace(/`[^`\r\n]*`/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const han = (prose.match(/\p{Script=Han}/gu) ?? []).length;
  if (han < 10000) errors.push(path + ': Chinese prose ' + han + ' Han characters (minimum 10000)');

  const images = new Set();
  for (const m of body.matchAll(/!\[[^\]]*\]\(\s*(\/[^)\s?#]+\.svg)(?:\s+["'][^"']*["'])?\s*\)/gi)) images.add(m[1]);
  for (const m of body.matchAll(/<img\b[^>]*\bsrc=["'](\/[^"'?#]+\.svg)["']/gi)) images.add(m[1]);
  if (images.size < 3) errors.push(path + ': referenced local SVG images ' + images.size + ' (minimum 3)');
  const publicRoot = resolve(root, 'public');
  for (const image of images) {
    const asset = resolve(publicRoot, image.slice(1));
    if (!asset.startsWith(publicRoot + sep) || !existsSync(asset)) {
      errors.push(path + ': SVG missing or outside public/ ' + image);
    } else if (!/<svg\b/i.test(readFileSync(asset, 'utf8').slice(0, 1200))) {
      errors.push(path + ': asset does not look like SVG ' + image);
    }
  }

  const sources = new Set(
    [...prose.matchAll(/(?<!!)\[[^\]\r\n]+\]\(\s*(https?:\/\/[^\s)]+)\s*\)/g)].map((m) => m[1])
  );
  if (sources.size < 2) errors.push(path + ': external reference links ' + sources.size + ' (minimum 2)');
  console.log(path + ': Han=' + han + ', local SVG=' + images.size + ', external links=' + sources.size);
}

try {
  const files = selectedFiles();
  if (files.length === 0) console.log('No new published daily-learning articles or draft promotions in this PR.');
  for (const path of files) check(path);
} catch (error) {
  errors.push(error.message);
}
if (errors.length) {
  for (const err of errors) console.error('FAIL ' + err);
  process.exitCode = 1;
} else {
  console.log('PASS: incremental daily-learning editorial checks');
}
