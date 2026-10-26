import { categories, tools } from '../data/tools';
import { intents } from '../data/intents';
import { locales } from '../i18n/config';
import {
  routes,
  isPublished,
  getLocalizedPath,
  routeFromPath,
} from '../i18n/routes';
import { alternates } from '../i18n/seo';

// Every public, canonical, indexable page. /pricing/ (noindex while Premium is
// not available), /404 and redirects are deliberately left out.
export function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const toolPaths = tools
    .filter((t) => t.status === 'ready')
    .map((t) => t.href);
  const paths = [
    '/',
    '/tools/',
    ...toolPaths,
    ...categories.map((c) => `/${c.toLowerCase()}/`),
    ...intents.map((i) => `/${i.slug}/`),
    '/india/',
    '/about/',
    '/feedback/',
    '/contact/',
    '/privacy/',
    '/terms/',
    ...locales
      .filter((locale) => locale !== 'en')
      .flatMap((locale) =>
        Object.keys(routes)
          .filter((key) => key !== 'pricing' && isPublished(locale, key))
          .map((key) => getLocalizedPath(locale, key)),
      ),
  ];
  const priority = (path: string) =>
    path === '/'
      ? '1.0'
      : toolPaths.includes(path) || path === '/india/'
        ? '0.9'
        : '0.6';
  const urls = [...new Set(paths)]
    .map((path) => {
      const key = routeFromPath(path);
      const links = key
        ? alternates(key, 'https://kittysuite.in')
            .map(
              (link) =>
                `<xhtml:link rel="alternate" hreflang="${link.hreflang}" href="${link.href}"/>`,
            )
            .join('')
        : '';
      return `<url><loc>https://kittysuite.in${path}</loc>${links}<lastmod>${today}</lastmod><priority>${priority(path)}</priority></url>`;
    })
    .join('');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`,
    { headers: { 'Content-Type': 'application/xml' } },
  );
}
