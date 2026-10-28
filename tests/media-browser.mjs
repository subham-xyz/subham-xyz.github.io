// End-to-end check of the video/audio tools in a real browser: worker, wasm
// engine, OPFS output, batch queue, cancel and result downloads.
// Run after `npm run build`: node tests/media-browser.mjs <fixtures-dir>
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
const dir = process.argv[2] || 'tests/fixtures/media';
const port = 4330;
const server = spawn(process.execPath, ['scripts/serve-dist.mjs', 'dist', String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const base = `http://localhost:${port}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: 'reduce', acceptDownloads: true, bypassCSP: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()) && errors.push(m.text()));
const file = async (name, mimeType) => ({ name, mimeType, buffer: await readFile(join(dir, name)) });
const resultOf = () => page.locator('#media-download').evaluate(async (a) => {
  const blob = await (await fetch(a.href)).blob();
  return { size: blob.size, type: blob.type, name: a.download, label: document.getElementById('media-download-label').textContent };
});
const run = async (timeout = 120000) => {
  await page.locator('#media-run').click();
  await page.waitForFunction(() => !document.getElementById('media-result').hidden || (!document.getElementById('media-run').hidden && document.getElementById('media-progress').hidden), null, { timeout });
  if (await page.locator('#media-result').isHidden()) throw new Error(`job failed: ${await page.locator('#media-status').textContent()}`);
};
const step = (s) => console.log('·', s);
try {
  // 1. Compress video: engine download, probe, encode to OPFS, result + overflow.
  await page.goto(`${base}/compress-video/`);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`);
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.locator('#media-file').setInputFiles([await file('clip.mp4', 'video/mp4')]);
  await page.locator('#media-editor').waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('.media-meta')?.textContent.includes('640'), null, { timeout: 60000 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'editor overflow at 390');
  await page.setViewportSize({ width: 320, height: 800 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'editor overflow at 320');
  await page.locator('label.chip:has(input[name=media-height][value="360"])').click();
  await run();
  let r = await resultOf();
  step(`compress-video → ${r.name} ${r.size} ${r.type}`);
  assert.match(r.name, /\.mp4$/);
  assert.ok(r.size > 1000);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'result overflow at 320');
  const opfs = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const names = [];
    for await (const [n] of root.entries()) names.push(n);
    return names;
  });
  step(`opfs: ${opfs.join(',')}`);
  await page.setViewportSize({ width: 1280, height: 900 });

  // 2. Batch: audio converter, two files → ZIP.
  await page.goto(`${base}/audio-converter/`);
  await page.locator('#media-file').setInputFiles([await file('song.mp3', 'audio/mpeg'), await file('clip.mp4', 'video/mp4')]);
  await page.locator('#media-editor').waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('.media-item').length === 2);
  await page.locator('label.chip:has(input[name=media-format][value=wav])').click();
  await run();
  r = await resultOf();
  step(`audio-converter batch → ${r.name} ${r.size} ${r.type}`);
  assert.match(r.name, /\.zip$/);

  // 3. Ordered inputs: join videos of different sizes.
  await page.goto(`${base}/join-videos/`);
  await page.locator('#media-file').setInputFiles([await file('clip.mp4', 'video/mp4'), await file('two.mp4', 'video/mp4')]);
  await page.waitForFunction(() => document.querySelectorAll('.media-item').length === 2, null, { timeout: 60000 });
  await page.locator('.media-action[title="Move down"]').first().click();
  assert.equal(await page.locator('.media-name').first().textContent(), 'two.mp4');
  await run();
  r = await resultOf();
  step(`join-videos → ${r.name} ${r.size}`);
  assert.ok(r.size > 1000);

  // 4. Cancel: a long job is stopped and the tool can run again.
  await page.goto(`${base}/reverse-video/`);
  await page.locator('#media-file').setInputFiles([await file('clip.mp4', 'video/mp4')]);
  await page.locator('#media-editor').waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('.media-meta')?.textContent.includes('640'), null, { timeout: 60000 });
  await page.locator('#media-run').click();
  await page.locator('#media-progress').waitFor({ state: 'visible' });
  await page.waitForTimeout(700);
  await page.locator('#media-cancel').click();
  await page.waitForFunction(() => document.getElementById('media-progress').hidden, null, { timeout: 20000 });
  step(`cancelled: ${await page.locator('#media-status').textContent()}`);
  await run();
  r = await resultOf();
  step(`reverse-video after cancel → ${r.name} ${r.size}`);

  // 5. Roles: replace audio; and GIF.
  await page.goto(`${base}/video-to-gif/`);
  await page.locator('#media-file').setInputFiles([await file('clip.mp4', 'video/mp4')]);
  await page.locator('#media-editor').waitFor({ state: 'visible', timeout: 60000 });
  await page.locator('#media-end').fill('2');
  await run();
  r = await resultOf();
  step(`video-to-gif → ${r.name} ${r.size} ${r.type}`);
  assert.equal(r.type, 'image/gif');

  await page.goto(`${base}/replace-audio/`);
  await page.locator('#media-file').setInputFiles([await file('clip.mp4', 'video/mp4')]);
  await page.locator('#media-editor').waitFor({ state: 'visible', timeout: 60000 });
  await page.locator('#media-role-1').setInputFiles([await file('song.mp3', 'audio/mpeg')]);
  await page.waitForFunction(() => !document.getElementById('media-role-1-name').textContent.includes('Not chosen'));
  await run();
  r = await resultOf();
  step(`replace-audio → ${r.name} ${r.size}`);

  // 6. Localized page renders.
  await page.goto(`${base}/hi/trim-audio/`);
  assert.equal(await page.locator('h1').count(), 1);
  assert.deepEqual(errors, []);
  console.log('PASS: media tools in the browser (engine, OPFS, batch ZIP, ordering, cancel, roles, GIF).');
} catch (e) {
  console.log('errors:', errors);
  await page.screenshot({ path: '/tmp/media-fail.png' }).catch(() => {});
  console.log('status:', await page.locator('#media-status').textContent().catch(() => ''));
  throw e;
} finally {
  await browser.close();
  server.kill();
}
