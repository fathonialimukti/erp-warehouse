import type { ReactNode } from 'react';
import { useAtomValue } from 'jotai';
import { useMessage } from '../../../lib/useMessage';
import { Card, Input, Label, TextArea, TextField } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import { trpcClient } from '../../../lib/trpc';
import { hasPermissionAtom } from '../../../lib/atoms';
import { useAiFillForm } from '../../../components/AiAssistant/useAiFillForm';
import { FormDatePicker } from '../../../components/FormDatePicker';
import { WarehouseSelectSearch } from '../../../components/WarehouseSelectSearch';
import { fromDateToLocal, getLocalTimeZone, today } from '@internationalized/date';
import type { DateValue } from '@internationalized/date';
import { wipIssueFormSchema } from '@repo/schemas/wip-issue';
import {
  DocHeaderCard,
  EditableLinesTable,
  FormFooterBar,
  FormPageShell,
  TransactionFormModal,
  toFooterTotals,
  useDocForm,
  useTransactionFormPage,
  type TransactionItemsColumn,
} from '../../../components/form';

interface FormItem {
  _id: string | null;
  skuId: string;
  quantity: string;
  details: string;
}

function createFormItem(): FormItem {
  return { _id: null, skuId: '', quantity: '1', details: '' };
}

type FormValues = {
  documentNumber: string;
  date: DateValue | null;
  workOrderRef: string;
  reference: string;
  notes: string;
  warehouseId: string;
  items: FormItem[];
};

/** Unwrap a tRPC vanilla-client query/procedure into its resolved wire type. */
type DetailOf<Q> = Q extends (...args: never[]) => Promise<infer R> ? R : never;

/** Client-side shape of `wipIssue.detail`. */
type WipIssueDetail = DetailOf<typeof trpcClient.wipIssue.detail.query>;

const defaultFormValues = (): FormValues => ({
  documentNumber: '',
  date: today(getLocalTimeZone()),
  workOrderRef: '',
  reference: '',
  notes: '',
  warehouseId: '',
  items: [createFormItem()],
});

const transformDetailToFormValues = (d: WipIssueDetail): FormValues => {
  const items: FormItem[] =
    (d.items?.length ?? 0) > 0
      ? d.items.map((item) => ({
          _id: (item as { _id?: string | null })._id ?? null,
          skuId: String(item.skuId ?? ''),
          quantity: String(item.quantity ?? '1'),
          details: String(item.details ?? ''),
        }))
      : [createFormItem()];
  return {
    documentNumber: d.documentNumber ?? '',
    date: d.date ? fromDateToLocal(new Date(d.date)) : today(getLocalTimeZone()),
    workOrderRef: d.workOrderRef ?? '',
    reference: d.reference ?? '',
    notes: d.notes ?? '',
    warehouseId: d.warehouseId ?? '',
    items,
  };
};

interface Props {
  id?: string;
  isEdit: boolean;
  initialValues: FormValues | null;
  /** Detail still loading on edit pages — shell shows the spinner. */
  isLoading?: boolean;
  /** Not-found / wrong-status message on edit pages — shell shows the guard. */
  guard?: ReactNode;
}

