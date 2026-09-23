import { useCallback } from 'react';
import { useIntl } from 'react-intl';

/**
 * Typed shorthand for the verbose `intl.formatMessage({ id, defaultMessage })` pair.
 *
 * Keeps the `defaultMessage` fallback intact so untranslated keys still render,
 * and mirrors `useIntl` identity-stability so the callback can safely be memoised.
 */
export function useMessage() {
  const intl = useIntl();

  return useCallback((id: string, defaultMessage: string) => intl.formatMessage({ id, defaultMessage }), [intl]);
}
