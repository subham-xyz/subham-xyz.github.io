import { tools } from '../data/tools.ts';
import { intents } from '../data/intents.ts';
import {
  locales,
  localePrefix,
  localeFromPath,
  type Locale,
} from './config.ts';

const publicPages = [
  'home',
  'tools',
  'images',
  'pdf',
  'video',
  'audio',
  'fonts',
  'india',
  'about',
  'feedback',
  'contact',
  'privacy',
  'terms',
  'pricing',
] as const;
type Slugs = Record<Locale, string>;
const sameSlug = (slug: string): Slugs =>
  Object.fromEntries(locales.map((locale) => [locale, slug])) as Slugs;
export const routes: Record<string, Slugs> = Object.fromEntries([
  ...publicPages.map((key) => [key, sameSlug(key === 'home' ? '' : key)]),
  ...tools
    .filter((tool) => tool.status === 'ready')
    .map((tool) => [tool.id, sameSlug(tool.slug)]),
  ...intents.map((intent) => [intent.slug, sameSlug(intent.slug)]),
]);
// Non-Latin locales intentionally use short ASCII slugs. These are editorial
// choices, independent of the displayed language and easy to revise before release.
routes['image-compressor'] = {
  en: 'compress-image',
  es: 'comprimir-imagen',
  hi: 'compress-image',
  ja: 'compress-image',
  fr: 'compresser-image',
  de: 'bild-komprimieren',
  'pt-BR': 'comprimir-imagem',
  ko: 'compress-image',
  it: 'comprimere-immagine',
};
routes['image-resizer'] = {
  en: 'resize-image',
  es: 'redimensionar-imagen',
  hi: 'resize-image',
  ja: 'resize-image',
  fr: 'redimensionner-image',
  de: 'bildgroesse-aendern',
  'pt-BR': 'redimensionar-imagem',
  ko: 'resize-image',
  it: 'ridimensionare-immagine',
};
routes['image-converter'] = {
  en: 'convert-image',
  es: 'convertir-imagen',
  hi: 'convert-image',
  ja: 'convert-image',
  fr: 'convertir-image',
  de: 'bild-umwandeln',
  'pt-BR': 'converter-imagem',
  ko: 'convert-image',
  it: 'convertire-immagine',
};

// A route is released only after its entire UI, runtime messages, and supporting
// content have been translated and checked. Never advertise fallback-only pages.
// Every public page is translated through the phrase catalogues (src/i18n/content);
// `npm run test:i18n-coverage` fails the build check if any localized page has
// untranslated copy.
export const translatedRoutes = new Set<string>(Object.keys(routes));
export function isPublished(locale: Locale, routeKey: string) {
  return (
    Boolean(routes[routeKey]) &&
    (locale === 'en' || translatedRoutes.has(routeKey))
  );
}
export function getLocalizedPath(locale: Locale, routeKey: string): string {
  const route = routes[routeKey];
  if (!route) throw new Error(`Unknown route: ${routeKey}`);
  return (
    '/' +
    [localePrefix(locale), route[locale]].filter(Boolean).join('/') +
    (route[locale] || localePrefix(locale) ? '/' : '')
  );
}
export function routeFromPath(pathname: string): string | undefined {
  const locale = localeFromPath(pathname);
  const normalized = pathname.endsWith('/') ? pathname : pathname + '/';
  return Object.keys(routes).find(
    (key) => getLocalizedPath(locale, key) === normalized,
  );
}
export function localizeHref(locale: Locale, href: string): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const url = new URL(href, 'https://kittysuite.in');
  const key = routeFromPath(url.pathname);
  return key && isPublished(locale, key)
    ? getLocalizedPath(locale, key) + url.search + url.hash
    : href;
}
