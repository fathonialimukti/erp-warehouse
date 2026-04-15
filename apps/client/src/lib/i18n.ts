import en from '../locales/en.json';
import id from '../locales/id.json';

export type Locale = 'en' | 'id';

export const DEFAULT_LOCALE: Locale = 'en';

export const messages: Record<Locale, Record<string, string>> = {
  en,
  id,
};

export const isLocale = (value: unknown): value is Locale =>
  value === 'en' || value === 'id';

export function getLocaleMessages(locale: string) {
  return messages[locale === 'id' ? 'id' : 'en'];
}