const WipIssueForm = ({ id, isEdit, initialValues, isLoading = false, guard }: Props) => {
  const t = useMessage();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = isEdit ? hasPermission('wip-issue@update') : hasPermission('wip-issue@create');

  const modalMessages = {
    saving: t('wip_issue.form_saving', 'Saving…'),
    successTitle: t('wip_issue.form_success_title', 'Saved'),
    errorTitle: t('wip_issue.form_error_title', 'Error'),
    confirmPropose: t('wip_issue.form_confirm_propose', 'Confirm Propose'),
    confirmDraft: t('wip_issue.form_confirm_draft', 'Confirm Save Draft'),
    confirmProposeDesc: t('wip_issue.form_confirm_propose_desc', 'Propose this WIP issue?'),
    confirmDraftDesc: t('wip_issue.form_confirm_draft_desc', 'Save as draft?'),
    messageLabel: t('wip_issue.form_message_label', 'Message'),
    messagePlaceholder: t('wip_issue.form_message_placeholder', 'Add a note (optional)'),
    cancel: t('wip_issue.form_cancel', 'Cancel'),
    confirm: t('wip_issue.form_confirm', 'Confirm'),
    close: t('wip_issue.form_close', 'Close'),
    viewDetail: t('wip_issue.form_view_detail', 'View Detail'),
  };

  const { data: warehouseListData } = useQuery({
    queryKey: ['warehouseOptions'],
    queryFn: () => trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 999 }),
  });
  const warehouses = warehouseListData?.data ?? [];

  const docForm = useDocForm<FormValues, any>({
    formId: 'wip-issue-form',
    isEdit,
    id,
    initialValues,
    defaultValues: defaultFormValues,
    schema: wipIssueFormSchema,
    toPayload: (parsed, intent, approvalMessage) => {
      const dateJs = parsed.date?.toDate ? parsed.date.toDate(getLocalTimeZone()) : new Date();
      const items = (parsed.items as FormItem[]).map((item) => ({
        skuId: item.skuId,
        quantity: Number(item.quantity),
        details: item.details || undefined,
      }));
      return {
        documentNumber: parsed.documentNumber || undefined,
        date: dateJs,
        workOrderRef: parsed.workOrderRef || undefined,
        reference: parsed.reference || undefined,
        notes: parsed.notes || undefined,
        warehouseId: parsed.warehouseId,
        approvalStatus: intent,
        message: approvalMessage || undefined,
        items,
      };
    },
    createCaller: (payload) => trpcClient.wipIssue.create.mutate(payload),
    updateCaller: (payload) => trpcClient.wipIssue.update.mutate(payload),
    listQueryKey: 'wipIssueList',
    detailQueryKey: 'wipIssueDetail',
    redirectOnSuccess: (savedId) => `/outbound-transaction/wip-issue/${savedId ?? id}`,
    modalMessages,
    successMessageCreate: t('wip_issue.form_create_success', 'WIP issue created.'),
    successMessageUpdate: t('wip_issue.form_update_success', 'WIP issue updated.'),
    errorFallback: t('error_generic', 'An unexpected error occurred.'),
    missingRequired: (values) => {
      const missing: string[] = [];
      if (!values.warehouseId) missing.push('warehouseId');
      const rows = Array.isArray(values.items) ? values.items : [];
      if (rows.length === 0) missing.push('items');
      rows.forEach((item, index) => {
        if (!item?.skuId) missing.push(`items[${index}].skuId`);
        if (!(Number(item?.quantity) > 0)) missing.push(`items[${index}].quantity`);
      });
      return missing;
    },
    computeTotals: (values) => {
      const rows = Array.isArray(values.items) ? values.items : [];
      return {
        totalItems: rows.length,
        totalQuantity: rows.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
      };
    },
    computeCanSubmit: (values) => {
      const rows = Array.isArray(values.items) ? values.items : [];
      return (
        Boolean(values.warehouseId) &&
        rows.length > 0 &&
        rows.every((item) => item.skuId && Number(item.quantity) > 0)
      );
    },
  });

  // The JSX below binds via `<form.Field>` — same form instance the hook owns.
  const form = docForm.form;

  useAiFillForm({
    documentNumber: (v) => docForm.form.setFieldValue('documentNumber', String(v)),
    workOrderRef: (v) => docForm.form.setFieldValue('workOrderRef', String(v)),
    reference: (v) => docForm.form.setFieldValue('reference', String(v)),
    notes: (v) => docForm.form.setFieldValue('notes', String(v)),
    warehouseId: (v) => docForm.form.setFieldValue('warehouseId', String(v)),
    items: (v) => {
      if (!Array.isArray(v)) return;
      const items: FormItem[] = v.map((item: Record<string, unknown>) => ({
        _id: (item._id as string | null) ?? null,
        skuId: String(item.skuId ?? ''),
        quantity: String(item.quantity ?? '1'),
        details: String(item.details ?? ''),
      }));
      docForm.form.setFieldValue('items', items.length > 0 ? items : [createFormItem()]);
    },
  });

  const values = docForm.formValues;
  const formItems = values.items ?? [];
  const itemCount = formItems.length;
  const totalQuantity = formItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const warehouseName = warehouses.find((w) => w.id === values.warehouseId)?.name;

  const columns: TransactionItemsColumn<FormItem>[] = [
    {
      key: 'skuId',
      cell: 'skuSelect',
      header: t('wip_issue.col_sku', 'SKU'),
      ariaLabel: t('wip_issue.col_sku', 'SKU'),
      placeholder: t('wip_issue.form_sku_placeholder', 'Select SKU'),
      searchPlaceholder: t('wip_issue.form_sku_search', 'Search SKU...'),
      emptyLabel: t('wip_issue.form_sku_empty', 'No SKU found'),
      requiredMessage: t('wip_issue.form_sku_required', 'SKU is required'),
    },
    {
      key: 'details',
      cell: 'text',
      header: t('wip_issue.col_details', 'Details'),
      label: t('wip_issue.col_details', 'Details'),
      placeholder: t('wip_issue.form_details_placeholder', 'Item notes'),
    },
    {
      key: 'quantity',
      cell: 'number',
      header: t('wip_issue.col_quantity', 'Qty'),
      label: t('wip_issue.col_quantity', 'Qty'),
      min: 1,
      ruleMessage: t('wip_issue.form_qty_rule', 'Must be at least 1'),
    },
  ];

  return (
    <FormPageShell
      formId="wip-issue-form"
      mode={isEdit ? 'edit' : 'create'}
      entityId={id}
      title={
        isEdit
          ? t('wip_issue.form_edit_title', 'Edit WIP Issue')
          : t('wip_issue.form_new_title', 'New WIP Issue')
      }
      backTo="/outbound-transaction"
      validationErrors={docForm.validationErrors}
      aiFields={['documentNumber', 'date', 'workOrderRef', 'reference', 'notes', 'warehouseId', 'items']}
      header={
        <DocHeaderCard
          title={t('wip_issue.form_section_general', 'General Information')}
          description={t('wip_issue.form_section_general_desc', 'Work order context and which warehouse feeds production.')}
          icon="solar:document-text-linear"
        >
          <form.Field name="documentNumber">
            {(field) => (
              <TextField
                isDisabled={docForm.isSubmitting}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              >
                <Label>{t('wip_issue.form_document_number', 'Document Number')}</Label>
                <Input
                  variant="secondary"
                  placeholder={t('wip_issue.form_document_number_placeholder', 'Auto-generated if blank')}
                />
              </TextField>
            )}
          </form.Field>
          <form.Field name="date">
            {(field) => (
              <FormDatePicker
                label={t('wip_issue.form_date', 'Date')}
                value={field.state.value}
                onChange={field.handleChange}
                isDisabled={docForm.isSubmitting}
              />
            )}
          </form.Field>
          <form.Field
            name="warehouseId"
            validators={{
              onChange: ({ value }) =>
                !value
                  ? t('wip_issue.form_warehouse_required', 'Warehouse is required')
                  : undefined,
            }}
          >
            {(field) => (
              <WarehouseSelectSearch
                queryKeyBase="wip-issue-warehouse"
                value={field.state.value || ''}
                onChange={(v) => field.handleChange(String(v ?? ''))}
                label={t('wip_issue.form_warehouse', 'Warehouse')}
                ariaLabel={t('wip_issue.form_warehouse', 'Warehouse')}
                placeholder={t('wip_issue.form_warehouse_placeholder', 'Select warehouse')}
                searchPlaceholder={t('wip_issue.form_warehouse_search', 'Search warehouse...')}
                emptyLabel={t('wip_issue.form_warehouse_empty', 'No warehouse found')}
                isDisabled={docForm.isSubmitting}
                isInvalid={field.state.meta.errors.length > 0}
                errorMessage={field.state.meta.errors.join(', ')}
              />
            )}
          </form.Field>
          <form.Field name="workOrderRef">
            {(field) => (
              <TextField
                isDisabled={docForm.isSubmitting}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              >
                <Label>{t('wip_issue.form_work_order_ref', 'Work Order Ref')}</Label>
                <Input
                  variant="secondary"
                  placeholder={t('wip_issue.form_work_order_ref_placeholder', 'Work order reference')}
                />
              </TextField>
            )}
          </form.Field>
          <form.Field name="reference">
            {(field) => (
              <TextField
                isDisabled={docForm.isSubmitting}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              >
                <Label>{t('wip_issue.form_reference', 'Reference')}</Label>
                <Input
                  variant="secondary"
                  placeholder={t('wip_issue.form_reference_placeholder', 'Reference number')}
                />
              </TextField>
            )}
          </form.Field>
          <form.Field name="notes">
            {(field) => (
              <TextField
                isDisabled={docForm.isSubmitting}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
                fullWidth
              >
                <Label>{t('wip_issue.form_notes', 'Notes')}</Label>
                <TextArea
                  rows={4}
                  variant="secondary"
                  placeholder={t('wip_issue.form_notes_placeholder', 'Add notes')}
                />
              </TextField>
            )}
          </form.Field>
        </DocHeaderCard>
      }
      aside={
        <Card>
          <Card.Header>
            <Card.Title>{t('wip_issue.preview_title', 'WIP Issue Preview')}</Card.Title>
            <Card.Description>{t('wip_issue.preview_desc', 'Live summary of the materials you are issuing.')}</Card.Description>
          </Card.Header>
          <Card.Content>
            <dl className="space-y-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">{t('wip_issue.form_document_number', 'Document Number')}</dt>
                <dd className="font-mono text-foreground">{values.documentNumber || t('wip_issue.form_auto', 'Auto')}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">{t('wip_issue.form_warehouse', 'Warehouse')}</dt>
                <dd className="text-right font-medium text-foreground">{warehouseName ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">{t('wip_issue.form_work_order_ref', 'Work Order Ref')}</dt>
                <dd className="text-right font-medium text-foreground">{values.workOrderRef || '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">{t('wip_issue.form_reference', 'Reference')}</dt>
                <dd className="text-right font-medium text-foreground">{values.reference || '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">{t('wip_issue.preview_items', 'Items')}</dt>
                <dd className="font-semibold text-foreground">
                  {itemCount > 0 ? `${itemCount} · ${totalQuantity} ${t('wip_issue.preview_qty_suffix', 'qty')}` : '—'}
                </dd>
              </div>
            </dl>
          </Card.Content>
        </Card>
      }
      below={
        <form.Field name="items">
          {(itemsField) => (
            <EditableLinesTable
              field={itemsField}
              columns={columns}
              createItem={createFormItem}
              isDisabled={docForm.isSubmitting}
              title={t('wip_issue.form_items_title', 'Items')}
              description={t('wip_issue.form_items_desc', 'Materials leaving stock for this work order.')}
              labels={{
                add: t('wip_issue.form_add_item', 'Add Item'),
                empty: t('wip_issue.form_no_items', 'No items. Click "Add Item" to start.'),
                aria: t('wip_issue.form_items_aria', 'WIP issue items'),
              }}
            />
          )}
        </form.Field>
      }
      footer={
        <FormFooterBar
          canSave={canSave}
          canSubmit={docForm.canSubmit}
          isSubmitting={docForm.isSubmitting}
          isDirty={docForm.isDirty}
          isEdit={isEdit}
          totals={toFooterTotals(docForm.totals)}
          labels={{
            saveDraft: t('wip_issue.form_save_draft', 'Save Draft'),
            propose: t('wip_issue.form_propose', 'Propose'),
          }}
          onSaveDraft={() => docForm.handleActionConfirm('DRAFT')}
          onPropose={() => docForm.handleActionConfirm('PROPOSED')}
        />
      }
      modal={
        <TransactionFormModal
          modalStage={docForm.modalStage}
          intent={docForm.intent}
          resultMessage={docForm.resultMessage}
          approvalMessage={docForm.approvalMessage}
          onApprovalMessageChange={docForm.setApprovalMessage}
          messages={modalMessages}
          onModalClose={docForm.handleModalClose}
          onConfirmSubmit={docForm.handleConfirmSubmit}
          onViewDetail={docForm.handleViewDetail}
        />
      }
      isLoading={isLoading}
      guard={guard}
      isDisabled={docForm.isSubmitting}
    />
  );
};

const WipIssueFormPage = () => {
  const { id, isEdit, detail, isLoading, isError, error, initialValues, canEdit } =
    useTransactionFormPage<WipIssueDetail, FormValues>({
      queryKey: 'wipIssueDetail',
      detailQuery: (input) => trpcClient.wipIssue.detail.query(input),
      transform: transformDetailToFormValues,
    });

  let guard: ReactNode = null;
  if (isEdit && isError) {
    guard = (
      <p className="text-sm text-danger">
        {(error as Error | null)?.message ?? 'Failed to load transaction.'}
      </p>
    );
  } else if (isEdit && !detail) {
    guard = <p className="text-sm text-danger">Transaction not found.</p>;
  } else if (isEdit && !canEdit) {
    guard = <p className="text-sm text-warning">This transaction cannot be edited in its current state.</p>;
  }

  return (
    <WipIssueForm
      id={id}
      isEdit={isEdit}
      initialValues={initialValues}
      isLoading={isEdit && isLoading}
      guard={guard}
    />
  );
};

export { WipIssueFormPage };