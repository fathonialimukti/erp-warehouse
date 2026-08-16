import { useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useIntl } from 'react-intl';
import { useForm, useStore } from '@tanstack/react-form';
import {
  Button,
  Card,
  Chip,
  FieldError,
  FieldGroup,
  Fieldset,
  FieldsetLegend,
  Form,
  Input,
  Label,
  Modal,
  NumberField,
  Separator,
  Spinner,
  Table,
  TextArea,
  TextField,
  Tooltip,
} from '@heroui/react';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BoxIcon,
  CheckCircleIcon,
  ClipboardIcon,
  CloseCircleIcon,
  DocumentIcon,
  InfoIcon,
  LayersIcon,
  NotesIcon,
  PaperclipIcon,
  PlusIcon,
  SaveIcon,
  ScaleIcon,
  SendIcon,
  SpinnerIcon,
  TrashIcon,
  TruckIcon,
} from '../../../assets/IconRegistry';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trpcClient } from '../../../lib/trpc';
import { hasPermissionAtom } from '../../../lib/atoms';
import { useAiFillForm } from '../../../components/AiAssistant/useAiFillForm';
import { AiFillButton } from '../../../components/AiFill/AiFillButton';
import { AiFillPanel } from '../../../components/AiFill/AiFillPanel';
import { PageHeader } from '../../../components/PageHeader';
import { FormDatePicker } from '../../../components/FormDatePicker';
import { SkuSelectSearch } from '../../../components/SkuSelectSearch';
import { SelectSearch } from '../../../components/SelectSearch';
import { fromDateToLocal, getLocalTimeZone, today } from '@internationalized/date';
import { receivingTransactionFormSchema } from '@repo/schemas/receiving-transaction';

interface FormItem {
  _id: string | null;
  skuId: string;
  quantity: string;
  details: string;
}

function createFormItem(): FormItem {
  return { _id: null, skuId: '', quantity: '1', details: '' };
}

type SupplierOption = {
  id: string;
  code?: string | null;
  name?: string | null;
};

