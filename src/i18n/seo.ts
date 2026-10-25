import { locales, type Locale } from './config.ts';
import { getLocalizedPath, isPublished } from './routes.ts';
import { translator } from './index.ts';

export function alternates(routeKey: string, site: URL | string) {
  const languages = locales.filter((locale) => isPublished(locale, routeKey));
  if (languages.length < 2) return [];
  return [
    ...languages.map((locale) => ({
      hreflang: locale,
      href: new URL(getLocalizedPath(locale, routeKey), site).href,
    })),
    {
      hreflang: 'x-default',
      href: new URL(getLocalizedPath('en', routeKey), site).href,
    },
  ];
}
export function localizedSeo(locale: Locale, routeKey?: string) {
  if (locale === 'en' || routeKey !== 'image-converter') return undefined;
  const t = translator(locale);
  return {
    title: t('converter.seoTitle'),
    description: t('converter.seoDescription'),
    h1: t('converter.h1'),
    intro: t('converter.description'),
  };
}
export const ogLocales: Record<Locale, string> = {
  en: 'en_IN',
  es: 'es_ES',
  hi: 'hi_IN',
  ja: 'ja_JP',
  fr: 'fr_FR',
  de: 'de_DE',
  'pt-BR': 'pt_BR',
  ko: 'ko_KR',
  it: 'it_IT',
};
