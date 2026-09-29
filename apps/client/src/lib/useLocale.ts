import { useAtom, useSetAtom } from "jotai";
import { localeAtom, localeActionsAtom } from "./atoms";

export function useLocale() {
  const [locale] = useAtom(localeAtom);
  const setLocale = useSetAtom(localeActionsAtom);
  return { locale, setLocale };
}
