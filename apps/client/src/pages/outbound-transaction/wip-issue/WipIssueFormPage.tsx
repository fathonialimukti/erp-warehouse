import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { useMessage } from '../../../lib/useMessage';
import { useForm, useStore } from '@tanstack/react-form';
import { Button, Card, FieldGroup, Form, Input, Label, Spinner, TextArea, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';
import { hasPermissionAtom } from '../../../lib/atoms';
import { useAiFillForm } from '../../../components/AiAssistant/useAiFillForm';
import { useRegisterPageForm } from '../../../lib/ai/usePageContext';
import { AiFillButton } from '../../../components/AiFill/AiFillButton';
import { AiFillPanel } from '../../../components/AiFill/AiFillPanel';
import { FormDatePicker } from '../../../components/FormDatePicker';
import { WarehouseSelectSearch } from '../../../components/WarehouseSelectSearch';
import { PageHeader } from '../../../components/PageHeader';
import { UnsavedChangesBadge } from '../../../components/UnsavedChangesBadge';
import { fromDateToLocal, getLocalTimeZone, today } from '@internationalized/date';
import type { DateValue } from '@internationalized/date';
import { wipIssueFormSchema } from '@repo/schemas/wip-issue';
import { useTransactionFormModal } from '../../../components/form/useTransactionFormModal';
import { TransactionFormModal } from '../../../components/form/TransactionFormModal';
import { useTransactionFormPage } from '../../../components/form/useTransactionFormPage';
import { TransactionItemsTable } from '../../../components/form/TransactionItemsTable';
import type { TransactionItemsColumn } from '../../../components/form/TransactionItemsTable';

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
}

