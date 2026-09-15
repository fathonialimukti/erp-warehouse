import { useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useIntl } from 'react-intl';
import { useForm, useStore } from '@tanstack/react-form';
import { Button, Card, FieldGroup, Form, Input, Label, ListBox, Modal, Select, Spinner, Table, TextArea, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trpcClient } from '../../lib/trpc';
import { hasPermissionAtom } from '../../lib/atoms';
import { useAiFillForm } from '../../components/AiAssistant/useAiFillForm';
import { AiFillButton } from '../../components/AiFill/AiFillButton';
import { AiFillPanel } from '../../components/AiFill/AiFillPanel';
import { FormDatePicker } from '../../components/FormDatePicker';
import { fromDateToLocal, getLocalTimeZone, today } from '@internationalized/date';
import { subinventoryTransferFormSchema } from '@repo/schemas/subinventory-transfer';
import { FormCanvas, FormMain, FormRail, FormFull } from '../../components/form/FormCanvas';
import { FormHero } from '../../components/form/FormHero';
import { FormSection } from '../../components/form/FormSection';
import { FormPreviewCard } from '../../components/form/FormPreviewCard';
import { FormActionBar } from '../../components/form/FormActionBar';
import { FormAiTip } from '../../components/form/FormAiTip';

interface FormItem {
  _id: string | null;
  palletId: string;
  fromLocationId: string;
  toLocationId: string;
}

function createFormItem(): FormItem {
  return { _id: null, palletId: '', fromLocationId: '', toLocationId: '' };
}

type FormValues = { documentNumber: string; date: any; transferReason: string; reference: string; notes: string; warehouseId: string; items: FormItem[] };

const defaultFormValues = (): FormValues => ({ documentNumber: '', date: today(getLocalTimeZone()) as any, transferReason: '', reference: '', notes: '', warehouseId: '', items: [createFormItem()] });

const transformDetailToFormValues = (d: any): FormValues => {
  const items: FormItem[] = (d.items?.length ?? 0) > 0
    ? d.items.map((item: any) => ({
        _id: item._id ?? null,
        palletId: String(item.palletId ?? ''),
        fromLocationId: String(item.fromLocationId ?? ''),
        toLocationId: String(item.toLocationId ?? ''),
      }))
    : [createFormItem()];
  return { documentNumber: d.documentNumber ?? '', date: d.date ? fromDateToLocal(new Date(d.date)) : today(getLocalTimeZone()), transferReason: d.transferReason ?? '', reference: d.reference ?? '', notes: d.notes ?? '', warehouseId: d.warehouseId ?? '', items };
};

interface Props { id?: string; isEdit: boolean; initialValues: FormValues | null; }

