/**
 * Page-context provider for the AI assistant (T1).
 *
 * Exposes the current page (route + formId + live form values + missing
 * required fields) so the assistant drawer never has to ask "which
 * module/page are you on?". Pilot form: `/inbound-transaction/receiving/new`
 * (`receiving-transaction-form` — see
 * `apps/client/src/pages/inbound-transaction/receiving/ReceivingTransactionFormPage.tsx`).
 *
 * Extends — does not replace — the existing DOM-scrape helper in
 * `apps/client/src/components/AiFill/pageContext.ts`: structured live form
 * state is published by form pages via {@link useRegisterPageForm}, while the
 * DOM scrape is still merged in as `dom` for everything else on the page
 * (headings, sections, select options).
 *
 * The store is module-level (not React context) on purpose: the assistant
 * drawer lives outside any form subtree, so it must be able to read context
 * from an event handler via {@link getPageContextSnapshot} without any
 * provider ancestor — the store is module-level.
 *
 * Future consumer (T2, not here): on drawer open, auto-send context plus the
 * initial user message "help me fill this form":
 *
 *   import { getPageContextSnapshot } from '../../lib/ai/usePageContext';
 *   sendMessage({ text: 'help me fill this form', context: getPageContextSnapshot() });
 *
 * Backend reference (later task, do not implement here):
 * `trpcClient.assistant.*`, permission `assistant@use` (or the existing
 * helper permission) — reuse, don't invent.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { collectPageContext, normalizeScrapedContext } from '../../components/AiFill/pageContext';

export type PageFormValues = Record<string, unknown>;

export interface PageFormRegistration {
  formId: string;
  formValues: PageFormValues;
  missingRequired: string[];
}

export interface PageContextSnapshot {
  /** Defaults to the current route the user is accessing. */
  route: string;
  /** e.g. `'receiving-transaction-form'` — `null` on non-form pages. */
  formId: string | null;
  /** Live, sanitized (JSON-safe, no base64) form values. */
  formValues: PageFormValues;
  /** Required field keys still empty, e.g. `['supplierId', 'items[0].skuId']`. */
  missingRequired: string[];
}

/** Snapshot plus the merged DOM scrape (`collectPageContext`). */
export interface PageContextPayload extends PageContextSnapshot {
  dom: Record<string, unknown> | null;
}

export interface UsePageContextResult extends PageContextSnapshot {
  /** Fresh payload at call time — use this when sending context to the assistant. */
  getPageContext: () => PageContextPayload;
}

// ── Module-level store (readable outside React) ─────────────────────────────

let currentForm: PageFormRegistration | null = null;

const listeners = new Set<() => void>();

const notify = (): void => {
  for (const listener of listeners) listener();
};

const subscribe = (callback: () => void): (() => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

const getFormSnapshot = (): PageFormRegistration | null => currentForm;

/** Publish (or replace) the live form on the current page. */
export const registerPageForm = (registration: PageFormRegistration): void => {
  currentForm = registration;
  notify();
};

/** Clear the registration (only when `formId` still matches — stale unmount safe). */
export const clearPageForm = (formId: string): void => {
  if (currentForm?.formId === formId) {
    currentForm = null;
    notify();
  }
};

// ── Sanitizers ──────────────────────────────────────────────────────────────

// T10 payload size caps: the snapshot travels on EVERY chat send, so
// unbounded option lists / long notes must not bloat the request body.
// `MAX_ARRAY_ITEMS` (200) is far above any real form — items rows are never
// cut to row 0; every row in `items[]` (skuId/quantity/details) is preserved.
const MAX_STRING_LENGTH = 2000;
const MAX_ARRAY_ITEMS = 200;
const MAX_OBJECT_KEYS = 200;
const MAX_SANITIZE_DEPTH = 10;

const sanitizeValue = (value: unknown, depth = 0): unknown => {
  if (value === null || value === undefined) return value;
  if (depth > MAX_SANITIZE_DEPTH) return null;
  const valueType = typeof value;
  if (valueType === 'string') {
    const text = value as string;
    return text.length > MAX_STRING_LENGTH ? `${text.slice(0, MAX_STRING_LENGTH)}…(truncated)` : text;
  }
  if (valueType === 'number' || valueType === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_ITEMS).map((entry) => sanitizeValue(entry, depth + 1));
  if (valueType === 'object') {
    const record = value as Record<string, unknown>;
    // `@internationalized/date` DateValue (receiving `date` field) → plain calendar string.
    if (typeof record.toDate === 'function') {
      try {
        return String(value);
      } catch {
        return null;
      }
    }
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record).slice(0, MAX_OBJECT_KEYS)) {
      // Never send base64 file payloads (receiving `files[].dataUrl`) to the assistant.
      if (key === 'dataUrl') continue;
      out[key] = sanitizeValue(entry, depth + 1);
    }
    return out;
  }
  return null;
};

