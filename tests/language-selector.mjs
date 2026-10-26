// Header language menu against the production build (npm run build, then serve
// dist on :4321). Every language is a real link to the equivalent localized page.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { locales, localeNames } from '../src/i18n/config.ts';
import { dictionaries } from '../src/i18n/index.ts';
import { getLocalizedPath } from '../src/i18n/routes.ts';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: 'de-DE', reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const base = process.env.BASE || 'http://localhost:4321';
try {
  // A German browser is not redirected: the visitor stays in control.
  await page.goto(`${base}/compress-image/`);
  assert.equal(await page.getAttribute('html', 'lang'), 'en');
  assert.equal(await page.locator('.language-selector a[data-language]').count(), 9);
  for (const locale of locales) {
    await page.locator('.language-selector summary').click();
    await page.locator(`.language-selector [data-language="${locale}"]`).click();
    const path = getLocalizedPath(locale, 'image-compressor');
    await page.waitForURL(`${base}${path}`);
    assert.equal(await page.getAttribute('html', 'lang'), locale);
    assert.equal(await page.locator('#account-toggle').textContent(), dictionaries[locale]['nav.login']);
    assert.equal(await page.locator(`.language-selector [data-language="${locale}"]`).getAttribute('aria-current'), 'page');
    assert.equal(await page.locator('.language-selector [aria-current="page"]').count(), 1);
    assert.equal(await page.evaluate(() => localStorage.getItem('kittysuite-language')), locale);
    assert.equal((await page.locator('.language-name').textContent()).trim(), localeNames[locale]);
  }
  for (const theme of ['light', 'dark'])
    for (const width of [320, 375, 768, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
      await page.locator('.language-selector summary').click();
      const panel = await page.locator('.language-panel').boundingBox();
      assert.ok(panel.x >= 0 && panel.x + panel.width <= width + 1, `${theme}/${width}: dropdown fits`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${theme}/${width}: no overflow`);
      await page.keyboard.press('Escape');
    }
  // Keyboard: arrows move through the languages, Enter follows the link.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.language-selector summary').focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator(':focus').getAttribute('data-language'), 'en');
  await page.keyboard.press('ArrowUp');
  assert.equal(await page.locator(':focus').getAttribute('data-language'), 'it');
  await page.keyboard.press('Enter');
  await page.waitForURL(`${base}${getLocalizedPath('it', 'image-compressor')}`);
  // Pages without an equivalent (404) offer each language's home page.
  await page.goto(`${base}/no-such-page/`);
  assert.equal(await page.locator('.language-selector [data-language="ja"]').getAttribute('href'), '/ja/');
  assert.deepEqual(errors, []);
  console.log('PASS: nine language links to equivalent pages, html[lang], saved choice without redirects, aria-current, keyboard, responsive dropdown in both themes.');
} finally {
  await browser.close();
}
