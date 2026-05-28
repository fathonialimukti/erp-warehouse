import { useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useIntl } from 'react-intl';
import { useForm } from '@tanstack/react-form';
import {
  Button,
  Card,
  FieldError,
  FieldGroup,
  Fieldset,
  FieldsetLegend,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  NumberField,
  Select,
  Spinner,
  Table,
  TextArea,
  TextField,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trpcClient } from '../../../lib/trpc';
import { hasPermissionAtom } from '../../../lib/atoms';
import { useAiFillForm } from '../../../components/AiAssistant/useAiFillForm';
import { PageHeader } from '../../../components/PageHeader';
import { FormDatePicker } from '../../../components/FormDatePicker';
import { SkuSelectSearch } from '../../../components/SkuSelectSearch';
import { PalletTypeSelectSearch } from '../../../components/PalletTypeSelectSearch';
import { fromDateToLocal, getLocalTimeZone, today } from '@internationalized/date';
import { receivingTransactionFormSchema } from '@repo/schemas/receiving-transaction';

interface FormItem {
  _id: string | null;
  skuId: string;
  palletTypeId: string;
  quantity: string;
  details: string;
}

interface InboundAttachment {
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  url?: string;
  storedName?: string;
}

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

const createFormItem = (): FormItem => ({ _id: null, skuId: '', palletTypeId: '', quantity: '1', details: '' });

type FormValues = {
  documentNumber: string;
  date: any;
  supplierId: string;
  purchaseOrderRef: string;
  deliveryNoteRef: string;
  carrier: string;
  trackingNumber: string;
  driverName: string;
  driverContact: string;
  vehiclePlate: string;
  notes: string;
  warehouseId: string;
  files: InboundAttachment[];
  items: FormItem[];
};

const defaultFormValues = (): FormValues => ({
  documentNumber: '',
  date: today(getLocalTimeZone()) as any,
  supplierId: '',
  purchaseOrderRef: '',
  deliveryNoteRef: '',
  carrier: '',
  trackingNumber: '',
  driverName: '',
  driverContact: '',
  vehiclePlate: '',
  notes: '',
  warehouseId: '',
  files: [],
  items: [createFormItem()],
});

const transformDetailToFormValues = (d: any): FormValues => {
  const files: InboundAttachment[] = Array.isArray(d.files)
    ? d.files.map((f: any) => ({ name: String(f?.name ?? ''), type: String(f?.type ?? ''), size: Number(f?.size ?? 0), url: f?.url ? String(f.url) : undefined, storedName: f?.storedName ? String(f.storedName) : undefined }))
    : [];
  const items: FormItem[] = (d.items?.length ?? 0) > 0
    ? d.items.map((item: any) => ({ _id: item.id ?? item._id ?? null, skuId: item.skuId, palletTypeId: item.palletTypeId ?? '', quantity: String(item.quantity), details: item.details ?? '' }))
    : [createFormItem()];
  return {
    documentNumber: d.documentNumber ?? '',
    date: d.date ? fromDateToLocal(new Date(d.date)) : today(getLocalTimeZone()),
    supplierId: d.supplierId ?? '',
    purchaseOrderRef: d.purchaseOrderRef ?? '',
    deliveryNoteRef: d.deliveryNoteRef ?? '',
    carrier: d.carrier ?? '',
    trackingNumber: d.trackingNumber ?? '',
    driverName: d.driverName ?? '',
    driverContact: d.driverContact ?? '',
    vehiclePlate: d.vehiclePlate ?? '',
    notes: d.notes ?? '',
    warehouseId: d.warehouseId ?? '',
    files,
    items,
  };
};

interface ReceivingTransactionFormProps {
  id?: string;
  isEdit: boolean;
  initialValues: FormValues | null;
}

