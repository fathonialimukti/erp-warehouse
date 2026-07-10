import { useMemo, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { Button, Description, EmptyState, FieldGroup, Fieldset, FieldsetLegend, Label, Modal, Spinner, Table, TextArea, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trpcClient } from '../../../lib/trpc';
import { ApprovalHistory } from '../../../components/ApprovalHistory';
import { PageHeader } from '../../../components/PageHeader';
import { hasPermissionAtom } from '../../../lib/atoms';

function ShipmentDetailPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canApprove = hasPermission('shipment@approve');
  const canUpdate = hasPermission('shipment@update');

  type ModalAction = 'idle' | 'confirm-approve' | 'confirm-reject' | 'loading' | 'success' | 'error';
  const [modalAction, setModalAction] = useState<ModalAction>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const [approvalMessage, setApprovalMessage] = useState('');
  const resultTimerRef = useRef<number | null>(null);
  const actionRef = useRef<'approve' | 'reject'>('approve');
  const clearTimer = () => { if (resultTimerRef.current !== null) { window.clearTimeout(resultTimerRef.current); resultTimerRef.current = null; } };
  const handleModalClose = () => { if (modalAction === 'loading') return; clearTimer(); setModalAction('idle'); setApprovalMessage(''); };

  const approveMutation = useMutation({
    mutationFn: (payload: { id: string; message?: string }) => trpcClient.shipment.approve.mutate(payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shipmentDetail', id] }); queryClient.invalidateQueries({ queryKey: ['shipmentList'] }); setResultMessage(intl.formatMessage({ id: 'shipment.approve_success', defaultMessage: 'Shipment approved.' })); setModalAction('success'); clearTimer(); resultTimerRef.current = window.setTimeout(() => setModalAction('idle'), 1800); },
    onError: (err: Error) => { setResultMessage(err.message); setModalAction('error'); },
  });

  const rejectMutation = useMutation({
    mutationFn: (payload: { id: string; message?: string }) => trpcClient.shipment.reject.mutate(payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shipmentDetail', id] }); queryClient.invalidateQueries({ queryKey: ['shipmentList'] }); setResultMessage(intl.formatMessage({ id: 'shipment.reject_success', defaultMessage: 'Shipment rejected.' })); setModalAction('success'); clearTimer(); resultTimerRef.current = window.setTimeout(() => setModalAction('idle'), 1800); },
    onError: (err: Error) => { setResultMessage(err.message); setModalAction('error'); },
  });

  const { data: queryData, isLoading } = useQuery({ queryKey: ['shipmentDetail', id], queryFn: () => trpcClient.shipment.detail.query({ id: id! }), enabled: Boolean(id) });
  const data = queryData as any;
  const itemCount = useMemo(() => data?.items?.length ?? 0, [data]);

  const handleConfirmSubmit = async () => {
    if (!id) return;
    setModalAction('loading');
    try { if (actionRef.current === 'approve') await approveMutation.mutateAsync({ id, message: approvalMessage }); else await rejectMutation.mutateAsync({ id, message: approvalMessage }); } catch { /* handled */ }
  };

  return (
    <section
      className="space-y-6"
      data-ai-context={JSON.stringify({
        section: 'shipment-detail',
        id: data?.id,
        shipmentNumber: data?.shipmentNumber,
        recipient: data?.recipient,
        approvalStatus: data?.approvalStatus,
        itemCount,
      })}
    >
      <PageHeader title={intl.formatMessage({ id: 'shipment.detail_title', defaultMessage: 'Shipment Detail' })} onBack={() => navigate('/outbound-transaction')} onEdit={canUpdate && ['DRAFT', 'REJECTED'].includes(data?.approvalStatus ?? '') ? () => navigate(`/outbound-transaction/shipment/${id}/edit`) : undefined} />
      {isLoading ? (<div className="flex min-h-72 flex-col items-center justify-center gap-4"><Spinner size="lg" /></div>)
        : !data ? (<p className="text-sm text-danger">{intl.formatMessage({ id: 'shipment.not_found', defaultMessage: 'Shipment not found.' })}</p>)
        : (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Fieldset>
                <FieldsetLegend>{intl.formatMessage({ id: 'shipment.section_general', defaultMessage: 'Shipment Details' })}</FieldsetLegend>
                <FieldGroup>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div><p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'shipment.label_id', defaultMessage: 'ID' })}</p><p className="mt-2 font-mono text-sm">{data.id}</p></div>
                    <div><p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'shipment.label_document_number', defaultMessage: 'Document Number' })}</p><p className="mt-2 text-sm">{data.documentNumber ?? '-'}</p></div>
                    <div><p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'shipment.label_date', defaultMessage: 'Date' })}</p><p className="mt-2 text-sm">{intl.formatDate(new Date(data.date))}</p></div>
                    <div><p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'shipment.label_warehouse', defaultMessage: 'Warehouse' })}</p><p className="mt-2 text-sm">{data.warehouse?.name ?? '-'}</p></div>
                    <div><p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'shipment.label_status', defaultMessage: 'Status' })}</p><p className="mt-2 text-sm">{data.approvalStatus}</p></div>
                    <div><p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'shipment.label_shipment_number', defaultMessage: 'Shipment Number' })}</p><p className="mt-2 text-sm">{data.shipmentNumber ?? '-'}</p></div>
                    <div><p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'shipment.label_sales_order_ref', defaultMessage: 'Sales Order Ref' })}</p><p className="mt-2 text-sm">{data.salesOrderRef ?? '-'}</p></div>
                    <div><p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'shipment.label_recipient', defaultMessage: 'Recipient' })}</p><p className="mt-2 text-sm">{data.recipient ?? '-'}</p></div>
                    <div><p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'shipment.label_carrier', defaultMessage: 'Carrier' })}</p><p className="mt-2 text-sm">{data.carrier ?? '-'}</p></div>
                    <div><p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'shipment.label_tracking_number', defaultMessage: 'Tracking Number' })}</p><p className="mt-2 text-sm">{data.trackingNumber ?? '-'}</p></div>
                    <div><p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'shipment.label_reference', defaultMessage: 'Reference' })}</p><p className="mt-2 text-sm">{data.reference ?? '-'}</p></div>
                    <div className="col-span-2"><p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'shipment.label_notes', defaultMessage: 'Notes' })}</p><p className="mt-2 text-sm">{data.notes ?? '-'}</p></div>
                  </div>
                </FieldGroup>
              </Fieldset>
            </div>
            <div className="flex justify-end"><ApprovalHistory approvalHistory={data?.approvalHistory} /></div>
            <Fieldset>
              <Fieldset.Legend>{intl.formatMessage({ id: 'shipment.items_title', defaultMessage: 'Shipment Items' })}</Fieldset.Legend>
              <Description>{intl.formatMessage({ id: 'shipment.items_description', defaultMessage: 'Items in this shipment.' })}</Description>
              <FieldGroup>
                {itemCount > 0 ? (
                  <Table>
                    <Table.ScrollContainer>
                      <Table.Content aria-label={intl.formatMessage({ id: 'shipment.items_aria', defaultMessage: 'Shipment items' })}>
                        <Table.Header>
                          <Table.Column>{intl.formatMessage({ id: 'shipment.col_sku', defaultMessage: 'SKU' })}</Table.Column>
                          <Table.Column>{intl.formatMessage({ id: 'shipment.col_details', defaultMessage: 'Details' })}</Table.Column>
                          <Table.Column>{intl.formatMessage({ id: 'shipment.col_quantity', defaultMessage: 'Qty' })}</Table.Column>
                        </Table.Header>
                        <Table.Body>
                          {data.items?.map((item: any, i: number) => (
                            <Table.Row key={`${item.skuId}-${i}`}>
                              <Table.Cell>{item.sku?.name ?? item.skuId}</Table.Cell>
                              <Table.Cell>{item.details ?? '-'}</Table.Cell>
                              <Table.Cell>{item.quantity}</Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Content>
                    </Table.ScrollContainer>
                  </Table>
                ) : (<EmptyState>{intl.formatMessage({ id: 'shipment.no_items', defaultMessage: 'No items available.' })}</EmptyState>)}
              </FieldGroup>
            </Fieldset>
          </>
        )}

      <div className="flex justify-end gap-2">
        {canApprove && data?.approvalStatus === 'PROPOSED' && (<><Button onPress={() => { actionRef.current = 'approve'; setApprovalMessage(''); setModalAction('confirm-approve'); }}><Icon icon="solar:check-circle-bold" className="size-4" />{intl.formatMessage({ id: 'shipment.approve', defaultMessage: 'Approve' })}</Button><Button onPress={() => { actionRef.current = 'reject'; setApprovalMessage(''); setModalAction('confirm-reject'); }}><Icon icon="solar:close-circle-bold" className="size-4" />{intl.formatMessage({ id: 'shipment.reject', defaultMessage: 'Reject' })}</Button></>)}
        {canApprove && data?.approvalStatus === 'APPROVED' && (<Button onPress={() => { actionRef.current = 'reject'; setApprovalMessage(''); setModalAction('confirm-reject'); }}><Icon icon="solar:close-circle-bold" className="size-4" />{intl.formatMessage({ id: 'shipment.reject', defaultMessage: 'Reject' })}</Button>)}
      </div>

      <Modal><Modal.Backdrop isOpen={modalAction !== 'idle'} onOpenChange={(open) => { if (!open) handleModalClose(); }} isDismissable={modalAction !== 'loading'} isKeyboardDismissDisabled={modalAction === 'loading'}><Modal.Container size="sm"><Modal.Dialog>
        {modalAction === 'loading' ? (<><Modal.Header><Modal.Heading>{intl.formatMessage({ id: 'shipment.processing', defaultMessage: 'Processing…' })}</Modal.Heading></Modal.Header><Modal.Body className="flex flex-col items-center gap-4 py-8"><Spinner size="lg" /></Modal.Body></>)
          : modalAction === 'success' ? (<><Modal.Header><Modal.Icon><Icon icon="solar:check-circle-bold" className="size-12 text-success" /></Modal.Icon><Modal.Heading>{intl.formatMessage({ id: 'shipment.done', defaultMessage: 'Done' })}</Modal.Heading></Modal.Header><Modal.Body><p className="text-center text-sm text-muted">{resultMessage}</p></Modal.Body><Modal.Footer><Button onPress={handleModalClose}>{intl.formatMessage({ id: 'shipment.close', defaultMessage: 'Close' })}</Button></Modal.Footer></>)
          : modalAction === 'error' ? (<><Modal.Header><Modal.Icon><Icon icon="solar:close-circle-bold" className="size-12 text-danger" /></Modal.Icon><Modal.Heading>{intl.formatMessage({ id: 'shipment.error', defaultMessage: 'Error' })}</Modal.Heading></Modal.Header><Modal.Body><p className="text-center text-sm text-muted">{resultMessage}</p></Modal.Body><Modal.Footer><Button onPress={handleModalClose}>{intl.formatMessage({ id: 'shipment.close', defaultMessage: 'Close' })}</Button></Modal.Footer></>)
          : (<><Modal.Header><Modal.Icon><Icon icon={modalAction === 'confirm-approve' ? 'solar:check-circle-bold' : 'solar:close-circle-bold'} className={`size-10 ${modalAction === 'confirm-approve' ? 'text-success' : 'text-danger'}`} /></Modal.Icon><Modal.Heading>{modalAction === 'confirm-approve' ? intl.formatMessage({ id: 'shipment.confirm_approve', defaultMessage: 'Confirm Approve' }) : intl.formatMessage({ id: 'shipment.confirm_reject', defaultMessage: 'Confirm Reject' })}</Modal.Heading></Modal.Header><Modal.Body className="space-y-4"><p className="text-sm text-muted">{modalAction === 'confirm-approve' ? intl.formatMessage({ id: 'shipment.confirm_approve_desc', defaultMessage: 'Approve this shipment?' }) : intl.formatMessage({ id: 'shipment.confirm_reject_desc', defaultMessage: 'Reject this shipment?' })}</p><TextField fullWidth><Label>{intl.formatMessage({ id: 'shipment.message_label', defaultMessage: 'Message' })}</Label><TextArea rows={4} variant="secondary" value={approvalMessage} onChange={(e) => setApprovalMessage(e.target.value)} placeholder={intl.formatMessage({ id: 'shipment.message_placeholder', defaultMessage: 'Add a message (optional)' })} /></TextField></Modal.Body><Modal.Footer><Button variant="ghost" onPress={handleModalClose}>{intl.formatMessage({ id: 'shipment.cancel', defaultMessage: 'Cancel' })}</Button><Button variant={modalAction === 'confirm-reject' ? 'danger' : 'primary'} onPress={() => void handleConfirmSubmit()}>{modalAction === 'confirm-approve' ? intl.formatMessage({ id: 'shipment.action_approve', defaultMessage: 'Approve' }) : intl.formatMessage({ id: 'shipment.action_reject', defaultMessage: 'Reject' })}</Button></Modal.Footer></>)}
      </Modal.Dialog></Modal.Container></Modal.Backdrop></Modal>
    </section>
  );
}

export { ShipmentDetailPage };
