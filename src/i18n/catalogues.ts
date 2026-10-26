// Server-side access to the phrase catalogues (src/i18n/content/<locale>.json).
import { Translator, type Catalogue } from './phrases.ts';
import { localePrefix, locales, type Locale } from './config.ts';
import { routes } from './routes.ts';
import source from './source/phrases.json';

const files = import.meta.glob<{ default: Catalogue }>('./content/*.json', { eager: true });
const cache = new Map<Locale, Translator>();

export function catalogue(locale: Locale): Catalogue {
  return files[`./content/${locale}.json`]?.default || {};
}
export function phraseTranslator(locale: Locale) {
  let t = cache.get(locale);
  if (!t) cache.set(locale, (t = new Translator(catalogue(locale))));
  return t;
}

const runtimeKeys = Object.entries(source as Record<string, { runtime?: boolean }>)
  // Script messages, plus page phrases with number slots ("Page {0} of {1}") that
  // scripts also write when they rebuild part of the page.
  .filter(([key, entry]) => entry.runtime || /\{\d+\}/.test(key) && key.length < 90)
  .map(([key]) => key);
/** Runtime phrases, the URL prefix and localized slugs for src/i18n/runtime.ts. */
export function runtimeCatalogue(locale: Locale) {
  const all = catalogue(locale);
  const phrases = Object.fromEntries(runtimeKeys.filter((key) => all[key]).map((key) => [key, all[key]]));
  const slugs = Object.fromEntries(
    Object.values(routes)
      .filter((slugs) => slugs.en && slugs[locale] !== slugs.en)
      .map((slugs) => [slugs.en, slugs[locale]]),
  );
  return { locale, prefix: localePrefix(locale), prefixes: locales.map(localePrefix).filter(Boolean), slugs, phrases };
}