const ReceivingTransactionForm = ({ id, isEdit, initialValues }: ReceivingTransactionFormProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = isEdit ? hasPermission('receiving@update') : hasPermission('receiving@create');

  type ModalStage = 'idle' | 'confirm-draft' | 'confirm-propose' | 'loading' | 'success' | 'error';
  const intentRef = useRef<'DRAFT' | 'PROPOSED'>('DRAFT');
  const [modalStage, setModalStage] = useState<ModalStage>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const [approvalMessage, setApprovalMessage] = useState('');
  const [successDetailId, setSuccessDetailId] = useState<string | null>(null);
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const resultTimerRef = useRef<number | null>(null);

  const clearResultTimer = () => { if (resultTimerRef.current !== null) { window.clearTimeout(resultTimerRef.current); resultTimerRef.current = null; } };
  const handleModalClose = () => { if (modalStage === 'loading') return; clearResultTimer(); setApprovalMessage(''); setModalStage('idle'); };
  useEffect(() => () => clearResultTimer(), []);

  const { data: warehouseListData } = useQuery({
    queryKey: ['warehouseList'],
    queryFn: () => trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 100 }),
  });

  const { data: supplierListData } = useQuery({
    queryKey: ['supplierList'],
    queryFn: () => trpcClient.supplier.list.query({ page: 1, limit: 200 }),
  });

  const warehouses = (warehouseListData as any)?.data ?? (warehouseListData as any)?.items ?? [];
  const suppliers = (supplierListData as any)?.data ?? (supplierListData as any)?.items ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: any) => trpcClient.receivingTransaction.create.mutate(payload),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['receivingTransactionList'] });
      const detailId = data?.id ?? id;
      setSuccessDetailId(detailId ?? null);
      setResultMessage(intl.formatMessage({ id: 'receiving_transaction.form_create_success', defaultMessage: 'Receiving transaction created successfully.' }));
      setModalStage('success');
      clearResultTimer();
      resultTimerRef.current = window.setTimeout(() => navigate(`/inbound-transaction/receiving/${detailId}`), 1500);
    },
    onError: (err: Error) => {
      setResultMessage(err.message ?? intl.formatMessage({ id: 'error_generic', defaultMessage: 'An unexpected error occurred.' }));
      setModalStage('error');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: any) => trpcClient.receivingTransaction.update.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivingTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['receivingTransactionList'] });
      setResultMessage(intl.formatMessage({ id: 'receiving_transaction.form_update_success', defaultMessage: 'Receiving transaction updated successfully.' }));
      setModalStage('success');
      clearResultTimer();
      resultTimerRef.current = window.setTimeout(() => navigate(`/inbound-transaction/receiving/${id}`), 1500);
    },
    onError: (err: Error) => {
      setResultMessage(err.message ?? intl.formatMessage({ id: 'error_generic', defaultMessage: 'An unexpected error occurred.' }));
      setModalStage('error');
    },
  });

  const form = useForm({
    defaultValues: initialValues ?? defaultFormValues(),
    validators: {
      onChange: ({ value }: { value: FormValues }) => receivingTransactionFormSchema.safeParse(value),
    },
    onSubmit: async ({ value }: { value: FormValues }) => {
      const approvalStatus = intentRef.current;
      const dateValue = value.date;
      const dateJs = dateValue?.toDate ? dateValue.toDate(getLocalTimeZone()) : new Date();
      const items = (value.items as FormItem[]).map((item) => ({
        skuId: item.skuId,
        palletTypeId: item.palletTypeId,
        quantity: Number(item.quantity),
        details: item.details || undefined,
      }));
      const files = (value.files as InboundAttachment[]).map((f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
        dataUrl: f.dataUrl,
        url: f.url,
        storedName: f.storedName,
      }));
      const payload: any = {
        documentNumber: value.documentNumber || undefined,
        date: dateJs,
        supplierId: value.supplierId,
        purchaseOrderRef: value.purchaseOrderRef || undefined,
        deliveryNoteRef: value.deliveryNoteRef || undefined,
        carrier: value.carrier || undefined,
        trackingNumber: value.trackingNumber || undefined,
        driverName: value.driverName || undefined,
        driverContact: value.driverContact || undefined,
        vehiclePlate: value.vehiclePlate || undefined,
        notes: value.notes || undefined,
        warehouseId: value.warehouseId,
        approvalStatus,
        message: approvalMessage || undefined,
        files,
        items,
        approvalHistory: [],
      };
      if (isEdit && id) {
        await updateMutation.mutateAsync({ ...payload, id });
      } else {
        await createMutation.mutateAsync(payload);
      }
    },
  });

  const isSubmitting = modalStage === 'loading';

  useAiFillForm({
    documentNumber:   (v) => form.setFieldValue('documentNumber', String(v)),
    supplierId:       (v) => form.setFieldValue('supplierId', String(v)),
    purchaseOrderRef: (v) => form.setFieldValue('purchaseOrderRef', String(v)),
    deliveryNoteRef:  (v) => form.setFieldValue('deliveryNoteRef', String(v)),
    carrier:          (v) => form.setFieldValue('carrier', String(v)),
    trackingNumber:   (v) => form.setFieldValue('trackingNumber', String(v)),
    driverName:       (v) => form.setFieldValue('driverName', String(v)),
    driverContact:    (v) => form.setFieldValue('driverContact', String(v)),
    vehiclePlate:     (v) => form.setFieldValue('vehiclePlate', String(v)),
    notes:            (v) => form.setFieldValue('notes', String(v)),
    warehouseId:      (v) => form.setFieldValue('warehouseId', String(v)),
  });

  const handleActionConfirm = (status: 'DRAFT' | 'PROPOSED') => {
    intentRef.current = status;
    setModalStage(status === 'DRAFT' ? 'confirm-draft' : 'confirm-propose');
  };

  const handleConfirmSubmit = async () => {
    setModalStage('loading');
    await form.handleSubmit();
  };

  return (
    <Form>
      <PageHeader
        title={isEdit
          ? intl.formatMessage({ id: 'receiving_transaction.form_edit_title', defaultMessage: 'Edit Receiving Transaction' })
          : intl.formatMessage({ id: 'receiving_transaction.form_new_title', defaultMessage: 'New Receiving Transaction' })}
        onBack={() => navigate('/inbound-transaction')}
      />

      <section
        className="space-y-6"
        data-ai-context={JSON.stringify({
          section: 'receiving-transaction-form',
          mode: isEdit ? 'edit' : 'create',
          transactionId: isEdit ? id : undefined,
          fields: ['documentNumber', 'date', 'supplierId', 'warehouseId', 'purchaseOrderRef', 'deliveryNoteRef', 'carrier', 'trackingNumber', 'driverName', 'driverContact', 'vehiclePlate', 'notes', 'files', 'items'],
        })}
      >
        {/* General info */}
        <Fieldset>
          <FieldsetLegend>{intl.formatMessage({ id: 'receiving_transaction.form_section_general', defaultMessage: 'General Information' })}</FieldsetLegend>
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <form.Field name="documentNumber">
                {(field) => (
                  <TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}>
                    <Label>{intl.formatMessage({ id: 'receiving_transaction.form_document_number', defaultMessage: 'Document Number' })}</Label>
                    <Input variant="secondary" placeholder={intl.formatMessage({ id: 'receiving_transaction.form_document_number_placeholder', defaultMessage: 'Auto-generated if blank' })} />
                  </TextField>
                )}
              </form.Field>

              <form.Field name="date">
                {(field) => (
                  <FormDatePicker
                    label={intl.formatMessage({ id: 'receiving_transaction.form_date', defaultMessage: 'Date' })}
                    value={field.state.value}
                    onChange={field.handleChange}
                    isDisabled={isSubmitting}
                  />
                )}
              </form.Field>

              <form.Field name="supplierId" validators={{ onChange: ({ value }) => !value ? intl.formatMessage({ id: 'receiving_transaction.form_supplier_required', defaultMessage: 'Supplier is required' }) : undefined }}>
                {(field) => (
                  <Select
                    isRequired
                    isDisabled={isSubmitting}
                    selectedKey={field.state.value || null}
                    onSelectionChange={(key) => field.handleChange(key ? String(key) : '')}
                    isInvalid={field.state.meta.errors.length > 0}
                    placeholder={intl.formatMessage({ id: 'receiving_transaction.form_supplier_placeholder', defaultMessage: 'Select supplier' })}
                    aria-label={intl.formatMessage({ id: 'receiving_transaction.form_supplier', defaultMessage: 'Supplier' })}
                  >
                    <Label>{intl.formatMessage({ id: 'receiving_transaction.form_supplier', defaultMessage: 'Supplier' })}</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {suppliers.map((s: any) => (
                          <ListBox.Item key={s.id} id={s.id}>{s.name}</ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                )}
              </form.Field>

              <form.Field name="warehouseId" validators={{ onChange: ({ value }) => !value ? intl.formatMessage({ id: 'receiving_transaction.form_warehouse_required', defaultMessage: 'Warehouse is required' }) : undefined }}>
                {(field) => (
                  <Select
                    isRequired
                    isDisabled={isSubmitting}
                    selectedKey={field.state.value || null}
                    onSelectionChange={(key) => field.handleChange(key ? String(key) : '')}
                    isInvalid={field.state.meta.errors.length > 0}
                    placeholder={intl.formatMessage({ id: 'receiving_transaction.form_warehouse_placeholder', defaultMessage: 'Select warehouse' })}
                    aria-label={intl.formatMessage({ id: 'receiving_transaction.form_warehouse', defaultMessage: 'Warehouse' })}
                  >
                    <Label>{intl.formatMessage({ id: 'receiving_transaction.form_warehouse', defaultMessage: 'Warehouse' })}</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {warehouses.map((w: any) => (
                          <ListBox.Item key={w.id} id={w.id}>{w.name}</ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                )}
              </form.Field>

              <form.Field name="purchaseOrderRef">
                {(field) => (
                  <TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}>
                    <Label>{intl.formatMessage({ id: 'receiving_transaction.form_po_ref', defaultMessage: 'Purchase Order Ref' })}</Label>
                    <Input variant="secondary" placeholder={intl.formatMessage({ id: 'receiving_transaction.form_po_ref_placeholder', defaultMessage: 'PO reference' })} />
                  </TextField>
                )}
              </form.Field>

              <form.Field name="deliveryNoteRef">
                {(field) => (
                  <TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}>
                    <Label>{intl.formatMessage({ id: 'receiving_transaction.form_dn_ref', defaultMessage: 'Delivery Note Ref' })}</Label>
                    <Input variant="secondary" placeholder={intl.formatMessage({ id: 'receiving_transaction.form_dn_ref_placeholder', defaultMessage: 'DN reference' })} />
                  </TextField>
                )}
              </form.Field>
            </div>
          </FieldGroup>
        </Fieldset>

        {/* Shipment & Driver */}
        <Fieldset>
          <FieldsetLegend>{intl.formatMessage({ id: 'receiving_transaction.form_section_shipment', defaultMessage: 'Shipment & Driver' })}</FieldsetLegend>
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <form.Field name="carrier">
                {(field) => (
                  <TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}>
                    <Label>{intl.formatMessage({ id: 'receiving_transaction.form_carrier', defaultMessage: 'Carrier' })}</Label>
                    <Input variant="secondary" placeholder={intl.formatMessage({ id: 'receiving_transaction.form_carrier_placeholder', defaultMessage: 'Carrier name' })} />
                  </TextField>
                )}
              </form.Field>

              <form.Field name="trackingNumber">
                {(field) => (
                  <TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}>
                    <Label>{intl.formatMessage({ id: 'receiving_transaction.form_tracking', defaultMessage: 'Tracking Number' })}</Label>
                    <Input variant="secondary" placeholder={intl.formatMessage({ id: 'receiving_transaction.form_tracking_placeholder', defaultMessage: 'Tracking number' })} />
                  </TextField>
                )}
              </form.Field>

              <form.Field name="driverName">
                {(field) => (
                  <TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}>
                    <Label>{intl.formatMessage({ id: 'receiving_transaction.form_driver_name', defaultMessage: 'Driver Name' })}</Label>
                    <Input variant="secondary" placeholder={intl.formatMessage({ id: 'receiving_transaction.form_driver_name_placeholder', defaultMessage: 'Driver full name' })} />
                  </TextField>
                )}
              </form.Field>

              <form.Field name="driverContact">
                {(field) => (
                  <TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}>
                    <Label>{intl.formatMessage({ id: 'receiving_transaction.form_driver_contact', defaultMessage: 'Driver Contact' })}</Label>
                    <Input variant="secondary" placeholder={intl.formatMessage({ id: 'receiving_transaction.form_driver_contact_placeholder', defaultMessage: 'Phone or email' })} />
                  </TextField>
                )}
              </form.Field>

              <form.Field name="vehiclePlate">
                {(field) => (
                  <TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}>
                    <Label>{intl.formatMessage({ id: 'receiving_transaction.form_vehicle_plate', defaultMessage: 'Vehicle Plate' })}</Label>
                    <Input variant="secondary" placeholder={intl.formatMessage({ id: 'receiving_transaction.form_vehicle_plate_placeholder', defaultMessage: 'Plate number' })} />
                  </TextField>
                )}
              </form.Field>
            </div>
          </FieldGroup>
        </Fieldset>

        {/* Notes */}
        <Fieldset>
          <FieldsetLegend>{intl.formatMessage({ id: 'receiving_transaction.form_section_notes', defaultMessage: 'Notes & Attachments' })}</FieldsetLegend>
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4">
              <form.Field name="notes">
                {(field) => (
                  <TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur} fullWidth>
                    <Label>{intl.formatMessage({ id: 'receiving_transaction.form_notes', defaultMessage: 'Notes' })}</Label>
                    <TextArea rows={4} variant="secondary" placeholder={intl.formatMessage({ id: 'receiving_transaction.form_notes_placeholder', defaultMessage: 'Add notes or remarks' })} />
                  </TextField>
                )}
              </form.Field>

              <form.Field name="files">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{intl.formatMessage({ id: 'receiving_transaction.form_attachments', defaultMessage: 'Attachments' })}</Label>
                    {(field.state.value as InboundAttachment[]).length > 0 && (
                      <ul className="space-y-1">
                        {(field.state.value as InboundAttachment[]).map((f, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <Icon icon="solar:file-linear" className="size-4 shrink-0 text-muted" />
                            <span className="flex-1 truncate">{f.name}</span>
                            <span className="shrink-0 text-xs text-muted">{Math.round(f.size / 1024)} KB</span>
                            <Button size="sm" variant="ghost" isIconOnly isDisabled={isSubmitting} onPress={() => { const next = [...(field.state.value as InboundAttachment[])]; next.splice(i, 1); field.handleChange(next); }}>
                              <Icon icon="solar:trash-bin-trash-linear" className="size-4 text-danger" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Button
                      variant="ghost"
                      isDisabled={isSubmitting || isReadingFiles}
                      onPress={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.multiple = true;
                        input.onchange = async (e) => {
                          const target = e.target as HTMLInputElement;
                          if (!target.files?.length) return;
                          setIsReadingFiles(true);
                          const newFiles: InboundAttachment[] = [];
                          for (const file of Array.from(target.files)) {
                            const dataUrl = await readFileAsDataUrl(file);
                            newFiles.push({ name: file.name, type: file.type, size: file.size, dataUrl });
                          }
                          field.handleChange([...(field.state.value as InboundAttachment[]), ...newFiles]);
                          setIsReadingFiles(false);
                        };
                        input.click();
                      }}
                    >
                      <Icon icon="solar:paperclip-linear" className="size-4" />
                      {intl.formatMessage({ id: 'receiving_transaction.form_add_attachment', defaultMessage: 'Add Attachment' })}
                    </Button>
                  </div>
                )}
              </form.Field>
            </div>
          </FieldGroup>
        </Fieldset>

        {/* Items */}
        <form.Field name="items">
          {(itemsField) => (
            <Card>
              <Card.Header className="flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold">{intl.formatMessage({ id: 'receiving_transaction.form_items_title', defaultMessage: 'Items' })}</p>
                  <p className="text-sm text-muted">{intl.formatMessage({ id: 'receiving_transaction.form_items_desc', defaultMessage: 'Add items for this receiving transaction.' })}</p>
                </div>
                <Button variant="secondary" isDisabled={isSubmitting} onPress={() => itemsField.pushValue(createFormItem())}>
                  <Icon icon="solar:add-circle-linear" className="size-4" />
                  {intl.formatMessage({ id: 'receiving_transaction.form_add_item', defaultMessage: 'Add Item' })}
                </Button>
              </Card.Header>
              <Card.Content>
                <Table aria-label={intl.formatMessage({ id: 'receiving_transaction.form_items_aria', defaultMessage: 'Transaction items' })}>
                  <Table.Header>
                    <Table.Column isRowHeader><span className="text-xs font-semibold">#</span></Table.Column>
                    <Table.Column><span className="text-xs font-semibold">{intl.formatMessage({ id: 'receiving_transaction.col_sku', defaultMessage: 'SKU' })}</span></Table.Column>
                    <Table.Column><span className="text-xs font-semibold">{intl.formatMessage({ id: 'receiving_transaction.col_pallet_type', defaultMessage: 'Pallet Type' })}</span></Table.Column>
                    <Table.Column><span className="text-xs font-semibold">{intl.formatMessage({ id: 'receiving_transaction.col_details', defaultMessage: 'Details' })}</span></Table.Column>
                    <Table.Column><span className="text-xs font-semibold">{intl.formatMessage({ id: 'receiving_transaction.col_quantity', defaultMessage: 'Qty' })}</span></Table.Column>
                    <Table.Column><span className="text-xs font-semibold" /></Table.Column>
                  </Table.Header>
                  <Table.Body
                    renderEmptyState={() => (
                      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                        <Icon icon="solar:box-linear" className="size-6 text-muted" />
                        <span className="text-sm text-muted">{intl.formatMessage({ id: 'receiving_transaction.form_no_items', defaultMessage: 'No items. Click "Add Item" to start.' })}</span>
                      </div>
                    )}
                  >
                    {(itemsField.state.value as FormItem[]).map((item, index) => {
                      const rowId = item._id ?? `new-${index}`;
                      return (
                        <Table.Row key={rowId} id={rowId}>
                          <Table.Cell><span className="font-mono text-sm text-muted">{index + 1}</span></Table.Cell>
                          <Table.Cell>
                            <form.Field name={`items[${index}].skuId` as any} validators={{ onChange: ({ value }: { value: string }) => !value ? intl.formatMessage({ id: 'receiving_transaction.form_sku_required', defaultMessage: 'SKU is required' }) : undefined }}>
                              {(subField: any) => (
                                <SkuSelectSearch
                                  queryKeyBase={`${rowId}-sku`}
                                  value={subField.state.value || ''}
                                  onChange={(v) => { subField.handleChange(String(v ?? '')); (form.setFieldValue as any)(`items[${index}].palletTypeId`, ''); }}
                                  label={intl.formatMessage({ id: 'receiving_transaction.col_sku', defaultMessage: 'SKU' })}
                                  ariaLabel={intl.formatMessage({ id: 'receiving_transaction.col_sku', defaultMessage: 'SKU' })}
                                  placeholder={intl.formatMessage({ id: 'receiving_transaction.form_sku_placeholder', defaultMessage: 'Select SKU' })}
                                  searchPlaceholder={intl.formatMessage({ id: 'receiving_transaction.form_sku_search', defaultMessage: 'Search SKU...' })}
                                  emptyLabel={intl.formatMessage({ id: 'receiving_transaction.form_sku_empty', defaultMessage: 'No SKU found' })}
                                  isDisabled={isSubmitting}
                                  isInvalid={subField.state.meta.errors.length > 0}
                                  errorMessage={subField.state.meta.errors.join(', ')}
                                />
                              )}
                            </form.Field>
                          </Table.Cell>
                          <Table.Cell>
                            <form.Field name={`items[${index}].palletTypeId` as any} validators={{ onChange: ({ value }: { value: string }) => !value ? intl.formatMessage({ id: 'receiving_transaction.form_pallet_required', defaultMessage: 'Pallet type is required' }) : undefined }}>
                              {(subField: any) => (
                                <PalletTypeSelectSearch
                                  queryKeyBase={`${rowId}-pallet`}
                                  isDisabled={isSubmitting || !item.skuId}
                                  value={subField.state.value || ''}
                                  isInvalid={subField.state.meta.errors.length > 0}
                                  onChange={(v) => subField.handleChange(String(v ?? ''))}
                                  skuId={item.skuId}
                                  ariaLabel={intl.formatMessage({ id: 'receiving_transaction.col_pallet_type', defaultMessage: 'Pallet Type' })}
                                  placeholder={intl.formatMessage({ id: 'receiving_transaction.form_pallet_placeholder', defaultMessage: 'Select pallet type' })}
                                  searchPlaceholder={intl.formatMessage({ id: 'receiving_transaction.form_pallet_search', defaultMessage: 'Search pallet type...' })}
                                  emptyLabel={intl.formatMessage({ id: 'receiving_transaction.form_pallet_empty', defaultMessage: 'No pallet type found' })}
                                  errorMessage={subField.state.meta.errors.join(', ')}
                                />
                              )}
                            </form.Field>
                          </Table.Cell>
                          <Table.Cell>
                            <form.Field name={`items[${index}].details` as any}>
                              {(subField: any) => (
                                <TextField isDisabled={isSubmitting} value={subField.state.value} onChange={subField.handleChange} onBlur={subField.handleBlur} aria-label={intl.formatMessage({ id: 'receiving_transaction.col_details', defaultMessage: 'Details' })}>
                                  <Input variant="secondary" placeholder={intl.formatMessage({ id: 'receiving_transaction.form_details_placeholder', defaultMessage: 'Item notes' })} />
                                </TextField>
                              )}
                            </form.Field>
                          </Table.Cell>
                          <Table.Cell>
                            <form.Field name={`items[${index}].quantity` as any}>
                              {(subField: any) => {
                                const qty = Number(subField.state.value || '0');
                                return (
                                  <NumberField fullWidth variant="secondary" isDisabled={isSubmitting} isRequired minValue={1} step={1} value={qty} onChange={(v) => subField.handleChange(String(v ?? 1))} aria-label={intl.formatMessage({ id: 'receiving_transaction.col_quantity', defaultMessage: 'Qty' })} isInvalid={qty < 1}>
                                    <Label>{intl.formatMessage({ id: 'receiving_transaction.col_quantity', defaultMessage: 'Qty' })}</Label>
                                    <NumberField.Group>
                                      <NumberField.DecrementButton />
                                      <NumberField.Input />
                                      <NumberField.IncrementButton />
                                    </NumberField.Group>
                                    <FieldError>{qty < 1 ? intl.formatMessage({ id: 'receiving_transaction.form_qty_rule', defaultMessage: 'Must be at least 1' }) : ''}</FieldError>
                                  </NumberField>
                                );
                              }}
                            </form.Field>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" isIconOnly isDisabled={index === 0 || isSubmitting} onPress={() => itemsField.swapValues(index, index - 1)} aria-label={intl.formatMessage({ id: 'receiving_transaction.form_move_up', defaultMessage: 'Move up' })}><Icon icon="solar:arrow-up-linear" className="size-4" /></Button>
                              <Button size="sm" variant="ghost" isIconOnly isDisabled={index === (itemsField.state.value as FormItem[]).length - 1 || isSubmitting} onPress={() => itemsField.swapValues(index, index + 1)} aria-label={intl.formatMessage({ id: 'receiving_transaction.form_move_down', defaultMessage: 'Move down' })}><Icon icon="solar:arrow-down-linear" className="size-4" /></Button>
                              <Button size="sm" variant="ghost" isIconOnly isDisabled={isSubmitting} onPress={() => itemsField.removeValue(index)} aria-label={intl.formatMessage({ id: 'receiving_transaction.form_remove_item', defaultMessage: 'Remove' })}><Icon icon="solar:trash-bin-trash-linear" className="size-4 text-danger" /></Button>
                            </div>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table>
              </Card.Content>
            </Card>
          )}
        </form.Field>

        {/* Actions */}
        {canSave && (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" isDisabled={isSubmitting} onPress={() => handleActionConfirm('DRAFT')}>
              <Icon icon="solar:floppy-disk-linear" className="size-4" />
              {intl.formatMessage({ id: 'receiving_transaction.form_save_draft', defaultMessage: 'Save Draft' })}
            </Button>
            <Button isDisabled={isSubmitting} onPress={() => handleActionConfirm('PROPOSED')}>
              <Icon icon="solar:send-linear" className="size-4" />
              {intl.formatMessage({ id: 'receiving_transaction.form_propose', defaultMessage: 'Propose' })}
            </Button>
          </div>
        )}
      </section>

      {/* Modal */}
      <Modal>
        <Modal.Backdrop
          isOpen={modalStage !== 'idle'}
          onOpenChange={(open) => { if (!open) handleModalClose(); }}
          isDismissable={modalStage !== 'loading'}
          isKeyboardDismissDisabled={modalStage === 'loading'}
        >
          <Modal.Container size="sm">
            <Modal.Dialog>
              {modalStage === 'loading' ? (
                <>
                  <Modal.Header><Modal.Heading>{intl.formatMessage({ id: 'receiving_transaction.form_saving', defaultMessage: 'Saving…' })}</Modal.Heading></Modal.Header>
                  <Modal.Body className="flex flex-col items-center gap-4 py-8"><Spinner size="lg" /><p className="text-sm text-muted">{intl.formatMessage({ id: 'receiving_transaction.form_please_wait', defaultMessage: 'Please wait…' })}</p></Modal.Body>
                </>
              ) : modalStage === 'success' ? (
                <>
                  <Modal.Header><Modal.Icon><Icon icon="solar:check-circle-bold" className="size-12 text-success" /></Modal.Icon><Modal.Heading>{intl.formatMessage({ id: 'receiving_transaction.form_success_title', defaultMessage: 'Saved' })}</Modal.Heading></Modal.Header>
                  <Modal.Body><p className="text-center text-sm text-muted">{resultMessage}</p></Modal.Body>
                  <Modal.Footer><Button onPress={() => navigate(`/inbound-transaction/receiving/${successDetailId ?? id}`)}>{intl.formatMessage({ id: 'receiving_transaction.form_view_detail', defaultMessage: 'View Detail' })}</Button></Modal.Footer>
                </>
              ) : modalStage === 'error' ? (
                <>
                  <Modal.Header><Modal.Icon><Icon icon="solar:close-circle-bold" className="size-12 text-danger" /></Modal.Icon><Modal.Heading>{intl.formatMessage({ id: 'receiving_transaction.form_error_title', defaultMessage: 'Error' })}</Modal.Heading></Modal.Header>
                  <Modal.Body><p className="text-center text-sm text-muted">{resultMessage}</p></Modal.Body>
                  <Modal.Footer><Button onPress={handleModalClose}>{intl.formatMessage({ id: 'receiving_transaction.form_close', defaultMessage: 'Close' })}</Button></Modal.Footer>
                </>
              ) : (
                <>
                  <Modal.Header>
                    <Modal.Icon><Icon icon={intentRef.current === 'PROPOSED' ? 'solar:send-linear' : 'solar:floppy-disk-linear'} className="size-10" /></Modal.Icon>
                    <Modal.Heading>
                      {intentRef.current === 'PROPOSED'
                        ? intl.formatMessage({ id: 'receiving_transaction.form_confirm_propose_title', defaultMessage: 'Confirm Propose' })
                        : intl.formatMessage({ id: 'receiving_transaction.form_confirm_draft_title', defaultMessage: 'Confirm Save Draft' })}
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body className="space-y-4">
                    <p className="text-sm text-muted">
                      {intentRef.current === 'PROPOSED'
                        ? intl.formatMessage({ id: 'receiving_transaction.form_confirm_propose_desc', defaultMessage: 'Propose this transaction for approval?' })
                        : intl.formatMessage({ id: 'receiving_transaction.form_confirm_draft_desc', defaultMessage: 'Save this transaction as a draft?' })}
                    </p>
                    {intentRef.current === 'PROPOSED' && (
                      <TextField fullWidth>
                        <Label>{intl.formatMessage({ id: 'receiving_transaction.form_message_label', defaultMessage: 'Message' })}</Label>
                        <TextArea rows={3} variant="secondary" value={approvalMessage} onChange={(e) => setApprovalMessage(e.target.value)} placeholder={intl.formatMessage({ id: 'receiving_transaction.form_message_placeholder', defaultMessage: 'Add a note (optional)' })} />
                      </TextField>
                    )}
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="ghost" onPress={handleModalClose}>{intl.formatMessage({ id: 'receiving_transaction.form_cancel', defaultMessage: 'Cancel' })}</Button>
                    <Button onPress={() => void handleConfirmSubmit()}>{intl.formatMessage({ id: 'receiving_transaction.form_confirm', defaultMessage: 'Confirm' })}</Button>
                  </Modal.Footer>
                </>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </Form>
  );
};

// ─── Outer component ──────────────────────────────────────────────────────────
const ReceivingTransactionFormPage = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['receivingTransactionDetail', id],
    queryFn: () => trpcClient.receivingTransaction.detail.query({ id: id! }),
    enabled: isEdit,
  });

  const detail = detailData as any;
  const initialValues = isEdit && detail ? transformDetailToFormValues(detail) : null;

  if (isEdit && detailLoading) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center gap-4">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isEdit && !detail) {
    return <p className="text-sm text-danger">Transaction not found.</p>;
  }

  if (isEdit && detail && !['DRAFT', 'REJECTED'].includes(detail.approvalStatus)) {
    return <p className="text-sm text-warning">This transaction cannot be edited in its current state.</p>;
  }

  return <ReceivingTransactionForm id={id} isEdit={isEdit} initialValues={initialValues} />;
};

export { ReceivingTransactionFormPage };
