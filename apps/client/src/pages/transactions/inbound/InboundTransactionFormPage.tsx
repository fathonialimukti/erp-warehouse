import { useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useIntl } from 'react-intl';
import { useForm } from '@tanstack/react-form';
import {
  Button,
  Calendar,
  Card,
  DateField,
  DatePicker,
  EmptyState,
  FieldGroup,
  Fieldset,
  FieldsetLegend,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  SearchField,
  Select,
  Spinner,
  Table,
  TextField,
  useFilter,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';
import { hasPermissionAtom } from '../../../lib/atoms';
import { PageHeader } from '../../../components/PageHeader';
import { fromDateToLocal, getLocalTimeZone, today } from '@internationalized/date';

type InboundCreateInput = inferProcedureInput<AppRouter['inboundTransaction']['create']>;
type InboundUpdateInput = inferProcedureInput<AppRouter['inboundTransaction']['update']>;

interface FormItem {
  _id: string | null;
  skuId: string;
  palletTypeId: string;
  quantity: string;
  sortOrder: number;
}

interface InboundAttachment {
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  url?: string;
  storedName?: string;
}

const readFileAsDataUrl = async (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read attachment file.'));
    reader.readAsDataURL(file);
  });
};

const createFormItem = (): FormItem => ({
  _id: null,
  skuId: '',
  palletTypeId: '',
  quantity: '1',
  sortOrder: 1,
});

// ─── Form value types & helpers ───────────────────────────────────────────
type FormValues = {
  id: string;
  date: any;
  sender: string;
  reference: string;
  asnNumber: string;
  carrier: string;
  trackingNumber: string;
  bolNumber: string;
  driverName: string;
  driverContact: string;
  vehiclePlate: string;
  notes: string;
  files: InboundAttachment[];
  items: FormItem[];
};

const defaultFormValues = (): FormValues => ({
  id: '',
  date: today(getLocalTimeZone()) as any,
  sender: '',
  reference: '',
  asnNumber: '',
  carrier: '',
  trackingNumber: '',
  bolNumber: '',
  driverName: '',
  driverContact: '',
  vehiclePlate: '',
  notes: '',
  files: [],
  items: [createFormItem()],
});

const transformDetailToFormValues = (d: any): FormValues => {
  const rawFiles: unknown = d.files;
  const files: InboundAttachment[] = Array.isArray(rawFiles)
    ? rawFiles.map((file: any) => ({
        name: String(file?.name ?? ''),
        type: String(file?.type ?? ''),
        size: Number(file?.size ?? 0),
        url: file?.url ? String(file.url) : undefined,
        storedName: file?.storedName ? String(file.storedName) : undefined,
      }))
    : [];
  const items: FormItem[] = (d.items?.length ?? 0) > 0
    ? (d.items as any[]).map((item: any, index: number) => ({
        _id: item.id ?? item._id ?? null,
        skuId: item.skuId,
        palletTypeId: item.palletTypeId ?? '',
        quantity: String(item.quantity),
        sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : index + 1,
      }))
    : [createFormItem()];
  return {
    id: d.id ?? '',
    date: d.date ? fromDateToLocal(new Date(d.date)) : today(getLocalTimeZone()),
    sender: d.sender ?? '',
    reference: d.reference ?? '',
    asnNumber: d.asnNumber ?? '',
    carrier: d.carrier ?? '',
    trackingNumber: d.trackingNumber ?? '',
    bolNumber: d.bolNumber ?? '',
    driverName: d.driverName ?? '',
    driverContact: d.driverContact ?? '',
    vehiclePlate: d.vehiclePlate ?? '',
    notes: d.notes ?? '',
    files,
    items,
  };
};

type SkuListItem = { id: string; name: string; palletTypes: Array<{ id: string; name: string }> };

interface InboundTransactionFormProps {
  id: string | undefined;
  isEdit: boolean;
  initialValues: FormValues | null;
  skuList: SkuListItem[];
}

