import assert from 'node:assert/strict';
import {
  locales,
  localeFromPath,
  normalizeLocale,
} from '../src/i18n/config.ts';
import {
  routes,
  getLocalizedPath,
  routeFromPath,
  isPublished,
  translatedRoutes,
  localizeHref,
} from '../src/i18n/routes.ts';
import { alternates } from '../src/i18n/seo.ts';
import { dictionaries, translator } from '../src/i18n/index.ts';

for (const locale of locales) {
  const paths = new Set();
  for (const key of Object.keys(routes)) {
    const path = getLocalizedPath(locale, key);
    assert.ok(!paths.has(path), `${locale}: duplicate route ${path}`);
    paths.add(path);
    assert.equal(routeFromPath(path), key);
    assert.equal(routeFromPath(path.replace(/\/$/, '') || '/'), key);
    assert.equal(localeFromPath(path), locale);
  }
}
assert.equal(getLocalizedPath('en', 'image-compressor'), '/compress-image/');
assert.equal(
  getLocalizedPath('pt-BR', 'image-compressor'),
  '/pt-br/comprimir-imagem/',
);
assert.equal(normalizeLocale('pt-PT'), 'pt-BR');
assert.equal(normalizeLocale('hi-IN'), 'hi');
assert.equal(normalizeLocale('xx'), undefined);
assert.equal(
  localizeHref('hi', 'https://example.com/'),
  'https://example.com/',
);
assert.equal(localizeHref('hi', '//example.com/'), '//example.com/');
assert.equal(localizeHref('hi', '/missing/?x=1#part'), '/missing/?x=1#part');
// Missing translations fall back to English and never display a semantic key.
const original = dictionaries.hi['nav.home'];
try {
  dictionaries.hi['nav.home'] = '';
  assert.equal(translator('hi')('nav.home'), dictionaries.en['nav.home']);
} finally {
  dictionaries.hi['nav.home'] = original;
}
assert.equal(
  translator('hi')('converter.optionsLabel', { tool: 'PNG' }),
  'PNG के विकल्प',
);
// Simulate publication in memory only; never publish incomplete pages to test.
const wasPublished = translatedRoutes.has('image-converter');
try {
  translatedRoutes.add('image-converter');
  const links = alternates('image-converter', 'https://kittysuite.in');
  assert.equal(links.length, 10);
  assert.equal(
    links.find((link) => link.hreflang === 'x-default').href,
    'https://kittysuite.in/convert-image/',
  );
  assert.equal(
    localizeHref('fr', '/convert-image/?preset=one#editor'),
    '/fr/convertir-image/?preset=one#editor',
  );
  for (const locale of locales) {
    assert.ok(isPublished(locale, 'image-converter'));
    assert.equal(
      links.find((link) => link.hreflang === locale).href,
      'https://kittysuite.in' + getLocalizedPath(locale, 'image-converter'),
    );
  }
} finally {
  if (!wasPublished) translatedRoutes.delete('image-converter');
}
console.log(
  'i18n route identity, uniqueness, fallback, interpolation, and alternate-link tests passed.',
);
