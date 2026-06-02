#!/usr/bin/env node
/**
 * lint-json.js — Validate all JSON files in the repository.
 *
 * Why a custom script (vs. jsonlint)?
 *   1. Zero extra dependency — Node's built-in JSON.parse already gives us
 *      precise error messages (line, column, position).
 *   2. We learned the hard way that a broken zh.json silently kills i18n
 *      in production. This script is a tiny safety net.
 */
const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.playwright-cli',
  '.codebuddy',
  '.idea',
  '.vscode',
]);

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(f.name)) continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (f.name.endsWith('.json')) out.push(p);
  }
  return out;
}

const root = process.cwd();
const files = walk(root);

let bad = 0;
for (const f of files) {
  const rel = path.relative(root, f);
  try {
    JSON.parse(fs.readFileSync(f, 'utf8'));
    console.log('  ✓ ' + rel);
  } catch (err) {
    bad++;
    console.error('  ✗ ' + rel);
    console.error('    ' + err.message);
  }
}

if (bad > 0) {
  console.error('\n' + bad + ' JSON file(s) failed validation.');
  process.exit(1);
}
console.log('\nAll ' + files.length + ' JSON file(s) valid.');
