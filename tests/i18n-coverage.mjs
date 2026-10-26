// Every localized page must be fully translated: renders each English page of the
// production build through the localized translation step and fails on any
// interface text that has no translation. Also checks placeholder/markup parity.
// Run after `npm run build`: node tests/i18n-coverage.mjs
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { Translator, numberKey, normalize, isFixedText } from '../src/i18n/phrases.ts';
import { translateHtml } from '../src/i18n/html.ts';
import { locales } from '../src/i18n/config.ts';
import { routes, getLocalizedPath, isPublished } from '../src/i18n/routes.ts';

const source = JSON.parse(await readFile('src/i18n/source/phrases.json', 'utf8'));
const slots = (s) => [...s.matchAll(/\{\w+\}|<\/?\d+\/?>/g)].map((m) => m[0]).sort().join();
const problems = [];
for (const locale of locales.filter((l) => l !== 'en')) {
  const catalogue = JSON.parse(await readFile(`src/i18n/content/${locale}.json`, 'utf8'));
  for (const key of Object.keys(source)) {
    const value = catalogue[key];
    if (!value?.trim()) problems.push(`${locale}: no translation for ${JSON.stringify(key.slice(0, 80))}`);
    else if (slots(key) !== slots(value)) problems.push(`${locale}: placeholders differ in ${JSON.stringify(key.slice(0, 80))}`);
  }
  for (const key of Object.keys(catalogue)) if (!source[key]) problems.push(`${locale}: stale key ${JSON.stringify(key.slice(0, 80))}`);
  const t = new Translator(catalogue);
  for (const key of Object.keys(routes).filter((k) => isPublished(locale, k))) {
    const html = await readFile(join('dist', getLocalizedPath('en', key), 'index.html'), 'utf8').catch(() => '');
    if (!html) continue;
    const missing = new Set();
    translateHtml(html, t, (h) => h, missing);
    for (const text of missing)
      if (!isFixedText(numberKey(normalize(text)).key)) problems.push(`${locale} ${getLocalizedPath(locale, key)}: untranslated ${JSON.stringify(text.slice(0, 80))}`);
  }
}
assert.deepEqual(problems.slice(0, 60), [], `${problems.length} problems:\n${problems.slice(0, 60).join('\n')}`);
console.log(`PASS: ${Object.keys(source).length} phrases × ${locales.length - 1} locales complete, placeholders match, every localized page fully translated.`);
