import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useStore } from "@tanstack/react-form";
import {
  useRegisterPageForm,
  type PageFormValues,
} from "../../lib/ai/usePageContext";
import {
  useTransactionFormModal,
  type TransactionFormModalMessages,
  type TransactionIntent,
  type TransactionIntentMode,
} from "./useTransactionFormModal";
import type { FormFooterTotals } from "./FormFooterBar";

/**
 * Server-side / zod validation errors mapped by field name. Keys use the
 * tanstack deep-key syntax, so nested line errors arrive as
 * `items[0].quantity`-style paths (exactly the names `<form.Field>` binds).
 */
export type FormValidationErrors = Record<string, string | string[]>;

/**
 * Structural view over a Zod schema — only `safeParse` + `parse` are needed,
 * so the kit stays decoupled from any single page's exact schema type.
 *
 * The issue `path` matches zod v4's own `PropertyKey[]` (string | number |
 * symbol), so a real `z` schema satisfies this interface directly — no
 * `as unknown as DocFormSchema` cast needed on pages.
 */
export interface DocFormSchema {
  safeParse(value: unknown): {
    success: boolean;
    error?: { issues: Array<{ message: string; path?: PropertyKey[] }> };
  };
  /**
   * Full parse — applies zod transforms. This is the submit payload source of
   * truth (the pages' `toPayload` only maps/naming on top of its output).
   */
  parse(value: unknown): unknown;
}

/** Alias — `DocFormSchema` is the structural contract real zod v4 schemas satisfy. */
export type ZodTypeLike = DocFormSchema;

/** Live totals derived from the form values (lines profile; header-only pages omit). */
export interface DocFormTotals {
  totalItems: number;
  totalQuantity: number;
}

/**
 * Adapter from the hook's `DocFormTotals` to `FormFooterBar`'s
 * `FormFooterTotals` shape — pages pass
 * `totals={toFooterTotals(docForm.totals)}` instead of re-mapping keys per
 * page. `null`/`undefined` pass through (header-only pages, no lines table).
 */
export const toFooterTotals = (
  totals: DocFormTotals | null | undefined,
): FormFooterTotals | null =>
  totals ? { items: totals.totalItems, quantity: totals.totalQuantity } : null;

/**
 * The field-keyed shape a form-level validator returns so zod issues land on
 * the exact field that caused them (incl. nested `items[0].quantity` paths).
 * Matches tanstack's `GlobalFormValidationError`.
 */
interface DocFormErrors {
  form?: string;
  fields: Record<string, string | string[]>;
}

/** Zod issue path → tanstack deep key: `['items', 0, 'quantity']` → `items[0].quantity`. */
const pathToString = (path: PropertyKey[]): string =>
  path.reduce<string>(
    (acc, part) =>
      typeof part === "number"
        ? `${acc}[${part}]`
        : typeof part === "string"
          ? acc === ""
            ? part
            : `${acc}.${part}`
          : acc === ""
            ? String(part)
            : `${acc}.${String(part)}`,
    "",
  );

/**
 * Run the schema over the whole form value and split the issues per field.
 * Returns `undefined` when valid — no errors before the user interacts
 * (validators only fire on change/blur, never on mount).
 */
const zodErrorsToFieldErrors = (
  schema: DocFormSchema,
  value: unknown,
): DocFormErrors | undefined => {
  const result = schema.safeParse(value);
  if (result.success) return undefined;
  const fields: Record<string, string[]> = {};
  const formErrors: string[] = [];
  for (const issue of result.error?.issues ?? []) {
    if (issue.path && issue.path.length > 0) {
      const name = pathToString(issue.path);
      (fields[name] ??= []).push(issue.message);
    } else {
      // Schema-level issue (no field path) — form-level error.
      formErrors.push(issue.message);
    }
  }
  if (formErrors.length === 0 && Object.keys(fields).length === 0)
    return undefined;
  return {
    ...(formErrors.length > 0 ? { form: formErrors.join(", ") } : {}),
    fields,
  };
};

/**
 * Default server-error parser: understands the tRPC `BAD_REQUEST` payload
 * shape (`error.data.zodError.issues`, each with a zod `path`). Returns
 * `undefined` when the error carries no field mapping — the modal message
 * then stays the single source of the failure. Pages with a different server
 * contract override via `parseServerErrors`.
 */
const defaultParseServerErrors = (
  err: unknown,
): FormValidationErrors | undefined => {
  const data = (err as { data?: unknown } | undefined)?.data;
  const issues = (
    data as
      | {
          zodError?: {
            issues?: Array<{ path?: PropertyKey[]; message?: string }>;
          };
        }
      | undefined
  )?.zodError?.issues;
  if (!issues?.length) return undefined;
  const fields: Record<string, string[]> = {};
  for (const issue of issues) {
    if (issue.path && issue.path.length > 0) {
      const name = pathToString(issue.path);
      (fields[name] ??= []).push(issue.message ?? "Invalid value");
    }
  }
  return Object.keys(fields).length > 0 ? fields : undefined;
};

