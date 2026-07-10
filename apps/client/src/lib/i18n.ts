import en from '../locales/en.json';
import id from '../locales/id.json';

export type Locale = 'en' | 'id';

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_STORAGE_KEY = 'app-locale';
export const LOCALE_COOKIE_NAME = 'app-locale';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export const supportedLocales: Locale[] = ['en', 'id'];

export const localeSymbols: Record<Locale, string> = {
  en: 'EN',
  id: 'ID',
};

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  id: 'Bahasa Indonesia',
};

export const messages: Record<Locale, Record<string, string>> = {
  en,
  id,
};

export const isLocale = (value: unknown): value is Locale =>
  value === 'en' || value === 'id';

export function getLocaleMessages(locale: string) {
  return messages[locale === 'id' ? 'id' : 'en'];
}

export const parseLocaleFromString = (value: string | undefined): Locale | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return isLocale(normalized) ? normalized : null;
};

export const getLocaleFromCookie = (cookieHeader?: string): Locale | null => {
  if (typeof cookieHeader !== 'string') return null;

  const entries = cookieHeader.split(';').map((value) => value.trim());
  for (const entry of entries) {
    const [name, rawValue] = entry.split('=');
    if (name === LOCALE_COOKIE_NAME && rawValue) {
      return parseLocaleFromString(decodeURIComponent(rawValue));
    }
  }

  return null;
};

export const getLocaleFromLocalStorage = (): Locale | null => {
  if (typeof window === 'undefined') return null;
  return parseLocaleFromString(window.localStorage.getItem(LOCALE_STORAGE_KEY) ?? undefined);
};

export const setLocaleCookie = (locale: Locale) => {
  if (typeof document === 'undefined') return;

  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; sameSite=lax`;
};

export const persistLocale = (locale: Locale) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  setLocaleCookie(locale);
};

export const getInitialLocale = (): Locale => {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  const cookieLocale = getLocaleFromCookie(document.cookie);
  if (cookieLocale) return cookieLocale;

  const storedLocale = getLocaleFromLocalStorage();
  if (storedLocale) return storedLocale;

  const browserLang = window.navigator.language.split('-')[0];
  if (browserLang === 'id') return 'id';

  return DEFAULT_LOCALE;
};
