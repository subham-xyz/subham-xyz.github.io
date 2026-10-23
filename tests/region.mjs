import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = 'http://localhost:4321';
const browser = await chromium.launch();
try {
  const abroad = await browser.newContext({ timezoneId: 'America/New_York', locale: 'en-US' });
  const page = await abroad.newPage();
  await page.goto(base);
  assert.equal(await page.locator('#india').isVisible(), false, 'India section hidden outside India');
  assert.equal(await page.locator('header a[href="/india/"]:visible').count(), 0);
  assert.equal(await page.locator('footer a[href="/india/"]:visible').count(), 0);
  await page.goto(base + '/india/');
  assert.ok(await page.locator('.india-card').first().isVisible(), '/india/ stays reachable');
  await page.goto(base);
  await page.click('a.dot-matrix-button');
  await page.waitForURL('**/pricing/');
  assert.equal(await page.locator('meta[name=robots]').getAttribute('content'), 'noindex, follow');
  assert.equal(await page.locator('.plan-card').count(), 3);
  assert.match(await page.locator('.plan-featured').innerText(), /₹500/);
  await abroad.close();

  for (const opts of [{ timezoneId: 'Asia/Kolkata', locale: 'en-US' }, { timezoneId: 'Europe/London', locale: 'hi-IN' }]) {
    const india = await browser.newContext(opts);
    const p = await india.newPage();
    await p.goto(base);
    assert.ok(await p.locator('#india').isVisible(), `India section shown for ${JSON.stringify(opts)}`);
    await india.close();
  }

  const sitemap = await (await fetch(base + '/sitemap.xml')).text();
  assert.ok(!sitemap.includes('/pricing/'), 'noindex pricing page stays out of the sitemap');
  console.log('PASS: pricing page, India-only visibility by timezone/language, /india/ stays public.');
} finally {
  await browser.close();
}
