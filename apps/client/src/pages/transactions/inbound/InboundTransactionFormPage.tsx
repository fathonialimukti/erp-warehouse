import { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { useForm } from '@tanstack/react-form';
import {
  Autocomplete,
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
  files: Array<{ name: string; type: string; size: number }>;
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
  const files: Array<{ name: string; type: string; size: number }> = Array.isArray(rawFiles)
    ? rawFiles.map((file: any) => ({ name: String(file?.name ?? ''), type: String(file?.type ?? ''), size: Number(file?.size ?? 0) }))
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
  const { contains } = useFilter({ sensitivity: 'base' });

  // ─── Action modal state machine ─────────────────────────────────────────
  type ModalStage = 'idle' | 'confirm-draft' | 'confirm-propose' | 'loading' | 'success' | 'error';
  const intentRef = useRef<'DRAFT' | 'PENDING'>('DRAFT');
  const [modalStage, setModalStage] = useState<ModalStage>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const resultTimerRef = useRef<number | null>(null);

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

  const isSubmitting = modalStage === 'loading' || createMutation.isPending || updateMutation.isPending;

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
                        onChange={(event) => {
                          const selected = Array.from(event.currentTarget.files ?? []);
                          field.handleChange(selected.map((f) => ({ name: f.name, type: f.type, size: f.size })));
                        }}
                      />
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
                          const rowId = item._id ?? `new-item-${index}`;
                          return (
                            <Table.Row key={rowId} id={rowId}>
                              <Table.Cell>
                                <span className="font-mono text-sm text-muted">{index + 1}</span>
                              </Table.Cell>

                              <Table.Cell>
                                <form.Field key={index} name={`items[${index}].skuId` as any}>
                                  {(subField: any) => (
                                    <Autocomplete
                                      fullWidth
                                      selectionMode="single"
                                      value={subField.state.value || null}
                                      isDisabled={isSubmitting}
                                      onChange={(value) => {
                                        subField.handleChange(String(value ?? ''));
                                        (form.setFieldValue as any)(`items[${index}].palletTypeId`, '');
                                      }}
                                      variant="secondary"
                                    >
                                      <Label className="sr-only">{intl.formatMessage({ id: 'inbound_transaction_form_col_sku', defaultMessage: 'SKU' })}</Label>
                                      <Autocomplete.Trigger>
                                        <Autocomplete.Value />
                                        <Autocomplete.ClearButton />
                                        <Autocomplete.Indicator />
                                      </Autocomplete.Trigger>
                                      <Autocomplete.Popover>
                                        <Autocomplete.Filter filter={contains}>
                                          <SearchField autoFocus name="skuSearch" variant="secondary">
                                            <SearchField.Group>
                                              <SearchField.SearchIcon />
                                              <SearchField.Input placeholder={intl.formatMessage({ id: 'inbound_transaction_form_sku_search', defaultMessage: 'Search SKU...' })} />
                                              <SearchField.ClearButton />
                                            </SearchField.Group>
                                          </SearchField>
                                          <ListBox renderEmptyState={() => <EmptyState>{intl.formatMessage({ id: 'inbound_transaction_form_sku_empty', defaultMessage: 'No SKU found' })}</EmptyState>}>
                                            {skuList.map((sku) => (
                                              <ListBox.Item key={sku.id} id={sku.id} textValue={`${sku.id} ${sku.name}`}>
                                                <div className="flex flex-col">
                                                  <Label>{sku.id}</Label>
                                                  <span className="text-xs text-muted">{sku.name}</span>
                                                </div>
                                                <ListBox.ItemIndicator />
                                              </ListBox.Item>
                                            ))}
                                          </ListBox>
                                        </Autocomplete.Filter>
                                      </Autocomplete.Popover>
                                    </Autocomplete>
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
                                      onChange={(v) => subField.handleChange(String(v ?? ''))}
                                      variant="secondary"
                                    >
                                      <Select.Trigger>
                                        <Select.Value />
                                        <Select.Indicator />
                                      </Select.Trigger>
                                      <Select.Popover>
                                        <ListBox>
                                          {palletTypesForItem.map((pt) => (
                                            <ListBox.Item key={pt.id} id={pt.id} textValue={pt.name}>
                                              {pt.name}
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
                                    <TextField isDisabled={isSubmitting} type="number" value={subField.state.value} onChange={subField.handleChange} onBlur={subField.handleBlur}>
                                      <Input variant="secondary" className="w-24" />
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
          <Button isDisabled={isSubmitting} onPress={() => navigate('/transactions/inbound')} className="bg-danger text-danger-foreground">
            <Icon icon="solar:close-circle-linear" className="size-4" />
            <span className="hidden md:block">{intl.formatMessage({ id: 'inbound_transaction_form_cancel', defaultMessage: 'Cancel' })}</span>
          </Button>
          <Button isDisabled={isSubmitting} onPress={() => handleActionConfirm('DRAFT')} className="bg-primary text-primary-foreground">
            <Icon icon="mdi:content-save" className="size-4" />
            <span className="hidden md:block">{intl.formatMessage({ id: 'inbound_transaction_form_savedraft', defaultMessage: 'Save Draft' })}</span>
          </Button>
          <Button isDisabled={isSubmitting} onPress={() => handleActionConfirm('PENDING')} className="bg-warning text-warning-foreground">
            <Icon icon="mdi:send" className="size-4" />
            <span className="hidden md:block">{intl.formatMessage({ id: 'inbound_transaction_form_propose', defaultMessage: 'Propose' })}</span>
          </Button>
        </div>

        {/* ── Single action modal: confirm → loading → success/error ──── */}
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
      <Modal isOpen onOpenChange={() => {}}>
        <Modal.Backdrop isOpen onOpenChange={() => {}} variant="transparent">
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
