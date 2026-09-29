import { useIntl } from "react-intl";
import type { ReactNode } from "react";
import {
  TransactionItemsTable,
  type TransactionItemKey,
  type TransactionItemRow,
  type TransactionItemsCellContext,
  type TransactionItemsColumn,
  type TransactionItemsField,
  type TransactionItemsSkuLabels,
  type TransactionItemsTableLabels,
} from "./TransactionItemsTable";

export type {
  TransactionItemKey,
  TransactionItemRow,
  TransactionItemsCellContext,
  TransactionItemsColumn,
  TransactionItemsField,
  TransactionItemsSkuLabels,
  TransactionItemsTableLabels,
};

export interface EditableLinesTableProps<TItem extends TransactionItemRow> {
  /** The `items` array field from `<form.Field name="items">`. */
  field: TransactionItemsField<TItem>;
  columns: TransactionItemsColumn<TItem>[];
  /** Factory for a fresh blank row — renders the Add button. */
  createItem: () => TItem;
  /** True while the submit request is in flight — disables every control. */
  isDisabled: boolean;
  title: string;
  description?: string;
  icon?: string;
  /** Resolved `<domain>.form.*` strings; missing keys fall back to `form.*`. */
  labels?: Partial<TransactionItemsTableLabels>;
  /** Totals/footer extension point — page-built `Table.Row`s (e.g. PO money rows). */
  totalsFooter?: ReactNode;
}

/**
 * Editable lines table for document forms — the receiving `FormValues.items`
 * recipe (add/remove + reorder + inline validation + totals footer) over the
 * shared `TransactionItemsTable`, with generic `form.*` i18n fallbacks so
 * pages only pass their `<domain>.form.*` overrides.
 *
 * Header-only pages (7 files) simply don't render this. Purchase-order pages
 * extend totals via `totalsFooter` (amount rows beside the quantity row).
 */
export function EditableLinesTable<TItem extends TransactionItemRow>({
  field,
  columns,
  createItem,
  isDisabled,
  title,
  description,
  icon = "solar:box-linear",
  labels,
  totalsFooter,
}: EditableLinesTableProps<TItem>) {
  const intl = useIntl();

  return (
    <TransactionItemsTable
      field={field}
      columns={columns}
      createItem={createItem}
      isDisabled={isDisabled}
      title={title}
      description={description}
      icon={icon}
      footer={totalsFooter}
      labels={{
        add:
          labels?.add ??
          intl.formatMessage({
            id: "form.lines_add",
            defaultMessage: "Add Item",
          }),
        empty:
          labels?.empty ??
          intl.formatMessage({
            id: "form.lines_empty",
            defaultMessage: 'No items. Click "Add Item" to start.',
          }),
        aria:
          labels?.aria ??
          intl.formatMessage({
            id: "form.lines_aria",
            defaultMessage: "Items",
          }),
        moveUp: labels?.moveUp,
        moveDown: labels?.moveDown,
        remove: labels?.remove,
      }}
    />
  );
}
