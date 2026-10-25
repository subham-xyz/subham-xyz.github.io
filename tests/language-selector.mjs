import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { locales, localeNames } from '../src/i18n/config.ts';
import { dictionaries } from '../src/i18n/index.ts';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  locale: 'en-US',
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const base = 'http://localhost:4321';
const choose = async (locale) => {
  await page.locator('.language-selector summary').click();
  await page.locator(`.language-selector [data-language="${locale}"]`).click();
  await page.waitForFunction(
    (locale) => document.documentElement.dataset.uiLanguage === locale,
    locale,
  );
};
try {
  await page.goto(base);
  await page.locator('.language-selector summary').waitFor();
  assert.equal(
    await page.locator('.language-selector [data-language]').count(),
    9,
  );
  for (const locale of locales) {
    await choose(locale);
    assert.equal(
      await page.locator('#account-toggle').textContent(),
      dictionaries[locale]['nav.login'],
    );
    assert.equal(
      await page.locator('.language-name').textContent(),
      localeNames[locale],
    );
    assert.equal(
      await page
        .locator(`[data-language="${locale}"]`)
        .getAttribute('aria-pressed'),
      'true',
    );
    assert.equal(
      await page.locator('.language-selector [aria-pressed="true"]').count(),
      1,
    );
    assert.equal(
      await page.evaluate(() => localStorage.getItem('kittysuite-language')),
      locale,
    );
    assert.equal(new URL(page.url()).pathname, '/');
  }
  await choose('hi');
  await page.reload();
  await page.waitForFunction(
    () => document.documentElement.dataset.uiLanguage === 'hi',
  );
  assert.equal(
    await page.locator('#account-toggle').textContent(),
    dictionaries.hi['nav.login'],
  );
  for (const theme of ['light', 'dark']) {
    for (const width of [320, 375, 768, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      await page.locator('.language-selector summary').click();
      const panel = await page.locator('.language-panel').boundingBox();
      assert.ok(
        panel.x >= 0 && panel.x + panel.width <= width + 1,
        `${theme}/${width}: dropdown fits`,
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${theme}/${width}: no overflow ${JSON.stringify(await page.locator('.header-row,.header-logo,.header-actions,.header-actions > *').evaluateAll((elements) => elements.map((element) => ({ name: element.className, x: element.getBoundingClientRect().x, width: element.getBoundingClientRect().width }))))}`,
      );
      await page.keyboard.press('Escape');
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.language-selector summary').focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(
    await page.locator(':focus').getAttribute('data-language'),
    'en',
  );
  await page.keyboard.press('ArrowUp');
  assert.equal(
    await page.locator(':focus').getAttribute('data-language'),
    'it',
  );
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => document.documentElement.dataset.uiLanguage === 'it',
  );
  assert.equal(
    await page.locator(':focus').evaluate((element) => element.tagName),
    'SUMMARY',
  );

  await page.goto(`${base}/convert-image/`);
  await page.waitForFunction(
    () => document.documentElement.dataset.uiLanguage === 'it',
  );
  // A selected local file survives a switch, without navigation or renaming.
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    return canvas.toDataURL().split(',')[1];
  });
  await page
    .locator('#file-input')
    .setInputFiles({
      name: 'my-original.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png, 'base64'),
    });
  await page.locator('#editor-panel').waitFor({ state: 'visible' });
  await choose('de');
  assert.equal(
    await page.locator('#file-name').textContent(),
    'my-original.png',
  );
  assert.equal(new URL(page.url()).pathname, '/convert-image/');
  assert.equal(
    await page
      .locator('#quality-field [data-i18n="common.quality"]')
      .textContent(),
    dictionaries.de['common.quality'],
  );
  assert.equal(await page.locator('#quality-value').textContent(), '85%');
  await page.locator('#convert').click();
  await page.locator('#result-panel').waitFor({ state: 'visible' });
  assert.ok(
    (await page.locator('#download').getAttribute('href')).startsWith('blob:'),
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS: nine languages, persistence, keyboard, mobile/desktop, themes, current page/file preservation, and local conversion.',
  );
} finally {
  await browser.close();
}
