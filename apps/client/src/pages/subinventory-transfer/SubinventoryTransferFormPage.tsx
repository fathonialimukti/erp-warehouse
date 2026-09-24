import type { ReactNode } from 'react';
import { useAtomValue } from 'jotai';
import { useMessage } from '../../lib/useMessage';
import { Card, Input, Label, ListBox, Select, TextArea, TextField } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import { trpcClient } from '../../lib/trpc';
import { hasPermissionAtom } from '../../lib/atoms';
import { useAiFillForm } from '../../components/AiAssistant/useAiFillForm';
import { FormDatePicker } from '../../components/FormDatePicker';
import { WarehouseSelectSearch } from '../../components/WarehouseSelectSearch';
import { fromDateToLocal, getLocalTimeZone, today } from '@internationalized/date';
import { subinventoryTransferFormSchema } from '@repo/schemas/subinventory-transfer';
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
} from '../../components/form';

interface FormItem {
  _id: string | null;
  palletId: string;
  fromLocationId: string;
  toLocationId: string;
}

function createFormItem(): FormItem {
  return { _id: null, palletId: '', fromLocationId: '', toLocationId: '' };
}

type FormValues = {
  documentNumber: string;
  date: any;
  transferReason: string;
  reference: string;
  notes: string;
  warehouseId: string;
  items: FormItem[];
};

/** Unwrap a tRPC vanilla-client query/procedure into its resolved wire type. */
type DetailOf<Q> = Q extends (...args: never[]) => Promise<infer R> ? R : never;

/** Client-side shape of `subinventoryTransfer.detail`. */
type SubinventoryTransferDetail = DetailOf<typeof trpcClient.subinventoryTransfer.detail.query>;

const defaultFormValues = (): FormValues => ({
  documentNumber: '',
  date: today(getLocalTimeZone()) as any,
  transferReason: '',
  reference: '',
  notes: '',
  warehouseId: '',
  items: [createFormItem()],
});