// ─── Inner form component ─────────────────────────────────────────────────
const InboundTransactionForm = ({ id, isEdit, initialValues, skuList }: InboundTransactionFormProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = isEdit ? hasPermission('warehouse_transaction_update') : hasPermission('warehouse_transaction_create');
  const { contains } = useFilter({ sensitivity: 'base' });

  // ─── Action modal state machine ─────────────────────────────────────────
  type ModalStage = 'idle' | 'confirm-draft' | 'confirm-propose' | 'loading' | 'success' | 'error';
  const intentRef = useRef<'DRAFT' | 'PENDING'>('DRAFT');
  const [modalStage, setModalStage] = useState<ModalStage>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const [skuSearchByRow, setSkuSearchByRow] = useState<Record<number, string>>({});
  const [palletSearchByRow, setPalletSearchByRow] = useState<Record<number, string>>({});
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const resultTimerRef = useRef<number | null>(null);

  const getFilteredSkuList = (rowIndex: number) => {
    const searchTerm = skuSearchByRow[rowIndex]?.trim();

    if (!searchTerm) {
      return skuList;
    }

    return skuList.filter((sku) => contains(`${sku.id} ${sku.name}`, searchTerm));
  };

  const getFilteredPalletTypeList = (rowIndex: number, palletTypes: SkuListItem['palletTypes']) => {
    const searchTerm = palletSearchByRow[rowIndex]?.trim();

    if (!searchTerm) {
      return palletTypes;
    }

    return palletTypes.filter((palletType) => contains(`${palletType.id} ${palletType.name}`, searchTerm));
  };

  const clearResultTimer = () => {
    if (resultTimerRef.current !== null) {
      window.clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
  };

  const handleModalClose = () => {
    if (modalStage === 'loading') return;
    clearResultTimer();
    const wasSuccess = modalStage === 'success';
    setModalStage('idle');
    if (wasSuccess) navigate('/transactions');
  };

  useEffect(() => () => clearResultTimer(), []);

  // ─── Mutations ───────────────────────────────────────────────────────────
  const createMutation = useMutation<unknown, unknown, InboundCreateInput>({
    mutationFn: (payload) => trpcClient.inboundTransaction.create.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inboundTransactionList'] });
      setResultMessage(
        intentRef.current === 'PENDING'
          ? intl.formatMessage({ id: 'inbound_transaction_form_success_propose', defaultMessage: 'Inbound transaction proposed successfully.' })
          : intl.formatMessage({ id: 'inbound_transaction_form_success_savedraft', defaultMessage: 'Inbound transaction saved as draft.' }),
      );
      setModalStage('success');
      clearResultTimer();
      resultTimerRef.current = window.setTimeout(() => { setModalStage('idle'); navigate('/transactions'); }, 1500);
    },
    onError: (err) => {
      setResultMessage(err instanceof Error ? err.message : intl.formatMessage({ id: 'error_generic', defaultMessage: 'An unexpected error occurred.' }));
      setModalStage('error');
    },
  });

  const updateMutation = useMutation<unknown, unknown, InboundUpdateInput>({
    mutationFn: (payload) => trpcClient.inboundTransaction.update.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inboundTransactionList'] });
      queryClient.invalidateQueries({ queryKey: ['inboundTransactionDetail', id] });
      setResultMessage(
        intentRef.current === 'PENDING'
          ? intl.formatMessage({ id: 'inbound_transaction_form_success_propose', defaultMessage: 'Inbound transaction proposed successfully.' })
          : intl.formatMessage({ id: 'inbound_transaction_form_success_savedraft', defaultMessage: 'Inbound transaction saved as draft.' }),
      );
      setModalStage('success');
      clearResultTimer();
      resultTimerRef.current = window.setTimeout(() => { setModalStage('idle'); navigate('/transactions'); }, 1500);
    },
    onError: (err) => {
      setResultMessage(err instanceof Error ? err.message : intl.formatMessage({ id: 'error_generic', defaultMessage: 'An unexpected error occurred.' }));
      setModalStage('error');
    },
  });

  // ─── TanStack Form ───────────────────────────────────────────────────────
  const form = useForm({
    defaultValues: initialValues ?? defaultFormValues(),
    onSubmit: async ({ value }) => {
      const approvalStatus = intentRef.current;
      if (!canSave) {
        setResultMessage(intl.formatMessage({ id: 'error_generic', defaultMessage: 'You do not have permission to save this transaction.' }));
        setModalStage('error');
        return;
      }
      if (value.items.length === 0) {
        setResultMessage(intl.formatMessage({ id: 'inbound_transaction_form_error_items_empty', defaultMessage: 'At least one item is required.' }));
        setModalStage('error');
        return;
      }
      if (value.items.some((item) => !item.skuId || !item.palletTypeId || Number(item.quantity) < 1)) {
        setResultMessage(intl.formatMessage({ id: 'inbound_transaction_form_error_items', defaultMessage: 'All items must have a valid SKU, pallet type, and quantity ≥ 1.' }));
        setModalStage('error');
        return;
      }
      const mappedItems = value.items.map((item, index) => ({
        skuId: item.skuId,
        palletTypeId: item.palletTypeId,
        quantity: Math.max(1, Math.floor(Number(item.quantity))),
        sortOrder: index + 1,
      }));
      const basePayload = {
        id: value.id.trim() || undefined,
        date: value.date ? new Date(value.date.year, value.date.month - 1, value.date.day) : new Date(),
        sender: value.sender.trim() || undefined,
        reference: value.reference.trim() || undefined,
        asnNumber: value.asnNumber.trim() || undefined,
        carrier: value.carrier.trim() || undefined,
        trackingNumber: value.trackingNumber.trim() || undefined,
        bolNumber: value.bolNumber.trim() || undefined,
        driverName: value.driverName.trim() || undefined,
        driverContact: value.driverContact.trim() || undefined,
        vehiclePlate: value.vehiclePlate.trim() || undefined,
        notes: value.notes.trim() || undefined,
        files: Array.isArray(value.files) && value.files.length > 0 ? value.files : undefined,
        approvalStatus,
        items: mappedItems,
      };
      if (isEdit) {
        await updateMutation.mutateAsync({ ...basePayload, currentId: id!, approvalStatus });
      } else {
        await createMutation.mutateAsync(basePayload);
      }
    },
  });

  const isSubmitting = modalStage === 'loading' || createMutation.isPending || updateMutation.isPending || isReadingFiles;

  const handleActionConfirm = (approvalStatus: 'DRAFT' | 'PENDING') => {
    intentRef.current = approvalStatus;
    setModalStage(approvalStatus === 'DRAFT' ? 'confirm-draft' : 'confirm-propose');
  };

  const handleConfirmSubmit = () => {
    setModalStage('loading');
    void form.handleSubmit();
  };

  const headerTitle = isEdit
    ? intl.formatMessage({ id: 'inbound_transaction_form_titleedit', defaultMessage: 'Edit Inbound Transaction' })
    : intl.formatMessage({ id: 'inbound_transaction_form_titlecreate', defaultMessage: 'Create Inbound Transaction' });

  return (
    <Form
      aria-label={headerTitle}
      validationBehavior="aria"
      onSubmit={(e) => e.preventDefault()}
    >
      <section className="space-y-6">
        <PageHeader
          title={headerTitle}
          onBack={() => navigate('/transactions')}
          onDetail={isEdit ? () => navigate(`/transactions/inbound/${id}`) : undefined}
          isDisabled={isSubmitting}
        />

        {/* ── Section 1: General info ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Fieldset>
            <FieldsetLegend>
              {intl.formatMessage({ id: 'inbound_transaction_form_section_general_legend', defaultMessage: 'Transaction details' })}
            </FieldsetLegend>
            <FieldGroup>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <form.Field name="id">
                  {(field) => (
                    <TextField fullWidth isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}>
                      <Label>{intl.formatMessage({ id: 'inbound_transaction_form_label_id', defaultMessage: 'Transaction ID' })}</Label>
                      <Input variant="secondary" placeholder={intl.formatMessage({ id: 'inbound_transaction_form_id_placeholder', defaultMessage: 'Leave empty for auto-generation' })} />
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="date">
                  {(field) => (
                    <DatePicker
                      className="w-full"
                      isDisabled={isSubmitting}
                      value={field.state.value}
                      onChange={field.handleChange}
                    >
                      <Label>{intl.formatMessage({ id: 'inbound_transaction_form_label_date', defaultMessage: 'Date' })}</Label>
                      <DateField.Group fullWidth variant="secondary">
                        <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
                        <DateField.Suffix>
                          <DatePicker.Trigger>
                            <DatePicker.TriggerIndicator />
                          </DatePicker.Trigger>
                        </DateField.Suffix>
                      </DateField.Group>
                      <DatePicker.Popover>
                        <Calendar aria-label="Event date">
                          <Calendar.Header>
                            <Calendar.YearPickerTrigger>
                              <Calendar.YearPickerTriggerHeading />
                              <Calendar.YearPickerTriggerIndicator />
                            </Calendar.YearPickerTrigger>
                            <Calendar.NavButton slot="previous" />
                            <Calendar.NavButton slot="next" />
                          </Calendar.Header>
                          <Calendar.Grid>
                            <Calendar.GridHeader>
                              {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                            </Calendar.GridHeader>
                            <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
                          </Calendar.Grid>
                          <Calendar.YearPickerGrid>
                            <Calendar.YearPickerGridBody>
                              {({ year }) => <Calendar.YearPickerCell year={year} />}
                            </Calendar.YearPickerGridBody>
                          </Calendar.YearPickerGrid>
                        </Calendar>
                      </DatePicker.Popover>
                    </DatePicker>
                  )}
                </form.Field>

                {(['sender', 'reference', 'asnNumber', 'carrier'] as const).map((name) => (
                  <form.Field key={name} name={name}>
                    {(field) => (
                      <TextField fullWidth isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}>
                        <Label>{intl.formatMessage({ id: `inbound_transaction_form_label_${name === 'asnNumber' ? 'asn_number' : name}`, defaultMessage: name })}</Label>
                        <Input variant="secondary" placeholder={intl.formatMessage({ id: `inbound_transaction_form_${name === 'asnNumber' ? 'asn_number' : name}_placeholder`, defaultMessage: name })} />
                      </TextField>
                    )}
                  </form.Field>
                ))}
              </div>
            </FieldGroup>
          </Fieldset>

          <Fieldset>
            <FieldsetLegend>
              {intl.formatMessage({ id: 'inbound_transaction_form_section_shipment_legend', defaultMessage: 'Shipment details' })}
            </FieldsetLegend>
            <FieldGroup>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {(['trackingNumber', 'bolNumber', 'vehiclePlate'] as const).map((name) => (
                  <form.Field key={name} name={name}>
                    {(field) => (
                      <TextField fullWidth isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}>
                        <Label>{intl.formatMessage({ id: `inbound_transaction_form_label_${name === 'trackingNumber' ? 'tracking_number' : name === 'bolNumber' ? 'bol_number' : 'vehicle_plate'}`, defaultMessage: name })}</Label>
                        <Input variant="secondary" placeholder={intl.formatMessage({ id: `inbound_transaction_form_${name === 'trackingNumber' ? 'tracking_number' : name === 'bolNumber' ? 'bol_number' : 'vehicle_plate'}_placeholder`, defaultMessage: name })} />
                      </TextField>
                    )}
                  </form.Field>
                ))}
              </div>
            </FieldGroup>
          </Fieldset>

          <Fieldset>
            <FieldsetLegend>
              {intl.formatMessage({ id: 'inbound_transaction_form_section_driver_legend', defaultMessage: 'Driver information' })}
            </FieldsetLegend>
            <FieldGroup>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {(['driverName', 'driverContact'] as const).map((name) => (
                  <form.Field key={name} name={name}>
                    {(field) => (
                      <TextField fullWidth isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}>
                        <Label>{intl.formatMessage({ id: `inbound_transaction_form_label_${name === 'driverName' ? 'driver_name' : 'driver_contact'}`, defaultMessage: name })}</Label>
                        <Input variant="secondary" placeholder={intl.formatMessage({ id: `inbound_transaction_form_${name === 'driverName' ? 'driver_name' : 'driver_contact'}_placeholder`, defaultMessage: name })} />
                      </TextField>
                    )}
                  </form.Field>
                ))}
              </div>
            </FieldGroup>
          </Fieldset>

          <Fieldset>
            <FieldsetLegend>
              {intl.formatMessage({ id: 'inbound_transaction_form_section_notes_legend', defaultMessage: 'Notes & attachments' })}
            </FieldsetLegend>
            <FieldGroup>
              <div className="grid grid-cols-1 gap-4">
                <form.Field name="notes">
                  {(field) => (
                    <TextField fullWidth isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}>
                      <Label>{intl.formatMessage({ id: 'inbound_transaction_form_labelnotes', defaultMessage: 'Notes' })}</Label>
                      <Input variant="secondary" placeholder={intl.formatMessage({ id: 'inbound_transaction_form_notesplaceholder', defaultMessage: 'Optional notes...' })} />
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="files">
                  {(field) => (
                    <div className="flex flex-col gap-1">
                      <Label>{intl.formatMessage({ id: 'inbound_transaction_form_label_files', defaultMessage: 'Attachments' })}</Label>
                      <Input
                        type="file"
                        variant="secondary"
                        multiple
                        aria-label={intl.formatMessage({ id: 'inbound_transaction_form_label_files', defaultMessage: 'Attachments' })}
                        onChange={(event) => {
                          const selected = Array.from(event.currentTarget.files ?? []);
                          event.currentTarget.value = '';

                          if (selected.length === 0) {
                            return;
                          }

                          setIsReadingFiles(true);
                          void Promise.all(
                            selected.map(async (file) => ({
                              name: file.name,
                              type: file.type,
                              size: file.size,
                              dataUrl: await readFileAsDataUrl(file),
                            }))
                          )
                            .then((uploadedFiles) => {
                              const existingFiles = Array.isArray(field.state.value) ? field.state.value : [];
                              field.handleChange([...existingFiles, ...uploadedFiles]);
                            })
                            .finally(() => {
                              setIsReadingFiles(false);
                            });
                        }}
                      />
                      {isReadingFiles && (
                        <p className="text-xs text-muted">
                          {intl.formatMessage({ id: 'inbound_transaction_form_files_reading', defaultMessage: 'Reading attachment files...' })}
                        </p>
                      )}
                      {Array.isArray(field.state.value) && field.state.value.length > 0 && (
                        <div className="mt-3 grid gap-2">
                          {field.state.value.map((file, index) => (
                            <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                              <span>{file.name}</span>
                              <span className="text-muted">{Math.round(file.size / 1024)} KB</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </form.Field>
              </div>
            </FieldGroup>
          </Fieldset>
        </div>

        {/* ── Section 2: Items table ──────────────────────────────────────── */}
        <form.Field name="items" mode="array">
          {(itemsField: any) => (
            <Card>
              <Card.Header>
                <div className="flex w-full items-start justify-between">
                  <div>
                    <Card.Title>
                      {intl.formatMessage({ id: 'inbound_transaction_form_section_items', defaultMessage: 'Transaction Items' })}
                    </Card.Title>
                    <Card.Description>
                      {intl.formatMessage({ id: 'inbound_transaction_form_section_items_desc', defaultMessage: 'Define SKU, pallet type, and quantity for each line item.' })}
                    </Card.Description>
                  </div>
                  <Button size="sm" variant="primary" isDisabled={isSubmitting} onPress={() => itemsField.pushValue(createFormItem())}>
                    <Icon icon="solar:add-circle-linear" className="size-4" />
                    {intl.formatMessage({ id: 'inbound_transaction_form_additem', defaultMessage: 'Add Item' })}
                  </Button>
                </div>
              </Card.Header>
              <Card.Content>
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content aria-label={intl.formatMessage({ id: 'inbound_transaction_form_itemstablearia', defaultMessage: 'Transaction items' })}>
                      <Table.Header>
                        <Table.Column isRowHeader><span className="text-xs font-semibold">#</span></Table.Column>
                        <Table.Column><span className="text-xs font-semibold">{intl.formatMessage({ id: 'inbound_transaction_form_col_sku', defaultMessage: 'SKU' })}</span></Table.Column>
                        <Table.Column><span className="text-xs font-semibold">{intl.formatMessage({ id: 'inbound_transaction_form_col_pallettype', defaultMessage: 'Pallet Type' })}</span></Table.Column>
                        <Table.Column><span className="text-xs font-semibold">{intl.formatMessage({ id: 'inbound_transaction_form_col_quantity', defaultMessage: 'Qty' })}</span></Table.Column>
                        <Table.Column><span className="text-xs font-semibold" /></Table.Column>
                      </Table.Header>
                      <Table.Body
                        renderEmptyState={() => (
                          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                            <Icon icon="solar:box-linear" className="size-6 text-muted" />
                            <span className="text-sm text-muted">
                              {intl.formatMessage({ id: 'inbound_transaction_form_noitems', defaultMessage: 'No items yet. Click "Add Item" to start.' })}
                            </span>
                          </div>
                        )}
                      >
                        {(itemsField.state.value as FormItem[]).map((item, index) => {
                          const palletTypesForItem = skuList.find((sku) => sku.id === item.skuId)?.palletTypes ?? [];
                          const filteredSkuList = getFilteredSkuList(index);
                          const filteredPalletTypesForItem = getFilteredPalletTypeList(index, palletTypesForItem);
                          const rowId = item._id ?? `new-item-${index}`;
                          return (
                            <Table.Row key={rowId} id={rowId}>
                              <Table.Cell>
                                <span className="font-mono text-sm text-muted">{index + 1}</span>
                              </Table.Cell>

                              <Table.Cell>
                                <form.Field key={index} name={`items[${index}].skuId` as any}>
                                  {(subField: any) => (
                                    <Select
                                      fullWidth
                                      value={subField.state.value || undefined}
                                      isDisabled={isSubmitting}
                                      onChange={(value) => {
                                        subField.handleChange(String(value ?? ''));
                                        (form.setFieldValue as any)(`items[${index}].palletTypeId`, '');
                                        setSkuSearchByRow((current) => ({ ...current, [index]: '' }));
                                        setPalletSearchByRow((current) => ({ ...current, [index]: '' }));
                                      }}
                                      variant="secondary"
                                      placeholder={intl.formatMessage({ id: 'inbound_transaction_form_sku_placeholder', defaultMessage: 'Select SKU' })}
                                      aria-label={intl.formatMessage({ id: 'inbound_transaction_form_col_sku', defaultMessage: 'SKU' })}
                                    >
                                      <Label className="sr-only">{intl.formatMessage({ id: 'inbound_transaction_form_col_sku', defaultMessage: 'SKU' })}</Label>
                                      <Select.Trigger aria-label={intl.formatMessage({ id: 'inbound_transaction_form_col_sku', defaultMessage: 'SKU' })}>
                                        <Select.Value>
                                          {({ defaultChildren }) => {
                                            const selectedSku = skuList.find((sku) => sku.id === subField.state.value);

                                            if (!selectedSku) {
                                              return defaultChildren;
                                            }

                                            return `${selectedSku.id} - ${selectedSku.name}`;
                                          }}
                                        </Select.Value>
                                        <Select.Indicator />
                                      </Select.Trigger>
                                      <Select.Popover>
                                          <SearchField
                                            autoFocus
                                            className="m-3 mb-0"
                                            name={`skuSearch-${index}`}
                                            variant="secondary"
                                            value={skuSearchByRow[index] ?? ''}
                                            onChange={(value) => {
                                              setSkuSearchByRow((current) => ({ ...current, [index]: value }));
                                            }}
                                            aria-label={intl.formatMessage({ id: 'inbound_transaction_form_sku_search', defaultMessage: 'Search SKU...' })}
                                          >
                                            <SearchField.Group>
                                              <SearchField.SearchIcon />
                                              <SearchField.Input
                                                aria-label={intl.formatMessage({ id: 'inbound_transaction_form_sku_search', defaultMessage: 'Search SKU...' })}
                                                placeholder={intl.formatMessage({ id: 'inbound_transaction_form_sku_search', defaultMessage: 'Search SKU...' })}
                                              />
                                              <SearchField.ClearButton />
                                            </SearchField.Group>
                                          </SearchField>
                                          <ListBox renderEmptyState={() => <EmptyState>{intl.formatMessage({ id: 'inbound_transaction_form_sku_empty', defaultMessage: 'No SKU found' })}</EmptyState>}>
                                            {filteredSkuList.map((sku) => (
                                              <ListBox.Item key={sku.id} id={sku.id} textValue={`${sku.id} ${sku.name}`}>
                                                <div className="flex flex-col">
                                                  <Label>{sku.id}</Label>
                                                  <span className="text-xs text-muted">{sku.name}</span>
                                                </div>
                                                <ListBox.ItemIndicator />
                                              </ListBox.Item>
                                            ))}
                                          </ListBox>
                                      </Select.Popover>
                                    </Select>
                                  )}
                                </form.Field>
                              </Table.Cell>

                              <Table.Cell>
                                <form.Field key={index} name={`items[${index}].palletTypeId` as any}>
                                  {(subField: any) => (
                                    <Select
                                      fullWidth
                                      isDisabled={isSubmitting || !item.skuId}
                                      value={subField.state.value || undefined}
                                      onChange={(v) => {
                                        subField.handleChange(String(v ?? ''));
                                        setPalletSearchByRow((current) => ({ ...current, [index]: '' }));
                                      }}
                                      variant="secondary"
                                      placeholder={intl.formatMessage({ id: 'inbound_transaction_form_pallet_placeholder', defaultMessage: 'Select pallet type' })}
                                      aria-label={intl.formatMessage({ id: 'inbound_transaction_form_col_pallettype', defaultMessage: 'Pallet Type' })}
                                    >
                                      <Select.Trigger aria-label={intl.formatMessage({ id: 'inbound_transaction_form_col_pallettype', defaultMessage: 'Pallet Type' })}>
                                        <Select.Value>
                                          {({ defaultChildren }) => {
                                            const selectedPalletType = palletTypesForItem.find((palletType) => palletType.id === subField.state.value);

                                            if (!selectedPalletType) {
                                              return defaultChildren;
                                            }

                                            return `${selectedPalletType.id} - ${selectedPalletType.name}`;
                                          }}
                                        </Select.Value>
                                        <Select.Indicator />
                                      </Select.Trigger>
                                      <Select.Popover>
                                          <SearchField
                                            autoFocus
                                            className="m-3 mb-0"
                                            name={`palletSearch-${index}`}
                                            variant="secondary"
                                            value={palletSearchByRow[index] ?? ''}
                                            onChange={(value) => {
                                              setPalletSearchByRow((current) => ({ ...current, [index]: value }));
                                            }}
                                            aria-label={intl.formatMessage({ id: 'inbound_transaction_form_pallet_search', defaultMessage: 'Search pallet type...' })}
                                          >
                                            <SearchField.Group>
                                              <SearchField.SearchIcon />
                                              <SearchField.Input
                                                aria-label={intl.formatMessage({ id: 'inbound_transaction_form_pallet_search', defaultMessage: 'Search pallet type...' })}
                                                placeholder={intl.formatMessage({ id: 'inbound_transaction_form_pallet_search', defaultMessage: 'Search pallet type...' })}
                                              />
                                              <SearchField.ClearButton />
                                            </SearchField.Group>
                                          </SearchField>
                                          <ListBox renderEmptyState={() => <EmptyState>{intl.formatMessage({ id: 'inbound_transaction_form_pallet_empty', defaultMessage: 'No pallet type found' })}</EmptyState>}>
                                          {filteredPalletTypesForItem.map((pt) => (
                                            <ListBox.Item key={pt.id} id={pt.id} textValue={pt.name}>
                                              <div className="flex flex-col">
                                                <Label>{pt.id}</Label>
                                                <span className="text-xs text-muted">{pt.name}</span>
                                              </div>
                                              <ListBox.ItemIndicator />
                                            </ListBox.Item>
                                          ))}
                                          </ListBox>
                                      </Select.Popover>
                                    </Select>
                                  )}
                                </form.Field>
                              </Table.Cell>

                              <Table.Cell>
                                <form.Field key={index} name={`items[${index}].quantity` as any}>
                                  {(subField: any) => (
                                    <TextField isDisabled={isSubmitting} type="number" value={subField.state.value} onChange={subField.handleChange} onBlur={subField.handleBlur} aria-label={intl.formatMessage({ id: 'inbound_transaction_form_col_quantity', defaultMessage: 'Qty' })}>
                                      <Input variant="secondary" className="w-24" aria-label={intl.formatMessage({ id: 'inbound_transaction_form_col_quantity', defaultMessage: 'Qty' })} />
                                    </TextField>
                                  )}
                                </form.Field>
                              </Table.Cell>

                              <Table.Cell>
                                <div className="flex items-center gap-1">
                                  <Button size="sm" variant="ghost" isIconOnly isDisabled={index === 0 || isSubmitting} onPress={() => itemsField.swapValues(index, index - 1)} aria-label={intl.formatMessage({ id: 'inbound_transaction_form_moveup', defaultMessage: 'Move up' })}>
                                    <Icon icon="solar:arrow-up-linear" className="size-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" isIconOnly isDisabled={index === itemsField.state.value.length - 1 || isSubmitting} onPress={() => itemsField.swapValues(index, index + 1)} aria-label={intl.formatMessage({ id: 'inbound_transaction_form_movedown', defaultMessage: 'Move down' })}>
                                    <Icon icon="solar:arrow-down-linear" className="size-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" isIconOnly isDisabled={isSubmitting} onPress={() => itemsField.removeValue(index)} aria-label={intl.formatMessage({ id: 'inbound_transaction_form_removeitem', defaultMessage: 'Remove' })}>
                                    <Icon icon="solar:trash-bin-trash-linear" className="size-4 text-danger" />
                                  </Button>
                                </div>
                              </Table.Cell>
                            </Table.Row>
                          );
                        })}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              </Card.Content>
            </Card>
          )}
        </form.Field>

        <div className="flex justify-end gap-2">
          <Button isDisabled={isSubmitting} onPress={() => navigate('/transactions/inbound')} className="bg-danger text-danger-foreground" aria-label={intl.formatMessage({ id: 'inbound_transaction_form_cancel', defaultMessage: 'Cancel' })}>
            <Icon icon="solar:close-circle-linear" className="size-4" />
            <span className="hidden md:block">{intl.formatMessage({ id: 'inbound_transaction_form_cancel', defaultMessage: 'Cancel' })}</span>
          </Button>
          <Button isDisabled={isSubmitting || !canSave} onPress={() => handleActionConfirm('DRAFT')} className="bg-primary text-primary-foreground" aria-label={intl.formatMessage({ id: 'inbound_transaction_form_savedraft', defaultMessage: 'Save Draft' })}>
            <Icon icon="mdi:content-save" className="size-4" />
            <span className="hidden md:block">{intl.formatMessage({ id: 'inbound_transaction_form_savedraft', defaultMessage: 'Save Draft' })}</span>
          </Button>
          <Button isDisabled={isSubmitting || !canSave} onPress={() => handleActionConfirm('PENDING')} className="bg-warning text-warning-foreground" aria-label={intl.formatMessage({ id: 'inbound_transaction_form_propose', defaultMessage: 'Propose' })}>
            <Icon icon="mdi:send" className="size-4" />
            <span className="hidden md:block">{intl.formatMessage({ id: 'inbound_transaction_form_propose', defaultMessage: 'Propose' })}</span>
          </Button>
        </div>

        {/* ── Single action modal: confirm → loading → success/error ──── */}
        <Modal onOpenChange={(open) => { if (!open) handleModalClose(); }}>
          <Modal.Backdrop
            isOpen={modalStage !== 'idle'}
            isDismissable={modalStage !== 'loading'}
            isKeyboardDismissDisabled={modalStage === 'loading'}
            aria-label={intl.formatMessage({ id: 'modal_close', defaultMessage: 'Close modal' })}
          >
            <Modal.Container size="sm">
              <Modal.Dialog>
                {modalStage === 'loading' ? (
                  <>
                    <Modal.Header>
                      <Modal.Heading>
                        {intl.formatMessage({ id: 'inbound_transaction_form_processing_title', defaultMessage: 'Saving transaction' })}
                      </Modal.Heading>
                    </Modal.Header>
                    <Modal.Body className="flex flex-col items-center gap-4 py-8">
                      <Spinner size="lg" />
                      <p className="text-sm text-muted">
                        {intl.formatMessage({ id: 'inbound_transaction_form_processing_desc', defaultMessage: 'Please wait…' })}
                      </p>
                    </Modal.Body>
                  </>
                ) : modalStage === 'success' ? (
                  <>
                    <Modal.Header>
                      <Modal.Icon>
                        <Icon icon="solar:check-circle-bold" className="size-12 text-success" />
                      </Modal.Icon>
                      <Modal.Heading>
                        {intl.formatMessage({ id: 'inbound_transaction_form_result_success_title', defaultMessage: 'Success' })}
                      </Modal.Heading>
                    </Modal.Header>
                    <Modal.Body>
                      <p className="text-center text-sm text-muted">{resultMessage}</p>
                      <p className="mt-2 text-center text-sm text-muted">
                        {intl.formatMessage({ id: 'inbound_transaction_form_result_redirect', defaultMessage: 'Returning to transactions…' })}
                      </p>
                    </Modal.Body>
                    <Modal.Footer>
                      <Button onPress={handleModalClose}>
                        {intl.formatMessage({ id: 'inbound_transaction_form_result_close', defaultMessage: 'Close' })}
                      </Button>
                    </Modal.Footer>
                  </>
                ) : modalStage === 'error' ? (
                  <>
                    <Modal.Header>
                      <Modal.Icon>
                        <Icon icon="solar:close-circle-bold" className="size-12 text-danger" />
                      </Modal.Icon>
                      <Modal.Heading>
                        {intl.formatMessage({ id: 'inbound_transaction_form_result_error_title', defaultMessage: 'Something went wrong' })}
                      </Modal.Heading>
                    </Modal.Header>
                    <Modal.Body>
                      <p className="text-center text-sm text-muted">{resultMessage}</p>
                    </Modal.Body>
                    <Modal.Footer>
                      <Button onPress={handleModalClose}>
                        {intl.formatMessage({ id: 'inbound_transaction_form_result_close', defaultMessage: 'Close' })}
                      </Button>
                    </Modal.Footer>
                  </>
                ) : (
                  // confirm-draft or confirm-propose
                  <>
                    <Modal.Header>
                      <Modal.Icon>
                        <Icon
                          icon={modalStage === 'confirm-propose' ? 'mdi:send' : 'mdi:content-save'}
                          className={`size-10 ${modalStage === 'confirm-propose' ? 'text-warning' : 'text-accent'}`}
                        />
                      </Modal.Icon>
                      <Modal.Heading>
                        {modalStage === 'confirm-propose'
                          ? intl.formatMessage({ id: 'inbound_transaction_form_propose_confirm_title', defaultMessage: 'Confirm propose' })
                          : intl.formatMessage({ id: 'inbound_transaction_form_savedraft_confirm_title', defaultMessage: 'Confirm save draft' })}
                      </Modal.Heading>
                    </Modal.Header>
                    <Modal.Body>
                      <p className="text-sm text-muted">
                        {modalStage === 'confirm-propose'
                          ? intl.formatMessage({ id: 'inbound_transaction_form_propose_confirm_description', defaultMessage: 'Send this transaction for approval and change its status to pending?' })
                          : intl.formatMessage({ id: 'inbound_transaction_form_savedraft_confirm_description', defaultMessage: 'Save this transaction as a draft so you can edit it later?' })}
                      </p>
                    </Modal.Body>
                    <Modal.Footer>
                      <Button variant="ghost" onPress={handleModalClose}>
                        {intl.formatMessage({ id: 'inbound_transaction_form_confirm_cancel', defaultMessage: 'Cancel' })}
                      </Button>
                      <Button onPress={handleConfirmSubmit}>
                        {modalStage === 'confirm-propose'
                          ? intl.formatMessage({ id: 'inbound_transaction_form_confirm_send', defaultMessage: 'Send for approval' })
                          : intl.formatMessage({ id: 'inbound_transaction_form_confirm_save', defaultMessage: 'Confirm' })}
                      </Button>
                    </Modal.Footer>
                  </>
                )}
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      </section>
    </Form>
  );
};

