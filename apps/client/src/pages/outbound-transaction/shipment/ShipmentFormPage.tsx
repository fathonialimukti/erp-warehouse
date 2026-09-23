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
import { shipmentFormSchema } from '@repo/schemas/shipment';
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
  shipmentNumber: string;
  salesOrderRef: string;
  recipient: string;
  reference: string;
  notes: string;
  carrier: string;
  trackingNumber: string;
  warehouseId: string;
  items: FormItem[];
};

/** Unwrap a tRPC vanilla-client query/procedure into its resolved wire type. */
type DetailOf<Q> = Q extends (...args: never[]) => Promise<infer R> ? R : never;

/** Client-side shape of `shipment.detail`. */
type ShipmentDetail = DetailOf<typeof trpcClient.shipment.detail.query>;

const defaultFormValues = (): FormValues => ({
  documentNumber: '',
  date: today(getLocalTimeZone()),
  shipmentNumber: '',
  salesOrderRef: '',
  recipient: '',
  reference: '',
  notes: '',
  carrier: '',
  trackingNumber: '',
  warehouseId: '',
  items: [createFormItem()],
});

const transformDetailToFormValues = (d: ShipmentDetail): FormValues => {
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
    shipmentNumber: d.shipmentNumber ?? '',
    salesOrderRef: d.salesOrderRef ?? '',
    recipient: d.recipient ?? '',
    reference: d.reference ?? '',
    notes: d.notes ?? '',
    carrier: d.carrier ?? '',
    trackingNumber: d.trackingNumber ?? '',
    warehouseId: d.warehouseId ?? '',
    items,
  };
};

interface Props {
  id?: string;
  isEdit: boolean;
  initialValues: FormValues | null;
}

