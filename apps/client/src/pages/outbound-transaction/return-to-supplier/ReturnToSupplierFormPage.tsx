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
import { SupplierSelectSearch } from '../../../components/SupplierSelectSearch';
import { PageHeader } from '../../../components/PageHeader';
import { UnsavedChangesBadge } from '../../../components/UnsavedChangesBadge';
import { fromDateToLocal, getLocalTimeZone, today } from '@internationalized/date';
import type { DateValue } from '@internationalized/date';
import { returnToSupplierFormSchema } from '@repo/schemas/return-to-supplier';
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
  supplierId: string;
  originalReceivingId: string;
  returnReason: string;
  reference: string;
  notes: string;
  warehouseId: string;
  items: FormItem[];
};

/** Unwrap a tRPC vanilla-client query/procedure into its resolved wire type. */
type DetailOf<Q> = Q extends (...args: never[]) => Promise<infer R> ? R : never;

/** Client-side shape of `returnToSupplier.detail`. */
type ReturnToSupplierDetail = DetailOf<typeof trpcClient.returnToSupplier.detail.query>;

const defaultFormValues = (): FormValues => ({
  documentNumber: '',
  date: today(getLocalTimeZone()),
  supplierId: '',
  originalReceivingId: '',
  returnReason: '',
  reference: '',
  notes: '',
  warehouseId: '',
  items: [createFormItem()],
});

