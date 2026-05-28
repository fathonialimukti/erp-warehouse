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
import { foundTransactionFormSchema } from '@repo/schemas/transaction-found';

interface FormItem { _id: string | null; skuId: string; palletTypeId: string; quantity: string; details: string; }
const createFormItem = (): FormItem => ({ _id: null, skuId: '', palletTypeId: '', quantity: '1', details: '' });

type FormValues = { documentNumber: string; date: any; foundReason: string; foundLocation: string; reference: string; notes: string; warehouseId: string; items: FormItem[]; };

const defaultFormValues = (): FormValues => ({ documentNumber: '', date: today(getLocalTimeZone()) as any, foundReason: '', foundLocation: '', reference: '', notes: '', warehouseId: '', items: [createFormItem()] });

const transformDetailToFormValues = (d: any): FormValues => {
  const items: FormItem[] = (d.items?.length ?? 0) > 0 ? d.items.map((item: any) => ({ _id: item.id ?? null, skuId: item.skuId, palletTypeId: item.palletTypeId ?? '', quantity: String(item.quantity), details: item.details ?? '' })) : [createFormItem()];
  return { documentNumber: d.documentNumber ?? '', date: d.date ? fromDateToLocal(new Date(d.date)) : today(getLocalTimeZone()), foundReason: d.foundReason ?? '', foundLocation: d.foundLocation ?? '', reference: d.reference ?? '', notes: d.notes ?? '', warehouseId: d.warehouseId ?? '', items };
};

interface Props { id?: string; isEdit: boolean; initialValues: FormValues | null; }

