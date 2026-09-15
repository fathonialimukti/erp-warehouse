import { useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useIntl } from 'react-intl';
import { useForm } from '@tanstack/react-form';
import { Button, Card, FieldError, FieldGroup, Fieldset, FieldsetLegend, Form, Input, Label, ListBox, Modal, NumberField, Select, Spinner, Table, TextArea, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trpcClient } from '../../../lib/trpc';
import { hasPermissionAtom } from '../../../lib/atoms';
import { useAiFillForm } from '../../../components/AiAssistant/useAiFillForm';
import { AiFillButton } from '../../../components/AiFill/AiFillButton';
import { AiFillPanel } from '../../../components/AiFill/AiFillPanel';
import { SkuSelectSearch } from '../../../components/SkuSelectSearch';
import { FormDatePicker } from '../../../components/FormDatePicker';
import { PageHeader } from '../../../components/PageHeader';
import { UnsavedChangesBadge } from '../../../components/UnsavedChangesBadge';
import { fromDateToLocal, getLocalTimeZone, today } from '@internationalized/date';
import { wipCompletionFormSchema } from '@repo/schemas/wip-completion';

interface FormItem {
  _id: string | null;
  skuId: string;
  quantity: string;
  details: string;
}

function createFormItem(): FormItem {
  return { _id: null, skuId: '', quantity: '1', details: '' };
}

type FormValues = { documentNumber: string; date: any; workOrderRef: string; productionBatchNo: string; reference: string; notes: string; warehouseId: string; items: FormItem[]; };

const defaultFormValues = (): FormValues => ({ documentNumber: '', date: today(getLocalTimeZone()) as any, workOrderRef: '', productionBatchNo: '', reference: '', notes: '', warehouseId: '', items: [createFormItem()] });

const transformDetailToFormValues = (d: any): FormValues => {
  const items: FormItem[] = (d.items?.length ?? 0) > 0
    ? d.items.map((item: any) => ({
        _id: item._id ?? null,
        skuId: String(item.skuId ?? ''),
        quantity: String(item.quantity ?? '1'),
        details: String(item.details ?? ''),
      }))
    : [createFormItem()];
  return { documentNumber: d.documentNumber ?? '', date: d.date ? fromDateToLocal(new Date(d.date)) : today(getLocalTimeZone()), workOrderRef: d.workOrderRef ?? '', productionBatchNo: d.productionBatchNo ?? '', reference: d.reference ?? '', notes: d.notes ?? '', warehouseId: d.warehouseId ?? '', items };
};

interface Props { id?: string; isEdit: boolean; initialValues: FormValues | null; }

