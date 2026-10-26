// Collects every translatable phrase of the site into src/i18n/source/phrases.json.
//   1. Static copy: the English production build (run `npm run build` first) is read
//      with the same rules the localized build uses (src/i18n/html.ts).
//   2. Runtime copy: user-facing string literals in browser scripts, with ${...}
//      expressions turned into named {slots}.
// Then reports, for every locale catalogue in src/i18n/content/, which phrases are
// missing or stale. `--write` also seeds missing entries from the semantic
// dictionaries (src/i18n/translations) and removes stale ones.
// Run: node scripts/i18n-extract.mjs [--write]
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Translator, numberKey, normalize, isFixedText } from '../src/i18n/phrases.ts';
import { translateHtml } from '../src/i18n/html.ts';
import { locales } from '../src/i18n/config.ts';
import { routes, getLocalizedPath } from '../src/i18n/routes.ts';
import { dictionaries } from '../src/i18n/index.ts';

const write = process.argv.includes('--write');
const empty = new Translator({});
const phrases = new Map(); // key -> { pages:Set, context, runtime }
const add = (raw, page, context = '', runtime = false) => {
  const text = normalize(raw);
  if (!/\p{L}{2}/u.test(text.replace(/\{\w+\}/g, '')) || KEEP.test(text)) return;
  const { key } = numberKey(text);
  const entry = phrases.get(key) || { pages: new Set(), context, runtime };
  if (page) entry.pages.add(page);
  entry.runtime ||= runtime;
  if (!entry.context && context) entry.context = context;
  phrases.set(key, entry);
};
const KEEP = { test: isFixedText };

// 1. Static copy from the English build.
const pages = Object.keys(routes).map((key) => ({ key, path: getLocalizedPath('en', key) }));
for (const { path } of pages) {
  const file = join('dist', path, 'index.html');
  const html = await readFile(file, 'utf8').catch(() => '');
  if (!html) {
    console.warn(`missing build output: ${file}`);
    continue;
  }
  const missing = new Set();
  translateHtml(html, empty, (href) => href, missing);
  const list = [...missing];
  list.forEach((text, i) => add(text, path, [list[i - 1], list[i + 1]].filter(Boolean).join(' | ').slice(0, 240)));
}

// 2. Runtime copy from browser scripts.
async function files(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await files(full)));
    else if (/\.(ts|mjs)$/.test(entry.name) && !/worker-only|\.d\.ts$/.test(entry.name)) out.push(full);
  }
  return out;
}
const literal = /(?<![\w$])(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.|\$\{(?:[^{}]|\{[^{}]*\})*\})*)`)/g;
const looksLikeCopy = (s) =>
  /\p{L}{3}/u.test(s) &&
  (/\p{L}+[ ,]\p{L}+/u.test(s) || /^[A-Z][a-z]+[.!…:]?$/.test(s) || (/\$\{/.test(s) && /^[A-Z][a-z]{2,}[.!:]? /.test(s))) &&
  !/^[a-z0-9-]+(\s[a-z0-9-]+)*$/.test(s) && // CSS classes, ids, keywords
  !/[<>=]|=>|:\s*[\w#.%-]+;|querySelector|^\.|^#|var\(--|rgba?\(|\bpx [a-z]|^\d+px |font-|\bfunction\b|https?:/.test(s.replace(/\$\{[^}]*\}/g, ''));
const slotName = (expr, used) => {
  const word = (expr.match(/([A-Za-z_]\w*)\s*(?:\(|\.|$)/) || [])[1] || 'value';
  let name = /^(size|format|megabytes|mb|bytes)$/i.test(word) ? 'size' : word.replace(/^(get|to)(?=[A-Z])/, '').toLowerCase() || 'value';
  if (!/^[a-z]\w*$/.test(name)) name = 'value';
  let unique = name;
  for (let n = 2; used.has(unique); n++) unique = name + n;
  used.add(unique);
  return `{${unique}}`;
};
const scriptDirs = ['src/scripts'];
const sources = (await Promise.all(scriptDirs.map(files))).flat();
// Inline <script> blocks in components can also write interface text.
for (const component of await files('src/components').catch(() => [])) sources.push(component);
for (const entry of await readdir('src/components')) if (entry.endsWith('.astro')) sources.push(join('src/components', entry));
for (const entry of await readdir('src/pages')) if (entry.endsWith('.astro')) sources.push(join('src/pages', entry));
// Data that browser scripts show after an interaction (goal steps and tips).
sources.push('src/data/goals.ts');
for (const file of sources) {
  let code = await readFile(file, 'utf8');
  if (file.endsWith('.astro')) code = [...code.matchAll(/<script(?![^>]*(?:is:inline|ld\+json|application\/json))[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
  code = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
  for (const match of code.matchAll(literal)) {
    const [, single, double, template] = match;
    let value = single ?? double ?? template;
    if (value === undefined) continue;
    if (template !== undefined) {
      const used = new Set();
      // Nested literals inside ${...} are scanned separately below.
      for (const inner of value.matchAll(/\$\{((?:[^{}]|\{[^{}]*\})*)\}/g))
        for (const nested of inner[1].matchAll(/'((?:[^'\\\n]|\\.)*)'/g)) if (looksLikeCopy(nested[1])) add(nested[1], '', file, true);
      value = value.replace(/\$\{((?:[^{}]|\{[^{}]*\})*)\}/g, (_, expr) => slotName(expr, used));
    }
    value = value.replace(/\\n/g, '\n').replace(/\\(['"`\\])/g, '$1').replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
    if (!looksLikeCopy(value)) continue;
    // Multi-line messages are shown line by line (white-space: pre-line).
    for (const line of value.split(/\n+/)) if (line.trim()) add(line, '', file.replace(/^src\//, ''), true);
  }
}

const sorted = Object.fromEntries(
  [...phrases.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => [key, { pages: [...entry.pages].slice(0, 3), context: entry.context, ...(entry.runtime ? { runtime: true } : {}) }]),
);
await mkdir('src/i18n/source', { recursive: true });
await writeFile('src/i18n/source/phrases.json', JSON.stringify(sorted, null, 1) + '\n');
const runtimeCount = Object.values(sorted).filter((e) => e.runtime).length;
console.log(`${Object.keys(sorted).length} phrases (${runtimeCount} runtime) → src/i18n/source/phrases.json`);

// Seed from the semantic dictionaries: English value → translated value.
const english = dictionaries.en;
for (const locale of locales.filter((l) => l !== 'en')) {
  const path = `src/i18n/content/${locale}.json`;
  const current = JSON.parse((await readFile(path, 'utf8').catch(() => '')) || '{}');
  const seeded = {};
  for (const [key, value] of Object.entries(english)) {
    const translated = dictionaries[locale][key];
    if (!translated || String(value).includes('{')) continue;
    const source = numberKey(normalize(value));
    const target = numberKey(normalize(translated));
    if (source.values.join() === target.values.join()) seeded[source.key] = target.key;
  }
  const missing = Object.keys(sorted).filter((key) => !current[key] && !seeded[key]);
  const stale = Object.keys(current).filter((key) => !sorted[key]);
  console.log(`${locale}: ${missing.length} missing, ${stale.length} stale`);
  if (write) {
    const next = {};
    for (const key of Object.keys(sorted)) if (current[key] || seeded[key]) next[key] = current[key] || seeded[key];
    await writeFile(path, JSON.stringify(next, null, 1) + '\n');
  }
}
