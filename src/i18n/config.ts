export const locales = [
  'en',
  'es',
  'hi',
  'ja',
  'fr',
  'de',
  'pt-BR',
  'ko',
  'it',
] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';
export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  hi: 'हिन्दी',
  ja: '日本語',
  fr: 'Français',
  de: 'Deutsch',
  'pt-BR': 'Português (Brasil)',
  ko: '한국어',
  it: 'Italiano',
};
export const localePrefix = (locale: Locale) =>
  locale === 'en' ? '' : locale.toLowerCase();
export function normalizeLocale(
  value: string | null | undefined,
): Locale | undefined {
  const tag = value?.trim().toLowerCase();
  return (
    locales.find((locale) => locale.toLowerCase() === tag) ||
    locales.find(
      (locale) => locale.toLowerCase().split('-')[0] === tag?.split('-')[0],
    )
  );
}
export function localeFromPath(pathname: string): Locale {
  const prefix = pathname.split('/')[1];
  return (
    locales.find((locale) => localePrefix(locale) === prefix) || defaultLocale
  );
}
