// Lighthouse audit of a production build. BASE (default the preview server on :4321) and
// FORM (mobile | desktop) can be set: FORM=desktop BASE=http://localhost:4322 node scripts/lighthouse.mjs
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { launch } from 'chrome-launcher';
import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
const base = process.env.BASE || 'http://localhost:4321';
const form = process.env.FORM || 'mobile';
const paths = ['/', '/compress-image/', '/merge-pdf/', '/font-finder/'];
await mkdir('test-results', { recursive: true });
const chrome = await launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const summaries = [];
  for (const path of paths) {
    const config = form === 'desktop' ? desktopConfig : undefined;
    const result = await lighthouse(base + path, { port: chrome.port, output: 'json', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'], logLevel: 'error' }, config);
    const lhr = result.lhr;
    const scores = Object.fromEntries(Object.entries(lhr.categories).map(([key, value]) => [key, Math.round(value.score * 100)]));
    const metric = (id) => lhr.audits[id]?.displayValue || '';
    const failing = ['uses-text-compression', 'unminified-javascript', 'unminified-css', 'unused-javascript', 'unused-css-rules', 'render-blocking-resources']
      .filter((id) => lhr.audits[id] && lhr.audits[id].score !== null && lhr.audits[id].score < 0.9);
    summaries.push({ path, form, ...scores, FCP: metric('first-contentful-paint'), LCP: metric('largest-contentful-paint'), TBT: metric('total-blocking-time'), CLS: metric('cumulative-layout-shift'), failing });
    console.log(form, path, JSON.stringify(summaries.at(-1)));
    await writeFile(`test-results/lighthouse-${form}${path.replaceAll('/', '_') || '_home'}.json`, result.report);
  }
  await writeFile(`test-results/lighthouse-${form}-summary.json`, JSON.stringify(summaries, null, 2));
} finally {
  await chrome.kill();
}