const ShipmentForm = ({ id, isEdit, initialValues }: Props) => {
  const t = useMessage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = isEdit ? hasPermission('shipment@update') : hasPermission('shipment@create');

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
    redirectOnSuccess: (detailId) => `/outbound-transaction/shipment/${detailId ?? id}`,
    messages: {
      saving: t('shipment.form_saving', 'Saving…'),
      successTitle: t('shipment.form_success_title', 'Saved'),
      errorTitle: t('shipment.form_error_title', 'Error'),
      confirmPropose: t('shipment.form_confirm_propose', 'Confirm Propose'),
      confirmDraft: t('shipment.form_confirm_draft', 'Confirm Save Draft'),
      confirmProposeDesc: t('shipment.form_confirm_propose_desc', 'Propose this shipment?'),
      confirmDraftDesc: t('shipment.form_confirm_draft_desc', 'Save as draft?'),
      messageLabel: t('shipment.form_message_label', 'Message'),
      messagePlaceholder: t('shipment.form_message_placeholder', 'Add a note (optional)'),
      cancel: t('shipment.form_cancel', 'Cancel'),
      confirm: t('shipment.form_confirm', 'Confirm'),
      close: t('shipment.form_close', 'Close'),
      viewDetail: t('shipment.form_view_detail', 'View Detail'),
    },
  });

  const { data: warehouseListData } = useQuery({
    queryKey: ['warehouseOptions'],
    queryFn: () => trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 999 }),
  });
  const warehouses = warehouseListData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: inferProcedureInput<AppRouter['shipment']['create']>) =>
      trpcClient.shipment.create.mutate(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['shipmentList'] });
      handleSuccess(
        data?.id ?? id ?? null,
        t('shipment.form_create_success', 'Shipment created.'),
      );
    },
    onError: (err: Error) => handleError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: inferProcedureInput<AppRouter['shipment']['update']>) =>
      trpcClient.shipment.update.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipmentDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['shipmentList'] });
      handleSuccess(
        id ?? null,
        t('shipment.form_update_success', 'Shipment updated.'),
      );
    },
    onError: (err: Error) => handleError(err.message),
  });

  const form = useForm({
    defaultValues: initialValues ?? defaultFormValues(),
    validators: {
      onChange: ({ value }: { value: FormValues }) => {
        const result = shipmentFormSchema.safeParse(value);
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
        shipmentNumber: value.shipmentNumber || undefined,
        salesOrderRef: value.salesOrderRef || undefined,
        recipient: value.recipient || undefined,
        reference: value.reference || undefined,
        notes: value.notes || undefined,
        carrier: value.carrier || undefined,
        trackingNumber: value.trackingNumber || undefined,
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
    shipmentNumber: (v) => form.setFieldValue('shipmentNumber', String(v)),
    salesOrderRef: (v) => form.setFieldValue('salesOrderRef', String(v)),
    recipient: (v) => form.setFieldValue('recipient', String(v)),
    reference: (v) => form.setFieldValue('reference', String(v)),
    notes: (v) => form.setFieldValue('notes', String(v)),
    carrier: (v) => form.setFieldValue('carrier', String(v)),
    trackingNumber: (v) => form.setFieldValue('trackingNumber', String(v)),
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
  useRegisterPageForm('shipment-form', values, missingRequired);

  const itemColumns: TransactionItemsColumn<FormItem>[] = [
    {
      key: 'skuId',
      header: t('shipment.col_sku', 'SKU'),
      cell: 'skuSelect',
      ariaLabel: t('shipment.col_sku', 'SKU'),
      placeholder: t('shipment.form_sku_placeholder', 'Select SKU'),
      searchPlaceholder: t('shipment.form_sku_search', 'Search SKU...'),
      emptyLabel: t('shipment.form_sku_empty', 'No SKU found'),
      requiredMessage: t('shipment.form_sku_required', 'SKU is required'),
    },
    {
      key: 'details',
      header: t('shipment.col_details', 'Details'),
      cell: 'text',
      label: t('shipment.col_details', 'Details'),
      placeholder: t('shipment.form_details_placeholder', 'Item notes'),
    },
    {
      key: 'quantity',
      header: t('shipment.col_quantity', 'Qty'),
      cell: 'number',
      label: t('shipment.col_quantity', 'Qty'),
      ruleMessage: t('shipment.form_qty_rule', 'Must be at least 1'),
    },
  ];

  return (
    <Form>
      <PageHeader
        title={
          isEdit
            ? t('shipment.form_edit_title', 'Edit Shipment')
            : t('shipment.form_new_title', 'New Shipment')
        }
        onBack={() => navigate('/outbound-transaction')}
      >
        <AiFillButton />
      </PageHeader>
      <AiFillPanel />
      <section
        className="mt-6 space-y-6"
        data-ai-context={JSON.stringify({
          section: 'shipment-form',
          mode: isEdit ? 'edit' : 'create',
          transactionId: isEdit ? id : undefined,
          fields: [
            'documentNumber',
            'date',
            'shipmentNumber',
            'salesOrderRef',
            'recipient',
            'carrier',
            'trackingNumber',
            'reference',
            'notes',
            'warehouseId',
            'items',
          ],
          availableWarehouses: warehouses.map((w) => ({ id: w.id, label: w.name })),
        })}
      >
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <Card>
              <Card.Header>
                <Card.Title>{t('shipment.form_section_general', 'General Information')}</Card.Title>
                <Card.Description>{t('shipment.form_section_general_desc', 'The destination, carrier, and paperwork context of this dispatch.')}</Card.Description>
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
                          {t('shipment.form_document_number', 'Document Number')}
                        </Label>
                        <Input
                          variant="secondary"
                          placeholder={t('shipment.form_document_number_placeholder', 'Auto-generated if blank')}
                        />
                      </TextField>
                    )}
                  </form.Field>
                  <form.Field name="date">
                    {(field) => (
                      <FormDatePicker
                        label={t('shipment.form_date', 'Date')}
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
                          ? t('shipment.form_warehouse_required', 'Warehouse is required')
                          : undefined,
                    }}
                  >
                    {(field) => (
                      <WarehouseSelectSearch
                        queryKeyBase="shipment-warehouse"
                        value={field.state.value || ''}
                        onChange={(v) => field.handleChange(String(v ?? ''))}
                        label={t('shipment.form_warehouse', 'Warehouse')}
                        ariaLabel={t('shipment.form_warehouse', 'Warehouse')}
                        placeholder={t('shipment.form_warehouse_placeholder', 'Select warehouse')}
                        searchPlaceholder={t('shipment.form_warehouse_search', 'Search warehouse...')}
                        emptyLabel={t('shipment.form_warehouse_empty', 'No warehouse found')}
                        isDisabled={isSubmitting}
                        isInvalid={field.state.meta.errors.length > 0}
                        errorMessage={field.state.meta.errors.join(', ')}
                      />
                    )}
                  </form.Field>
                  <form.Field name="shipmentNumber">
                    {(field) => (
                      <TextField
                        isDisabled={isSubmitting}
                        value={field.state.value}
                        onChange={field.handleChange}
                        onBlur={field.handleBlur}
                      >
                        <Label>
                          {t('shipment.form_shipment_number', 'Shipment Number')}
                        </Label>
                        <Input
                          variant="secondary"
                          placeholder={t('shipment.form_shipment_number_placeholder', 'Shipment number')}
                        />
                      </TextField>
                    )}
                  </form.Field>
                  <form.Field name="salesOrderRef">
                    {(field) => (
                      <TextField
                        isDisabled={isSubmitting}
                        value={field.state.value}
                        onChange={field.handleChange}
                        onBlur={field.handleBlur}
                      >
                        <Label>
                          {t('shipment.form_sales_order_ref', 'Sales Order Ref')}
                        </Label>
                        <Input
                          variant="secondary"
                          placeholder={t('shipment.form_sales_order_ref_placeholder', 'SO reference')}
                        />
                      </TextField>
                    )}
                  </form.Field>
                  <form.Field name="recipient">
                    {(field) => (
                      <TextField
                        isDisabled={isSubmitting}
                        value={field.state.value}
                        onChange={field.handleChange}
                        onBlur={field.handleBlur}
                      >
                        <Label>
                          {t('shipment.form_recipient', 'Recipient')}
                        </Label>
                        <Input
                          variant="secondary"
                          placeholder={t('shipment.form_recipient_placeholder', 'Recipient name')}
                        />
                      </TextField>
                    )}
                  </form.Field>
                  <form.Field name="carrier">
                    {(field) => (
                      <TextField
                        isDisabled={isSubmitting}
                        value={field.state.value}
                        onChange={field.handleChange}
                        onBlur={field.handleBlur}
                      >
                        <Label>{t('shipment.form_carrier', 'Carrier')}</Label>
                        <Input
                          variant="secondary"
                          placeholder={t('shipment.form_carrier_placeholder', 'Carrier name')}
                        />
                      </TextField>
                    )}
                  </form.Field>
                  <form.Field name="trackingNumber">
                    {(field) => (
                      <TextField
                        isDisabled={isSubmitting}
                        value={field.state.value}
                        onChange={field.handleChange}
                        onBlur={field.handleBlur}
                      >
                        <Label>
                          {t('shipment.form_tracking_number', 'Tracking Number')}
                        </Label>
                        <Input
                          variant="secondary"
                          placeholder={t('shipment.form_tracking_number_placeholder', 'Tracking number')}
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
                          {t('shipment.form_reference', 'Reference')}
                        </Label>
                        <Input
                          variant="secondary"
                          placeholder={t('shipment.form_reference_placeholder', 'Reference number')}
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
                        <Label>{t('shipment.form_notes', 'Notes')}</Label>
                        <TextArea
                          rows={4}
                          variant="secondary"
                          placeholder={t('shipment.form_notes_placeholder', 'Add notes')}
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
                <Card.Title>{t('shipment.preview_title', 'Shipment Preview')}</Card.Title>
                <Card.Description>{t('shipment.preview_desc', 'Live summary of the dispatch you are preparing.')}</Card.Description>
              </Card.Header>
              <Card.Content>
                <dl className="space-y-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <dt className="text-muted">{t('shipment.form_document_number', 'Document Number')}</dt>
                    <dd className="font-mono text-foreground">{values.documentNumber || t('shipment.form_auto', 'Auto')}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <dt className="text-muted">{t('shipment.form_warehouse', 'Warehouse')}</dt>
                    <dd className="text-right font-medium text-foreground">{warehouseName ?? '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <dt className="text-muted">{t('shipment.form_recipient', 'Recipient')}</dt>
                    <dd className="text-right font-medium text-foreground">{values.recipient || '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <dt className="text-muted">{t('shipment.form_carrier', 'Carrier')}</dt>
                    <dd className="text-right font-medium text-foreground">{values.carrier || '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <dt className="text-muted">{t('shipment.form_shipment_number', 'Shipment Number')}</dt>
                    <dd className="text-right font-medium text-foreground">{values.shipmentNumber || '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <dt className="text-muted">{t('shipment.preview_pallets', 'Pallets')}</dt>
                    <dd className="font-semibold text-foreground">
                      {itemCount > 0 ? `${itemCount} · ${totalQuantity} ${t('shipment.preview_qty_suffix', 'qty')}` : '—'}
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
              title={t('shipment.form_items_title', 'Items')}
              description={t('shipment.form_items_desc', 'The SKUs leaving on this shipment.')}
              labels={{
                add: t('shipment.form_add_item', 'Add Item'),
                empty: t('shipment.form_no_items', 'No items. Click "Add Item" to start.'),
                aria: t('shipment.form_items_aria', 'Shipment items'),
              }}
            />
          )}
        </form.Field>

        {canSave && (
          <div className="flex items-center justify-end gap-2">
            {isEdit && form.state.isDirty ? <UnsavedChangesBadge className="mr-auto" /> : null}
            <Button variant="ghost" isDisabled={isSubmitting || !itemsReady || !hasWarehouse} onPress={() => handleActionConfirm('DRAFT')}>
              <Icon icon="solar:floppy-disk-linear" className="size-4" />
              {t('shipment.form_save_draft', 'Save Draft')}
            </Button>
            <Button isDisabled={isSubmitting || !itemsReady || !hasWarehouse} onPress={() => handleActionConfirm('PROPOSED')}>
              <Icon icon="solar:send-linear" className="size-4" />
              {t('shipment.form_propose', 'Propose')}
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
          saving: t('shipment.form_saving', 'Saving…'),
          successTitle: t('shipment.form_success_title', 'Saved'),
          errorTitle: t('shipment.form_error_title', 'Error'),
          confirmPropose: t('shipment.form_confirm_propose', 'Confirm Propose'),
          confirmDraft: t('shipment.form_confirm_draft', 'Confirm Save Draft'),
          confirmProposeDesc: t('shipment.form_confirm_propose_desc', 'Propose this shipment?'),
          confirmDraftDesc: t('shipment.form_confirm_draft_desc', 'Save as draft?'),
          messageLabel: t('shipment.form_message_label', 'Message'),
          messagePlaceholder: t('shipment.form_message_placeholder', 'Add a note (optional)'),
          cancel: t('shipment.form_cancel', 'Cancel'),
          confirm: t('shipment.form_confirm', 'Confirm'),
          close: t('shipment.form_close', 'Close'),
          viewDetail: t('shipment.form_view_detail', 'View Detail'),
        }}
        onModalClose={handleModalClose}
        onConfirmSubmit={() => void handleConfirmSubmit(form.handleSubmit)}
        onViewDetail={handleViewDetail}
      />
    </Form>
  );
};

const ShipmentFormPage = () => {
  const { id, isEdit, detail, isLoading, isError, error, initialValues, canEdit } = useTransactionFormPage<
    ShipmentDetail,
    FormValues
  >({
    queryKey: 'shipmentDetail',
    detailQuery: (input) => trpcClient.shipment.detail.query(input),
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
  return <ShipmentForm id={id} isEdit={isEdit} initialValues={initialValues} />;
};

export { ShipmentFormPage };
