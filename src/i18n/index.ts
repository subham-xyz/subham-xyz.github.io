import en, { type TranslationKey } from './translations/en.ts';
import es from './translations/es.ts';
import hi from './translations/hi.ts';
import ja from './translations/ja.ts';
import fr from './translations/fr.ts';
import de from './translations/de.ts';
import ptBR from './translations/pt-BR.ts';
import ko from './translations/ko.ts';
import it from './translations/it.ts';
import type { Locale } from './config';

// Server-only registry: client code receives just the messages used by its page.
export const dictionaries = { en, es, hi, ja, fr, de, 'pt-BR': ptBR, ko, it };
export type { TranslationKey };
export function translator(locale: Locale) {
  return (
    key: TranslationKey,
    values: Record<string, string | number> = {},
  ): string => {
    const message = dictionaries[locale]?.[key] || en[key];
    return message.replace(/\{(\w+)\}/g, (token, name) =>
      String(values[name] ?? token),
    );
  };
}
