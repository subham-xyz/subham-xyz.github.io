import { localeNames, normalizeLocale, type Locale } from '../i18n/config';
import { setClientMessages } from '../i18n/client';
import type { Dictionary, TranslationKey } from '../i18n/translations/en';

// Load only the chosen, self-hosted dictionary. Never translate user content,
// filenames, or arbitrary text nodes. Unfinished pages keep their English SEO.
const dictionaries = import.meta.glob<{ default: Dictionary }>(
  '../i18n/translations/*.ts',
);
const selector =
  document.querySelector<HTMLDetailsElement>('.language-selector');
let request = 0;
async function selectLanguage(locale: Locale, manual = false) {
  const current = ++request;
  if (!selector) return;
  selector.setAttribute('aria-busy', 'true');
  const error = selector.querySelector<HTMLElement>('[data-language-error]')!;
  error.hidden = true;
  try {
    const [{ default: selected }, { default: english }] = await Promise.all([
      dictionaries[`../i18n/translations/${locale}.ts`](),
      dictionaries['../i18n/translations/en.ts'](),
    ]);
    const messages = Object.fromEntries(
      Object.entries(english).map(([key, value]) => [
        key,
        selected[key as TranslationKey] || value,
      ]),
    ) as Dictionary;
    if (current !== request) return;
    for (const element of document.querySelectorAll<HTMLElement>(
      '[data-i18n]',
    )) {
      const key = element.dataset.i18n as TranslationKey;
      if (messages[key]) {
        element.textContent = messages[key];
        element.lang = locale;
      }
    }
    for (const attribute of ['aria-label', 'title', 'placeholder']) {
      for (const element of document.querySelectorAll<HTMLElement>(
        `[data-i18n-${attribute}]`,
      )) {
        const key = element.getAttribute(
          `data-i18n-${attribute}`,
        ) as TranslationKey;
        if (messages[key]) element.setAttribute(attribute, messages[key]);
      }
    }
    setClientMessages(messages);
    error.textContent = messages['common.error'];
    error.lang = locale;
    const name = selector.querySelector<HTMLElement>('.language-name')!;
    name.textContent = localeNames[locale];
    name.lang = locale;
    selector
      .querySelector('summary')!
      .setAttribute(
        'aria-label',
        `${messages['nav.language']}: ${localeNames[locale]}`,
      );
    selector
      .querySelector('nav')!
      .setAttribute('aria-label', messages['nav.language']);
    for (const option of selector.querySelectorAll<HTMLElement>(
      '[data-language]',
    )) {
      const active = option.dataset.language === locale;
      if (option.tagName === 'BUTTON')
        option.setAttribute('aria-pressed', String(active));
      else if (active) option.setAttribute('aria-current', 'page');
      else option.removeAttribute('aria-current');
      option.querySelector('[data-language-check]')!.textContent = active
        ? '✓'
        : '';
    }
    document
      .getElementById('theme-toggle')
      ?.setAttribute(
        'aria-label',
        messages[
          document.documentElement.dataset.theme === 'dark'
            ? 'nav.light'
            : 'nav.dark'
        ],
      );
    document
      .getElementById('menu-toggle')
      ?.setAttribute(
        'aria-label',
        messages[
          document.getElementById('mobile-nav')?.hidden
            ? 'nav.open'
            : 'nav.close'
        ],
      );
    document.documentElement.dataset.uiLanguage = locale;
    if (manual) {
      try {
        localStorage.setItem('kittysuite-language', locale);
      } catch {
        /* Optional storage. */
      }
      selector.open = false;
      selector.querySelector('summary')!.focus();
    }
  } catch {
    // Keep the current interface and preference if a dictionary cannot load.
    // Choosing another language remains possible when connectivity returns.
    if (current === request) error.hidden = false;
  } finally {
    if (current === request) selector.removeAttribute('aria-busy');
  }
}

selector?.addEventListener('click', (event) => {
  const option = (event.target as Element).closest<HTMLButtonElement>(
    'button[data-language]',
  );
  const locale = normalizeLocale(option?.dataset.language);
  if (option && locale) void selectLanguage(locale, true);
});
let saved: string | null = null;
try {
  saved = localStorage.getItem('kittysuite-language');
} catch {
  /* Optional storage. */
}
const pageLocale = normalizeLocale(document.documentElement.lang) || 'en';
const preferred =
  pageLocale !== 'en'
    ? pageLocale
    : normalizeLocale(saved) ||
      (navigator.languages || [navigator.language])
        .map(normalizeLocale)
        .find(Boolean) ||
      'en';
if (preferred !== pageLocale) void selectLanguage(preferred);