const WipCompletionForm = ({ id, isEdit, initialValues }: Props) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = isEdit ? hasPermission('wip-completion@update') : hasPermission('wip-completion@create');

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

  const { data: warehouseListData } = useQuery({ queryKey: ['warehouseOptions'], queryFn: () => trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 999 }) });
  const warehouses = (warehouseListData as any)?.data ?? (warehouseListData as any)?.items ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: any) => trpcClient.wipCompletion.create.mutate(payload),
    onSuccess: (data: any) => { queryClient.invalidateQueries({ queryKey: ['wipCompletionList'] }); const detailId = data?.id ?? id; setSuccessDetailId(detailId ?? null); setResultMessage(intl.formatMessage({ id: 'wip_completion.form_create_success', defaultMessage: 'WIP completion created.' })); setModalStage('success'); clearTimer(); resultTimerRef.current = window.setTimeout(() => navigate(`/inbound-transaction/wip-completion/${detailId}`), 1500); },
    onError: (err: Error) => { setResultMessage(err.message); setModalStage('error'); },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: any) => trpcClient.wipCompletion.update.mutate(payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wipCompletionDetail', id] }); queryClient.invalidateQueries({ queryKey: ['wipCompletionList'] }); setResultMessage(intl.formatMessage({ id: 'wip_completion.form_update_success', defaultMessage: 'WIP completion updated.' })); setModalStage('success'); clearTimer(); resultTimerRef.current = window.setTimeout(() => navigate(`/inbound-transaction/wip-completion/${id}`), 1500); },
    onError: (err: Error) => { setResultMessage(err.message); setModalStage('error'); },
  });

  const form = useForm({
    defaultValues: initialValues ?? defaultFormValues(),
    validators: { onChange: ({ value }: { value: FormValues }) => wipCompletionFormSchema.safeParse(value) },
    onSubmit: async ({ value }: { value: FormValues }) => {
      const approvalStatus = intentRef.current;
      const dateJs = value.date?.toDate ? value.date.toDate(getLocalTimeZone()) : new Date();
      const items = (value.items as FormItem[]).map((item) => ({
        skuId: item.skuId,
        quantity: Number(item.quantity),
        details: item.details || undefined,
      }));
      const payload: any = { documentNumber: value.documentNumber || undefined, date: dateJs, workOrderRef: value.workOrderRef || undefined, productionBatchNo: value.productionBatchNo || undefined, reference: value.reference || undefined, notes: value.notes || undefined, warehouseId: value.warehouseId, approvalStatus, message: approvalMessage || undefined, items, approvalHistory: [] };
      if (isEdit && id) await updateMutation.mutateAsync({ ...payload, id });
      else await createMutation.mutateAsync(payload);
    },
  });

  const isSubmitting = modalStage === 'loading';

  useAiFillForm({
    documentNumber:     (v) => form.setFieldValue('documentNumber', String(v)),
    workOrderRef:       (v) => form.setFieldValue('workOrderRef', String(v)),
    productionBatchNo:  (v) => form.setFieldValue('productionBatchNo', String(v)),
    reference:          (v) => form.setFieldValue('reference', String(v)),
    notes:              (v) => form.setFieldValue('notes', String(v)),
    warehouseId:        (v) => form.setFieldValue('warehouseId', String(v)),
    items: (v) => {
      if (!Array.isArray(v)) return;
      const items = v.map((item: any) => ({
        _id: item._id ?? null,
        skuId: String(item.skuId ?? ''),
        quantity: String(item.quantity ?? '1'),
        details: String(item.details ?? ''),
      }));
      form.setFieldValue('items', items.length > 0 ? items : [createFormItem()]);
    },
  });

  const handleActionConfirm = (status: 'DRAFT' | 'PROPOSED') => { intentRef.current = status; setModalStage(status === 'DRAFT' ? 'confirm-draft' : 'confirm-propose'); };
  const handleConfirmSubmit = async () => { setModalStage('loading'); await form.handleSubmit(); };

  return (
    <Form>
      <PageHeader title={isEdit ? intl.formatMessage({ id: 'wip_completion.form_edit_title', defaultMessage: 'Edit WIP Completion' }) : intl.formatMessage({ id: 'wip_completion.form_new_title', defaultMessage: 'New WIP Completion' })} onBack={() => navigate('/inbound-transaction')}><AiFillButton /></PageHeader>
      <AiFillPanel />
      <section
        className="space-y-6"
        data-ai-context={JSON.stringify({
          section: 'wip-completion-form',
          mode: isEdit ? 'edit' : 'create',
          transactionId: isEdit ? id : undefined,
          fields: ['documentNumber', 'date', 'warehouseId', 'workOrderRef', 'productionBatchNo', 'reference', 'notes', 'items'],
          availableWarehouses: warehouses.map((w: any) => ({ id: w.id, label: w.name })),
        })}
      >
        <Fieldset>
          <FieldsetLegend>{intl.formatMessage({ id: 'wip_completion.form_section_general', defaultMessage: 'General Information' })}</FieldsetLegend>
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <form.Field name="documentNumber">{(field) => (<TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}><Label>{intl.formatMessage({ id: 'wip_completion.form_document_number', defaultMessage: 'Document Number' })}</Label><Input variant="secondary" placeholder={intl.formatMessage({ id: 'wip_completion.form_document_number_placeholder', defaultMessage: 'Auto-generated if blank' })} /></TextField>)}</form.Field>
              <form.Field name="date">{(field) => (<FormDatePicker label={intl.formatMessage({ id: 'wip_completion.form_date', defaultMessage: 'Date' })} value={field.state.value} onChange={field.handleChange} isDisabled={isSubmitting} />)}</form.Field>
              <form.Field name="warehouseId" validators={{ onChange: ({ value }) => !value ? intl.formatMessage({ id: 'wip_completion.form_warehouse_required', defaultMessage: 'Warehouse is required' }) : undefined }}>
                {(field) => (<Select isRequired isDisabled={isSubmitting} selectedKey={field.state.value || null} onSelectionChange={(key) => field.handleChange(key ? String(key) : '')} isInvalid={field.state.meta.errors.length > 0} placeholder={intl.formatMessage({ id: 'wip_completion.form_warehouse_placeholder', defaultMessage: 'Select warehouse' })} aria-label={intl.formatMessage({ id: 'wip_completion.form_warehouse', defaultMessage: 'Warehouse' })}><Label>{intl.formatMessage({ id: 'wip_completion.form_warehouse', defaultMessage: 'Warehouse' })}</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox>{warehouses.map((w: any) => (<ListBox.Item key={w.id} id={w.id}>{w.name}</ListBox.Item>))}</ListBox></Select.Popover></Select>)}
              </form.Field>
              <form.Field name="workOrderRef">{(field) => (<TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}><Label>{intl.formatMessage({ id: 'wip_completion.form_work_order_ref', defaultMessage: 'Work Order Ref' })}</Label><Input variant="secondary" placeholder={intl.formatMessage({ id: 'wip_completion.form_work_order_ref_placeholder', defaultMessage: 'Work order reference' })} /></TextField>)}</form.Field>
              <form.Field name="productionBatchNo">{(field) => (<TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}><Label>{intl.formatMessage({ id: 'wip_completion.form_production_batch_no', defaultMessage: 'Production Batch No' })}</Label><Input variant="secondary" placeholder={intl.formatMessage({ id: 'wip_completion.form_production_batch_no_placeholder', defaultMessage: 'Batch number' })} /></TextField>)}</form.Field>
              <form.Field name="reference">{(field) => (<TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}><Label>{intl.formatMessage({ id: 'wip_completion.form_reference', defaultMessage: 'Reference' })}</Label><Input variant="secondary" placeholder={intl.formatMessage({ id: 'wip_completion.form_reference_placeholder', defaultMessage: 'Reference number' })} /></TextField>)}</form.Field>
              <form.Field name="notes">{(field) => (<TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur} fullWidth><Label>{intl.formatMessage({ id: 'wip_completion.form_notes', defaultMessage: 'Notes' })}</Label><TextArea rows={4} variant="secondary" placeholder={intl.formatMessage({ id: 'wip_completion.form_notes_placeholder', defaultMessage: 'Add notes' })} /></TextField>)}</form.Field>
            </div>
          </FieldGroup>
        </Fieldset>

        <form.Field name="items">
          {(itemsField) => (
            <Card>
              <Card.Header className="flex items-center justify-between"><div><p className="text-base font-semibold">{intl.formatMessage({ id: 'wip_completion.form_items_title', defaultMessage: 'Items' })}</p></div><Button variant="secondary" isDisabled={isSubmitting} onPress={() => itemsField.pushValue(createFormItem())}><Icon icon="solar:add-circle-linear" className="size-4" />{intl.formatMessage({ id: 'wip_completion.form_add_item', defaultMessage: 'Add Item' })}</Button></Card.Header>
              <Card.Content>
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content aria-label={intl.formatMessage({ id: 'wip_completion.form_items_aria', defaultMessage: 'Transaction items' })}>
                  <Table.Header>
                    <Table.Column isRowHeader><span className="text-xs font-semibold">#</span></Table.Column>
                    <Table.Column><span className="text-xs font-semibold">{intl.formatMessage({ id: 'wip_completion.col_sku', defaultMessage: 'SKU' })}</span></Table.Column>
                    <Table.Column><span className="text-xs font-semibold">{intl.formatMessage({ id: 'wip_completion.col_details', defaultMessage: 'Details' })}</span></Table.Column>
                    <Table.Column><span className="text-xs font-semibold">{intl.formatMessage({ id: 'wip_completion.col_quantity', defaultMessage: 'Qty' })}</span></Table.Column>
                    <Table.Column><span className="text-xs font-semibold" /></Table.Column>
                  </Table.Header>
                  <Table.Body renderEmptyState={() => (<div className="flex flex-col items-center justify-center gap-3 py-10 text-center"><Icon icon="solar:box-linear" className="size-6 text-muted" /><span className="text-sm text-muted">{intl.formatMessage({ id: 'wip_completion.form_no_items', defaultMessage: 'No items. Click "Add Item" to start.' })}</span></div>)}>
                    {(itemsField.state.value as FormItem[]).map((item, index) => {
                      const rowId = item._id ?? `new-${index}`;
                      return (
                        <Table.Row key={rowId} id={rowId}>
                          <Table.Cell><span className="font-mono text-sm text-muted">{index + 1}</span></Table.Cell>
                          <Table.Cell>
                            <form.Field name={`items[${index}].skuId` as any} validators={{ onChange: ({ value }: { value: string }) => !value ? intl.formatMessage({ id: 'wip_completion.form_sku_required', defaultMessage: 'SKU is required' }) : undefined }}>
                              {(subField: any) => (
                                <SkuSelectSearch
                                  queryKeyBase={`${rowId}-sku`}
                                  value={subField.state.value || ''}
                                  onChange={(v: string) => subField.handleChange(String(v ?? ''))}
                                  ariaLabel={intl.formatMessage({ id: 'wip_completion.col_sku', defaultMessage: 'SKU' })}
                                  placeholder={intl.formatMessage({ id: 'wip_completion.form_sku_placeholder', defaultMessage: 'Select SKU' })}
                                  searchPlaceholder={intl.formatMessage({ id: 'wip_completion.form_sku_search', defaultMessage: 'Search SKU...' })}
                                  emptyLabel={intl.formatMessage({ id: 'wip_completion.form_sku_empty', defaultMessage: 'No SKU found' })}
                                  isDisabled={isSubmitting}
                                  isInvalid={subField.state.meta.errors.length > 0}
                                  errorMessage={subField.state.meta.errors.join(', ')}
                                />
                              )}
                            </form.Field>
                          </Table.Cell>

                          <Table.Cell><form.Field name={`items[${index}].details` as any}>{(subField: any) => (<TextField isDisabled={isSubmitting} value={subField.state.value} onChange={subField.handleChange} onBlur={subField.handleBlur} aria-label={intl.formatMessage({ id: 'wip_completion.col_details', defaultMessage: 'Details' })}><Input variant="secondary" placeholder={intl.formatMessage({ id: 'wip_completion.form_details_placeholder', defaultMessage: 'Item notes' })} /></TextField>)}</form.Field></Table.Cell>
                          <Table.Cell><form.Field name={`items[${index}].quantity` as any}>{(subField: any) => { const qty = Number(subField.state.value || '0'); return (<NumberField fullWidth variant="secondary" isDisabled={isSubmitting} isRequired minValue={1} step={1} value={qty} onChange={(v) => subField.handleChange(String(v ?? 1))} aria-label={intl.formatMessage({ id: 'wip_completion.col_quantity', defaultMessage: 'Qty' })} isInvalid={qty < 1}><Label>{intl.formatMessage({ id: 'wip_completion.col_quantity', defaultMessage: 'Qty' })}</Label><NumberField.Group><NumberField.DecrementButton /><NumberField.Input /><NumberField.IncrementButton /></NumberField.Group><FieldError>{qty < 1 ? intl.formatMessage({ id: 'wip_completion.form_qty_rule', defaultMessage: 'Must be at least 1' }) : ''}</FieldError></NumberField>); }}</form.Field></Table.Cell>
                          <Table.Cell><div className="flex items-center gap-1"><Button size="sm" variant="ghost" isIconOnly isDisabled={index === 0 || isSubmitting} onPress={() => itemsField.swapValues(index, index - 1)} aria-label="Move up"><Icon icon="solar:arrow-up-linear" className="size-4" /></Button><Button size="sm" variant="ghost" isIconOnly isDisabled={index === (itemsField.state.value as FormItem[]).length - 1 || isSubmitting} onPress={() => itemsField.swapValues(index, index + 1)} aria-label="Move down"><Icon icon="solar:arrow-down-linear" className="size-4" /></Button><Button size="sm" variant="ghost" isIconOnly isDisabled={isSubmitting} onPress={() => itemsField.removeValue(index)} aria-label="Remove"><Icon icon="solar:trash-bin-trash-linear" className="size-4 text-danger" /></Button></div></Table.Cell>
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

        {canSave && (<div className="flex items-center justify-end gap-2">{isEdit && form.state.isDirty ? <UnsavedChangesBadge className="mr-auto" /> : null}<Button variant="ghost" isDisabled={isSubmitting} onPress={() => handleActionConfirm('DRAFT')}><Icon icon="solar:floppy-disk-linear" className="size-4" />{intl.formatMessage({ id: 'wip_completion.form_save_draft', defaultMessage: 'Save Draft' })}</Button><Button isDisabled={isSubmitting} onPress={() => handleActionConfirm('PROPOSED')}><Icon icon="solar:send-linear" className="size-4" />{intl.formatMessage({ id: 'wip_completion.form_propose', defaultMessage: 'Propose' })}</Button></div>)}
      </section>

      <Modal><Modal.Backdrop isOpen={modalStage !== 'idle'} onOpenChange={(open) => { if (!open) handleModalClose(); }} isDismissable={modalStage !== 'loading'} isKeyboardDismissDisabled={modalStage === 'loading'}><Modal.Container size="sm"><Modal.Dialog>
        {modalStage === 'loading' ? (<><Modal.Header><Modal.Heading>{intl.formatMessage({ id: 'wip_completion.form_saving', defaultMessage: 'Saving…' })}</Modal.Heading></Modal.Header><Modal.Body className="flex flex-col items-center gap-4 py-8"><Spinner size="lg" /></Modal.Body></>)
          : modalStage === 'success' ? (<><Modal.Header><Modal.Icon><Icon icon="solar:check-circle-bold" className="size-12 text-success" /></Modal.Icon><Modal.Heading>{intl.formatMessage({ id: 'wip_completion.form_success_title', defaultMessage: 'Saved' })}</Modal.Heading></Modal.Header><Modal.Body><p className="text-center text-sm text-muted">{resultMessage}</p></Modal.Body><Modal.Footer><Button onPress={() => navigate(`/inbound-transaction/wip-completion/${successDetailId ?? id}`)}>{intl.formatMessage({ id: 'wip_completion.form_view_detail', defaultMessage: 'View Detail' })}</Button></Modal.Footer></>)
          : modalStage === 'error' ? (<><Modal.Header><Modal.Icon><Icon icon="solar:close-circle-bold" className="size-12 text-danger" /></Modal.Icon><Modal.Heading>{intl.formatMessage({ id: 'wip_completion.form_error_title', defaultMessage: 'Error' })}</Modal.Heading></Modal.Header><Modal.Body><p className="text-center text-sm text-muted">{resultMessage}</p></Modal.Body><Modal.Footer><Button onPress={handleModalClose}>{intl.formatMessage({ id: 'wip_completion.form_close', defaultMessage: 'Close' })}</Button></Modal.Footer></>)
          : (<><Modal.Header><Modal.Icon><Icon icon={intentRef.current === 'PROPOSED' ? 'solar:send-linear' : 'solar:floppy-disk-linear'} className="size-10" /></Modal.Icon><Modal.Heading>{intentRef.current === 'PROPOSED' ? intl.formatMessage({ id: 'wip_completion.form_confirm_propose', defaultMessage: 'Confirm Propose' }) : intl.formatMessage({ id: 'wip_completion.form_confirm_draft', defaultMessage: 'Confirm Save Draft' })}</Modal.Heading></Modal.Header><Modal.Body className="space-y-4"><p className="text-sm text-muted">{intentRef.current === 'PROPOSED' ? intl.formatMessage({ id: 'wip_completion.form_confirm_propose_desc', defaultMessage: 'Propose this transaction?' }) : intl.formatMessage({ id: 'wip_completion.form_confirm_draft_desc', defaultMessage: 'Save as draft?' })}</p>{intentRef.current === 'PROPOSED' && (<TextField fullWidth><Label>{intl.formatMessage({ id: 'wip_completion.form_message_label', defaultMessage: 'Message' })}</Label><TextArea rows={3} variant="secondary" value={approvalMessage} onChange={(e) => setApprovalMessage(e.target.value)} placeholder={intl.formatMessage({ id: 'wip_completion.form_message_placeholder', defaultMessage: 'Add a note (optional)' })} /></TextField>)}</Modal.Body><Modal.Footer><Button variant="ghost" onPress={handleModalClose}>{intl.formatMessage({ id: 'wip_completion.form_cancel', defaultMessage: 'Cancel' })}</Button><Button onPress={() => void handleConfirmSubmit()}>{intl.formatMessage({ id: 'wip_completion.form_confirm', defaultMessage: 'Confirm' })}</Button></Modal.Footer></>)}
      </Modal.Dialog></Modal.Container></Modal.Backdrop></Modal>
    </Form>
  );
};

const WipCompletionFormPage = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { data: detailData, isLoading: detailLoading } = useQuery({ queryKey: ['wipCompletionDetail', id], queryFn: () => trpcClient.wipCompletion.detail.query({ id: id! }), enabled: isEdit });
  const detail = detailData as any;
  const initialValues = isEdit && detail ? transformDetailToFormValues(detail) : null;
  if (isEdit && detailLoading) return (<div className="flex min-h-72 flex-col items-center justify-center gap-4"><Spinner size="lg" /></div>);
  if (isEdit && !detail) return (<p className="text-sm text-danger">Transaction not found.</p>);
  if (isEdit && detail && !['DRAFT', 'REJECTED'].includes(detail.approvalStatus)) return (<p className="text-sm text-warning">This transaction cannot be edited in its current state.</p>);
  return <WipCompletionForm id={id} isEdit={isEdit} initialValues={initialValues} />;
};

export { WipCompletionFormPage };
