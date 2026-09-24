import { Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useIntl } from 'react-intl';
import { UnsavedChangesBadge } from '../UnsavedChangesBadge';
import type { TransactionIntentMode } from './useTransactionFormModal';

export interface FormFooterTotals {
  items: number;
  quantity: number;
  /** Purchase-order extension: money total beside qty (success mint, positive only). */
  amount?: number;
}

interface FormFooterBarProps {
  /** `'draft-propose'` (Save Draft + Propose) or `'single-save'` (create-only stock-count). */
  mode?: TransactionIntentMode;
  /** Permission gate (`resource@create` / `resource@update`) — hidden when false. */
  canSave: boolean;
  canSubmit: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
  isEdit: boolean;
  /** Omit for header-only pages (no lines table). */
  totals?: FormFooterTotals | null;
  /** Resolved `<domain>.form.*` strings; missing keys fall back to `form.*`. */
  labels?: {
    saveDraft?: string;
    propose?: string;
    save?: string;
    incomplete?: string;
    items?: string;
    quantity?: string;
    amount?: string;
  };
  onSaveDraft?: () => void;
  onPropose?: () => void;
  onSave?: () => void;
}

/**
 * Sticky footer bar for document forms — the receiving actions recipe: live
 * totals left (items / qty, optional PO amount), the incomplete hint, the
 * dirty badge on edit pages, and the permission-gated Save Draft / Propose
 * pair (or the single Save for create-only pages).
 *
 * Double-submit guard: the buttons are disabled ONLY while `isSubmitting`.
 * `canSubmit` never disables them — a submit attempt on an incomplete form
 * surfaces the field errors (HeroUI/tanstack) instead of leaving the user
 * stuck with a dead button.
 */
export function FormFooterBar({
  mode = 'draft-propose',
  canSave,
  canSubmit,
  isSubmitting,
  isDirty,
  isEdit,
  totals,
  labels,
  onSaveDraft,
  onPropose,
  onSave,
}: FormFooterBarProps) {
  const intl = useIntl();

  if (!canSave) return null;

  const saveDraftLabel =
    labels?.saveDraft ?? intl.formatMessage({ id: 'form.save_draft', defaultMessage: 'Save Draft' });
  const proposeLabel =
    labels?.propose ?? intl.formatMessage({ id: 'form.propose', defaultMessage: 'Propose' });
  const saveLabel = labels?.save ?? intl.formatMessage({ id: 'form.save', defaultMessage: 'Save' });
  const incompleteLabel =
    labels?.incomplete ??
    intl.formatMessage({ id: 'form.incomplete', defaultMessage: 'Complete required fields' });
  const itemsLabel =
    labels?.items ?? intl.formatMessage({ id: 'form.total_items', defaultMessage: 'items' });
  const quantityLabel =
    labels?.quantity ?? intl.formatMessage({ id: 'form.total_quantity', defaultMessage: 'qty' });
  const amountLabel =
    labels?.amount ?? intl.formatMessage({ id: 'form.total_amount', defaultMessage: 'total' });

  return (
    <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        {totals ? (
          <>
            <span className="flex items-center gap-1.5 text-muted">
              <span className="font-semibold tabular-nums text-foreground">{totals.items}</span>
              {itemsLabel}
            </span>
            <span className="flex items-center gap-1.5 text-muted">
              <span className="font-semibold tabular-nums text-foreground">{totals.quantity}</span>
              {quantityLabel}
            </span>
            {typeof totals.amount === 'number' ? (
              <span className="flex items-center gap-1.5 text-muted">
                <span className="font-semibold tabular-nums text-success">{totals.amount}</span>
                {amountLabel}
              </span>
            ) : null}
          </>
        ) : null}
        {!canSubmit ? <span className="text-xs text-warning">{incompleteLabel}</span> : null}
      </div>
      <div className="flex items-center gap-2">
        {isEdit && isDirty ? <UnsavedChangesBadge className="mr-auto" /> : null}
        {mode === 'single-save' ? (
          <Button isDisabled={isSubmitting} onPress={onSave}>
            <Icon icon="solar:floppy-disk-linear" className="size-4" />
            {saveLabel}
          </Button>
        ) : (
          <>
            <Button variant="ghost" isDisabled={isSubmitting} onPress={onSaveDraft}>
              <Icon icon="solar:floppy-disk-linear" className="size-4" />
              {saveDraftLabel}
            </Button>
            <Button isDisabled={isSubmitting} onPress={onPropose}>
              <Icon icon="solar:send-linear" className="size-4" />
              {proposeLabel}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