const transformDetailToFormValues = (d: ReturnToSupplierDetail): FormValues => {
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
    supplierId: d.supplierId ?? '',
    originalReceivingId: d.originalReceivingId ?? '',
    returnReason: d.returnReason ?? '',
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

const ReturnToSupplierForm = ({ id, isEdit, initialValues }: Props) => {
  const t = useMessage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = isEdit ? hasPermission('return-to-supplier@update') : hasPermission('return-to-supplier@create');

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
    redirectOnSuccess: (detailId) => `/outbound-transaction/return-to-supplier/${detailId ?? id}`,
    messages: {
      saving: t('return_to_supplier.form_saving', 'Saving…'),
      successTitle: t('return_to_supplier.form_success_title', 'Saved'),
      errorTitle: t('return_to_supplier.form_error_title', 'Error'),
      confirmPropose: t('return_to_supplier.form_confirm_propose', 'Confirm Propose'),
      confirmDraft: t('return_to_supplier.form_confirm_draft', 'Confirm Save Draft'),
      confirmProposeDesc: t('return_to_supplier.form_confirm_propose_desc', 'Propose this return?'),
      confirmDraftDesc: t('return_to_supplier.form_confirm_draft_desc', 'Save as draft?'),
      messageLabel: t('return_to_supplier.form_message_label', 'Message'),
      messagePlaceholder: t('return_to_supplier.form_message_placeholder', 'Add a note (optional)'),
      cancel: t('return_to_supplier.form_cancel', 'Cancel'),
      confirm: t('return_to_supplier.form_confirm', 'Confirm'),
      close: t('return_to_supplier.form_close', 'Close'),
      viewDetail: t('return_to_supplier.form_view_detail', 'View Detail'),
    },
  });

  const { data: warehouseListData } = useQuery({
    queryKey: ['warehouseOptions'],
    queryFn: () => trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 999 }),
  });
  const warehouses = warehouseListData?.data ?? [];

  const { data: supplierListData } = useQuery({
    queryKey: ['supplierOptions'],
    queryFn: () => trpcClient.supplier.list.query({ page: 1, limit: 999 }),
  });
  const suppliers = supplierListData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: inferProcedureInput<AppRouter['returnToSupplier']['create']>) =>
      trpcClient.returnToSupplier.create.mutate(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['returnToSupplierList'] });
      handleSuccess(
        data?.id ?? id ?? null,
        t('return_to_supplier.form_create_success', 'Return to supplier created.'),
      );
    },
    onError: (err: Error) => handleError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: inferProcedureInput<AppRouter['returnToSupplier']['update']>) =>
      trpcClient.returnToSupplier.update.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returnToSupplierDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['returnToSupplierList'] });
      handleSuccess(
        id ?? null,
        t('return_to_supplier.form_update_success', 'Return to supplier updated.'),
      );
    },
    onError: (err: Error) => handleError(err.message),
  });

  const form = useForm({
    defaultValues: initialValues ?? defaultFormValues(),
    validators: {
      onChange: ({ value }: { value: FormValues }) => {
        const result = returnToSupplierFormSchema.safeParse(value);
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
        supplierId: value.supplierId,
        originalReceivingId: value.originalReceivingId || undefined,
        returnReason: value.returnReason || undefined,
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
    supplierId: (v) => form.setFieldValue('supplierId', String(v)),
    originalReceivingId: (v) => form.setFieldValue('originalReceivingId', String(v)),
    returnReason: (v) => form.setFieldValue('returnReason', String(v)),
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
  const supplierName = suppliers.find((s) => s.id === values.supplierId)?.name;
  const hasWarehouse = Boolean(values.warehouseId);
  const hasSupplier = Boolean(values.supplierId);

  // AI page context: publish live values + missing required fields so the
  // assistant drawer is grounded in this form (mirrors receiving pilot).
  const missingRequired = useMemo(() => {
    const missing: string[] = [];
    if (!values.supplierId) missing.push('supplierId');
    if (!values.warehouseId) missing.push('warehouseId');
    const rows = Array.isArray(values.items) ? values.items : [];
    if (rows.length === 0) missing.push('items');
    rows.forEach((item, index) => {
      if (!item?.skuId) missing.push(`items[${index}].skuId`);
      if (!(Number(item?.quantity) > 0)) missing.push(`items[${index}].quantity`);
    });
    return missing;
  }, [values]);
  useRegisterPageForm('return-to-supplier-form', values, missingRequired);

  const itemColumns: TransactionItemsColumn<FormItem>[] = [
    {
      key: 'skuId',
      header: t('return_to_supplier.col_sku', 'SKU'),
      cell: 'skuSelect',
      ariaLabel: t('return_to_supplier.col_sku', 'SKU'),
      placeholder: t('return_to_supplier.form_sku_placeholder', 'Select SKU'),
      searchPlaceholder: t('return_to_supplier.form_sku_search', 'Search SKU...'),
      emptyLabel: t('return_to_supplier.form_sku_empty', 'No SKU found'),
      requiredMessage: t('return_to_supplier.form_sku_required', 'SKU is required'),
    },
    {
      key: 'details',
      header: t('return_to_supplier.col_details', 'Details'),
      cell: 'text',
      label: t('return_to_supplier.col_details', 'Details'),
      placeholder: t('return_to_supplier.form_details_placeholder', 'Item notes'),
    },
    {
      key: 'quantity',
      header: t('return_to_supplier.col_quantity', 'Qty'),
      cell: 'number',
      label: t('return_to_supplier.col_quantity', 'Qty'),
      ruleMessage: t('return_to_supplier.form_qty_rule', 'Must be at least 1'),
    },
  ];

  return (
    <Form>
      <PageHeader
        title={
          isEdit
            ? t('return_to_supplier.form_edit_title', 'Edit Return to Supplier')
            : t('return_to_supplier.form_new_title', 'New Return to Supplier')
        }
        onBack={() => navigate('/outbound-transaction')}
      >
        <AiFillButton />
      </PageHeader>
      <AiFillPanel />
      <section
        className="mt-6 space-y-6"
        data-ai-context={JSON.stringify({
          section: 'return-to-supplier-form',
          mode: isEdit ? 'edit' : 'create',
          transactionId: isEdit ? id : undefined,
          fields: [
            'documentNumber',
            'date',
            'supplierId',
            'originalReceivingId',
            'returnReason',
            'reference',
            'notes',
            'warehouseId',
            'items',
          ],
          availableWarehouses: warehouses.map((w) => ({ id: w.id, label: w.name })),
          availableSuppliers: suppliers.map((s) => ({ id: s.id, label: s.name })),
        })}
      >
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <Card>
              <Card.Header>
                <Card.Title>{t('return_to_supplier.form_section_general', 'General Information')}</Card.Title>
                <Card.Description>{t('return_to_supplier.form_section_general_desc', 'Which supplier takes it back and which receipt it came from.')}</Card.Description>
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
                      {t('return_to_supplier.form_document_number', 'Document Number')}
                    </Label>
                    <Input
                      variant="secondary"
                      placeholder={t('return_to_supplier.form_document_number_placeholder', 'Auto-generated if blank')}
                    />
                  </TextField>
                )}
              </form.Field>
              <form.Field name="date">
                {(field) => (
                  <FormDatePicker
                    label={t('return_to_supplier.form_date', 'Date')}
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
                      ? t('return_to_supplier.form_warehouse_required', 'Warehouse is required')
                      : undefined,
                }}
              >
                {(field) => (
                  <WarehouseSelectSearch
                    queryKeyBase="return-to-supplier-warehouse"
                    value={field.state.value || ''}
                    onChange={(v) => field.handleChange(String(v ?? ''))}
                    label={t('return_to_supplier.form_warehouse', 'Warehouse')}
                    ariaLabel={t('return_to_supplier.form_warehouse', 'Warehouse')}
                    placeholder={t('return_to_supplier.form_warehouse_placeholder', 'Select warehouse')}
                    searchPlaceholder={t('return_to_supplier.form_warehouse_search', 'Search warehouse...')}
                    emptyLabel={t('return_to_supplier.form_warehouse_empty', 'No warehouse found')}
                    isDisabled={isSubmitting}
                    isInvalid={field.state.meta.errors.length > 0}
                    errorMessage={field.state.meta.errors.join(', ')}
                  />
                )}
              </form.Field>
              <form.Field
                name="supplierId"
                validators={{
                  onChange: ({ value }) =>
                    !value
                      ? t('return_to_supplier.form_supplier_required', 'Supplier is required')
                      : undefined,
                }}
              >
                {(field) => (
                  <SupplierSelectSearch
                    queryKeyBase="return-to-supplier-supplier"
                    value={field.state.value || ''}
                    onChange={(v) => field.handleChange(String(v ?? ''))}
                    label={t('return_to_supplier.form_supplier', 'Supplier')}
                    ariaLabel={t('return_to_supplier.form_supplier', 'Supplier')}
                    placeholder={t('return_to_supplier.form_supplier_placeholder', 'Select supplier')}
                    searchPlaceholder={t('return_to_supplier.form_supplier_search', 'Search supplier...')}
                    emptyLabel={t('return_to_supplier.form_supplier_empty', 'No supplier found')}
                    isDisabled={isSubmitting}
                    isInvalid={field.state.meta.errors.length > 0}
                    errorMessage={field.state.meta.errors.join(', ')}
                  />
                )}
              </form.Field>
              <form.Field name="originalReceivingId">
                {(field) => (
                  <TextField
                    isDisabled={isSubmitting}
                    value={field.state.value}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                  >
                    <Label>
                      {t('return_to_supplier.form_original_receiving_id', 'Original Receiving ID')}
                    </Label>
                    <Input
                      variant="secondary"
                      placeholder={t('return_to_supplier.form_original_receiving_id_placeholder', 'Original receiving ID')}
                    />
                  </TextField>
                )}
              </form.Field>
              <form.Field name="returnReason">
                {(field) => (
                  <TextField
                    isDisabled={isSubmitting}
                    value={field.state.value}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                  >
                    <Label>
                      {t('return_to_supplier.form_return_reason', 'Return Reason')}
                    </Label>
                    <Input
                      variant="secondary"
                      placeholder={t('return_to_supplier.form_return_reason_placeholder', 'Reason for return')}
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
                    <Label>
                      {t('return_to_supplier.form_reference', 'Reference')}
                    </Label>
                    <Input
                      variant="secondary"
                      placeholder={t('return_to_supplier.form_reference_placeholder', 'Reference number')}
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
                    <Label>{t('return_to_supplier.form_notes', 'Notes')}</Label>
                    <TextArea
                      rows={4}
                      variant="secondary"
                      placeholder={t('return_to_supplier.form_notes_placeholder', 'Add notes')}
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
                <Card.Title>{t('return_to_supplier.preview_title', 'Return Preview')}</Card.Title>
                <Card.Description>{t('return_to_supplier.preview_desc', 'Live summary of the stock you are sending back.')}</Card.Description>
              </Card.Header>
              <Card.Content>
                <dl className="space-y-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <dt className="text-muted">{t('return_to_supplier.form_document_number', 'Document Number')}</dt>
                    <dd className="font-mono text-foreground">{values.documentNumber || t('return_to_supplier.form_auto', 'Auto')}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <dt className="text-muted">{t('return_to_supplier.form_warehouse', 'Warehouse')}</dt>
                    <dd className="text-right font-medium text-foreground">{warehouseName ?? '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <dt className="text-muted">{t('return_to_supplier.form_supplier', 'Supplier')}</dt>
                    <dd className="text-right font-medium text-foreground">{supplierName ?? '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <dt className="text-muted">{t('return_to_supplier.form_original_receiving_id', 'Original Receiving ID')}</dt>
                    <dd className="text-right font-medium text-foreground">{values.originalReceivingId || '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <dt className="text-muted">{t('return_to_supplier.preview_items', 'Items')}</dt>
                    <dd className="font-semibold text-foreground">
                      {itemCount > 0 ? `${itemCount} · ${totalQuantity} ${t('return_to_supplier.preview_qty_suffix', 'qty')}` : '—'}
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
              title={t('return_to_supplier.form_items_title', 'Items')}
              description={t('return_to_supplier.form_items_desc', 'SKUs going back to the supplier.')}
              labels={{
                add: t('return_to_supplier.form_add_item', 'Add Item'),
                empty: t('return_to_supplier.form_no_items', 'No items. Click "Add Item" to start.'),
                aria: t('return_to_supplier.form_items_aria', 'Return items'),
              }}
            />
          )}
        </form.Field>

        {canSave && (
          <div className="flex items-center justify-end gap-2">
            {isEdit && form.state.isDirty ? <UnsavedChangesBadge className="mr-auto" /> : null}
            <Button variant="ghost" isDisabled={isSubmitting || !itemsReady || !hasWarehouse || !hasSupplier} onPress={() => handleActionConfirm('DRAFT')}>
              <Icon icon="solar:floppy-disk-linear" className="size-4" />
              {t('return_to_supplier.form_save_draft', 'Save Draft')}
            </Button>
            <Button isDisabled={isSubmitting || !itemsReady || !hasWarehouse || !hasSupplier} onPress={() => handleActionConfirm('PROPOSED')}>
              <Icon icon="solar:send-linear" className="size-4" />
              {t('return_to_supplier.form_propose', 'Propose')}
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
          saving: t('return_to_supplier.form_saving', 'Saving…'),
          successTitle: t('return_to_supplier.form_success_title', 'Saved'),
          errorTitle: t('return_to_supplier.form_error_title', 'Error'),
          confirmPropose: t('return_to_supplier.form_confirm_propose', 'Confirm Propose'),
          confirmDraft: t('return_to_supplier.form_confirm_draft', 'Confirm Save Draft'),
          confirmProposeDesc: t('return_to_supplier.form_confirm_propose_desc', 'Propose this return?'),
          confirmDraftDesc: t('return_to_supplier.form_confirm_draft_desc', 'Save as draft?'),
          messageLabel: t('return_to_supplier.form_message_label', 'Message'),
          messagePlaceholder: t('return_to_supplier.form_message_placeholder', 'Add a note (optional)'),
          cancel: t('return_to_supplier.form_cancel', 'Cancel'),
          confirm: t('return_to_supplier.form_confirm', 'Confirm'),
          close: t('return_to_supplier.form_close', 'Close'),
          viewDetail: t('return_to_supplier.form_view_detail', 'View Detail'),
        }}
        onModalClose={handleModalClose}
        onConfirmSubmit={() => void handleConfirmSubmit(form.handleSubmit)}
        onViewDetail={handleViewDetail}
      />
    </Form>
  );
};

const ReturnToSupplierFormPage = () => {
  const { id, isEdit, detail, isLoading, isError, error, initialValues, canEdit } = useTransactionFormPage<
    ReturnToSupplierDetail,
    FormValues
  >({
    queryKey: 'returnToSupplierDetail',
    detailQuery: (input) => trpcClient.returnToSupplier.detail.query(input),
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
  return <ReturnToSupplierForm id={id} isEdit={isEdit} initialValues={initialValues} />;
};

export { ReturnToSupplierFormPage };
