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
import { shipmentFormSchema } from '@repo/schemas/shipment';
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
  /** Detail still loading on edit pages — shell shows the spinner. */
  isLoading?: boolean;
  /** Not-found / wrong-status message on edit pages — shell shows the guard. */
  guard?: ReactNode;
}

const ShipmentForm = ({ id, isEdit, initialValues, isLoading = false, guard }: Props) => {
  const t = useMessage();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = isEdit ? hasPermission('shipment@update') : hasPermission('shipment@create');

  const modalMessages = {
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
  };

  const { data: warehouseListData } = useQuery({
    queryKey: ['warehouseOptions'],
    queryFn: () => trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 999 }),
  });
  const warehouses = warehouseListData?.data ?? [];

  const docForm = useDocForm<FormValues, any>({
    formId: 'shipment-form',
    isEdit,
    id,
    initialValues,
    defaultValues: defaultFormValues,
    schema: shipmentFormSchema,
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
        shipmentNumber: parsed.shipmentNumber || undefined,
        salesOrderRef: parsed.salesOrderRef || undefined,
        recipient: parsed.recipient || undefined,
        reference: parsed.reference || undefined,
        notes: parsed.notes || undefined,
        carrier: parsed.carrier || undefined,
        trackingNumber: parsed.trackingNumber || undefined,
        warehouseId: parsed.warehouseId,
        approvalStatus: intent,
        message: approvalMessage || undefined,
        items,
      };
    },
    createCaller: (payload) => trpcClient.shipment.create.mutate(payload),
    updateCaller: (payload) => trpcClient.shipment.update.mutate(payload),
    listQueryKey: 'shipmentList',
    detailQueryKey: 'shipmentDetail',
    redirectOnSuccess: (savedId) => `/outbound-transaction/shipment/${savedId ?? id}`,
    modalMessages,
    successMessageCreate: t('shipment.form_create_success', 'Shipment created.'),
    successMessageUpdate: t('shipment.form_update_success', 'Shipment updated.'),
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
    shipmentNumber: (v) => docForm.form.setFieldValue('shipmentNumber', String(v)),
    salesOrderRef: (v) => docForm.form.setFieldValue('salesOrderRef', String(v)),
    recipient: (v) => docForm.form.setFieldValue('recipient', String(v)),
    reference: (v) => docForm.form.setFieldValue('reference', String(v)),
    notes: (v) => docForm.form.setFieldValue('notes', String(v)),
    carrier: (v) => docForm.form.setFieldValue('carrier', String(v)),
    trackingNumber: (v) => docForm.form.setFieldValue('trackingNumber', String(v)),
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
      header: t('shipment.col_sku', 'SKU'),
      ariaLabel: t('shipment.col_sku', 'SKU'),
      placeholder: t('shipment.form_sku_placeholder', 'Select SKU'),
      searchPlaceholder: t('shipment.form_sku_search', 'Search SKU...'),
      emptyLabel: t('shipment.form_sku_empty', 'No SKU found'),
      requiredMessage: t('shipment.form_sku_required', 'SKU is required'),
    },
    {
      key: 'details',
      cell: 'text',
      header: t('shipment.col_details', 'Details'),
      label: t('shipment.col_details', 'Details'),
      placeholder: t('shipment.form_details_placeholder', 'Item notes'),
    },
    {
      key: 'quantity',
      cell: 'number',
      header: t('shipment.col_quantity', 'Qty'),
      label: t('shipment.col_quantity', 'Qty'),
      min: 1,
      ruleMessage: t('shipment.form_qty_rule', 'Must be at least 1'),
    },
  ];

  return (
    <FormPageShell
      formId="shipment-form"
      mode={isEdit ? 'edit' : 'create'}
      entityId={id}
      title={
        isEdit
          ? t('shipment.form_edit_title', 'Edit Shipment')
          : t('shipment.form_new_title', 'New Shipment')
      }
      backTo="/outbound-transaction"
      validationErrors={docForm.validationErrors}
      aiFields={['documentNumber', 'date', 'shipmentNumber', 'salesOrderRef', 'recipient', 'carrier', 'trackingNumber', 'reference', 'notes', 'warehouseId', 'items']}
      header={
        <DocHeaderCard
          title={t('shipment.form_section_general', 'General Information')}
          description={t('shipment.form_section_general_desc', 'The destination, carrier, and paperwork context of this dispatch.')}
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
                <Label>{t('shipment.form_document_number', 'Document Number')}</Label>
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
                isDisabled={docForm.isSubmitting}
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
                isDisabled={docForm.isSubmitting}
                isInvalid={field.state.meta.errors.length > 0}
                errorMessage={field.state.meta.errors.join(', ')}
              />
            )}
          </form.Field>
          <form.Field name="shipmentNumber">
            {(field) => (
              <TextField
                isDisabled={docForm.isSubmitting}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              >
                <Label>{t('shipment.form_shipment_number', 'Shipment Number')}</Label>
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
                isDisabled={docForm.isSubmitting}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              >
                <Label>{t('shipment.form_sales_order_ref', 'Sales Order Ref')}</Label>
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
                isDisabled={docForm.isSubmitting}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              >
                <Label>{t('shipment.form_recipient', 'Recipient')}</Label>
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
                isDisabled={docForm.isSubmitting}
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
                isDisabled={docForm.isSubmitting}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              >
                <Label>{t('shipment.form_tracking_number', 'Tracking Number')}</Label>
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
                isDisabled={docForm.isSubmitting}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              >
                <Label>{t('shipment.form_reference', 'Reference')}</Label>
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
                isDisabled={docForm.isSubmitting}
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
        </DocHeaderCard>
      }
      aside={
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
      }
      below={
        <form.Field name="items">
          {(itemsField) => (
            <EditableLinesTable
              field={itemsField}
              columns={columns}
              createItem={createFormItem}
              isDisabled={docForm.isSubmitting}
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
            saveDraft: t('shipment.form_save_draft', 'Save Draft'),
            propose: t('shipment.form_propose', 'Propose'),
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

const ShipmentFormPage = () => {
  const { id, isEdit, detail, isLoading, isError, error, initialValues, canEdit } =
    useTransactionFormPage<ShipmentDetail, FormValues>({
      queryKey: 'shipmentDetail',
      detailQuery: (input) => trpcClient.shipment.detail.query(input),
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
    <ShipmentForm
      id={id}
      isEdit={isEdit}
      initialValues={initialValues}
      isLoading={isEdit && isLoading}
      guard={guard}
    />
  );
};

export { ShipmentFormPage };