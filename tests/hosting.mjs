// Production hosting checks (run after `npm run build`).
// 1. Cloudflare Pages limits: no file over 25 MiB, at most 20,000 files.
// 2. Cross-origin isolation guard. Production sends
// COOP same-origin + COEP require-corp on every page (public/_headers), so the
// FFmpeg, AI and PDF engines get SharedArrayBuffer and WebAssembly threads.
// Under require-corp a cross-origin <script>, <img>, <iframe>, stylesheet or
// font without CORS/CORP is blocked, so built pages must not embed any.
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const headers = await readFile('dist/_headers', 'utf8');
const all = headers.split(/\n(?=\S)/).find((block) => block.startsWith('/*\n'));
assert.ok(all, '_headers has a /* rule');
assert.match(all, /Cross-Origin-Opener-Policy: same-origin/);
assert.match(all, /Cross-Origin-Embedder-Policy: require-corp/);
for (const line of headers.split('\n')) if (/^\s+\S/.test(line)) assert.match(line, /^\s+[A-Za-z-]+: \S/, `header line: ${line}`);

async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else yield full;
  }
}
async function* pages(dir) {
  for await (const file of files(dir)) if (file.endsWith('.html')) yield file;
}
let total = 0;
const tooBig = [];
for await (const file of files('dist')) {
  total++;
  const { size } = await stat(file);
  if (size > 25 * 1024 * 1024) tooBig.push(`${file} (${(size / 1048576).toFixed(1)} MiB)`);
}
assert.deepEqual(tooBig, [], 'Cloudflare Pages rejects files over 25 MiB');
assert.ok(total <= 20000, `Cloudflare Pages allows 20,000 files; the build has ${total}`);
const problems = new Set();
let count = 0;
for await (const file of pages('dist')) {
  count++;
  const html = await readFile(file, 'utf8');
  for (const m of html.matchAll(/<(script|img|iframe|source|video|audio|link)\b[^>]*>/gi)) {
    const tag = m[0];
    if (/^<link/i.test(tag) && !/rel="(?:stylesheet|preload|modulepreload|icon|manifest)"/i.test(tag)) continue;
    const url = tag.match(/\s(?:src|href)="(https?:)?\/\/([^"/]+)/i);
    if (url && !/kittysuite\.in$/.test(url[2]) && !/crossorigin/i.test(tag)) problems.add(`${file}: ${tag.slice(0, 120)}`);
  }
}
assert.deepEqual([...problems].slice(0, 20), [], 'cross-origin embeds break COEP: require-corp');
// The optional analytics script is added at runtime; it must use CORS mode.
assert.match(await readFile('src/scripts/analytics.ts', 'utf8'), /crossOrigin = 'anonymous'/);
console.log(`PASS: ${total} files, none over 25 MiB (Cloudflare Pages); isolation headers on every page; ${count} pages embed nothing cross-origin.`);
