/**
 * Document-form kit (Approach A, T1) — shared shell extracted from the
 * canonical receiving form so all 18 FormPages can converge.
 *
 * - `FormPageShell` — PageHeader + status chip + back, AI slots,
 *   `data-ai-context` section, header/aside/below slots, footer + modal.
 * - `DocHeaderCard` — header card (title/desc/icon + two-column field grid).
 * - `EditableLinesTable` — editable lines table (header+lines profile).
 * - `FormFooterBar` — sticky footer (Save Draft / Propose or single Save).
 * - `useDocForm` — form + mutations + modal machine + AI context + totals.
 * - `toFooterTotals` — hook totals → footer totals (no per-page map).
 *
 * Re-exported neighbours pages compose alongside the kit: `SelectSearch`,
 * `SkuSelectSearch`, `FormDatePicker`, `TransactionFormModal`,
 * `useTransactionFormModal` (modal + intent types), `useTransactionFormPage`
 * (outer detail loader + guards), `FormPreviewCard` + `FormAiTip` (preview
 * rail + AI callout used by the master-data forms).
 */
export { FormPageShell } from './FormPageShell';
export { DocHeaderCard } from './DocHeaderCard';
export { EditableLinesTable } from './EditableLinesTable';
export type {
  EditableLinesTableProps,
  TransactionItemKey,
  TransactionItemRow,
  TransactionItemsCellContext,
  TransactionItemsColumn,
  TransactionItemsField,
  TransactionItemsSkuLabels,
  TransactionItemsTableLabels,
} from './EditableLinesTable';
export { FormFooterBar } from './FormFooterBar';
export type { FormFooterTotals } from './FormFooterBar';
export { useDocForm, toFooterTotals } from './useDocForm';
export type {
  DocFormSchema,
  ZodTypeLike,
  DocFormTotals,
  FormValidationErrors,
  UseDocFormOptions,
  UseDocFormResult,
} from './useDocForm';
export { TransactionFormModal } from './TransactionFormModal';
export type { TransactionFormModalProps } from './TransactionFormModal';
export { useTransactionFormModal } from './useTransactionFormModal';
export type {
  ModalStage,
  TransactionIntent,
  TransactionIntentMode,
  TransactionFormModalMessages,
  UseTransactionFormModalOptions,
  UseTransactionFormModalResult,
} from './useTransactionFormModal';
export { useTransactionFormPage } from './useTransactionFormPage';
export type {
  UseTransactionFormPageOptions,
  UseTransactionFormPageResult,
} from './useTransactionFormPage';
export { FormPreviewCard } from './FormPreviewCard';
export type { FormPreviewCardProps, PreviewRow } from './FormPreviewCard';
export { FormAiTip } from './FormAiTip';
