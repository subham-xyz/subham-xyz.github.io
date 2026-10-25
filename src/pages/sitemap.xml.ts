import { categories, tools } from '../data/tools';
import { intents } from '../data/intents';

// Every public, canonical, indexable page. /pricing/ (noindex while Premium is
// not available), /404 and redirects are deliberately left out.
export function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const toolPaths = tools
    .filter((t) => t.status === 'ready')
    .map((t) => t.href);
  const paths = [
    '/',
    ...toolPaths,
    ...categories.map((c) => `/${c.toLowerCase()}/`),
    ...intents.map((i) => `/${i.slug}/`),
    '/india/',
    '/about/',
    '/feedback/',
    '/contact/',
    '/privacy/',
    '/terms/',
  ];
  const priority = (path: string) =>
    path === '/'
      ? '1.0'
      : toolPaths.includes(path) || path === '/india/'
        ? '0.9'
        : '0.6';
  const urls = [...new Set(paths)]
    .map(
      (path) =>
        `<url><loc>https://kittysuite.in${path}</loc><lastmod>${today}</lastmod><priority>${priority(path)}</priority></url>`,
    )
    .join('');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    { headers: { 'Content-Type': 'application/xml' } },
  );
}
