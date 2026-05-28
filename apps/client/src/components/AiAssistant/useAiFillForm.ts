import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { aiFormFillAtom } from '../../lib/atoms';

type UseAiFillFormOptions = {
  aliases?: Record<string, string>;
};

const normalizeFillValue = (value: unknown): unknown => {
  if (value == null) return value;

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
    return value;
  }

  // If AI returns a wrapped object like { value: 'WH01' }, unwrap it.
  if (valueType === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if ('value' in obj) {
      const nested = obj.value;
      const nestedType = typeof nested;
      if (nested == null || nestedType === 'string' || nestedType === 'number' || nestedType === 'boolean') {
        return nested;
      }
    }
  }

  // Ignore complex objects/arrays by default to avoid rendering "[object Object]"
  // into text inputs.
  return undefined;
};

/**
 * Opt a TanStack Form instance into AI-driven form filling.
 *
 * Pass the form instance and a map of field names to their `handleChange` setters.
 * When the AI calls `fillFormFields`, the matching fields will be populated and
 * the atom is cleared so it doesn't re-apply on re-render.
 *
 * Usage:
 *   useAiFillForm(form, {
 *     skuCode:     (v) => form.setFieldValue('skuCode', v),
 *     skuName:     (v) => form.setFieldValue('skuName', v),
 *     baseUnit:    (v) => form.setFieldValue('baseUnit', v),
 *     description: (v) => form.setFieldValue('description', v),
 *   });
 */
export const useAiFillForm = (
  setters: Record<string, (value: unknown) => void>,
  options?: UseAiFillFormOptions,
) => {
  const fillData = useAtomValue(aiFormFillAtom);
  const setFillData = useSetAtom(aiFormFillAtom);

  useEffect(() => {
    if (!fillData) return;

    let applied = false;
    for (const [key, value] of Object.entries(fillData)) {
      const resolvedKey = options?.aliases?.[key] ?? key;
      if (resolvedKey in setters) {
        const normalizedValue = normalizeFillValue(value);
        if (normalizedValue === undefined) continue;
        setters[resolvedKey](normalizedValue);
        applied = true;
      }
    }

    if (applied) {
      // Clear after applying so it doesn't replay on re-render
      setFillData(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fillData]);
};