const WipIssueForm = ({ id, isEdit, initialValues }: Props) => {
  const t = useMessage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = isEdit ? hasPermission('wip-issue@update') : hasPermission('wip-issue@create');

  const {
    intent,
    modalStage,
    resultMessage,
    approvalMessage,
    setApprovalMessage,
    handleModalClose,
    handleActionConfirm,
    handleConfirmSubmit,
    handleSuccess,
    handleError,
    handleViewDetail,
    isSubmitting,
  } = useTransactionFormModal({
    intentMode: 'draft-propose',
    redirectOnSuccess: (detailId) => `/outbound-transaction/wip-issue/${detailId ?? id}`,
    messages: {
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
    },
  });

  const { data: warehouseListData } = useQuery({
    queryKey: ['warehouseOptions'],
    queryFn: () => trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 999 }),
  });
  const warehouses = warehouseListData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: inferProcedureInput<AppRouter['wipIssue']['create']>) =>
      trpcClient.wipIssue.create.mutate(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wipIssueList'] });
      handleSuccess(
        data?.id ?? id ?? null,
        t('wip_issue.form_create_success', 'WIP issue created.'),
      );
    },
    onError: (err: Error) => handleError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: inferProcedureInput<AppRouter['wipIssue']['update']>) =>
      trpcClient.wipIssue.update.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wipIssueDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['wipIssueList'] });
      handleSuccess(
        id ?? null,
        t('wip_issue.form_update_success', 'WIP issue updated.'),
      );
    },
    onError: (err: Error) => handleError(err.message),
  });

  const form = useForm({
    defaultValues: initialValues ?? defaultFormValues(),
    validators: {
      onChange: ({ value }: { value: FormValues }) => {
        const result = wipIssueFormSchema.safeParse(value);
        if (result.success) return undefined;
        return result.error.issues.map((e) => e.message).join(', ');
      },
    },
    onSubmit: async ({ value }: { value: FormValues }) => {
      // This page only stages DRAFT/PROPOSED; the hook's union also carries
      // SAVE for the single-save transaction pages.
      const approvalStatus = intent as 'DRAFT' | 'PROPOSED';
      const dateJs = value.date?.toDate ? value.date.toDate(getLocalTimeZone()) : new Date();
      const items = (value.items as FormItem[]).map((item) => ({
        skuId: item.skuId,
        quantity: Number(item.quantity),
        details: item.details || undefined,
      }));
      const payload = {
        documentNumber: value.documentNumber || undefined,
        date: dateJs,
        workOrderRef: value.workOrderRef || undefined,
        reference: value.reference || undefined,
        notes: value.notes || undefined,
        warehouseId: value.warehouseId,
        approvalStatus,
        message: approvalMessage || undefined,
        items,
      };
      if (isEdit && id) await updateMutation.mutateAsync({ ...payload, id });
      else await createMutation.mutateAsync(payload);
    },
  });

  useAiFillForm({
    documentNumber: (v) => form.setFieldValue('documentNumber', String(v)),
    workOrderRef: (v) => form.setFieldValue('workOrderRef', String(v)),
    reference: (v) => form.setFieldValue('reference', String(v)),
    notes: (v) => form.setFieldValue('notes', String(v)),
    warehouseId: (v) => form.setFieldValue('warehouseId', String(v)),
    items: (v) => {
      if (!Array.isArray(v)) return;
      const items: FormItem[] = v.map((item: Record<string, unknown>) => ({
        _id: (item._id as string | null) ?? null,
        skuId: String(item.skuId ?? ''),
        quantity: String(item.quantity ?? '1'),
        details: String(item.details ?? ''),
      }));
      form.setFieldValue('items', items.length > 0 ? items : [createFormItem()]);
    },
  });

  const values = useStore(form.store, (state) => state.values);
  const formItems = values.items ?? [];
  const itemCount = formItems.length;
  const totalQuantity = formItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const itemsReady = itemCount > 0 && formItems.every((item) => item.skuId && Number(item.quantity) > 0);
  const warehouseName = warehouses.find((w) => w.id === values.warehouseId)?.name;
  const hasWarehouse = Boolean(values.warehouseId);

  // AI page context: publish live values + missing required fields so the
  // assistant drawer is grounded in this form (mirrors receiving pilot).
  const missingRequired = useMemo(() => {
    const missing: string[] = [];
    if (!values.warehouseId) missing.push('warehouseId');
    const rows = Array.isArray(values.items) ? values.items : [];
    if (rows.length === 0) missing.push('items');
    rows.forEach((item, index) => {
      if (!item?.skuId) missing.push(`items[${index}].skuId`);
      if (!(Number(item?.quantity) > 0)) missing.push(`items[${index}].quantity`);
    });
    return missing;
  }, [values]);
  useRegisterPageForm('wip-issue-form', values, missingRequired);

  const itemColumns: TransactionItemsColumn<FormItem>[] = [
    {
      key: 'skuId',
      header: t('wip_issue.col_sku', 'SKU'),
      cell: 'skuSelect',
      ariaLabel: t('wip_issue.col_sku', 'SKU'),
      placeholder: t('wip_issue.form_sku_placeholder', 'Select SKU'),
      searchPlaceholder: t('wip_issue.form_sku_search', 'Search SKU...'),
      emptyLabel: t('wip_issue.form_sku_empty', 'No SKU found'),
      requiredMessage: t('wip_issue.form_sku_required', 'SKU is required'),
    },
    {
      key: 'details',
      header: t('wip_issue.col_details', 'Details'),
      cell: 'text',
      label: t('wip_issue.col_details', 'Details'),
      placeholder: t('wip_issue.form_details_placeholder', 'Item notes'),
    },
    {
      key: 'quantity',
      header: t('wip_issue.col_quantity', 'Qty'),
      cell: 'number',
      label: t('wip_issue.col_quantity', 'Qty'),
      ruleMessage: t('wip_issue.form_qty_rule', 'Must be at least 1'),
    },
  ];

  return (
    <Form>
      <PageHeader
        title={
          isEdit
            ? t('wip_issue.form_edit_title', 'Edit WIP Issue')
            : t('wip_issue.form_new_title', 'New WIP Issue')
        }
        onBack={() => navigate('/outbound-transaction')}
      >
        <AiFillButton />
      </PageHeader>
      <AiFillPanel />
      <section
        className="mt-6 space-y-6"
        data-ai-context={JSON.stringify({
          section: 'wip-issue-form',
          mode: isEdit ? 'edit' : 'create',
          transactionId: isEdit ? id : undefined,
          fields: ['documentNumber', 'date', 'workOrderRef', 'reference', 'notes', 'warehouseId', 'items'],
          availableWarehouses: warehouses.map((w) => ({ id: w.id, label: w.name })),
        })}
      >
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <Card>
              <Card.Header>
                <Card.Title>{t('wip_issue.form_section_general', 'General Information')}</Card.Title>
                <Card.Description>{t('wip_issue.form_section_general_desc', 'Work order context and which warehouse feeds production.')}</Card.Description>
              </Card.Header>
              <Card.Content>
                <FieldGroup>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <form.Field name="documentNumber">
                {(field) => (
                  <TextField
                    isDisabled={isSubmitting}
                    value={field.state.value}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                  >
                    <Label>
                      {t('wip_issue.form_document_number', 'Document Number')}
                    </Label>
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
                    isDisabled={isSubmitting}
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
                    isDisabled={isSubmitting}
                    isInvalid={field.state.meta.errors.length > 0}
                    errorMessage={field.state.meta.errors.join(', ')}
                  />
                )}
              </form.Field>
              <form.Field name="workOrderRef">
                {(field) => (
                  <TextField
                    isDisabled={isSubmitting}
                    value={field.state.value}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                  >
                    <Label>
                      {t('wip_issue.form_work_order_ref', 'Work Order Ref')}
                    </Label>
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
                    isDisabled={isSubmitting}
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
                    isDisabled={isSubmitting}
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
            </div>
                </FieldGroup>
              </Card.Content>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
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
          </div>
        </div>

        <form.Field name="items">
          {(itemsField) => (
            <TransactionItemsTable
              field={itemsField}
              columns={itemColumns}
              createItem={createFormItem}
              isDisabled={isSubmitting}
              container="card"
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

        {canSave && (
          <div className="flex items-center justify-end gap-2">
            {isEdit && form.state.isDirty ? <UnsavedChangesBadge className="mr-auto" /> : null}
            <Button variant="ghost" isDisabled={isSubmitting || !itemsReady || !hasWarehouse} onPress={() => handleActionConfirm('DRAFT')}>
              <Icon icon="solar:floppy-disk-linear" className="size-4" />
              {t('wip_issue.form_save_draft', 'Save Draft')}
            </Button>
            <Button isDisabled={isSubmitting || !itemsReady || !hasWarehouse} onPress={() => handleActionConfirm('PROPOSED')}>
              <Icon icon="solar:send-linear" className="size-4" />
              {t('wip_issue.form_propose', 'Propose')}
            </Button>
          </div>
        )}
      </section>

      <TransactionFormModal
        modalStage={modalStage}
        intent={intent}
        resultMessage={resultMessage}
        approvalMessage={approvalMessage}
        onApprovalMessageChange={setApprovalMessage}
        messages={{
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
        }}
        onModalClose={handleModalClose}
        onConfirmSubmit={() => void handleConfirmSubmit(form.handleSubmit)}
        onViewDetail={handleViewDetail}
      />
    </Form>
  );
};

const WipIssueFormPage = () => {
  const { id, isEdit, detail, isLoading, isError, error, initialValues, canEdit } = useTransactionFormPage<
    WipIssueDetail,
    FormValues
  >({
    queryKey: 'wipIssueDetail',
    detailQuery: (input) => trpcClient.wipIssue.detail.query(input),
    transform: transformDetailToFormValues,
  });
  if (isEdit && isLoading)
    return (
      <div className="flex min-h-72 flex-col items-center justify-center gap-4">
        <Spinner size="lg" />
      </div>
    );
  if (isEdit && isError)
    return <p className="text-sm text-danger">{(error as Error | null)?.message ?? 'Failed to load transaction.'}</p>;
  if (isEdit && !detail) return <p className="text-sm text-danger">Transaction not found.</p>;
  if (isEdit && !canEdit) return <p className="text-sm text-warning">This transaction cannot be edited in its current state.</p>;
  return <WipIssueForm id={id} isEdit={isEdit} initialValues={initialValues} />;
};

export { WipIssueFormPage };