const transformDetailToFormValues = (d: SubinventoryTransferDetail): FormValues => {
  const items: FormItem[] =
    (d.items?.length ?? 0) > 0
      ? d.items.map((item) => ({
          _id: (item as { _id?: string | null })._id ?? null,
          palletId: String(item.palletId ?? ''),
          fromLocationId: String(item.fromLocationId ?? ''),
          toLocationId: String(item.toLocationId ?? ''),
        }))
      : [createFormItem()];
  return {
    documentNumber: d.documentNumber ?? '',
    date: d.date ? fromDateToLocal(new Date(d.date)) : today(getLocalTimeZone()),
    transferReason: d.transferReason ?? '',
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

const SubinventoryTransferForm = ({ id, isEdit, initialValues, isLoading = false, guard }: Props) => {
  const t = useMessage();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = isEdit
    ? hasPermission('subinventory-transfer@update')
    : hasPermission('subinventory-transfer@create');

  const modalMessages = {
    saving: t('subinventory_transfer.form_saving', 'Saving…'),
    successTitle: t('subinventory_transfer.form_success_title', 'Saved'),
    errorTitle: t('subinventory_transfer.form_error_title', 'Error'),
    confirmPropose: t('subinventory_transfer.form_confirm_propose', 'Confirm Propose'),
    confirmDraft: t('subinventory_transfer.form_confirm_draft', 'Confirm Save Draft'),
    confirmProposeDesc: t('subinventory_transfer.form_confirm_propose_desc', 'Propose this subinventory transfer?'),
    confirmDraftDesc: t('subinventory_transfer.form_confirm_draft_desc', 'Save as draft?'),
    messageLabel: t('subinventory_transfer.form_message_label', 'Message'),
    messagePlaceholder: t('subinventory_transfer.form_message_placeholder', 'Add a note (optional)'),
    cancel: t('subinventory_transfer.form_cancel', 'Cancel'),
    confirm: t('subinventory_transfer.form_confirm', 'Confirm'),
    close: t('subinventory_transfer.form_close', 'Close'),
    viewDetail: t('subinventory_transfer.form_view_detail', 'View Detail'),
  };

  const docForm = useDocForm<FormValues, any>({
    formId: 'subinventory-transfer-form',
    isEdit,
    id,
    initialValues,
    defaultValues: defaultFormValues,
    schema: subinventoryTransferFormSchema,
    toPayload: (parsed, intent, approvalMessage) => {
      const dateJs = parsed.date?.toDate ? parsed.date.toDate(getLocalTimeZone()) : new Date();
      const items = (parsed.items as FormItem[]).map((item) => ({
        palletId: item.palletId,
        fromLocationId: item.fromLocationId,
        toLocationId: item.toLocationId,
      }));
      return {
        documentNumber: parsed.documentNumber || undefined,
        date: dateJs,
        transferReason: parsed.transferReason || undefined,
        reference: parsed.reference || undefined,
        notes: parsed.notes || undefined,
        warehouseId: parsed.warehouseId,
        approvalStatus: intent,
        message: approvalMessage || undefined,
        items,
        approvalHistory: [],
      };
    },
    createCaller: (payload) => trpcClient.subinventoryTransfer.create.mutate(payload),
    updateCaller: (payload) => trpcClient.subinventoryTransfer.update.mutate(payload),
    listQueryKey: 'subinventoryTransferList',
    detailQueryKey: 'subinventoryTransferDetail',
    redirectOnSuccess: (savedId) => `/subinventory-transfer/${savedId ?? id}`,
    modalMessages,
    successMessageCreate: t('subinventory_transfer.form_create_success', 'Subinventory transfer created.'),
    successMessageUpdate: t('subinventory_transfer.form_update_success', 'Subinventory transfer updated.'),
    errorFallback: t('error_generic', 'An unexpected error occurred.'),
    missingRequired: (values) => {
      const missing: string[] = [];
      if (!values.warehouseId) missing.push('warehouseId');
      const rows = Array.isArray(values.items) ? values.items : [];
      if (rows.length === 0) missing.push('items');
      rows.forEach((item, index) => {
        if (!item?.palletId) missing.push(`items[${index}].palletId`);
        if (!item?.fromLocationId) missing.push(`items[${index}].fromLocationId`);
        if (!item?.toLocationId) missing.push(`items[${index}].toLocationId`);
      });
      return missing;
    },
    computeTotals: (values) => {
      const rows = Array.isArray(values.items) ? values.items : [];
      return {
        totalItems: rows.length,
        totalQuantity: rows.length,
      };
    },
    computeCanSubmit: (values) => {
      const rows = Array.isArray(values.items) ? values.items : [];
      return (
        Boolean(values.warehouseId) &&
        rows.length > 0 &&
        rows.every((item) => item.palletId && item.fromLocationId && item.toLocationId)
      );
    },
  });

  // The JSX below binds via `<form.Field>` — same form instance the hook owns.
  const form = docForm.form;

  useAiFillForm({
    documentNumber: (v) => docForm.form.setFieldValue('documentNumber', String(v)),
    transferReason: (v) => docForm.form.setFieldValue('transferReason', String(v)),
    reference: (v) => docForm.form.setFieldValue('reference', String(v)),
    notes: (v) => docForm.form.setFieldValue('notes', String(v)),
    warehouseId: (v) => docForm.form.setFieldValue('warehouseId', String(v)),
    items: (v) => {
      if (!Array.isArray(v)) return;
      const items: FormItem[] = v.map((item: Record<string, unknown>) => ({
        _id: (item._id as string | null) ?? null,
        palletId: String(item.palletId ?? ''),
        fromLocationId: String(item.fromLocationId ?? ''),
        toLocationId: String(item.toLocationId ?? ''),
      }));
      docForm.form.setFieldValue('items', items.length > 0 ? items : [createFormItem()]);
    },
  });

  const values = docForm.formValues;
  const itemCount = (values.items ?? []).length;

  const columns: TransactionItemsColumn<FormItem>[] = [
    {
      key: 'palletId',
      cell: 'custom',
      header: t('subinventory_transfer.col_pallet', 'Pallet'),
      render: ({ value, onChange, isDisabled }) => (
        <PalletSelect
          isDisabled={isDisabled}
          warehouseId={values.warehouseId}
          value={value}
          onChange={onChange}
          placeholder={t('subinventory_transfer.form_pallet_placeholder', 'Select pallet')}
        />
      ),
    },
    {
      key: 'fromLocationId',
      cell: 'custom',
      header: t('subinventory_transfer.col_from', 'From Location'),
      render: ({ value, onChange, isDisabled }) => (
        <LocationSelect
          isDisabled={isDisabled}
          warehouseId={values.warehouseId}
          value={value}
          onChange={onChange}
          placeholder={t('subinventory_transfer.form_from_placeholder', 'Source')}
        />
      ),
    },
    {
      key: 'toLocationId',
      cell: 'custom',
      header: t('subinventory_transfer.col_to', 'To Location'),
      render: ({ value, onChange, isDisabled }) => (
        <LocationSelect
          isDisabled={isDisabled}
          warehouseId={values.warehouseId}
          value={value}
          onChange={onChange}
          placeholder={t('subinventory_transfer.form_to_placeholder', 'Destination')}
        />
      ),
    },
  ];

  return (
    <FormPageShell
      formId="subinventory-transfer-form"
      mode={isEdit ? 'edit' : 'create'}
      entityId={id}
      title={
        isEdit
          ? t('subinventory_transfer.form_edit_title', 'Edit Subinventory Transfer')
          : t('subinventory_transfer.form_new_title', 'New Subinventory Transfer')
      }
      backTo="/subinventory-transfer"
      validationErrors={docForm.validationErrors}
      aiFields={['documentNumber', 'date', 'transferReason', 'reference', 'notes', 'warehouseId', 'items']}
      header={
        <DocHeaderCard
          title={t('subinventory_transfer.form_section_general', 'General Information')}
          description={t('subinventory_transfer.form_section_general_desc', 'The document, warehouse, and context behind this move.')}
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
                <Label>{t('subinventory_transfer.form_document_number', 'Document Number')}</Label>
                <Input
                  variant="secondary"
                  placeholder={t('subinventory_transfer.form_document_number_placeholder', 'Auto-generated if blank')}
                />
              </TextField>
            )}
          </form.Field>
          <form.Field name="date">
            {(field) => (
              <FormDatePicker
                label={t('subinventory_transfer.form_date', 'Date')}
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
                  ? t('subinventory_transfer.form_warehouse_required', 'Warehouse is required')
                  : undefined,
            }}
          >
            {(field) => (
              <WarehouseSelectSearch
                queryKeyBase="subinventory-transfer-warehouse"
                value={field.state.value || ''}
                onChange={(v) => field.handleChange(String(v ?? ''))}
                label={t('subinventory_transfer.form_warehouse', 'Warehouse')}
                ariaLabel={t('subinventory_transfer.form_warehouse', 'Warehouse')}
                placeholder={t('subinventory_transfer.form_warehouse_placeholder', 'Select warehouse')}
                searchPlaceholder={t('subinventory_transfer.form_warehouse_search', 'Search warehouse...')}
                emptyLabel={t('subinventory_transfer.form_warehouse_empty', 'No warehouse found')}
                isDisabled={docForm.isSubmitting}
                isInvalid={field.state.meta.errors.length > 0}
                errorMessage={field.state.meta.errors.join(', ')}
              />
            )}
          </form.Field>
          <form.Field name="transferReason">
            {(field) => (
              <TextField
                isDisabled={docForm.isSubmitting}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              >
                <Label>{t('subinventory_transfer.form_transfer_reason', 'Transfer Reason')}</Label>
                <Input
                  variant="secondary"
                  placeholder={t('subinventory_transfer.form_transfer_reason_placeholder', 'Reason for transfer')}
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
                <Label>{t('subinventory_transfer.form_reference', 'Reference')}</Label>
                <Input
                  variant="secondary"
                  placeholder={t('subinventory_transfer.form_reference_placeholder', 'Reference number')}
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
                <Label>{t('subinventory_transfer.form_notes', 'Notes')}</Label>
                <TextArea
                  rows={4}
                  variant="secondary"
                  placeholder={t('subinventory_transfer.form_notes_placeholder', 'Add notes')}
                />
              </TextField>
            )}
          </form.Field>
        </DocHeaderCard>
      }
      aside={
        <Card>
          <Card.Header>
            <Card.Title>{t('subinventory_transfer.preview_title', 'Transfer Preview')}</Card.Title>
            <Card.Description>{t('subinventory_transfer.preview_desc', 'Live summary of the pallet moves you are planning.')}</Card.Description>
          </Card.Header>
          <Card.Content>
            <dl className="space-y-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">{t('subinventory_transfer.form_document_number', 'Document Number')}</dt>
                <dd className="font-mono text-foreground">{values.documentNumber || t('subinventory_transfer.form_auto', 'Auto')}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">{t('subinventory_transfer.form_warehouse', 'Warehouse')}</dt>
                <dd className="text-right font-medium text-foreground">
                  {values.warehouseId ? '✓' : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">{t('subinventory_transfer.form_transfer_reason', 'Transfer Reason')}</dt>
                <dd className="text-right font-medium text-foreground">{values.transferReason || '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">{t('subinventory_transfer.form_reference', 'Reference')}</dt>
                <dd className="text-right font-medium text-foreground">{values.reference || '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">{t('subinventory_transfer.form_pallets_count', 'Pallets')}</dt>
                <dd className="font-semibold text-foreground">
                  {itemCount > 0 ? itemCount : '—'}
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
              title={t('subinventory_transfer.form_items_title', 'Transfer Items')}
              icon="solar:transfer-horizontal-linear"
              labels={{
                add: t('subinventory_transfer.form_add_item', 'Add Item'),
                empty: t('subinventory_transfer.form_no_items', 'No items. Click "Add Item" to start.'),
                aria: t('subinventory_transfer.form_items_aria', 'Transfer items'),
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
            saveDraft: t('subinventory_transfer.form_save_draft', 'Save Draft'),
            propose: t('subinventory_transfer.form_propose', 'Propose'),
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

function PalletSelect({ isDisabled, warehouseId, value, onChange, placeholder }: { isDisabled: boolean; warehouseId?: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const { data } = useQuery<any>({
    queryKey: ['palletOptions', warehouseId],
    queryFn: () => trpcClient.warehouse.pallet.list.query({
      page: 1, limit: 500,
    } as any),
    enabled: true,
  });
  const pallets = (data as any)?.data ?? [];
  const filtered = warehouseId ? pallets.filter((p: any) => p.storageLocation?.warehouseId === warehouseId && p.status === 'AVAILABLE') : pallets.filter((p: any) => p.status === 'AVAILABLE');
  return (
    <>
    <Select isDisabled={isDisabled} selectedKey={value || null} onSelectionChange={(key) => onChange(key ? String(key) : '')} placeholder={placeholder} aria-label={placeholder}>
      <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
      <Select.Popover>
        <ListBox items={filtered}>
          {(item: any) => (
            <ListBox.Item key={item.id} id={item.id} textValue={`${item.palletNumber ?? item.id} — ${item.sku?.name ?? ''}`}>
              <div className="flex flex-col"><span className="text-sm font-mono">{item.palletNumber ?? item.id}</span><span className="text-xs text-muted">{item.sku?.name ?? '-'}</span></div>
            </ListBox.Item>
          )}
        </ListBox>
      </Select.Popover>
    </Select>
    <div data-ai-select-options="transferPallet" style={{ display: 'none' }}>
      {JSON.stringify(filtered.map((p: any) => ({ id: String(p.id), label: `${p.palletNumber ?? p.id} — ${p.sku?.name ?? ''}` })))}
    </div>
    </>
  );
}

function LocationSelect({ isDisabled, warehouseId, value, onChange, placeholder }: { isDisabled: boolean; warehouseId?: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const { data } = useQuery<any>({
    queryKey: ['locationOptions', warehouseId],
    queryFn: () => warehouseId
      ? trpcClient.warehouse.storageLocation.exportAll.query({ warehouseId })
      : trpcClient.warehouse.storageLocation.list.query({ page: 1, limit: 500 }),
    enabled: true,
  });
  const locations = (data as any)?.data ?? data ?? [];
  const list = Array.isArray(locations) ? locations : [];
  return (
    <>
    <Select isDisabled={isDisabled} selectedKey={value || null} onSelectionChange={(key) => onChange(key ? String(key) : '')} placeholder={placeholder} aria-label={placeholder}>
      <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
      <Select.Popover>
        <ListBox items={list}>
          {(item: any) => (
            <ListBox.Item key={item.id} id={item.id} textValue={item.id}>
              <div className="flex flex-col"><span className="text-sm font-mono">{item.id}</span><span className="text-xs text-muted">{item.status ?? 'ACTIVE'}</span></div>
            </ListBox.Item>
          )}
        </ListBox>
      </Select.Popover>
    </Select>
    <div data-ai-select-options="transferLocation" style={{ display: 'none' }}>
      {JSON.stringify(list.map((l: any) => ({ id: String(l.id), label: String(l.id) })))}
    </div>
    </>
  );
}

const SubinventoryTransferFormPage = () => {
  const { id, isEdit, detail, isLoading, isError, error, initialValues, canEdit } =
    useTransactionFormPage<SubinventoryTransferDetail, FormValues>({
      queryKey: 'subinventoryTransferDetail',
      detailQuery: (input) => trpcClient.subinventoryTransfer.detail.query(input),
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
    <SubinventoryTransferForm
      id={id}
      isEdit={isEdit}
      initialValues={initialValues}
      isLoading={isEdit && isLoading}
      guard={guard}
    />
  );
};

export { SubinventoryTransferFormPage };