import type { TranslationKey } from './translations/en';

let cached: Partial<Record<TranslationKey, string>> | undefined;
export function setClientMessages(
  messages: Partial<Record<TranslationKey, string>>,
) {
  cached = messages;
}
export function clientT(
  key: TranslationKey,
  values: Record<string, string | number> = {},
) {
  if (!cached) {
    const data = document.getElementById('i18n-messages');
    cached = data ? JSON.parse(data.textContent || '{}') : {};
  }
  const message = cached?.[key];
  if (!message)
    throw new Error(`Client translation was not serialized: ${key}`);
  return message.replace(/\{(\w+)\}/g, (token, name) =>
    String(values[name] ?? token),
  );
}