export interface UseDocFormOptions<
  TValues extends Record<string, unknown>,
  TPayload,
> {
  /** AI page-context id, e.g. `'receiving-transaction-form'`. */
  formId: string;
  isEdit: boolean;
  /** Route id — required on edit pages. */
  id?: string;
  /**
   * Transformed detail on edit pages, `null` on create pages.
   *
   * Loading sync is implicit: while the detail loads, `initialValues` is
   * `null`, so the form mounts on `defaultValues()` and the shell's
   * `isLoading` keeps it hidden. When the detail lands, the `defaultValues`
   * option changes and tanstack resyncs the untouched form. Do NOT "fix"
   * this with a remount key, a reset effect, or a manual sync — the resync
   * only runs while the form is untouched, which is exactly what makes the
   * pattern work.
   */
  initialValues: TValues | null;
  defaultValues: () => TValues;
  schema: DocFormSchema;
  /**
   * Map live values + staged intent into the wire payload. Receives the
   * `schema.parse(value)` output (zod transforms already applied) — this
   * function only names/maps (approval intent, message, id…).
   */
  toPayload: (
    values: TValues,
    intent: TransactionIntent,
    approvalMessage: string,
  ) => TPayload;
  /** `trpcClient.<domain>.create.mutate` (must resolve the created record id). */
  createCaller: (payload: TPayload) => Promise<{ id?: string | null }>;
  /** `trpcClient.<domain>.update.mutate`. Omit on create-only pages (stock-count). */
  updateCaller?: (payload: TPayload & { id: string }) => Promise<unknown>;
  /** Invalidation keys, e.g. `'receivingTransactionList'` / `'receivingTransactionDetail'`. */
  listQueryKey: string;
  detailQueryKey: string;
  /** Detail URL for a saved record (success modal + auto-redirect). */
  redirectOnSuccess: (id: string | null) => string;
  intentMode?: TransactionIntentMode;
  modalMessages: TransactionFormModalMessages;
  successMessageCreate: string;
  successMessageUpdate: string;
  errorFallback: string;
  /** Required keys still empty — published to the AI page context. */
  missingRequired?: (values: TValues) => string[];
  /** Totals derivation — omit for header-only pages (7 files, no lines table). */
  computeTotals?: (values: TValues) => DocFormTotals;
  /** Submit-readiness gate — drives the footer hint. Defaults to `true`. */
  computeCanSubmit?: (values: TValues) => boolean;
  /**
   * Map a failed mutation error to server-side field errors. Defaults to a
   * parser for the tRPC `error.data.zodError.issues` shape (nested
   * `items[0].qty`-style paths supported). Return `undefined` to fall back to
   * the plain modal error message.
   */
  parseServerErrors?: (error: unknown) => FormValidationErrors | undefined;
}

/**
 * The document-form hook extracted from the canonical receiving form
 * (`ReceivingTransactionFormPage`): tanstack form + zod onChange/onBlur
 * validation attributed per field (nested `items[i].qty` paths included),
 * create/update mutations with list+detail invalidation and server-side
 * `validationErrors` extraction, the `useTransactionFormModal` state machine,
 * AI page-context registration, and optional totals.
 *
 * Submit payload: `schema.parse(value)` is the source of truth (zod
 * transforms); `toPayload` only maps/naming on top of the parsed value.
 *
 * Permissions stay page-side: pages compute `canSave` from `hasPermissionAtom`
 * (`resource@create` / `resource@update`) and pass it to `FormFooterBar`.
 * i18n stays page-side: pages resolve `<domain>.form.*` strings and hand them
 * in; the kit only renders what it is given.
 */
