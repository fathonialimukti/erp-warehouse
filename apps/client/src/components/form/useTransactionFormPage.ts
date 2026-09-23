import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';

/**
 * Statuses under which an existing transaction can still be edited. Every
 * transaction form page uses this same pair.
 */
const DEFAULT_EDITABLE_STATUSES = ['DRAFT', 'REJECTED'] as const;

export interface UseTransactionFormPageOptions<TDetail, TValues> {
  /** Query key for the detail record, e.g. `'lossTransactionDetail'`. */
  queryKey: string;
  /** The `trpcClient.<resource>.detail.query` procedure to run. */
  detailQuery: (input: { id: string }) => Promise<TDetail>;
  /** Map the wire detail into the form's default values. */
  transform: (detail: TDetail) => TValues;
  /** Statuses that may still be edited. Defaults to `['DRAFT', 'REJECTED']`. */
  editableStatuses?: readonly string[];
}

export interface UseTransactionFormPageResult<TDetail, TValues> {
  /** Route id — `undefined` on create pages. */
  id: string | undefined;
  /** `true` when a route id is present. */
  isEdit: boolean;
  /** The resolved detail record (undefined on create pages). */
  detail: TDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  /** Transformed detail, or `null` on create pages. */
  initialValues: TValues | null;
  /**
   * `true` when the page may render the form: create pages always, edit pages
   * only once the detail loaded, didn't error, and is still editable.
   *
   * Pages gate on this and render the four guard states (loading spinner,
   * error text, "not found", wrong-status warning) while it is false.
   */
  canEdit: boolean;
}

/**
 * The transaction-form page wrapper: route id, detail query, and the
 * transform into default values.
 *
 * Reproduces the block every transaction form page inlines — same `enabled`
 * gating, same guard order. The pages keep rendering the guard markup so the
 * spinner / error / not-found / wrong-status branches stay byte-identical.
 */
export function useTransactionFormPage<TDetail extends { approvalStatus: string }, TValues>(
  opts: UseTransactionFormPageOptions<TDetail, TValues>,
): UseTransactionFormPageResult<TDetail, TValues> {
  const { queryKey, detailQuery, transform, editableStatuses = DEFAULT_EDITABLE_STATUSES } = opts;

  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const { data: detail, isLoading, isError, error } = useQuery({
    queryKey: [queryKey, id],
    queryFn: () => detailQuery({ id: id as string }),
    enabled: isEdit,
  });

  const initialValues = isEdit && detail ? transform(detail) : null;

  // Mirrors the four early returns the pages had, collapsed into one flag:
  // loading → spinner, isError → danger text, !detail → "not found",
  // wrong status → warning. Create pages skip all of them.
  const canEdit =
    !isEdit ||
    (detail !== undefined &&
      detail !== null &&
      !isLoading &&
      !isError &&
      editableStatuses.includes(detail.approvalStatus));

  return { id, isEdit, detail, isLoading, isError, error, initialValues, canEdit };
}
