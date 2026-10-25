import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import en from '../src/i18n/translations/en.ts';
import { locales } from '../src/i18n/config.ts';

const names = [
  'English',
  'Spanish',
  'Hindi',
  'Japanese',
  'French',
  'German',
  'Portuguese (Brazil)',
  'Korean',
  'Italian',
];
const expected = Object.keys(en);
const placeholders = (value) =>
  [...value.matchAll(/\{(\w+)\}/g)]
    .map((match) => match[1])
    .sort()
    .join(',');
let failed = false;
for (const [index, locale] of locales.entries()) {
  const path = `src/i18n/translations/${locale}.ts`;
  const { default: dictionary } = await import(
    pathToFileURL(`${process.cwd()}/${path}`).href
  );
  const source = await readFile(path, 'utf8');
  const errors = [
    ...expected
      .filter((key) => !(key in dictionary))
      .map((key) => `missing: ${key}`),
    ...Object.keys(dictionary)
      .filter((key) => !(key in en))
      .map((key) => `unexpected: ${key}`),
    ...Object.entries(dictionary)
      .filter(([, value]) => typeof value !== 'string' || !value.trim())
      .map(([key]) => `empty: ${key}`),
    ...expected
      .filter(
        (key) =>
          dictionary[key] &&
          placeholders(dictionary[key]) !== placeholders(en[key]),
      )
      .map((key) => `placeholders: ${key}`),
    ...(source.includes('\uFFFD') ? ['Unicode replacement character'] : []),
  ];
  if (errors.length) {
    failed = true;
    console.error(`✗ ${names[index]}\n  ${errors.join('\n  ')}`);
  } else console.log(`✓ ${names[index]} (${expected.length} registered keys)`);
}
console.log(
  'Dictionary parity does not certify page coverage. Only fully reviewed routes may be published in src/i18n/routes.ts.',
);
if (failed) process.exitCode = 1;
