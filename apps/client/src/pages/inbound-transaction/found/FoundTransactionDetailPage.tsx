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

function FoundTransactionDetailPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const queryClient = useQueryClient();

  const hasPermission = useAtomValue(hasPermissionAtom);
  const canApprove = hasPermission('found@approve');
  const canUpdate = hasPermission('found@update');

  type ModalAction = 'idle' | 'confirm-approve' | 'confirm-reject' | 'loading' | 'success' | 'error';
  const [modalAction, setModalAction] = useState<ModalAction>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const [approvalMessage, setApprovalMessage] = useState('');
  const resultTimerRef = useRef<number | null>(null);
  const actionRef = useRef<'approve' | 'reject'>('approve');

  const clearTimer = () => { if (resultTimerRef.current !== null) { window.clearTimeout(resultTimerRef.current); resultTimerRef.current = null; } };
  const handleModalClose = () => { if (modalAction === 'loading') return; clearTimer(); setModalAction('idle'); setApprovalMessage(''); };

  const approveMutation = useMutation({
    mutationFn: (payload: { id: string; message?: string }) => trpcClient.foundTransaction.approve.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['foundTransactionList'] });
      setResultMessage(intl.formatMessage({ id: 'found_transaction.approve_success', defaultMessage: 'Transaction approved.' }));
      setModalAction('success');
      clearTimer();
      resultTimerRef.current = window.setTimeout(() => setModalAction('idle'), 1800);
    },
    onError: (err: Error) => { setResultMessage(err.message); setModalAction('error'); },
  });

  const rejectMutation = useMutation({
    mutationFn: (payload: { id: string; message?: string }) => trpcClient.foundTransaction.reject.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['foundTransactionList'] });
      setResultMessage(intl.formatMessage({ id: 'found_transaction.reject_success', defaultMessage: 'Transaction rejected.' }));
      setModalAction('success');
      clearTimer();
      resultTimerRef.current = window.setTimeout(() => setModalAction('idle'), 1800);
    },
    onError: (err: Error) => { setResultMessage(err.message); setModalAction('error'); },
  });

  const { data: queryData, isLoading } = useQuery({
    queryKey: ['foundTransactionDetail', id],
    queryFn: () => trpcClient.foundTransaction.detail.query({ id: id! }),
    enabled: Boolean(id),
  });

  const data = queryData as any;
  const itemCount = useMemo(() => data?.items?.length ?? 0, [data]);

  const handleConfirmSubmit = async () => {
    if (!id) return;
    setModalAction('loading');
    try {
      if (actionRef.current === 'approve') await approveMutation.mutateAsync({ id, message: approvalMessage });
      else await rejectMutation.mutateAsync({ id, message: approvalMessage });
    } catch { /* handled in mutation */ }
  };

  return (
    <section
      className="space-y-6"
      data-ai-context={JSON.stringify({
        section: 'found-transaction-detail',
        id: data?.id,
        documentNumber: data?.documentNumber,
        warehouse: data?.warehouse?.name,
        approvalStatus: data?.approvalStatus,
        itemCount,
      })}
    >
      <PageHeader
        title={intl.formatMessage({ id: 'found_transaction.detail_title', defaultMessage: 'Found Transaction Detail' })}
        onBack={() => navigate('/inbound-transaction')}
        onEdit={canUpdate && ['DRAFT', 'REJECTED'].includes(data?.approvalStatus ?? '') ? () => navigate(`/inbound-transaction/found/${id}/edit`) : undefined}
      />

      {isLoading ? (
        <div className="flex min-h-72 flex-col items-center justify-center gap-4"><Spinner size="lg" /></div>
      ) : !data ? (
        <p className="text-sm text-danger">{intl.formatMessage({ id: 'found_transaction.not_found', defaultMessage: 'Found transaction not found.' })}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Fieldset>
              <FieldsetLegend>{intl.formatMessage({ id: 'found_transaction.section_general', defaultMessage: 'Transaction Details' })}</FieldsetLegend>
              <FieldGroup>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div><p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'found_transaction.label_id', defaultMessage: 'Transaction ID' })}</p><p className="mt-2 font-mono text-sm">{data.id}</p></div>
                  <div><p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'found_transaction.label_document_number', defaultMessage: 'Document Number' })}</p><p className="mt-2 text-sm">{data.documentNumber ?? '-'}</p></div>
                  <div><p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'found_transaction.label_date', defaultMessage: 'Date' })}</p><p className="mt-2 text-sm">{intl.formatDate(new Date(data.date))}</p></div>
                  <div><p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'found_transaction.label_warehouse', defaultMessage: 'Warehouse' })}</p><p className="mt-2 text-sm">{data.warehouse?.name ?? '-'}</p></div>
                  <div><p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'found_transaction.label_status', defaultMessage: 'Status' })}</p><p className="mt-2 text-sm">{data.approvalStatus}</p></div>
                  <div><p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'found_transaction.label_found_reason', defaultMessage: 'Found Reason' })}</p><p className="mt-2 text-sm">{data.foundReason ?? '-'}</p></div>
                  <div><p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'found_transaction.label_found_location', defaultMessage: 'Found Location' })}</p><p className="mt-2 text-sm">{data.foundLocation ?? '-'}</p></div>
                  <div><p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'found_transaction.label_reference', defaultMessage: 'Reference' })}</p><p className="mt-2 text-sm">{data.reference ?? '-'}</p></div>
                  <div className="col-span-2"><p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'found_transaction.label_notes', defaultMessage: 'Notes' })}</p><p className="mt-2 text-sm">{data.notes ?? '-'}</p></div>
                </div>
              </FieldGroup>
            </Fieldset>
          </div>

          <div className="flex justify-end">
            <ApprovalHistory approvalHistory={data?.approvalHistory} />
          </div>

          <Fieldset>
            <Fieldset.Legend>{intl.formatMessage({ id: 'found_transaction.items_title', defaultMessage: 'Transaction Items' })}</Fieldset.Legend>
            <Description>{intl.formatMessage({ id: 'found_transaction.items_description', defaultMessage: 'Items in this found transaction.' })}</Description>
            <FieldGroup>
              {itemCount > 0 ? (
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content aria-label={intl.formatMessage({ id: 'found_transaction.items_aria', defaultMessage: 'Transaction items' })}>
                      <Table.Header>
                        <Table.Column>{intl.formatMessage({ id: 'found_transaction.col_sku', defaultMessage: 'SKU' })}</Table.Column>
                        <Table.Column>{intl.formatMessage({ id: 'found_transaction.col_pallet_type', defaultMessage: 'Pallet Type' })}</Table.Column>
                        <Table.Column>{intl.formatMessage({ id: 'found_transaction.col_details', defaultMessage: 'Details' })}</Table.Column>
                        <Table.Column>{intl.formatMessage({ id: 'found_transaction.col_quantity', defaultMessage: 'Qty' })}</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {data.items?.map((item: any, i: number) => (
                          <Table.Row key={`${item.skuId}-${i}`}>
                            <Table.Cell>{item.sku?.name ?? item.skuId}</Table.Cell>
                            <Table.Cell>{item.palletType?.name ?? item.palletTypeId}</Table.Cell>
                            <Table.Cell>{item.details ?? '-'}</Table.Cell>
                            <Table.Cell>{item.quantity}</Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              ) : (
                <EmptyState>{intl.formatMessage({ id: 'found_transaction.no_items', defaultMessage: 'No items available.' })}</EmptyState>
              )}
            </FieldGroup>
          </Fieldset>
        </>
      )}

      <div className="flex justify-end gap-2">
        {canApprove && data?.approvalStatus === 'PROPOSED' && (
          <>
            <Button onPress={() => { actionRef.current = 'approve'; setApprovalMessage(''); setModalAction('confirm-approve'); }}><Icon icon="solar:check-circle-bold" className="size-4" />{intl.formatMessage({ id: 'found_transaction.approve', defaultMessage: 'Approve' })}</Button>
            <Button onPress={() => { actionRef.current = 'reject'; setApprovalMessage(''); setModalAction('confirm-reject'); }}><Icon icon="solar:close-circle-bold" className="size-4" />{intl.formatMessage({ id: 'found_transaction.reject', defaultMessage: 'Reject' })}</Button>
          </>
        )}
        {canApprove && data?.approvalStatus === 'APPROVED' && (
          <Button onPress={() => { actionRef.current = 'reject'; setApprovalMessage(''); setModalAction('confirm-reject'); }}><Icon icon="solar:close-circle-bold" className="size-4" />{intl.formatMessage({ id: 'found_transaction.reject', defaultMessage: 'Reject' })}</Button>
        )}
      </div>

      <Modal>
        <Modal.Backdrop isOpen={modalAction !== 'idle'} onOpenChange={(open) => { if (!open) handleModalClose(); }} isDismissable={modalAction !== 'loading'} isKeyboardDismissDisabled={modalAction === 'loading'}>
          <Modal.Container size="sm">
            <Modal.Dialog>
              {modalAction === 'loading' ? (
                <><Modal.Header><Modal.Heading>{intl.formatMessage({ id: 'found_transaction.processing', defaultMessage: 'Processing…' })}</Modal.Heading></Modal.Header><Modal.Body className="flex flex-col items-center gap-4 py-8"><Spinner size="lg" /></Modal.Body></>
              ) : modalAction === 'success' ? (
                <><Modal.Header><Modal.Icon><Icon icon="solar:check-circle-bold" className="size-12 text-success" /></Modal.Icon><Modal.Heading>{intl.formatMessage({ id: 'found_transaction.done', defaultMessage: 'Done' })}</Modal.Heading></Modal.Header><Modal.Body><p className="text-center text-sm text-muted">{resultMessage}</p></Modal.Body><Modal.Footer><Button onPress={handleModalClose}>{intl.formatMessage({ id: 'found_transaction.close', defaultMessage: 'Close' })}</Button></Modal.Footer></>
              ) : modalAction === 'error' ? (
                <><Modal.Header><Modal.Icon><Icon icon="solar:close-circle-bold" className="size-12 text-danger" /></Modal.Icon><Modal.Heading>{intl.formatMessage({ id: 'found_transaction.error', defaultMessage: 'Error' })}</Modal.Heading></Modal.Header><Modal.Body><p className="text-center text-sm text-muted">{resultMessage}</p></Modal.Body><Modal.Footer><Button onPress={handleModalClose}>{intl.formatMessage({ id: 'found_transaction.close', defaultMessage: 'Close' })}</Button></Modal.Footer></>
              ) : (
                <><Modal.Header><Modal.Icon><Icon icon={modalAction === 'confirm-approve' ? 'solar:check-circle-bold' : 'solar:close-circle-bold'} className={`size-10 ${modalAction === 'confirm-approve' ? 'text-success' : 'text-danger'}`} /></Modal.Icon><Modal.Heading>{modalAction === 'confirm-approve' ? intl.formatMessage({ id: 'found_transaction.confirm_approve', defaultMessage: 'Confirm Approve' }) : intl.formatMessage({ id: 'found_transaction.confirm_reject', defaultMessage: 'Confirm Reject' })}</Modal.Heading></Modal.Header>
                  <Modal.Body className="space-y-4">
                    <p className="text-sm text-muted">{modalAction === 'confirm-approve' ? intl.formatMessage({ id: 'found_transaction.confirm_approve_desc', defaultMessage: 'Approve this transaction?' }) : intl.formatMessage({ id: 'found_transaction.confirm_reject_desc', defaultMessage: 'Reject this transaction?' })}</p>
                    <TextField fullWidth><Label>{intl.formatMessage({ id: 'found_transaction.message_label', defaultMessage: 'Message' })}</Label><TextArea rows={4} variant="secondary" value={approvalMessage} onChange={(e) => setApprovalMessage(e.target.value)} placeholder={intl.formatMessage({ id: 'found_transaction.message_placeholder', defaultMessage: 'Add a message (optional)' })} /></TextField>
                  </Modal.Body>
                  <Modal.Footer><Button variant="ghost" onPress={handleModalClose}>{intl.formatMessage({ id: 'found_transaction.cancel', defaultMessage: 'Cancel' })}</Button><Button variant={modalAction === 'confirm-reject' ? 'danger' : 'primary'} onPress={() => void handleConfirmSubmit()}>{modalAction === 'confirm-approve' ? intl.formatMessage({ id: 'found_transaction.action_approve', defaultMessage: 'Approve' }) : intl.formatMessage({ id: 'found_transaction.action_reject', defaultMessage: 'Reject' })}</Button></Modal.Footer></>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}

export { FoundTransactionDetailPage };
