import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { localeAtom } from './atoms';

export function useLocale() {
  const locale = useAtomValue(localeAtom);
  const setLocale = useSetAtom(localeAtom);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('app-locale')) return;

    const browserLang = navigator.language.split('-')[0];
    if (browserLang === 'id') {
      setLocale('id');
    }
  }, [setLocale]);

  return { locale, setLocale };
}
