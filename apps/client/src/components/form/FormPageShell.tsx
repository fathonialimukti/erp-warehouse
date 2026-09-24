import { motion, useReducedMotion } from 'framer-motion';
import { Form, Spinner } from '@heroui/react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router';
import type { FormEvent, ReactNode } from 'react';
import { PageHeader } from '../PageHeader';
import { AiFillButton } from '../AiFill/AiFillButton';
import { AiFillPanel } from '../AiFill/AiFillPanel';
import type { FormValidationErrors } from './useDocForm';

interface FormPageShellProps {
  /** AI page-context id, e.g. `'receiving-transaction-form'`. */
  formId: string;
  mode: 'create' | 'edit';
  /** Route id on edit pages. */
  entityId?: string;
  title: string;
  backTo: string;
  /**
   * Id of the element that labels the form (`aria-labelledby`). Defaults to
   * `${formId}-title`, anchored on the element wrapping the `PageHeader`.
   */
  titleId?: string;
  /**
   * Server-side validation errors mapped by field name (nested
   * `items[0].qty`-style paths supported) — typically the `validationErrors`
   * result of `useDocForm`. HeroUI clears an error as soon as the user edits
   * that field.
   */
  validationErrors?: FormValidationErrors;
  /**
   * Override the default invalid-submit handler (HeroUI focuses the first
   * invalid field). `preventDefault()` disables that focus behaviour.
   */
  onInvalid?: (event: FormEvent<HTMLFormElement>) => void;
  /** Approval status chip rendered under the header (Draft/Proposed/…). */
  statusChip?: ReactNode;
  /** Field keys published in `data-ai-context` for the assistant drawer. */
  aiFields: string[];
  /**
   * Extra keys merged into the root `data-ai-context` object, alongside
   * `section` / `mode` / `transactionId` / `fields` — for page-specific AI
   * hints. Additive: pages that don't pass it are unchanged.
   */
  extraContext?: Record<string, unknown>;
  /** Header card(s) — `DocHeaderCard` blocks. */
  header: ReactNode;
  /** Right rail on wide screens — summary card + notes. Omit for single column. */
  aside?: ReactNode;
  /** Full-width blocks below the grid — lines table, attachments. */
  below?: ReactNode;
  /** Sticky action bar — `FormFooterBar`. Hidden while loading/guarded. */
  footer?: ReactNode;
  /** Submit state machine — `TransactionFormModal` bound to `useDocForm`. */
  modal?: ReactNode;
  isLoading?: boolean;
  loadingLabel?: string;
  /** Guard slot: not-found / wrong-status / error message. */
  guard?: ReactNode;
  /** Disable header actions while the submit request is in flight. */
  isDisabled?: boolean;
}

/**
 * The document-form page shell extracted from the canonical receiving form:
 * a HeroUI `Form` (validation context + landmark) wrapping `PageHeader`
 * (title + status chip + back + `AiFillButton`), `AiFillPanel`, the
 * `data-ai-context` section, the two-column grid (header left, summary rail
 * right, lines full-width below), the sticky footer, and the modal — plus the
 * loading spinner and guard states the outer page gates on.
 *
 * The `Form` runs with `validationBehavior="aria"` (realtime errors, never
 * blocks submission) and exposes `validationErrors` (server-side field errors
 * keyed by name — nested `items[i].qty` paths included) plus `onInvalid`
 * (default: focus the first invalid field). Submit itself stays programmatic
 * via `useDocForm`/tanstack; this form only supplies the validation context.
 *
 * Both profiles supported: header+lines pages pass `below` (the lines table);
 * header-only pages (7 files) omit `below` and `aside` as needed.
 */
export function FormPageShell({
  formId,
  mode,
  entityId,
  title,
  backTo,
  titleId,
  validationErrors,
  onInvalid,
  statusChip,
  aiFields,
  extraContext,
  header,
  aside,
  below,
  footer,
  modal,
  isLoading = false,
  loadingLabel,
  guard,
  isDisabled = false,
}: FormPageShellProps) {
  const intl = useIntl();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion() ?? false;

  // Anchor for `aria-labelledby` — the element wrapping the PageHeader. The
  // h1 carries the title text, so the form landmark labels itself from it.
  const titleAnchorId = titleId ?? `${formId}-title`;

  return (
    <Form
      validationBehavior="aria"
      validationErrors={validationErrors}
      aria-labelledby={titleAnchorId}
      onInvalid={onInvalid}
    >
      <div
        data-ai-context={JSON.stringify({
          section: formId,
          mode,
          transactionId: mode === 'edit' ? entityId : undefined,
          fields: aiFields,
          ...extraContext,
        })}
      >
        <div id={titleAnchorId}>
          <PageHeader title={title} onBack={() => navigate(backTo)} isDisabled={isDisabled}>
            <AiFillButton />
          </PageHeader>
        </div>
        {statusChip ? <div className="mt-3 flex justify-start">{statusChip}</div> : null}

        <AiFillPanel />

        {isLoading ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-4">
            <Spinner size="lg" />
            <p className="text-sm text-muted">
              {loadingLabel ??
                intl.formatMessage({ id: 'form.loading', defaultMessage: 'Loading…' })}
            </p>
          </div>
        ) : guard ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-2 text-center">
            {guard}
          </div>
        ) : (
          <motion.section
            initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="mt-6 space-y-6"
          >
            {aside ? (
              <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <div className="flex flex-col gap-6 lg:col-span-2">{header}</div>
                <div className="flex flex-col gap-6 lg:col-span-1">{aside}</div>
              </div>
            ) : (
              <div className="flex flex-col gap-6">{header}</div>
            )}

            {below}

            {footer}
          </motion.section>
        )}

        {modal}
      </div>
    </Form>
  );
}