const FoundTransactionForm = ({ id, isEdit, initialValues }: Props) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = isEdit ? hasPermission('found@update') : hasPermission('found@create');

  type ModalStage = 'idle' | 'confirm-draft' | 'confirm-propose' | 'loading' | 'success' | 'error';
  const intentRef = useRef<'DRAFT' | 'PROPOSED'>('DRAFT');
  const [modalStage, setModalStage] = useState<ModalStage>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const [approvalMessage, setApprovalMessage] = useState('');
  const [successDetailId, setSuccessDetailId] = useState<string | null>(null);
  const resultTimerRef = useRef<number | null>(null);
  const clearTimer = () => { if (resultTimerRef.current !== null) { window.clearTimeout(resultTimerRef.current); resultTimerRef.current = null; } };
  const handleModalClose = () => { if (modalStage === 'loading') return; clearTimer(); setApprovalMessage(''); setModalStage('idle'); };
  useEffect(() => () => clearTimer(), []);

  const { data: warehouseListData } = useQuery({ queryKey: ['warehouseList'], queryFn: () => trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 100 }) });
  const warehouses = (warehouseListData as any)?.data ?? (warehouseListData as any)?.items ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: any) => trpcClient.foundTransaction.create.mutate(payload),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['foundTransactionList'] });
      const detailId = data?.id ?? id;
      setSuccessDetailId(detailId ?? null);
      setResultMessage(intl.formatMessage({ id: 'found_transaction.form_create_success', defaultMessage: 'Found transaction created.' }));
      setModalStage('success');
      clearTimer();
      resultTimerRef.current = window.setTimeout(() => navigate(`/inbound-transaction/found/${detailId}`), 1500);
    },
    onError: (err: Error) => { setResultMessage(err.message); setModalStage('error'); },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: any) => trpcClient.foundTransaction.update.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['foundTransactionList'] });
      setResultMessage(intl.formatMessage({ id: 'found_transaction.form_update_success', defaultMessage: 'Found transaction updated.' }));
      setModalStage('success');
      clearTimer();
      resultTimerRef.current = window.setTimeout(() => navigate(`/inbound-transaction/found/${id}`), 1500);
    },
    onError: (err: Error) => { setResultMessage(err.message); setModalStage('error'); },
  });

  const form = useForm({
    defaultValues: initialValues ?? defaultFormValues(),
    validators: { onChange: ({ value }: { value: FormValues }) => foundTransactionFormSchema.safeParse(value) },
    onSubmit: async ({ value }: { value: FormValues }) => {
      const approvalStatus = intentRef.current;
      const dateJs = value.date?.toDate ? value.date.toDate(getLocalTimeZone()) : new Date();
      const items = (value.items as FormItem[]).map((item) => ({ skuId: item.skuId, palletTypeId: item.palletTypeId, quantity: Number(item.quantity), details: item.details || undefined }));
      const payload: any = { documentNumber: value.documentNumber || undefined, date: dateJs, foundReason: value.foundReason || undefined, foundLocation: value.foundLocation || undefined, reference: value.reference || undefined, notes: value.notes || undefined, warehouseId: value.warehouseId, approvalStatus, message: approvalMessage || undefined, items, approvalHistory: [] };
      if (isEdit && id) await updateMutation.mutateAsync({ ...payload, id });
      else await createMutation.mutateAsync(payload);
    },
  });

  const isSubmitting = modalStage === 'loading';

  useAiFillForm({
    documentNumber: (v) => form.setFieldValue('documentNumber', String(v)),
    foundReason:    (v) => form.setFieldValue('foundReason', String(v)),
    foundLocation:  (v) => form.setFieldValue('foundLocation', String(v)),
    reference:      (v) => form.setFieldValue('reference', String(v)),
    notes:          (v) => form.setFieldValue('notes', String(v)),
    warehouseId:    (v) => form.setFieldValue('warehouseId', String(v)),
  });

  const handleActionConfirm = (status: 'DRAFT' | 'PROPOSED') => { intentRef.current = status; setModalStage(status === 'DRAFT' ? 'confirm-draft' : 'confirm-propose'); };
  const handleConfirmSubmit = async () => { setModalStage('loading'); await form.handleSubmit(); };

  return (
    <Form>
      <PageHeader
        title={isEdit ? intl.formatMessage({ id: 'found_transaction.form_edit_title', defaultMessage: 'Edit Found Transaction' }) : intl.formatMessage({ id: 'found_transaction.form_new_title', defaultMessage: 'New Found Transaction' })}
        onBack={() => navigate('/inbound-transaction')}
      />
      <section
        className="space-y-6"
        data-ai-context={JSON.stringify({
          section: 'found-transaction-form',
          mode: isEdit ? 'edit' : 'create',
          transactionId: isEdit ? id : undefined,
          fields: ['documentNumber', 'date', 'warehouseId', 'foundReason', 'foundLocation', 'reference', 'notes', 'items'],
        })}
      >
        <Fieldset>
          <FieldsetLegend>{intl.formatMessage({ id: 'found_transaction.form_section_general', defaultMessage: 'General Information' })}</FieldsetLegend>
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <form.Field name="documentNumber">{(field) => (<TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}><Label>{intl.formatMessage({ id: 'found_transaction.form_document_number', defaultMessage: 'Document Number' })}</Label><Input variant="secondary" placeholder={intl.formatMessage({ id: 'found_transaction.form_document_number_placeholder', defaultMessage: 'Auto-generated if blank' })} /></TextField>)}</form.Field>
              <form.Field name="date">{(field) => (<FormDatePicker label={intl.formatMessage({ id: 'found_transaction.form_date', defaultMessage: 'Date' })} value={field.state.value} onChange={field.handleChange} isDisabled={isSubmitting} />)}</form.Field>
              <form.Field name="warehouseId" validators={{ onChange: ({ value }) => !value ? intl.formatMessage({ id: 'found_transaction.form_warehouse_required', defaultMessage: 'Warehouse is required' }) : undefined }}>
                {(field) => (<Select isRequired isDisabled={isSubmitting} selectedKey={field.state.value || null} onSelectionChange={(key) => field.handleChange(key ? String(key) : '')} isInvalid={field.state.meta.errors.length > 0} placeholder={intl.formatMessage({ id: 'found_transaction.form_warehouse_placeholder', defaultMessage: 'Select warehouse' })} aria-label={intl.formatMessage({ id: 'found_transaction.form_warehouse', defaultMessage: 'Warehouse' })}><Label>{intl.formatMessage({ id: 'found_transaction.form_warehouse', defaultMessage: 'Warehouse' })}</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox>{warehouses.map((w: any) => (<ListBox.Item key={w.id} id={w.id}>{w.name}</ListBox.Item>))}</ListBox></Select.Popover></Select>)}
              </form.Field>
              <form.Field name="foundReason">{(field) => (<TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}><Label>{intl.formatMessage({ id: 'found_transaction.form_found_reason', defaultMessage: 'Found Reason' })}</Label><Input variant="secondary" placeholder={intl.formatMessage({ id: 'found_transaction.form_found_reason_placeholder', defaultMessage: 'Describe the reason' })} /></TextField>)}</form.Field>
              <form.Field name="foundLocation">{(field) => (<TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}><Label>{intl.formatMessage({ id: 'found_transaction.form_found_location', defaultMessage: 'Found Location' })}</Label><Input variant="secondary" placeholder={intl.formatMessage({ id: 'found_transaction.form_found_location_placeholder', defaultMessage: 'Location where found' })} /></TextField>)}</form.Field>
              <form.Field name="reference">{(field) => (<TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}><Label>{intl.formatMessage({ id: 'found_transaction.form_reference', defaultMessage: 'Reference' })}</Label><Input variant="secondary" placeholder={intl.formatMessage({ id: 'found_transaction.form_reference_placeholder', defaultMessage: 'Reference number' })} /></TextField>)}</form.Field>
              <form.Field name="notes">{(field) => (<TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur} fullWidth><Label>{intl.formatMessage({ id: 'found_transaction.form_notes', defaultMessage: 'Notes' })}</Label><TextArea rows={4} variant="secondary" placeholder={intl.formatMessage({ id: 'found_transaction.form_notes_placeholder', defaultMessage: 'Add notes' })} /></TextField>)}</form.Field>
            </div>
          </FieldGroup>
        </Fieldset>

        <form.Field name="items">
          {(itemsField) => (
            <Card>
              <Card.Header className="flex items-center justify-between">
                <div><p className="text-base font-semibold">{intl.formatMessage({ id: 'found_transaction.form_items_title', defaultMessage: 'Items' })}</p></div>
                <Button variant="secondary" isDisabled={isSubmitting} onPress={() => itemsField.pushValue(createFormItem())}><Icon icon="solar:add-circle-linear" className="size-4" />{intl.formatMessage({ id: 'found_transaction.form_add_item', defaultMessage: 'Add Item' })}</Button>
              </Card.Header>
              <Card.Content>
                <Table aria-label={intl.formatMessage({ id: 'found_transaction.form_items_aria', defaultMessage: 'Transaction items' })}>
                  <Table.Header>
                    <Table.Column isRowHeader><span className="text-xs font-semibold">#</span></Table.Column>
                    <Table.Column><span className="text-xs font-semibold">{intl.formatMessage({ id: 'found_transaction.col_sku', defaultMessage: 'SKU' })}</span></Table.Column>
                    <Table.Column><span className="text-xs font-semibold">{intl.formatMessage({ id: 'found_transaction.col_pallet_type', defaultMessage: 'Pallet Type' })}</span></Table.Column>
                    <Table.Column><span className="text-xs font-semibold">{intl.formatMessage({ id: 'found_transaction.col_details', defaultMessage: 'Details' })}</span></Table.Column>
                    <Table.Column><span className="text-xs font-semibold">{intl.formatMessage({ id: 'found_transaction.col_quantity', defaultMessage: 'Qty' })}</span></Table.Column>
                    <Table.Column><span className="text-xs font-semibold" /></Table.Column>
                  </Table.Header>
                  <Table.Body renderEmptyState={() => (<div className="flex flex-col items-center justify-center gap-3 py-10 text-center"><Icon icon="solar:box-linear" className="size-6 text-muted" /><span className="text-sm text-muted">{intl.formatMessage({ id: 'found_transaction.form_no_items', defaultMessage: 'No items. Click "Add Item" to start.' })}</span></div>)}>
                    {(itemsField.state.value as FormItem[]).map((item, index) => {
                      const rowId = item._id ?? `new-${index}`;
                      return (
                        <Table.Row key={rowId} id={rowId}>
                          <Table.Cell><span className="font-mono text-sm text-muted">{index + 1}</span></Table.Cell>
                          <Table.Cell>
                            <form.Field name={`items[${index}].skuId` as any} validators={{ onChange: ({ value }: { value: string }) => !value ? intl.formatMessage({ id: 'found_transaction.form_sku_required', defaultMessage: 'SKU is required' }) : undefined }}>
                              {(subField: any) => (<SkuSelectSearch queryKeyBase={`${rowId}-sku`} value={subField.state.value || ''} onChange={(v) => { subField.handleChange(String(v ?? '')); (form.setFieldValue as any)(`items[${index}].palletTypeId`, ''); }} label={intl.formatMessage({ id: 'found_transaction.col_sku', defaultMessage: 'SKU' })} ariaLabel={intl.formatMessage({ id: 'found_transaction.col_sku', defaultMessage: 'SKU' })} placeholder={intl.formatMessage({ id: 'found_transaction.form_sku_placeholder', defaultMessage: 'Select SKU' })} searchPlaceholder={intl.formatMessage({ id: 'found_transaction.form_sku_search', defaultMessage: 'Search SKU...' })} emptyLabel={intl.formatMessage({ id: 'found_transaction.form_sku_empty', defaultMessage: 'No SKU found' })} isDisabled={isSubmitting} isInvalid={subField.state.meta.errors.length > 0} errorMessage={subField.state.meta.errors.join(', ')} />)}
                            </form.Field>
                          </Table.Cell>
                          <Table.Cell>
                            <form.Field name={`items[${index}].palletTypeId` as any} validators={{ onChange: ({ value }: { value: string }) => !value ? intl.formatMessage({ id: 'found_transaction.form_pallet_required', defaultMessage: 'Pallet type is required' }) : undefined }}>
                              {(subField: any) => (<PalletTypeSelectSearch queryKeyBase={`${rowId}-pallet`} isDisabled={isSubmitting || !item.skuId} value={subField.state.value || ''} isInvalid={subField.state.meta.errors.length > 0} onChange={(v) => subField.handleChange(String(v ?? ''))} skuId={item.skuId} ariaLabel={intl.formatMessage({ id: 'found_transaction.col_pallet_type', defaultMessage: 'Pallet Type' })} placeholder={intl.formatMessage({ id: 'found_transaction.form_pallet_placeholder', defaultMessage: 'Select pallet type' })} searchPlaceholder={intl.formatMessage({ id: 'found_transaction.form_pallet_search', defaultMessage: 'Search pallet type...' })} emptyLabel={intl.formatMessage({ id: 'found_transaction.form_pallet_empty', defaultMessage: 'No pallet type found' })} errorMessage={subField.state.meta.errors.join(', ')} />)}
                            </form.Field>
                          </Table.Cell>
                          <Table.Cell>
                            <form.Field name={`items[${index}].details` as any}>
                              {(subField: any) => (<TextField isDisabled={isSubmitting} value={subField.state.value} onChange={subField.handleChange} onBlur={subField.handleBlur} aria-label={intl.formatMessage({ id: 'found_transaction.col_details', defaultMessage: 'Details' })}><Input variant="secondary" placeholder={intl.formatMessage({ id: 'found_transaction.form_details_placeholder', defaultMessage: 'Item notes' })} /></TextField>)}
                            </form.Field>
                          </Table.Cell>
                          <Table.Cell>
                            <form.Field name={`items[${index}].quantity` as any}>
                              {(subField: any) => { const qty = Number(subField.state.value || '0'); return (<NumberField fullWidth variant="secondary" isDisabled={isSubmitting} isRequired minValue={1} step={1} value={qty} onChange={(v) => subField.handleChange(String(v ?? 1))} aria-label={intl.formatMessage({ id: 'found_transaction.col_quantity', defaultMessage: 'Qty' })} isInvalid={qty < 1}><Label>{intl.formatMessage({ id: 'found_transaction.col_quantity', defaultMessage: 'Qty' })}</Label><NumberField.Group><NumberField.DecrementButton /><NumberField.Input /><NumberField.IncrementButton /></NumberField.Group><FieldError>{qty < 1 ? intl.formatMessage({ id: 'found_transaction.form_qty_rule', defaultMessage: 'Must be at least 1' }) : ''}</FieldError></NumberField>); }}
                            </form.Field>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" isIconOnly isDisabled={index === 0 || isSubmitting} onPress={() => itemsField.swapValues(index, index - 1)} aria-label={intl.formatMessage({ id: 'found_transaction.form_move_up', defaultMessage: 'Move up' })}><Icon icon="solar:arrow-up-linear" className="size-4" /></Button>
                              <Button size="sm" variant="ghost" isIconOnly isDisabled={index === (itemsField.state.value as FormItem[]).length - 1 || isSubmitting} onPress={() => itemsField.swapValues(index, index + 1)} aria-label={intl.formatMessage({ id: 'found_transaction.form_move_down', defaultMessage: 'Move down' })}><Icon icon="solar:arrow-down-linear" className="size-4" /></Button>
                              <Button size="sm" variant="ghost" isIconOnly isDisabled={isSubmitting} onPress={() => itemsField.removeValue(index)} aria-label={intl.formatMessage({ id: 'found_transaction.form_remove_item', defaultMessage: 'Remove' })}><Icon icon="solar:trash-bin-trash-linear" className="size-4 text-danger" /></Button>
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

        {canSave && (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" isDisabled={isSubmitting} onPress={() => handleActionConfirm('DRAFT')}><Icon icon="solar:floppy-disk-linear" className="size-4" />{intl.formatMessage({ id: 'found_transaction.form_save_draft', defaultMessage: 'Save Draft' })}</Button>
            <Button isDisabled={isSubmitting} onPress={() => handleActionConfirm('PROPOSED')}><Icon icon="solar:send-linear" className="size-4" />{intl.formatMessage({ id: 'found_transaction.form_propose', defaultMessage: 'Propose' })}</Button>
          </div>
        )}
      </section>

      <Modal>
        <Modal.Backdrop isOpen={modalStage !== 'idle'} onOpenChange={(open) => { if (!open) handleModalClose(); }} isDismissable={modalStage !== 'loading'} isKeyboardDismissDisabled={modalStage === 'loading'}>
          <Modal.Container size="sm">
            <Modal.Dialog>
              {modalStage === 'loading' ? (<><Modal.Header><Modal.Heading>{intl.formatMessage({ id: 'found_transaction.form_saving', defaultMessage: 'Saving…' })}</Modal.Heading></Modal.Header><Modal.Body className="flex flex-col items-center gap-4 py-8"><Spinner size="lg" /></Modal.Body></>)
                : modalStage === 'success' ? (<><Modal.Header><Modal.Icon><Icon icon="solar:check-circle-bold" className="size-12 text-success" /></Modal.Icon><Modal.Heading>{intl.formatMessage({ id: 'found_transaction.form_success_title', defaultMessage: 'Saved' })}</Modal.Heading></Modal.Header><Modal.Body><p className="text-center text-sm text-muted">{resultMessage}</p></Modal.Body><Modal.Footer><Button onPress={() => navigate(`/inbound-transaction/found/${successDetailId ?? id}`)}>{intl.formatMessage({ id: 'found_transaction.form_view_detail', defaultMessage: 'View Detail' })}</Button></Modal.Footer></>)
                : modalStage === 'error' ? (<><Modal.Header><Modal.Icon><Icon icon="solar:close-circle-bold" className="size-12 text-danger" /></Modal.Icon><Modal.Heading>{intl.formatMessage({ id: 'found_transaction.form_error_title', defaultMessage: 'Error' })}</Modal.Heading></Modal.Header><Modal.Body><p className="text-center text-sm text-muted">{resultMessage}</p></Modal.Body><Modal.Footer><Button onPress={handleModalClose}>{intl.formatMessage({ id: 'found_transaction.form_close', defaultMessage: 'Close' })}</Button></Modal.Footer></>)
                : (<><Modal.Header><Modal.Icon><Icon icon={intentRef.current === 'PROPOSED' ? 'solar:send-linear' : 'solar:floppy-disk-linear'} className="size-10" /></Modal.Icon><Modal.Heading>{intentRef.current === 'PROPOSED' ? intl.formatMessage({ id: 'found_transaction.form_confirm_propose', defaultMessage: 'Confirm Propose' }) : intl.formatMessage({ id: 'found_transaction.form_confirm_draft', defaultMessage: 'Confirm Save Draft' })}</Modal.Heading></Modal.Header>
                  <Modal.Body className="space-y-4">
                    <p className="text-sm text-muted">{intentRef.current === 'PROPOSED' ? intl.formatMessage({ id: 'found_transaction.form_confirm_propose_desc', defaultMessage: 'Propose this transaction for approval?' }) : intl.formatMessage({ id: 'found_transaction.form_confirm_draft_desc', defaultMessage: 'Save as draft?' })}</p>
                    {intentRef.current === 'PROPOSED' && (<TextField fullWidth><Label>{intl.formatMessage({ id: 'found_transaction.form_message_label', defaultMessage: 'Message' })}</Label><TextArea rows={3} variant="secondary" value={approvalMessage} onChange={(e) => setApprovalMessage(e.target.value)} placeholder={intl.formatMessage({ id: 'found_transaction.form_message_placeholder', defaultMessage: 'Add a note (optional)' })} /></TextField>)}
                  </Modal.Body>
                  <Modal.Footer><Button variant="ghost" onPress={handleModalClose}>{intl.formatMessage({ id: 'found_transaction.form_cancel', defaultMessage: 'Cancel' })}</Button><Button onPress={() => void handleConfirmSubmit()}>{intl.formatMessage({ id: 'found_transaction.form_confirm', defaultMessage: 'Confirm' })}</Button></Modal.Footer></>)}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </Form>
  );
};

const FoundTransactionFormPage = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { data: detailData, isLoading: detailLoading } = useQuery({ queryKey: ['foundTransactionDetail', id], queryFn: () => trpcClient.foundTransaction.detail.query({ id: id! }), enabled: isEdit });
  const detail = detailData as any;
  const initialValues = isEdit && detail ? transformDetailToFormValues(detail) : null;
  if (isEdit && detailLoading) return (<div className="flex min-h-72 flex-col items-center justify-center gap-4"><Spinner size="lg" /></div>);
  if (isEdit && !detail) return (<p className="text-sm text-danger">Transaction not found.</p>);
  if (isEdit && detail && !['DRAFT', 'REJECTED'].includes(detail.approvalStatus)) return (<p className="text-sm text-warning">This transaction cannot be edited in its current state.</p>);
  return <FoundTransactionForm id={id} isEdit={isEdit} initialValues={initialValues} />;
};

export { FoundTransactionFormPage };
