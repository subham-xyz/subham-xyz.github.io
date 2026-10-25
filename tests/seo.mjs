// Static SEO audit of the production build (run after `npm run build`).
import { readFile, access } from 'node:fs/promises';
import assert from 'node:assert/strict';

const SITE = 'https://kittysuite.in';
const fileFor = (path) => `dist${path.endsWith('/') ? path + 'index.html' : path}`;
const exists = (f) => access(f).then(() => true, () => false);
const attr = (html, re) => (html.match(re) || [])[1];

const sitemap = await readFile('dist/sitemap.xml', 'utf8');
const paths = [...sitemap.matchAll(/<loc>https:\/\/kittysuite\.in([^<]*)<\/loc>/g)].map((m) => m[1]);
assert.ok(paths.length > 40, 'sitemap lists the public pages');
assert.equal(new Set(paths).size, paths.length, 'no duplicate sitemap URLs');
assert.ok(!paths.some((p) => p.startsWith('/tools/') || p === '/pricing/' || p.includes('404')), 'no redirects, noindex or 404 in sitemap');

const titles = new Map(), descriptions = new Map();
const problems = [];
for (const path of paths) {
  const f = fileFor(path);
  if (!(await exists(f))) { problems.push(`${path}: missing file`); continue; }
  const html = await readFile(f, 'utf8');
  const title = attr(html, /<title>([^<]*)<\/title>/);
  const desc = attr(html, /<meta name="description" content="([^"]*)"/);
  const canonical = attr(html, /<link rel="canonical" href="([^"]*)"/);
  const robots = attr(html, /<meta name="robots" content="([^"]*)"/);
  const h1s = (html.match(/<h1[\s>]/g) || []).length;
  if (!title || title.length < 15 || title.length > 70) problems.push(`${path}: title length ${title?.length}`);
  if (!desc || desc.length < 70 || desc.length > 170) problems.push(`${path}: description length ${desc?.length}`);
  if (canonical !== SITE + path) problems.push(`${path}: canonical ${canonical}`);
  if (!robots?.startsWith('index')) problems.push(`${path}: robots ${robots}`);
  if (h1s !== 1) problems.push(`${path}: ${h1s} h1`);
  for (const tag of ['og:title', 'og:description', 'og:image', 'og:url', 'og:site_name']) if (!html.includes(`property="${tag}"`)) problems.push(`${path}: no ${tag}`);
  if (!html.includes('name="twitter:card" content="summary_large_image"')) problems.push(`${path}: twitter card`);
  if (/localhost|127\.0\.0\.1/.test(html)) problems.push(`${path}: localhost reference`);
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch { problems.push(`${path}: invalid JSON-LD`); }
  }
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\balt=/.test(m[0])) problems.push(`${path}: img without alt`);
  for (const m of html.matchAll(/href="(\/[^"#?]*)/g)) {
    const link = m[1];
    if (/\.(png|ico|svg|webmanifest|xml|woff2|css|js)$/.test(link) || link.startsWith('/_astro/')) continue;
    if (!(await exists(fileFor(link.endsWith('/') ? link : link + '/')))) problems.push(`${path}: broken link ${link}`);
  }
  if (titles.has(title)) problems.push(`${path}: duplicate title with ${titles.get(title)}`);
  if (descriptions.has(desc)) problems.push(`${path}: duplicate description with ${descriptions.get(desc)}`);
  titles.set(title, path); descriptions.set(desc, path);
}
assert.deepEqual(problems, [], problems.join('\n'));

// Tool pages: the working tool comes before the supporting content.
for (const slug of ['compress-image', 'merge-pdf', 'compress-pdf', 'crop-image']) {
  const html = await readFile(`dist/${slug}/index.html`, 'utf8');
  assert.ok(html.indexOf('<h1') < html.indexOf('type="file"'), `${slug}: h1 before the upload input`);
  assert.ok(html.indexOf('type="file"') < html.indexOf('class="about-card'), `${slug}: tool before the article content`);
  assert.ok(html.includes('"@type":"WebApplication"') && html.includes('"@type":"BreadcrumbList"'), `${slug}: schema`);
}
const compressor = await readFile('dist/compress-image/index.html', 'utf8');
assert.ok(compressor.includes('<title>Compress Images Online Free – JPG, PNG &amp; WebP | KittySuite</title>') || compressor.includes('<title>Compress Images Online Free – JPG, PNG & WebP | KittySuite</title>'));

// Old /tools/ URLs redirect to the new canonical URL; 404 and pricing are noindex.
const old = await readFile('dist/tools/merge-pdf/index.html', 'utf8');
assert.ok(old.includes('url=/merge-pdf/') && old.includes('rel="canonical" href="https://kittysuite.in/merge-pdf/"'));
for (const f of ['dist/404.html', 'dist/pricing/index.html']) assert.match(await readFile(f, 'utf8'), /<meta name="robots" content="noindex, follow"/);
const robots = await readFile('dist/robots.txt', 'utf8');
assert.ok(robots.includes('Allow: /') && !/Disallow:\s*\/\s*$/m.test(robots) && robots.includes('Sitemap: https://kittysuite.in/sitemap.xml'));
for (const f of ['dist/site.webmanifest', 'dist/brand/og-image.png', 'dist/brand/apple-touch-icon.png', 'dist/favicon.ico', 'dist/_redirects', 'dist/_headers']) assert.ok(await exists(f), f);
console.log(`PASS: ${paths.length} sitemap pages with unique titles/descriptions, one h1, self canonicals, OG/Twitter, valid JSON-LD, alt text, no broken internal links; tool-first layout; redirects, 404, robots, manifest.`);