const sanitizeValues = (values: PageFormValues): PageFormValues =>
  sanitizeValue(values) as PageFormValues;

const currentRoute = (): string =>
  typeof window !== 'undefined' ? window.location.pathname : '/';

const readDomContext = (): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(collectPageContext()) as Record<string, unknown>;
    // Idempotent defense: the scrape normalizes itself at the source, but any
    // future producer benefits from the same caps + stable supplier/warehouse/
    // sku aliases before the payload reaches the model.
    return normalizeScrapedContext(parsed);
  } catch {
    return null;
  }
};

// ── Reader API (hook + standalone) ──────────────────────────────────────────

/**
 * Fresh page-context payload at call time. Safe outside React — this is what
 * the assistant drawer (T2) calls on open, so `route` is always the page the
 * user is actually accessing.
 */
export const getPageContextSnapshot = (): PageContextPayload => {
  const form = currentForm;
  return {
    route: currentRoute(),
    formId: form?.formId ?? null,
    formValues: sanitizeValues(form?.formValues ?? {}),
    missingRequired: form?.missingRequired ?? [],
    dom: readDomContext(),
  };
};

/**
 * Reactive page context. `route` defaults to the current location;
 * `getPageContext()` re-reads the store so event handlers always send fresh data.
 */
export const usePageContext = (): UsePageContextResult => {
  const form = useSyncExternalStore(subscribe, getFormSnapshot, getFormSnapshot);
  const getPageContext = useCallback(() => getPageContextSnapshot(), []);
  const formValues = useMemo(() => sanitizeValues(form?.formValues ?? {}), [form]);

  return {
    route: currentRoute(),
    formId: form?.formId ?? null,
    formValues,
    missingRequired: form?.missingRequired ?? [],
    getPageContext,
  };
};

/**
 * Opt a form page into page context. Registers on mount / value change,
 * unregisters on unmount (stale-unmount safe via `formId` match).
 *
 * Pattern every form page must follow (T10): publish the FULL live values
 * object — every input plus the whole row array (e.g. `items[]` with all
 * rows, never just row 0) — plus the missing-required keys. Select id+label
 * maps arrive via the DOM scrape's `data-ai-select-options` blocks, merged
 * into stable `supplier` / `warehouse` / `sku` aliases.
 *
 * Usage (receiving pilot): compute the missing-required keys with
 * {@link computeMissingRequired} against the form's required keys, then publish:
 *
 *   const missingRequired = computeMissingRequired(formValues, REQUIRED_KEYS);
 *   useRegisterPageForm('receiving-transaction-form', formValues, missingRequired);
 */
export const useRegisterPageForm = (
  formId: string,
  formValues: PageFormValues,
  missingRequired: string[] = [],
): void => {
  useEffect(() => {
    registerPageForm({ formId, formValues, missingRequired });
    return () => {
      clearPageForm(formId);
    };
  }, [formId, formValues, missingRequired]);
};

// ── Required-field helpers ──────────────────────────────────────────────────

/** Generic helper: required keys that are missing, empty, or empty arrays. */
export const computeMissingRequired = (
  values: PageFormValues,
  required: readonly string[],
): string[] =>
  required.filter((key) => {
    const value = values[key];
    return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
  });