type WarehouseOption = {
  id: string;
  code?: string | null;
  name?: string | null;
};

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
    ? d.items.map((item: any) => ({
        _id: item._id ?? null,
        skuId: String(item.skuId ?? ''),
        quantity: String(item.quantity ?? '1'),
        details: String(item.details ?? ''),
      }))
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
      onChange: ({ value }: { value: FormValues }) => {
        const result = receivingTransactionFormSchema.safeParse(value);
        if (result.success) return undefined;
        return result.error.issues.map((e) => e.message).join(', ');
      },
    },
    onSubmit: async ({ value }: { value: FormValues }) => {
      const approvalStatus = intentRef.current;
      const dateValue = value.date;
      const dateJs = dateValue?.toDate ? dateValue.toDate(getLocalTimeZone()) : new Date();
      const items = (value.items as FormItem[]).map((item) => ({
        skuId: item.skuId,
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
    documentNumber: (v) => form.setFieldValue('documentNumber', String(v)),
    supplierId: (v) => form.setFieldValue('supplierId', String(v)),
    purchaseOrderRef: (v) => form.setFieldValue('purchaseOrderRef', String(v)),
    deliveryNoteRef: (v) => form.setFieldValue('deliveryNoteRef', String(v)),
    carrier: (v) => form.setFieldValue('carrier', String(v)),
    trackingNumber: (v) => form.setFieldValue('trackingNumber', String(v)),
    driverName: (v) => form.setFieldValue('driverName', String(v)),
    driverContact: (v) => form.setFieldValue('driverContact', String(v)),
    vehiclePlate: (v) => form.setFieldValue('vehiclePlate', String(v)),
    notes: (v) => form.setFieldValue('notes', String(v)),
    warehouseId: (v) => form.setFieldValue('warehouseId', String(v)),
    items: (v) => {
      if (!Array.isArray(v)) return;
      const items: FormItem[] = v.map((item: any) => ({
        _id: item._id ?? null,
        skuId: String(item.skuId ?? ''),
        quantity: String(item.quantity ?? '1'),
        details: String(item.details ?? ''),
      }));
      form.setFieldValue('items', items.length > 0 ? items : [createFormItem()]);
    },
  });

  const handleActionConfirm = (status: 'DRAFT' | 'PROPOSED') => {
    intentRef.current = status;
    setModalStage(status === 'DRAFT' ? 'confirm-draft' : 'confirm-propose');
  };

  const handleConfirmSubmit = async () => {
    setModalStage('loading');
    await form.handleSubmit();
  };

  // ── Computed form summary ──────────────────────────────────────────────
  // Subscribe to form values reactively so canSubmit/summary recompute on edit.
  const formValues = useStore(form.store, (state) => state.values) as FormValues;
  const formItems = formValues.items ?? [];
  const totalItems = formItems.length;
  const totalQuantity = formItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const hasItems = totalItems > 0 && formItems.every((item) => item.skuId && Number(item.quantity) > 0);
  const canSubmit = Boolean(formValues.supplierId) && Boolean(formValues.warehouseId) && hasItems;

  return (
    <Form>
      <PageHeader
        title={isEdit
          ? intl.formatMessage({ id: 'receiving_transaction.form_edit_title', defaultMessage: 'Edit Receiving Transaction' })
          : intl.formatMessage({ id: 'receiving_transaction.form_new_title', defaultMessage: 'New Receiving Transaction' })}
        onBack={() => navigate('/inbound-transaction')}
      >
        <AiFillButton />
      </PageHeader>

      <AiFillPanel />

      <section
        className="mt-6 space-y-6"
        data-ai-context={JSON.stringify({
          section: 'receiving-transaction-form',
          mode: isEdit ? 'edit' : 'create',
          transactionId: isEdit ? id : undefined,
          fields: ['documentNumber', 'date', 'supplierId', 'warehouseId', 'purchaseOrderRef', 'deliveryNoteRef', 'carrier', 'trackingNumber', 'driverName', 'driverContact', 'vehiclePlate', 'notes', 'files', 'items'],
        })}
      >
        {/* Two-column layout on wide screens: left = form sections, right = summary + notes */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          {/* Left column — General + Shipment (2/3 width) */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            {/* General info */}
            <Fieldset>
              <FieldsetLegend>
                <div className="flex items-center gap-2">
                  <DocumentIcon size={18} className="text-accent" />
                  {intl.formatMessage({ id: 'receiving_transaction.form_section_general', defaultMessage: 'General Information' })}
                </div>
              </FieldsetLegend>
              <FieldGroup>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <form.Field name="documentNumber">
                    {(field) => (
                      <TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}>
                        <Label>
                          <span className="inline-flex items-center gap-1">
                            {intl.formatMessage({ id: 'receiving_transaction.form_document_number', defaultMessage: 'Document Number' })}
                            <Tooltip delay={200}>
                              <Tooltip.Trigger><InfoIcon size={14} className="text-muted" /></Tooltip.Trigger>
                              <Tooltip.Content showArrow placement="top">
                                {intl.formatMessage({ id: 'receiving_transaction.form_document_number_hint', defaultMessage: 'Leave blank to auto-generate (RCV/WH01/MM/YYYY/NNNN)' })}
                              </Tooltip.Content>
                            </Tooltip>
                          </span>
                        </Label>
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
                  <SelectSearch<SupplierOption>
                    queryKeyBase="supplier-form-search"
                    sourceData={async ({ search, limit }) => {
                      const result = await trpcClient.supplier.list.query({
                        page: 1,
                        limit,
                        search: search.trim() || undefined,
                      });
                      return { options: result.data };
                    }}
                    optionsKey="id"
                    value={field.state.value || ''}
                    onChange={(v) => field.handleChange(String(v ?? ''))}
                    isDisabled={isSubmitting}
                    isInvalid={field.state.meta.errors.length > 0}
                    errorMessage={field.state.meta.errors.join(', ')}
                    label={intl.formatMessage({ id: 'receiving_transaction.form_supplier', defaultMessage: 'Supplier' })}
                    placeholder={intl.formatMessage({ id: 'receiving_transaction.form_supplier_placeholder', defaultMessage: 'Select supplier' })}
                    searchPlaceholder={intl.formatMessage({ id: 'receiving_transaction.form_supplier_search', defaultMessage: 'Search supplier...' })}
                    emptyLabel={intl.formatMessage({ id: 'receiving_transaction.form_supplier_empty', defaultMessage: 'No supplier found' })}
                    loadingLabel={intl.formatMessage({ id: 'receiving_transaction.form_supplier_loading', defaultMessage: 'Loading suppliers...' })}
                    ariaLabel={intl.formatMessage({ id: 'receiving_transaction.form_supplier', defaultMessage: 'Supplier' })}
                    getOptionLabel={(s) => s.name ?? s.code ?? s.id}
                    getOptionTextValue={(s) => `${s.name ?? ''} ${s.code ?? ''}`.trim()}
                  />
                )}
              </form.Field>

              <form.Field name="warehouseId" validators={{ onChange: ({ value }) => !value ? intl.formatMessage({ id: 'receiving_transaction.form_warehouse_required', defaultMessage: 'Warehouse is required' }) : undefined }}>
                {(field) => (
                  <SelectSearch<WarehouseOption>
                    queryKeyBase="warehouse-form-search"
                    sourceData={async ({ search, limit }) => {
                      const result = await trpcClient.warehouse.warehouse.list.query({
                        page: 1,
                        limit,
                        search: search.trim() || undefined,
                      });
                      return { options: result.data };
                    }}
                    optionsKey="id"
                    value={field.state.value || ''}
                    onChange={(v) => field.handleChange(String(v ?? ''))}
                    isDisabled={isSubmitting}
                    isInvalid={field.state.meta.errors.length > 0}
                    errorMessage={field.state.meta.errors.join(', ')}
                    label={intl.formatMessage({ id: 'receiving_transaction.form_warehouse', defaultMessage: 'Warehouse' })}
                    placeholder={intl.formatMessage({ id: 'receiving_transaction.form_warehouse_placeholder', defaultMessage: 'Select warehouse' })}
                    searchPlaceholder={intl.formatMessage({ id: 'receiving_transaction.form_warehouse_search', defaultMessage: 'Search warehouse...' })}
                    emptyLabel={intl.formatMessage({ id: 'receiving_transaction.form_warehouse_empty', defaultMessage: 'No warehouse found' })}
                    loadingLabel={intl.formatMessage({ id: 'receiving_transaction.form_warehouse_loading', defaultMessage: 'Loading warehouses...' })}
                    ariaLabel={intl.formatMessage({ id: 'receiving_transaction.form_warehouse', defaultMessage: 'Warehouse' })}
                    getOptionLabel={(w) => w.name ?? w.code ?? w.id}
                    getOptionTextValue={(w) => `${w.name ?? ''} ${w.code ?? ''}`.trim()}
                  />
                )}
              </form.Field>

              <form.Field name="purchaseOrderRef">
                {(field) => (
                  <TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}>
                    <Label>
                      <span className="inline-flex items-center gap-1">
                        {intl.formatMessage({ id: 'receiving_transaction.form_po_ref', defaultMessage: 'Purchase Order Ref' })}
                        <Tooltip delay={200}>
                          <Tooltip.Trigger><InfoIcon size={14} className="text-muted" /></Tooltip.Trigger>
                          <Tooltip.Content showArrow placement="top">
                            {intl.formatMessage({ id: 'receiving_transaction.form_po_ref_hint', defaultMessage: 'Optional — link to the originating PO' })}
                          </Tooltip.Content>
                        </Tooltip>
                      </span>
                    </Label>
                    <Input variant="secondary" placeholder={intl.formatMessage({ id: 'receiving_transaction.form_po_ref_placeholder', defaultMessage: 'PO reference' })} />
                  </TextField>
                )}
              </form.Field>

              <form.Field name="deliveryNoteRef">
                {(field) => (
                  <TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}>
                    <Label>
                      <span className="inline-flex items-center gap-1">
                        {intl.formatMessage({ id: 'receiving_transaction.form_dn_ref', defaultMessage: 'Delivery Note Ref' })}
                        <Tooltip delay={200}>
                          <Tooltip.Trigger><InfoIcon size={14} className="text-muted" /></Tooltip.Trigger>
                          <Tooltip.Content showArrow placement="top">
                            {intl.formatMessage({ id: 'receiving_transaction.form_dn_ref_hint', defaultMessage: 'Optional — supplier delivery note number' })}
                          </Tooltip.Content>
                        </Tooltip>
                      </span>
                    </Label>
                    <Input variant="secondary" placeholder={intl.formatMessage({ id: 'receiving_transaction.form_dn_ref_placeholder', defaultMessage: 'DN reference' })} />
                  </TextField>
                )}
              </form.Field>
            </div>
          </FieldGroup>
        </Fieldset>

        {/* Shipment & Driver */}
        <Fieldset>
          <FieldsetLegend>
            <div className="flex items-center gap-2">
              <TruckIcon size={18} className="text-accent" />
              {intl.formatMessage({ id: 'receiving_transaction.form_section_shipment', defaultMessage: 'Shipment & Driver' })}
            </div>
          </FieldsetLegend>
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
        </div>

        {/* Right column — Live summary + Notes (1/3 width on lg) */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* Live summary card */}
          <Card>
            <Card.Header>
              <div className="flex items-center gap-2">
                <ClipboardIcon size={18} className="text-accent" />
                <Card.Title>{intl.formatMessage({ id: 'receiving_transaction.form_summary_title', defaultMessage: 'Summary' })}</Card.Title>
              </div>
              <Card.Description>{intl.formatMessage({ id: 'receiving_transaction.form_summary_desc', defaultMessage: 'Review your transaction before saving.' })}</Card.Description>
            </Card.Header>
            <Card.Content>
              <dl className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-muted">{intl.formatMessage({ id: 'receiving_transaction.form_document_number', defaultMessage: 'Document Number' })}</dt>
                  <dd className="font-mono text-foreground">{formValues.documentNumber || intl.formatMessage({ id: 'receiving_transaction.form_auto', defaultMessage: 'Auto' })}</dd>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-muted">{intl.formatMessage({ id: 'receiving_transaction.form_supplier', defaultMessage: 'Supplier' })}</dt>
                  <dd className="text-foreground">{formValues.supplierId ? '✓' : '—'}</dd>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-muted">{intl.formatMessage({ id: 'receiving_transaction.form_warehouse', defaultMessage: 'Warehouse' })}</dt>
                  <dd className="text-foreground">{formValues.warehouseId ? '✓' : '—'}</dd>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <dt className="flex items-center gap-1.5 text-muted">
                    <LayersIcon size={14} />
                    {intl.formatMessage({ id: 'receiving_transaction.form_total_items', defaultMessage: 'Total Items' })}
                  </dt>
                  <dd className="font-semibold text-foreground">{totalItems}</dd>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <dt className="flex items-center gap-1.5 text-muted">
                    <ScaleIcon size={14} />
                    {intl.formatMessage({ id: 'receiving_transaction.form_total_quantity', defaultMessage: 'Total Quantity' })}
                  </dt>
                  <dd className="font-semibold text-foreground">{totalQuantity}</dd>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <dt className="text-xs font-medium text-muted">{intl.formatMessage({ id: 'receiving_transaction.form_ready', defaultMessage: 'Ready to save' })}</dt>
                  <dd>
                    <Chip color={canSubmit ? 'success' : 'default'} size="sm" variant="soft">
                      {canSubmit ? '✓' : '…'}
                    </Chip>
                  </dd>
                </div>
              </dl>
            </Card.Content>
          </Card>

        {/* Notes */}
        <Fieldset>
          <FieldsetLegend>
            <div className="flex items-center gap-2">
              <NotesIcon size={18} className="text-accent" />
              {intl.formatMessage({ id: 'receiving_transaction.form_section_notes', defaultMessage: 'Notes & Attachments' })}
            </div>
          </FieldsetLegend>
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
                            <DocumentIcon size={14} className="shrink-0 text-muted" />
                            <span className="flex-1 truncate">{f.name}</span>
                            <span className="shrink-0 text-xs text-muted">{Math.round(f.size / 1024)} KB</span>
                            <Button size="sm" variant="ghost" isIconOnly isDisabled={isSubmitting} onPress={() => { const next = [...(field.state.value as InboundAttachment[])]; next.splice(i, 1); field.handleChange(next); }}>
                              <TrashIcon size={14} className="text-danger" />
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
                      <PaperclipIcon size={16} />
                      {intl.formatMessage({ id: 'receiving_transaction.form_add_attachment', defaultMessage: 'Add Attachment' })}
                    </Button>
                  </div>
                )}
              </form.Field>
            </div>
          </FieldGroup>
        </Fieldset>
        </div>
        </div>

        {/* Items — full width below the two-column layout */}
        <form.Field name="items">
          {(itemsField) => (
            <Card>
              <Card.Header>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <BoxIcon size={18} className="text-accent" />
                    <div>
                      <p className="text-base font-semibold">{intl.formatMessage({ id: 'receiving_transaction.form_items_title', defaultMessage: 'Items' })}</p>
                      <p className="text-sm text-muted">{intl.formatMessage({ id: 'receiving_transaction.form_items_desc', defaultMessage: 'Add items for this receiving transaction.' })}</p>
                    </div>
                  </div>
                  <Button variant="secondary" isDisabled={isSubmitting} onPress={() => itemsField.pushValue(createFormItem())}>
                    <PlusIcon size={16} />
                    {intl.formatMessage({ id: 'receiving_transaction.form_add_item', defaultMessage: 'Add Item' })}
                  </Button>
                </div>
              </Card.Header>
              <Card.Content>
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content aria-label={intl.formatMessage({ id: 'receiving_transaction.form_items_aria', defaultMessage: 'Transaction items' })}>
                      <Table.Header>
                        <Table.Column isRowHeader><span className="text-xs font-semibold">#</span></Table.Column>
                        <Table.Column><span className="text-xs font-semibold">{intl.formatMessage({ id: 'receiving_transaction.col_sku', defaultMessage: 'SKU' })}</span></Table.Column>
                        <Table.Column><span className="text-xs font-semibold">{intl.formatMessage({ id: 'receiving_transaction.col_details', defaultMessage: 'Details' })}</span></Table.Column>
                        <Table.Column><span className="text-xs font-semibold">{intl.formatMessage({ id: 'receiving_transaction.col_quantity', defaultMessage: 'Qty' })}</span></Table.Column>
                        <Table.Column><span className="text-xs font-semibold" /></Table.Column>
                      </Table.Header>
                      <Table.Body
                        renderEmptyState={() => (
                          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                            <BoxIcon size={24} className="text-muted" />
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
                                      onChange={(v) => subField.handleChange(String(v ?? ''))}
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
                                  <Button size="sm" variant="ghost" isIconOnly isDisabled={index === 0 || isSubmitting} onPress={() => itemsField.swapValues(index, index - 1)} aria-label={intl.formatMessage({ id: 'receiving_transaction.form_move_up', defaultMessage: 'Move up' })}><ArrowUpIcon size={14} /></Button>
                                  <Button size="sm" variant="ghost" isIconOnly isDisabled={index === (itemsField.state.value as FormItem[]).length - 1 || isSubmitting} onPress={() => itemsField.swapValues(index, index + 1)} aria-label={intl.formatMessage({ id: 'receiving_transaction.form_move_down', defaultMessage: 'Move down' })}><ArrowDownIcon size={14} /></Button>
                                  <Button size="sm" variant="ghost" isIconOnly isDisabled={isSubmitting} onPress={() => itemsField.removeValue(index)} aria-label={intl.formatMessage({ id: 'receiving_transaction.form_remove_item', defaultMessage: 'Remove' })}><TrashIcon size={14} className="text-danger" /></Button>
                                </div>
                              </Table.Cell>
                            </Table.Row>
                          );
                        })}
                      </Table.Body>
                      <Table.Footer>
                        <Table.Row>
                          <Table.Cell /><Table.Cell /><Table.Cell>
                            <span className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'receiving_transaction.form_total_quantity', defaultMessage: 'Total Quantity' })}</span>
                          </Table.Cell>
                          <Table.Cell><span className="font-semibold text-foreground">{totalQuantity}</span></Table.Cell>
                          <Table.Cell />
                        </Table.Row>
                      </Table.Footer>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              </Card.Content>
            </Card>
          )}
        </form.Field>

        {/* Actions */}
        {canSave && (
          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-muted">
                <LayersIcon size={14} />
                <span className="font-semibold text-foreground">{totalItems}</span>
                {intl.formatMessage({ id: 'receiving_transaction.form_total_items', defaultMessage: 'items' })}
              </span>
              <span className="flex items-center gap-1.5 text-muted">
                <ScaleIcon size={14} />
                <span className="font-semibold text-foreground">{totalQuantity}</span>
                {intl.formatMessage({ id: 'receiving_transaction.form_total_quantity', defaultMessage: 'qty' })}
              </span>
              {!canSubmit && (
                <span className="text-xs text-warning">{intl.formatMessage({ id: 'receiving_transaction.form_incomplete', defaultMessage: 'Supplier, warehouse & items required' })}</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" isDisabled={isSubmitting || !canSubmit} onPress={() => handleActionConfirm('DRAFT')}>
                <SaveIcon size={16} />
                {intl.formatMessage({ id: 'receiving_transaction.form_save_draft', defaultMessage: 'Save Draft' })}
              </Button>
              <Button isDisabled={isSubmitting || !canSubmit} onPress={() => handleActionConfirm('PROPOSED')}>
                <SendIcon size={16} />
                {intl.formatMessage({ id: 'receiving_transaction.form_propose', defaultMessage: 'Propose' })}
              </Button>
            </div>
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
                  <Modal.Body className="flex flex-col items-center gap-4 py-8"><SpinnerIcon size={32} className="animate-spin text-accent" /><p className="text-sm text-muted">{intl.formatMessage({ id: 'receiving_transaction.form_please_wait', defaultMessage: 'Please wait…' })}</p></Modal.Body>
                </>
              ) : modalStage === 'success' ? (
                <>
                  <Modal.Header><Modal.Icon><CheckCircleIcon size={48} className="text-success" /></Modal.Icon><Modal.Heading>{intl.formatMessage({ id: 'receiving_transaction.form_success_title', defaultMessage: 'Saved' })}</Modal.Heading></Modal.Header>
                  <Modal.Body><p className="text-center text-sm text-muted">{resultMessage}</p></Modal.Body>
                  <Modal.Footer><Button onPress={() => navigate(`/inbound-transaction/receiving/${successDetailId ?? id}`)}>{intl.formatMessage({ id: 'receiving_transaction.form_view_detail', defaultMessage: 'View Detail' })}</Button></Modal.Footer>
                </>
              ) : modalStage === 'error' ? (
                <>
                  <Modal.Header><Modal.Icon><CloseCircleIcon size={48} className="text-danger" /></Modal.Icon><Modal.Heading>{intl.formatMessage({ id: 'receiving_transaction.form_error_title', defaultMessage: 'Error' })}</Modal.Heading></Modal.Header>
                  <Modal.Body><p className="text-center text-sm text-muted">{resultMessage}</p></Modal.Body>
                  <Modal.Footer><Button onPress={handleModalClose}>{intl.formatMessage({ id: 'receiving_transaction.form_close', defaultMessage: 'Close' })}</Button></Modal.Footer>
                </>
              ) : (
                <>
                  <Modal.Header>
                    <Modal.Icon>{intentRef.current === 'PROPOSED' ? <SendIcon size={40} /> : <SaveIcon size={40} />}</Modal.Icon>
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