export function useDocForm<TValues extends Record<string, unknown>, TPayload>(
  opts: UseDocFormOptions<TValues, TPayload>,
) {
  const {
    formId,
    isEdit,
    id,
    initialValues,
    defaultValues,
    schema,
    toPayload,
    createCaller,
    updateCaller,
    listQueryKey,
    detailQueryKey,
    redirectOnSuccess,
    intentMode = "draft-propose",
    modalMessages,
    successMessageCreate,
    successMessageUpdate,
    errorFallback,
  } = opts;

  const queryClient = useQueryClient();
  const modal = useTransactionFormModal({
    intentMode,
    redirectOnSuccess,
    messages: modalMessages,
  });

  // Read at submit time (not render time): `handleActionConfirm` only flips the
  // modal stage, so the hook's `intent` snapshot would be stale inside `onSubmit`.
  const intentRef = useRef<TransactionIntent>(
    intentMode === "single-save" ? "SAVE" : "DRAFT",
  );
  const approvalRef = useRef("");
  approvalRef.current = modal.approvalMessage;

  // Server-side validation errors from the last failed mutation, mapped by
  // field name. HeroUI's `Form validationErrors` clears them as soon as the
  // user edits the field — the pages pass this through to `FormPageShell`.
  const [validationErrors, setValidationErrors] = useState<
    FormValidationErrors | undefined
  >(undefined);

  const createMutation = useMutation({
    mutationFn: createCaller,
    onSuccess: (data) => {
      setValidationErrors(undefined);
      queryClient.invalidateQueries({ queryKey: [listQueryKey] });
      const createdId = typeof data?.id === "string" ? data.id : null;
      modal.handleSuccess(createdId, successMessageCreate);
    },
    onError: (err: Error) => {
      const fieldErrors = (opts.parseServerErrors ?? defaultParseServerErrors)(
        err,
      );
      if (fieldErrors) setValidationErrors(fieldErrors);
      modal.handleError(err.message ?? errorFallback);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: TPayload & { id: string }) => {
      if (!updateCaller) throw new Error(errorFallback);
      return updateCaller(payload);
    },
    onSuccess: () => {
      setValidationErrors(undefined);
      queryClient.invalidateQueries({ queryKey: [detailQueryKey, id] });
      queryClient.invalidateQueries({ queryKey: [listQueryKey] });
      modal.handleSuccess(id ?? null, successMessageUpdate);
    },
    onError: (err: Error) => {
      const fieldErrors = (opts.parseServerErrors ?? defaultParseServerErrors)(
        err,
      );
      if (fieldErrors) setValidationErrors(fieldErrors);
      modal.handleError(err.message ?? errorFallback);
    },
  });

  const form = useForm({
    // `initialValues ?? defaultValues()`: while the detail loads the form
    // mounts on defaults and the shell hides it behind `isLoading`; when
    // `initialValues` lands, the option change resyncs the untouched form.
    // This implicit sync is intentional — do not add a manual re-sync
    // (see `initialValues` docs, friction #4).
    defaultValues: initialValues ?? defaultValues(),
    validators: {
      // Whole-form zod validation on change AND blur — never on mount, so no
      // errors appear before the user interacts. Issues are attributed to the
      // exact field (nested `items[0].qty` paths included), not joined into a
      // single string that every field shows.
      onChange: ({ value }: { value: TValues }) =>
        zodErrorsToFieldErrors(schema, value),
      onBlur: ({ value }: { value: TValues }) =>
        zodErrorsToFieldErrors(schema, value),
    },
    // Submit attempts with an invalid form surface the field errors (tanstack
    // marks every field touched) and return to idle instead of hanging on the
    // 'loading' modal stage. This is what keeps the footer buttons clickable
    // regardless of `canSubmit` (FormFooterBar disables only while submitting).
    onSubmitInvalid: () => modal.handleValidationBlocked(),
    onSubmit: async ({ value }: { value: TValues }) => {
      // `schema.parse` applies zod transforms — its output is the payload
      // source of truth; `toPayload` stays for naming/mapping only.
      const parsed = schema.parse(value) as unknown as TValues;
      const payload = toPayload(
        parsed,
        intentRef.current,
        approvalRef.current || "",
      );
      if (isEdit && id) {
        await updateMutation.mutateAsync({ ...payload, id });
      } else {
        await createMutation.mutateAsync(payload);
      }
    },
  });

  // Subscribe reactively so totals / readiness / AI context recompute on edit.
  const formValues = useStore(form.store, (state) => state.values) as TValues;
  const isDirty = useStore(form.store, (state) => state.isDirty);

  const missingRequired = useMemo(
    () => opts.missingRequired?.(formValues) ?? [],
    [formValues],
  );
  useRegisterPageForm(
    formId,
    formValues as unknown as PageFormValues,
    missingRequired,
  );

  const totals = useMemo(
    () => opts.computeTotals?.(formValues) ?? null,
    [formValues],
  );
  const canSubmit = useMemo(
    () => opts.computeCanSubmit?.(formValues) ?? true,
    [formValues],
  );

  const handleActionConfirm = (status: TransactionIntent) => {
    intentRef.current = status;
    modal.handleActionConfirm(status);
  };

  const handleConfirmSubmit = () =>
    modal.handleConfirmSubmit(() => form.handleSubmit());

  return {
    form,
    formValues,
    isDirty,
    missingRequired,
    totals,
    canSubmit,
    isSubmitting: modal.isSubmitting,
    validationErrors,
    intent: modal.intent,
    modalStage: modal.modalStage,
    resultMessage: modal.resultMessage,
    approvalMessage: modal.approvalMessage,
    setApprovalMessage: modal.setApprovalMessage,
    handleModalClose: modal.handleModalClose,
    handleActionConfirm,
    handleConfirmSubmit,
    handleViewDetail: modal.handleViewDetail,
  };
}

export type UseDocFormResult<
  TValues extends Record<string, unknown>,
  TPayload,
> = ReturnType<typeof useDocForm<TValues, TPayload>>;
