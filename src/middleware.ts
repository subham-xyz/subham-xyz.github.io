// Localized pages reuse the English page implementations. After a localized page
// renders, its interface copy, metadata and internal links are translated from the
// phrase catalogue. This runs at build time for the static site (and in dev).
import { defineMiddleware } from 'astro:middleware';
import { localeFromPath, locales, localePrefix } from './i18n/config.ts';
import { localizeHref } from './i18n/routes.ts';
import { phraseTranslator } from './i18n/catalogues.ts';
import { translateHtml } from './i18n/html.ts';

export const onRequest = defineMiddleware(async (context, next) => {
  const locale = localeFromPath(context.url.pathname);
  const response = await next();
  if (locale === 'en' || !response.headers.get('content-type')?.includes('text/html')) return response;
  const html = await response.text();
  const prefixes = new Set(locales.map(localePrefix).filter(Boolean));
  // Links that already name a language (the language menu) keep their target.
  const localize = (href: string) => (prefixes.has(href.split('/')[1]) ? href : localizeHref(locale, href));
  const translated = translateHtml(html, phraseTranslator(locale), localize);
  return new Response(translated, { status: response.status, headers: response.headers });
});
