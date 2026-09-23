import type { ReactNode } from 'react';
import {
  Button,
  Card,
  FieldError,
  Label,
  NumberField,
  Table,
  TextField,
  Input,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { Field as TanStackField } from '@tanstack/react-form';
import { SkuSelectSearch } from '../SkuSelectSearch';

/**
 * The item rows these tables edit carry a persisted line id (`_id`, `null` for
 * unsaved rows) plus any number of string fields — ids, quantities, notes;
 * everything is a string on the form side and coerced to a number on submit.
 */
export type TransactionItemRow = { _id: string | null };

/** Any editable key of the item row. */
export type TransactionItemKey<TItem extends TransactionItemRow> = keyof TItem & string;

/**
 * Structural view over the tanstack-form `items` array field: only the surface
 * the table needs, so the twenty-odd invariant validator type params of
 * `FieldApi` don't pin the table to one page's exact form instantiation.
 */
export type TransactionItemsField<TItem extends TransactionItemRow> = {
  readonly state: { readonly value: TItem[] | undefined };
  pushValue: (value: TItem) => void;
  swapValues: (startIndex: number, targetIndex: number) => void;
  removeValue: (index: number) => void;
  /**
   * The owning form instance.
   *
   * Deliberately `unknown`. `FieldApi.form` is the *core* `FormApi`, which does
   * not carry the React-bound `form.Field` component that `useForm` returns —
   * reaching for `.form.Field` renders `undefined` ("got: undefined" crash).
   * `ItemCell` instead renders TanStack's standalone `<Field form={...}>` with
   * this instance, which keeps the bare `items[i].skuId` names type-checking
   * and the render props typed as `string` without pinning a specific form's
   * invariant validator parameters.
   */
  readonly form: unknown;
};

/** The render-prop the table binds to each cell's field. */
interface ItemFieldApi {
  state: { value: string | undefined; meta: { errors: string[] } };
  handleChange: (value: string) => void;
  handleBlur: () => void;
}

/**
 * Narrowed view of TanStack's standalone `<Field form={...}>` for one
 * `items[i].<key>` cell. `name` is a plain `string` because it is constructed
 * internally from the already-typed `column.key` — and the value side stays
 * `string` because every item field is a string on the form side.
 */
const ItemSubField = TanStackField as unknown as (props: {
  form: unknown;
  name: string;
  validators?: { onChange?: (context: { value: string }) => string | undefined };
  children: (field: ItemFieldApi) => ReactNode;
}) => ReactNode;

/** Labels for the SKU-search cell (the only cell with its own query state). */
export interface TransactionItemsSkuLabels {
  ariaLabel: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  /** Supplying this adds the "SKU is required" onChange validator. */
  requiredMessage?: string;
}

/** Handed to a `custom` column so pages can drop in their own picker. */
export interface TransactionItemsCellContext<TItem extends TransactionItemRow> {
  item: TItem;
  index: number;
  /** Stable row key — the persisted `_id`, or `new-<index>` for unsaved rows. */
  rowId: string;
  value: string;
  onChange: (value: string) => void;
  isDisabled: boolean;
}

interface ColumnBase<TItem extends TransactionItemRow> {
  /** Item field this column edits — becomes `items[i].<key>` in the form. */
  key: TransactionItemKey<TItem>;
  header: string;
}

/**
 * One editable column. `skuSelect` renders the SKU searcher, `text` a plain
 * input, `number` a stepper with a minimum, and `custom` defers to the page
 * (used by subinventory transfer's pallet / from / to pickers).
 */
export type TransactionItemsColumn<TItem extends TransactionItemRow> =
  | (ColumnBase<TItem> & { cell: 'skuSelect' } & TransactionItemsSkuLabels)
  | (ColumnBase<TItem> & { cell: 'text'; label?: string; placeholder?: string })
  | (ColumnBase<TItem> & {
      cell: 'number';
      label?: string;
      /** Inclusive minimum (defaults to 1). Below it the cell shows `ruleMessage`. */
      min?: number;
      ruleMessage?: string;
    })
  | (ColumnBase<TItem> & {
      cell: 'custom';
      render: (context: TransactionItemsCellContext<TItem>) => ReactNode;
    });

export interface TransactionItemsTableLabels {
  /** "Add Item" button. The button only renders when `createItem` is supplied. */
  add?: string;
  /** Empty-state body, e.g. `No items. Click "Add Item" to start.` */
  empty: string;
  /** `aria-label` on the table content. */
  aria: string;
  /** Reorder / remove button labels. Pages pass resolved i18n strings. */
  moveUp?: string;
  moveDown?: string;
  remove?: string;
}

export interface TransactionItemsTableProps<TItem extends TransactionItemRow> {
  /** The `items` array field from `<form.Field name="items">`. */
  field: TransactionItemsField<TItem>;
  columns: TransactionItemsColumn<TItem>[];
  /** Factory for a fresh blank row. Omit and the page owns the "Add Item" button. */
  createItem?: () => TItem;
  /** True while the submit request is in flight — disables every control. */
  isDisabled: boolean;
  labels: TransactionItemsTableLabels;
  /** Empty-state icon. */
  emptyStateIcon?: string;
  /** Extra rows below the body — only receiving uses this (totals row). */
  footer?: ReactNode;
  /**
   * `'card'` (default) wraps the table in a `Card` with a header holding the
   * title, description and Add Item button. `'none'` renders the bare table so
   * family-A pages can keep their own `FormSection` wrapper and header button.
   */
  container?: 'card' | 'none';
  title?: string;
  description?: string;
  /** Optional iconify icon next to the title (container='card'). */
  icon?: string;
  /** Iconify icon for the Add Item button. */
  addIcon?: string;
}

const MOVE_UP_LABEL = 'Move up';
const MOVE_DOWN_LABEL = 'Move down';
const REMOVE_LABEL = 'Remove';
const DEFAULT_MIN = 1;

/**
 * The editable items table shared by the transaction form pages — the largest
 * duplicated block (~450 lines per page).
 *
 * Renders the `#` column, one column per {@link TransactionItemsColumn}, and the
 * reorder/remove actions, plus the empty state and an optional totals footer.
 * Disabled rules are exactly the ones the pages had: up disabled on the first
 * row, down on the last, everything disabled while submitting.
 */
export function TransactionItemsTable<TItem extends TransactionItemRow>({
  field,
  columns,
  createItem,
  isDisabled,
  labels,
  emptyStateIcon = 'solar:box-linear',
  footer,
  container = 'card',
  title,
  description,
  icon,
  addIcon = 'solar:add-circle-linear',
}: TransactionItemsTableProps<TItem>) {
  const items = field.state.value ?? [];
  const lastIndex = items.length - 1;
  const moveUpLabel = labels.moveUp ?? MOVE_UP_LABEL;
  const moveDownLabel = labels.moveDown ?? MOVE_DOWN_LABEL;
  const removeLabel = labels.remove ?? REMOVE_LABEL;

  const table = (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label={labels.aria}>
          <Table.Header>
            <Table.Column isRowHeader>
              <span className="text-xs font-semibold">#</span>
            </Table.Column>
            {columns.map((column) => (
              <Table.Column key={column.key}>
                <span className="text-xs font-semibold">{column.header}</span>
              </Table.Column>
            ))}
            <Table.Column>
              <span className="text-xs font-semibold" />
            </Table.Column>
          </Table.Header>
          <Table.Body
            renderEmptyState={() => (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <Icon icon={emptyStateIcon} className="size-6 text-muted" />
                <span className="text-sm text-muted">{labels.empty}</span>
              </div>
            )}
          >
            {items.map((item, index) => {
              const rowId = item._id ?? `new-${index}`;
              return (
                <Table.Row key={rowId} id={rowId}>
                  <Table.Cell>
                    <span className="font-mono text-sm text-muted">{index + 1}</span>
                  </Table.Cell>
                  {columns.map((column) => (
                    <Table.Cell key={column.key}>
                      <ItemCell
                        field={field}
                        column={column}
                        item={item}
                        index={index}
                        rowId={rowId}
                        isDisabled={isDisabled}
                      />
                    </Table.Cell>
                  ))}
                  <Table.Cell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        isIconOnly
                        isDisabled={index === 0 || isDisabled}
                        onPress={() => field.swapValues(index, index - 1)}
                        aria-label={moveUpLabel}
                      >
                        <Icon icon="solar:arrow-up-linear" className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        isIconOnly
                        isDisabled={index === lastIndex || isDisabled}
                        onPress={() => field.swapValues(index, index + 1)}
                        aria-label={moveDownLabel}
                      >
                        <Icon icon="solar:arrow-down-linear" className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        isIconOnly
                        isDisabled={isDisabled}
                        onPress={() => field.removeValue(index)}
                        aria-label={removeLabel}
                      >
                        <Icon icon="solar:trash-bin-trash-linear" className="size-4 text-danger" />
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
          {footer ? <Table.Footer>{footer}</Table.Footer> : null}
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );

  if (container === 'none' || !createItem) return table;

  return (
    <Card>
      <Card.Header className="flex flex-row items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon ? <Icon icon={icon} className="size-[18px] shrink-0 text-accent" /> : null}
          <div className="min-w-0">
            <p className="text-base font-semibold">{title}</p>
            {description ? <p className="truncate text-sm text-muted">{description}</p> : null}
          </div>
        </div>
        <Button
          variant="secondary"
          className="shrink-0"
          isDisabled={isDisabled}
          onPress={() => field.pushValue(createItem())}
        >
          <Icon icon={addIcon} className="size-4" />
          {labels.add}
        </Button>
      </Card.Header>
      <Card.Content>{table}</Card.Content>
    </Card>
  );
}

interface ItemCellProps<TItem extends TransactionItemRow> {
  field: TransactionItemsField<TItem>;
  column: TransactionItemsColumn<TItem>;
  item: TItem;
  index: number;
  rowId: string;
  isDisabled: boolean;
}

/** Renders a single column's control, bound to `items[index][column.key]`. */
function ItemCell<TItem extends TransactionItemRow>({
  field,
  column,
  item,
  index,
  rowId,
  isDisabled,
}: ItemCellProps<TItem>) {
  // `field` is the `items` array FieldApi. Its `.form` is the *core* FormApi,
  // which carries no React-bound `form.Field` — so cells bind via TanStack's
  // standalone `<Field form={field.form}>` instead.
  const form = field.form;
  const name = `items[${index}].${column.key}`;

  if (column.cell === 'custom') {
    return (
      <ItemSubField form={form} name={name}>
        {(subField) =>
          column.render({
            item,
            index,
            rowId,
            value: subField.state.value ?? '',
            onChange: (value: string) => subField.handleChange(value),
            isDisabled,
          })
        }
      </ItemSubField>
    );
  }

  if (column.cell === 'skuSelect') {
    const { ariaLabel, placeholder, searchPlaceholder, emptyLabel, requiredMessage } = column;
    return (
      <ItemSubField
        form={form}
        name={name}
        validators={
          requiredMessage
            ? { onChange: ({ value }) => (!value ? requiredMessage : undefined) }
            : undefined
        }
      >
        {(subField) => (
          <SkuSelectSearch
            queryKeyBase={`${rowId}-sku`}
            value={subField.state.value || ''}
            onChange={(v: string) => subField.handleChange(String(v ?? ''))}
            ariaLabel={ariaLabel}
            placeholder={placeholder}
            searchPlaceholder={searchPlaceholder}
            emptyLabel={emptyLabel}
            isDisabled={isDisabled}
            isInvalid={subField.state.meta.errors.length > 0}
            errorMessage={subField.state.meta.errors.join(', ')}
          />
        )}
      </ItemSubField>
    );
  }

  if (column.cell === 'number') {
    const min = column.min ?? DEFAULT_MIN;
    return (
      <ItemSubField form={form} name={name}>
        {(subField) => {
          const qty = Number(subField.state.value || '0');
          return (
            <NumberField
              fullWidth
              variant="secondary"
              isDisabled={isDisabled}
              isRequired
              minValue={min}
              step={1}
              value={qty}
              onChange={(v) => subField.handleChange(String(v ?? min))}
              aria-label={column.label}
              isInvalid={qty < min}
            >
              <Label>{column.label}</Label>
              <NumberField.Group>
                <NumberField.DecrementButton />
                <NumberField.Input />
                <NumberField.IncrementButton />
              </NumberField.Group>
              <FieldError>{qty < min ? column.ruleMessage : ''}</FieldError>
            </NumberField>
          );
        }}
      </ItemSubField>
    );
  }

  return (
    <ItemSubField form={form} name={name}>
      {(subField) => (
        <TextField
          isDisabled={isDisabled}
          value={subField.state.value}
          onChange={subField.handleChange}
          onBlur={subField.handleBlur}
          aria-label={column.label}
        >
          <Input variant="secondary" placeholder={column.placeholder} />
        </TextField>
      )}
    </ItemSubField>
  );
}