const SubinventoryTransferForm = ({ id, isEdit, initialValues }: Props) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = isEdit ? hasPermission('subinventory-transfer@update') : hasPermission('subinventory-transfer@create');

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
    mutationFn: (payload: any) => trpcClient.subinventoryTransfer.create.mutate(payload),
    onSuccess: (data: any) => { queryClient.invalidateQueries({ queryKey: ['subinventoryTransferList'] }); const detailId = data?.id ?? id; setSuccessDetailId(detailId ?? null); setResultMessage(intl.formatMessage({ id: 'subinventory_transfer.form_create_success', defaultMessage: 'Subinventory transfer created.' })); setModalStage('success'); clearTimer(); resultTimerRef.current = window.setTimeout(() => navigate(`/subinventory-transfer/${detailId}`), 1500); },
    onError: (err: Error) => { setResultMessage(err.message); setModalStage('error'); },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: any) => trpcClient.subinventoryTransfer.update.mutate(payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subinventoryTransferDetail', id] }); queryClient.invalidateQueries({ queryKey: ['subinventoryTransferList'] }); setResultMessage(intl.formatMessage({ id: 'subinventory_transfer.form_update_success', defaultMessage: 'Subinventory transfer updated.' })); setModalStage('success'); clearTimer(); resultTimerRef.current = window.setTimeout(() => navigate(`/subinventory-transfer/${id}`), 1500); },
    onError: (err: Error) => { setResultMessage(err.message); setModalStage('error'); },
  });

  const form = useForm({
    defaultValues: initialValues ?? defaultFormValues(),
    validators: { onChange: ({ value }: { value: FormValues }) => subinventoryTransferFormSchema.safeParse(value) },
    onSubmit: async ({ value }: { value: FormValues }) => {
      const approvalStatus = intentRef.current;
      const dateJs = value.date?.toDate ? value.date.toDate(getLocalTimeZone()) : new Date();
      const items = (value.items as FormItem[]).map((item) => ({
        palletId: item.palletId,
        fromLocationId: item.fromLocationId,
        toLocationId: item.toLocationId,
      }));
      const payload: any = { documentNumber: value.documentNumber || undefined, date: dateJs, transferReason: value.transferReason || undefined, reference: value.reference || undefined, notes: value.notes || undefined, warehouseId: value.warehouseId, approvalStatus, message: approvalMessage || undefined, items, approvalHistory: [] };
      if (isEdit && id) await updateMutation.mutateAsync({ ...payload, id });
      else await createMutation.mutateAsync(payload);
    },
  });

  const isSubmitting = modalStage === 'loading';

  useAiFillForm({
    documentNumber: (v) => form.setFieldValue('documentNumber', String(v)),
    transferReason: (v) => form.setFieldValue('transferReason', String(v)),
    reference:      (v) => form.setFieldValue('reference', String(v)),
    notes:          (v) => form.setFieldValue('notes', String(v)),
    warehouseId:    (v) => form.setFieldValue('warehouseId', String(v)),
    items: (v) => {
      if (!Array.isArray(v)) return;
      const items = v.map((item: any) => ({
        _id: item._id ?? null,
        palletId: String(item.palletId ?? ''),
        fromLocationId: String(item.fromLocationId ?? ''),
        toLocationId: String(item.toLocationId ?? ''),
      }));
      form.setFieldValue('items', items.length > 0 ? items : [createFormItem()]);
    },
  });

  const handleActionConfirm = (status: 'DRAFT' | 'PROPOSED') => { intentRef.current = status; setModalStage(status === 'DRAFT' ? 'confirm-draft' : 'confirm-propose'); };
  const handleConfirmSubmit = async () => { setModalStage('loading'); await form.handleSubmit(); };

  const values = useStore(form.store, (state) => state.values);
  const itemCount = (values.items ?? []).length;
  const warehouseName = warehouses.find((w: any) => w.id === values.warehouseId)?.name;
  const hasDoc = Boolean(values.documentNumber?.trim());
  const hasWarehouse = Boolean(values.warehouseId);
  const itemsReady = itemCount > 0 && (values.items ?? []).every((item: any) => item.palletId && item.fromLocationId && item.toLocationId);

  return (
    <Form>
      <FormHero
        icon="solar:transfer-horizontal-linear"
        title={isEdit ? intl.formatMessage({ id: 'subinventory_transfer.form_edit_title', defaultMessage: 'Edit Subinventory Transfer' }) : intl.formatMessage({ id: 'subinventory_transfer.form_new_title', defaultMessage: 'New Subinventory Transfer' })}
        description={intl.formatMessage({ id: 'subinventory_transfer.form_hero_desc', defaultMessage: 'Move pallets between locations inside a warehouse — draft it first, propose when ready.' })}
        mode={isEdit ? 'edit' : 'create'}
        modeLabel={intl.formatMessage({ id: isEdit ? 'form.mode_edit' : 'form.mode_create', defaultMessage: isEdit ? 'Edit' : 'Create' })}
        onBack={() => navigate('/subinventory-transfer')}
        backLabel={intl.formatMessage({ id: 'subinventory_transfer.form_back', defaultMessage: 'Back' })}
        chips={warehouseName ? [{ icon: 'solar:buildings-linear', label: warehouseName, tone: 'accent' }] : []}
        actions={<AiFillButton />}
      />
      <AiFillPanel />
      <section
        className="space-y-6"
        data-ai-context={JSON.stringify({
          section: 'subinventory-transfer-form',
          mode: isEdit ? 'edit' : 'create',
          transactionId: isEdit ? id : undefined,
          fields: ['documentNumber', 'date', 'transferReason', 'reference', 'notes', 'warehouseId', 'items'],
          availableWarehouses: warehouses.map((w: any) => ({ id: w.id, label: w.name })),
        })}
      >
        <FormCanvas>
          <FormMain>
            <FormSection
              step={1}
              icon="solar:document-text-linear"
              title={intl.formatMessage({ id: 'subinventory_transfer.form_section_general', defaultMessage: 'General Information' })}
              description={intl.formatMessage({ id: 'subinventory_transfer.form_section_general_desc', defaultMessage: 'The document, warehouse, and context behind this move.' })}
              filled={hasDoc && hasWarehouse}
            >
              <FieldGroup>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <form.Field name="documentNumber">{(field) => (<TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}><Label>{intl.formatMessage({ id: 'subinventory_transfer.form_document_number', defaultMessage: 'Document Number' })}</Label><Input variant="secondary" placeholder={intl.formatMessage({ id: 'subinventory_transfer.form_document_number_placeholder', defaultMessage: 'Auto-generated if blank' })} /></TextField>)}</form.Field>
                  <form.Field name="date">{(field) => (<FormDatePicker label={intl.formatMessage({ id: 'subinventory_transfer.form_date', defaultMessage: 'Date' })} value={field.state.value} onChange={field.handleChange} isDisabled={isSubmitting} />)}</form.Field>
                  <form.Field name="warehouseId" validators={{ onChange: ({ value }) => !value ? intl.formatMessage({ id: 'subinventory_transfer.form_warehouse_required', defaultMessage: 'Warehouse is required' }) : undefined }}>
                    {(field) => (<Select isRequired isDisabled={isSubmitting} selectedKey={field.state.value || null} onSelectionChange={(key) => field.handleChange(key ? String(key) : '')} isInvalid={field.state.meta.errors.length > 0} placeholder={intl.formatMessage({ id: 'subinventory_transfer.form_warehouse_placeholder', defaultMessage: 'Select warehouse' })} aria-label={intl.formatMessage({ id: 'subinventory_transfer.form_warehouse', defaultMessage: 'Warehouse' })}><Label>{intl.formatMessage({ id: 'subinventory_transfer.form_warehouse', defaultMessage: 'Warehouse' })}</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox>{warehouses.map((w: any) => (<ListBox.Item key={w.id} id={w.id}>{w.name}</ListBox.Item>))}</ListBox></Select.Popover></Select>)}
                  </form.Field>
                  <form.Field name="transferReason">{(field) => (<TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}><Label>{intl.formatMessage({ id: 'subinventory_transfer.form_transfer_reason', defaultMessage: 'Transfer Reason' })}</Label><Input variant="secondary" placeholder={intl.formatMessage({ id: 'subinventory_transfer.form_transfer_reason_placeholder', defaultMessage: 'Reason for transfer' })} /></TextField>)}</form.Field>
                  <form.Field name="reference">{(field) => (<TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}><Label>{intl.formatMessage({ id: 'subinventory_transfer.form_reference', defaultMessage: 'Reference' })}</Label><Input variant="secondary" placeholder={intl.formatMessage({ id: 'subinventory_transfer.form_reference_placeholder', defaultMessage: 'Reference number' })} /></TextField>)}</form.Field>
                  <form.Field name="notes">{(field) => (<TextField isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur} fullWidth><Label>{intl.formatMessage({ id: 'subinventory_transfer.form_notes', defaultMessage: 'Notes' })}</Label><TextArea rows={4} variant="secondary" placeholder={intl.formatMessage({ id: 'subinventory_transfer.form_notes_placeholder', defaultMessage: 'Add notes' })} /></TextField>)}</form.Field>
                </div>
              </FieldGroup>
            </FormSection>
          </FormMain>

          <FormRail>
            <FormPreviewCard
              title={intl.formatMessage({ id: 'subinventory_transfer.preview_title', defaultMessage: 'Transfer Preview' })}
              icon="solar:transfer-horizontal-linear"
              description={intl.formatMessage({ id: 'subinventory_transfer.preview_desc', defaultMessage: 'Live summary of the pallet moves you are planning.' })}
              fillLabel={intl.formatMessage({ id: 'form.preview_fill', defaultMessage: 'Completed' })}
              rows={[
                { label: intl.formatMessage({ id: 'subinventory_transfer.form_document_number', defaultMessage: 'Document Number' }), value: values.documentNumber || intl.formatMessage({ id: 'subinventory_transfer.form_auto', defaultMessage: 'Auto' }), icon: 'solar:document-text-linear' },
                { label: intl.formatMessage({ id: 'subinventory_transfer.form_warehouse', defaultMessage: 'Warehouse' }), value: warehouseName ?? null, icon: 'solar:buildings-linear', tone: 'accent' },
                { label: intl.formatMessage({ id: 'subinventory_transfer.form_transfer_reason', defaultMessage: 'Transfer Reason' }), value: values.transferReason, icon: 'solar:question-circle-linear' },
                { label: intl.formatMessage({ id: 'subinventory_transfer.form_reference', defaultMessage: 'Reference' }), value: values.reference, icon: 'solar:link-linear' },
                { label: intl.formatMessage({ id: 'subinventory_transfer.form_pallets_count', defaultMessage: 'Pallets' }), value: itemCount > 0 ? itemCount : null, icon: 'solar:box-linear', tone: itemsReady ? 'success' : 'accent' },
              ]}
              footer={<FormAiTip />}
            />
          </FormRail>
        </FormCanvas>

        <FormFull>
        <form.Field name="items">
          {(itemsField) => (
            <Card>
              <Card.Header className="flex items-center justify-between"><div><p className="text-base font-semibold">{intl.formatMessage({ id: 'subinventory_transfer.form_items_title', defaultMessage: 'Transfer Items' })}</p></div><Button variant="secondary" isDisabled={isSubmitting} onPress={() => itemsField.pushValue(createFormItem())}><Icon icon="solar:add-circle-linear" className="size-4" />{intl.formatMessage({ id: 'subinventory_transfer.form_add_item', defaultMessage: 'Add Item' })}</Button></Card.Header>
              <Card.Content>
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content aria-label={intl.formatMessage({ id: 'subinventory_transfer.form_items_aria', defaultMessage: 'Transfer items' })}>
                  <Table.Header>
                    <Table.Column isRowHeader><span className="text-xs font-semibold">#</span></Table.Column>
                    <Table.Column><span className="text-xs font-semibold">{intl.formatMessage({ id: 'subinventory_transfer.col_pallet', defaultMessage: 'Pallet' })}</span></Table.Column>
                    <Table.Column><span className="text-xs font-semibold">{intl.formatMessage({ id: 'subinventory_transfer.col_from', defaultMessage: 'From Location' })}</span></Table.Column>
                    <Table.Column><span className="text-xs font-semibold">{intl.formatMessage({ id: 'subinventory_transfer.col_to', defaultMessage: 'To Location' })}</span></Table.Column>
                    <Table.Column><span className="text-xs font-semibold" /></Table.Column>
                  </Table.Header>
                  <Table.Body renderEmptyState={() => (<div className="flex flex-col items-center justify-center gap-3 py-10 text-center"><Icon icon="solar:transfer-horizontal-linear" className="size-6 text-muted" /><span className="text-sm text-muted">{intl.formatMessage({ id: 'subinventory_transfer.form_no_items', defaultMessage: 'No items. Click "Add Item" to start.' })}</span></div>)}>
                    {(itemsField.state.value as FormItem[]).map((item, index) => {
                      const rowId = item._id ?? `new-${index}`;
                      return (
                        <Table.Row key={rowId} id={rowId}>
                          <Table.Cell><span className="font-mono text-sm text-muted">{index + 1}</span></Table.Cell>
                          <Table.Cell><form.Field name={`items[${index}].palletId` as any}>{(subField: any) => (<PalletSelect isDisabled={isSubmitting} warehouseId={form.getFieldValue('warehouseId') as string} value={subField.state.value} onChange={subField.handleChange} placeholder={intl.formatMessage({ id: 'subinventory_transfer.form_pallet_placeholder', defaultMessage: 'Select pallet' })} />)}</form.Field></Table.Cell>
                          <Table.Cell><form.Field name={`items[${index}].fromLocationId` as any}>{(subField: any) => (<LocationSelect isDisabled={isSubmitting} warehouseId={form.getFieldValue('warehouseId') as string} value={subField.state.value} onChange={subField.handleChange} placeholder={intl.formatMessage({ id: 'subinventory_transfer.form_from_placeholder', defaultMessage: 'Source' })} />)}</form.Field></Table.Cell>
                          <Table.Cell><form.Field name={`items[${index}].toLocationId` as any}>{(subField: any) => (<LocationSelect isDisabled={isSubmitting} warehouseId={form.getFieldValue('warehouseId') as string} value={subField.state.value} onChange={subField.handleChange} placeholder={intl.formatMessage({ id: 'subinventory_transfer.form_to_placeholder', defaultMessage: 'Destination' })} />)}</form.Field></Table.Cell>
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
        </FormFull>

        {canSave && (
          <FormActionBar
            onCancel={() => navigate('/subinventory-transfer')}
            cancelLabel={intl.formatMessage({ id: 'subinventory_transfer.form_back', defaultMessage: 'Back' })}
            submitLabel={intl.formatMessage({ id: 'subinventory_transfer.form_propose', defaultMessage: 'Propose' })}
            submitIcon="solar:send-linear"
            submitOnPress={() => handleActionConfirm('PROPOSED')}
            isPending={isSubmitting}
            isDisabled={!itemsReady || !hasWarehouse}
            isDirty={isEdit && form.state.isDirty}
            showSavedState={isEdit}
          >
            <Button variant="secondary" isDisabled={isSubmitting || !itemsReady || !hasWarehouse} onPress={() => handleActionConfirm('DRAFT')}>
              <Icon icon="solar:floppy-disk-linear" className="size-4" />
              {intl.formatMessage({ id: 'subinventory_transfer.form_save_draft', defaultMessage: 'Save Draft' })}
            </Button>
          </FormActionBar>
        )}
      </section>

      <Modal><Modal.Backdrop isOpen={modalStage !== 'idle'} onOpenChange={(open) => { if (!open) handleModalClose(); }} isDismissable={modalStage !== 'loading'} isKeyboardDismissDisabled={modalStage === 'loading'}><Modal.Container size="sm"><Modal.Dialog>
        {modalStage === 'loading' ? (<><Modal.Header><Modal.Heading>{intl.formatMessage({ id: 'subinventory_transfer.form_saving', defaultMessage: 'Saving…' })}</Modal.Heading></Modal.Header><Modal.Body className="flex flex-col items-center gap-4 py-8"><Spinner size="lg" /></Modal.Body></>)
          : modalStage === 'success' ? (<><Modal.Header><Modal.Icon><Icon icon="solar:check-circle-bold" className="size-12 text-success" /></Modal.Icon><Modal.Heading>{intl.formatMessage({ id: 'subinventory_transfer.form_success_title', defaultMessage: 'Saved' })}</Modal.Heading></Modal.Header><Modal.Body><p className="text-center text-sm text-muted">{resultMessage}</p></Modal.Body><Modal.Footer><Button onPress={() => navigate(`/subinventory-transfer/${successDetailId ?? id}`)}>{intl.formatMessage({ id: 'subinventory_transfer.form_view_detail', defaultMessage: 'View Detail' })}</Button></Modal.Footer></>)
          : modalStage === 'error' ? (<><Modal.Header><Modal.Icon><Icon icon="solar:close-circle-bold" className="size-12 text-danger" /></Modal.Icon><Modal.Heading>{intl.formatMessage({ id: 'subinventory_transfer.form_error_title', defaultMessage: 'Error' })}</Modal.Heading></Modal.Header><Modal.Body><p className="text-center text-sm text-muted">{resultMessage}</p></Modal.Body><Modal.Footer><Button onPress={handleModalClose}>{intl.formatMessage({ id: 'subinventory_transfer.form_close', defaultMessage: 'Close' })}</Button></Modal.Footer></>)
          : (<><Modal.Header><Modal.Icon><Icon icon={intentRef.current === 'PROPOSED' ? 'solar:send-linear' : 'solar:floppy-disk-linear'} className="size-10" /></Modal.Icon><Modal.Heading>{intentRef.current === 'PROPOSED' ? intl.formatMessage({ id: 'subinventory_transfer.form_confirm_propose', defaultMessage: 'Confirm Propose' }) : intl.formatMessage({ id: 'subinventory_transfer.form_confirm_draft', defaultMessage: 'Confirm Save Draft' })}</Modal.Heading></Modal.Header><Modal.Body className="space-y-4"><p className="text-sm text-muted">{intentRef.current === 'PROPOSED' ? intl.formatMessage({ id: 'subinventory_transfer.form_confirm_propose_desc', defaultMessage: 'Propose this subinventory transfer?' }) : intl.formatMessage({ id: 'subinventory_transfer.form_confirm_draft_desc', defaultMessage: 'Save as draft?' })}</p>{intentRef.current === 'PROPOSED' && (<TextField fullWidth><Label>{intl.formatMessage({ id: 'subinventory_transfer.form_message_label', defaultMessage: 'Message' })}</Label><TextArea rows={3} variant="secondary" value={approvalMessage} onChange={(e) => setApprovalMessage(e.target.value)} placeholder={intl.formatMessage({ id: 'subinventory_transfer.form_message_placeholder', defaultMessage: 'Add a note (optional)' })} /></TextField>)}</Modal.Body><Modal.Footer><Button variant="ghost" onPress={handleModalClose}>{intl.formatMessage({ id: 'subinventory_transfer.form_cancel', defaultMessage: 'Cancel' })}</Button><Button onPress={() => void handleConfirmSubmit()}>{intl.formatMessage({ id: 'subinventory_transfer.form_confirm', defaultMessage: 'Confirm' })}</Button></Modal.Footer></>)}
      </Modal.Dialog></Modal.Container></Modal.Backdrop></Modal>
    </Form>
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
  return (
    <Select isDisabled={isDisabled} selectedKey={value || null} onSelectionChange={(key) => onChange(key ? String(key) : '')} placeholder={placeholder} aria-label={placeholder}>
      <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
      <Select.Popover>
        <ListBox items={Array.isArray(locations) ? locations : []}>
          {(item: any) => (
            <ListBox.Item key={item.id} id={item.id} textValue={item.id}>
              <div className="flex flex-col"><span className="text-sm font-mono">{item.id}</span><span className="text-xs text-muted">{item.status ?? 'ACTIVE'}</span></div>
            </ListBox.Item>
          )}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

const SubinventoryTransferFormPage = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { data: detailData, isLoading: detailLoading } = useQuery({ queryKey: ['subinventoryTransferDetail', id], queryFn: () => trpcClient.subinventoryTransfer.detail.query({ id: id! }), enabled: isEdit });
  const detail = detailData as any;
  const initialValues = isEdit && detail ? transformDetailToFormValues(detail) : null;
  if (isEdit && detailLoading) return (<div className="flex min-h-72 flex-col items-center justify-center gap-4"><Spinner size="lg" /></div>);
  if (isEdit && !detail) return (<p className="text-sm text-danger">Transaction not found.</p>);
  if (isEdit && detail && !['DRAFT', 'REJECTED'].includes(detail.approvalStatus)) return (<p className="text-sm text-warning">This transaction cannot be edited in its current state.</p>);
  return <SubinventoryTransferForm id={id} isEdit={isEdit} initialValues={initialValues} />;
};

export { SubinventoryTransferFormPage };