// ─── Outer component (handles queries + loading guard) ────────────────────
export const InboundTransactionFormPage = () => {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const detailQuery = useQuery({
    queryKey: ['inboundTransactionDetail', id],
    queryFn: () => trpcClient.inboundTransaction.detail.query({ id: id! }),
    enabled: isEdit && Boolean(id),
  });

  const skuListQuery = useQuery({
    queryKey: ['skuListForFormWithPalletTypes'],
    queryFn: () => trpcClient.sku.listWithPalletTypes.query({ limit: 100 }),
  });

  const isLoading = (isEdit && detailQuery.isLoading) || skuListQuery.isLoading;

  if (isLoading) {
    return (
      <Modal isOpen>
        <Modal.Backdrop isOpen variant="transparent" isDismissable={false}>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{intl.formatMessage({ id: 'inbound_transaction_form_loading_title', defaultMessage: 'Loading transaction' })}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-4 py-6 text-center">
                <div className="flex justify-center">
                  <Spinner size="lg" />
                </div>
                <p className="text-sm text-muted">
                  {intl.formatMessage({ id: 'inbound_transaction_form_loading_description', defaultMessage: 'Waiting for query data…' })}
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onPress={() => navigate('/transactions')}>
                  {intl.formatMessage({ id: 'inbound_transaction_form_loading_back', defaultMessage: 'Back' })}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    );
  }

  return (
    <InboundTransactionForm
      id={id}
      isEdit={isEdit}
      initialValues={isEdit && detailQuery.data ? transformDetailToFormValues(detailQuery.data as any) : null}
      skuList={(skuListQuery.data?.data ?? []) as SkuListItem[]}
    />
  );
};

export default InboundTransactionFormPage;
