#!/usr/bin/env node
/**
 * build-dist.js — Assemble the publishable site into dist/.
 *
 * Used by EdgeOne Pages (see edgeone.json → outputDirectory).
 *
 * Whitelist-based on purpose: only the paths listed in INCLUDE are shipped,
 * so new tooling, config or notes added to the repo root never leak to
 * production by accident. Markdown and dotfiles are skipped everywhere
 * (matching the old rsync excludes).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist');

const INCLUDE = [
  'index.html',
  'robots.txt',
  'sitemap.xml',
  'about',
  'assets',
  'blog',
  'legal',
  'lessons',
  'projects',
  'resume',
  'tools',
];

const SKIP_EXT = new Set(['.md']);

let files = 0;
let bytes = 0;

function copy(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(src)) {
      if (name.startsWith('.')) continue;
      copy(path.join(src, name), path.join(dest, name));
    }
    return;
  }
  if (SKIP_EXT.has(path.extname(src).toLowerCase())) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  files++;
  bytes += stat.size;
}

const missing = INCLUDE.filter((p) => !fs.existsSync(path.join(ROOT, p)));
if (missing.length) {
  console.error('Missing required paths: ' + missing.join(', '));
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
for (const p of INCLUDE) copy(path.join(ROOT, p), path.join(OUT, p));

console.log(
  'Built dist/: ' + files + ' files, ' + (bytes / 1024).toFixed(1) + ' KB'
);
