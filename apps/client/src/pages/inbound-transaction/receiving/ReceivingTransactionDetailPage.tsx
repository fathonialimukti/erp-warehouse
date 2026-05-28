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

interface DetailItem {
  skuId: string;
  quantity: number;
  palletTypeId: string | null;
  details?: string | null;
  sku?: { name: string };
  palletType?: { name: string };
}

interface TransactionDetail {
  id: string;
  approvalStatus: string;
  date: string;
  documentNumber?: string | null;
  supplierId?: string | null;
  supplier?: { name?: string | null } | null;
  purchaseOrderRef?: string | null;
  deliveryNoteRef?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  driverName?: string | null;
  driverContact?: string | null;
  vehiclePlate?: string | null;
  notes?: string | null;
  files?: Array<{ name?: string; type?: string; size?: number; url?: string; storedName?: string }> | null;
  warehouse?: { name?: string | null } | null;
  createdBy?: { name?: string | null } | null;
  approvedBy?: { name?: string | null } | null;
  approvalHistory?: unknown;
  items?: DetailItem[];
}

function ReceivingTransactionDetailPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const queryClient = useQueryClient();

  const hasPermission = useAtomValue(hasPermissionAtom);
  const canApprove = hasPermission('receiving@approve');
  const canUpdate = hasPermission('receiving@update');

  type ModalAction = 'idle' | 'confirm-approve' | 'confirm-reject' | 'loading' | 'success' | 'error';
  const [modalAction, setModalAction] = useState<ModalAction>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const [approvalMessage, setApprovalMessage] = useState('');
  const resultTimerRef = useRef<number | null>(null);
  const actionRef = useRef<'approve' | 'reject'>('approve');

  const clearResultTimer = () => {
    if (resultTimerRef.current !== null) {
      window.clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
  };

  const handleModalClose = () => {
    if (modalAction === 'loading') return;
    clearResultTimer();
    setModalAction('idle');
    setApprovalMessage('');
  };

  const approveMutation = useMutation({
    mutationFn: (payload: { id: string; message?: string }) =>
      trpcClient.receivingTransaction.approve.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivingTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['receivingTransactionList'] });
      setResultMessage(intl.formatMessage({ id: 'receiving_transaction.approve_success', defaultMessage: 'Transaction approved successfully.' }));
      setModalAction('success');
      clearResultTimer();
      resultTimerRef.current = window.setTimeout(() => setModalAction('idle'), 1800);
    },
    onError: (err) => {
      setResultMessage(err instanceof Error ? err.message : intl.formatMessage({ id: 'error_generic', defaultMessage: 'An unexpected error occurred.' }));
      setModalAction('error');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (payload: { id: string; message?: string }) =>
      trpcClient.receivingTransaction.reject.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivingTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['receivingTransactionList'] });
      setResultMessage(intl.formatMessage({ id: 'receiving_transaction.reject_success', defaultMessage: 'Transaction rejected.' }));
      setModalAction('success');
      clearResultTimer();
      resultTimerRef.current = window.setTimeout(() => setModalAction('idle'), 1800);
    },
    onError: (err) => {
      setResultMessage(err instanceof Error ? err.message : intl.formatMessage({ id: 'error_generic', defaultMessage: 'An unexpected error occurred.' }));
      setModalAction('error');
    },
  });

  const { data: queryData, isLoading } = useQuery({
    queryKey: ['receivingTransactionDetail', id],
    queryFn: () => trpcClient.receivingTransaction.detail.query({ id: id! }),
    enabled: Boolean(id),
  });

  const data = queryData as TransactionDetail | undefined;
  const itemCount = useMemo(() => data?.items?.length ?? 0, [data]);

  const handleConfirmSubmit = async () => {
    if (!id || !data) return;
    setModalAction('loading');
    try {
      if (actionRef.current === 'approve') {
        await approveMutation.mutateAsync({ id, message: approvalMessage });
      } else {
        await rejectMutation.mutateAsync({ id, message: approvalMessage });
      }
    } catch {
      // handled in mutation onError
    }
  };

  return (
    <section
      className="space-y-6"
      data-ai-context={JSON.stringify({
        section: 'receiving-transaction-detail',
        id: data?.id,
        documentNumber: data?.documentNumber,
        supplier: data?.supplier?.name,
        warehouse: data?.warehouse?.name,
        approvalStatus: data?.approvalStatus,
        itemCount,
      })}
    >
      <PageHeader
        title={intl.formatMessage({ id: 'receiving_transaction.detail_title', defaultMessage: 'Receiving Transaction Detail' })}
        onBack={() => navigate('/inbound-transaction')}
        onEdit={
          canUpdate && ['DRAFT', 'REJECTED'].includes(data?.approvalStatus ?? '')
            ? () => navigate(`/inbound-transaction/receiving/${id!}/edit`)
            : undefined
        }
      />

      {isLoading ? (
        <div className="flex min-h-72 flex-col items-center justify-center gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-muted">
            {intl.formatMessage({ id: 'receiving_transaction.detail_loading', defaultMessage: 'Loading transaction data...' })}
          </p>
        </div>
      ) : !data ? (
        <div className="space-y-3">
          <p className="text-sm text-danger">
            {intl.formatMessage({ id: 'receiving_transaction.detail_not_found', defaultMessage: 'Receiving transaction not found.' })}
          </p>
          <Button variant="ghost" onPress={() => navigate('/inbound-transaction')}>
            {intl.formatMessage({ id: 'receiving_transaction.detail_back', defaultMessage: 'Back' })}
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Fieldset>
              <FieldsetLegend>
                {intl.formatMessage({ id: 'receiving_transaction.section_general', defaultMessage: 'Transaction Details' })}
              </FieldsetLegend>
              <FieldGroup>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'receiving_transaction.label_id', defaultMessage: 'Transaction ID' })}</p>
                    <p className="mt-2 font-mono text-sm text-foreground">{data.id}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'receiving_transaction.label_document_number', defaultMessage: 'Document Number' })}</p>
                    <p className="mt-2 text-sm text-foreground">{data.documentNumber ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'receiving_transaction.label_date', defaultMessage: 'Date' })}</p>
                    <p className="mt-2 text-sm text-foreground">{intl.formatDate(new Date(data.date))}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'receiving_transaction.label_warehouse', defaultMessage: 'Warehouse' })}</p>
                    <p className="mt-2 text-sm text-foreground">{data.warehouse?.name ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'receiving_transaction.label_supplier', defaultMessage: 'Supplier' })}</p>
                    <p className="mt-2 text-sm text-foreground">{data.supplier?.name ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'receiving_transaction.label_status', defaultMessage: 'Status' })}</p>
                    <p className="mt-2 text-sm text-foreground">{data.approvalStatus}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'receiving_transaction.label_po_ref', defaultMessage: 'Purchase Order Ref' })}</p>
                    <p className="mt-2 text-sm text-foreground">{data.purchaseOrderRef ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'receiving_transaction.label_dn_ref', defaultMessage: 'Delivery Note Ref' })}</p>
                    <p className="mt-2 text-sm text-foreground">{data.deliveryNoteRef ?? '-'}</p>
                  </div>
                </div>
              </FieldGroup>
            </Fieldset>

            <Fieldset>
              <FieldsetLegend>
                {intl.formatMessage({ id: 'receiving_transaction.section_shipment', defaultMessage: 'Shipment & Driver' })}
              </FieldsetLegend>
              <FieldGroup>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'receiving_transaction.label_carrier', defaultMessage: 'Carrier' })}</p>
                    <p className="mt-2 text-sm text-foreground">{data.carrier ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'receiving_transaction.label_tracking', defaultMessage: 'Tracking Number' })}</p>
                    <p className="mt-2 text-sm text-foreground">{data.trackingNumber ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'receiving_transaction.label_driver_name', defaultMessage: 'Driver Name' })}</p>
                    <p className="mt-2 text-sm text-foreground">{data.driverName ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'receiving_transaction.label_driver_contact', defaultMessage: 'Driver Contact' })}</p>
                    <p className="mt-2 text-sm text-foreground">{data.driverContact ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'receiving_transaction.label_vehicle_plate', defaultMessage: 'Vehicle Plate' })}</p>
                    <p className="mt-2 text-sm text-foreground">{data.vehiclePlate ?? '-'}</p>
                  </div>
                </div>
              </FieldGroup>
            </Fieldset>

            <Fieldset>
              <FieldsetLegend>
                {intl.formatMessage({ id: 'receiving_transaction.section_notes', defaultMessage: 'Notes & Attachments' })}
              </FieldsetLegend>
              <FieldGroup>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'receiving_transaction.label_notes', defaultMessage: 'Notes' })}</p>
                    <p className="mt-2 text-sm text-foreground">{data.notes ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'receiving_transaction.label_files', defaultMessage: 'Attachments' })}</p>
                    {data.files?.length ? (
                      <ul className="mt-2 space-y-1">
                        {data.files.map((file, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <Icon icon="solar:file-linear" className="size-4 shrink-0 text-muted" />
                            <a href={file.url ?? '#'} target="_blank" rel="noopener noreferrer" className="truncate text-primary underline-offset-2 hover:underline">
                              {file.name ?? 'Unnamed file'}
                            </a>
                            {file.size != null && (
                              <span className="shrink-0 text-xs text-muted">{Math.round(file.size / 1024)} KB</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-muted">{intl.formatMessage({ id: 'receiving_transaction.no_attachments', defaultMessage: 'No attachments' })}</p>
                    )}
                  </div>
                </div>
              </FieldGroup>
            </Fieldset>
          </div>

          <div className="flex justify-end">
            <ApprovalHistory approvalHistory={data?.approvalHistory} />
          </div>

          <Fieldset>
            <Fieldset.Legend>
              {intl.formatMessage({ id: 'receiving_transaction.items_title', defaultMessage: 'Transaction Items' })}
            </Fieldset.Legend>
            <Description>
              {intl.formatMessage({ id: 'receiving_transaction.items_description', defaultMessage: 'Review the items in this receiving transaction.' })}
            </Description>
            <FieldGroup>
              {itemCount > 0 ? (
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content aria-label={intl.formatMessage({ id: 'receiving_transaction.items_aria', defaultMessage: 'Transaction items' })}>
                      <Table.Header>
                        <Table.Column>{intl.formatMessage({ id: 'receiving_transaction.col_sku', defaultMessage: 'SKU' })}</Table.Column>
                        <Table.Column>{intl.formatMessage({ id: 'receiving_transaction.col_pallet_type', defaultMessage: 'Pallet Type' })}</Table.Column>
                        <Table.Column>{intl.formatMessage({ id: 'receiving_transaction.col_details', defaultMessage: 'Details' })}</Table.Column>
                        <Table.Column>{intl.formatMessage({ id: 'receiving_transaction.col_quantity', defaultMessage: 'Qty' })}</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {data.items?.map((item, i) => (
                          <Table.Row key={`${item.skuId}-${item.palletTypeId}-${i}`}>
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
                <EmptyState>
                  {intl.formatMessage({ id: 'receiving_transaction.no_items', defaultMessage: 'No transaction items available.' })}
                </EmptyState>
              )}
            </FieldGroup>
          </Fieldset>
        </>
      )}

      <div className="flex justify-end gap-2">
        {canApprove && data?.approvalStatus === 'PROPOSED' && (
          <>
            <Button onPress={() => { actionRef.current = 'approve'; setApprovalMessage(''); setModalAction('confirm-approve'); }}>
              <Icon icon="solar:check-circle-bold" className="size-4" />
              {intl.formatMessage({ id: 'receiving_transaction.approve', defaultMessage: 'Approve' })}
            </Button>
            <Button onPress={() => { actionRef.current = 'reject'; setApprovalMessage(''); setModalAction('confirm-reject'); }}>
              <Icon icon="solar:close-circle-bold" className="size-4" />
              {intl.formatMessage({ id: 'receiving_transaction.reject', defaultMessage: 'Reject' })}
            </Button>
          </>
        )}
        {canApprove && data?.approvalStatus === 'APPROVED' && (
          <Button onPress={() => { actionRef.current = 'reject'; setApprovalMessage(''); setModalAction('confirm-reject'); }}>
            <Icon icon="solar:close-circle-bold" className="size-4" />
            {intl.formatMessage({ id: 'receiving_transaction.reject', defaultMessage: 'Reject' })}
          </Button>
        )}
      </div>

      <Modal>
        <Modal.Backdrop
          isOpen={modalAction !== 'idle'}
          onOpenChange={(open) => { if (!open) handleModalClose(); }}
          isDismissable={modalAction !== 'loading'}
          isKeyboardDismissDisabled={modalAction === 'loading'}
        >
          <Modal.Container size="sm">
            <Modal.Dialog>
              {modalAction === 'loading' ? (
                <>
                  <Modal.Header>
                    <Modal.Heading>{intl.formatMessage({ id: 'receiving_transaction.action_processing', defaultMessage: 'Processing…' })}</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body className="flex flex-col items-center gap-4 py-8">
                    <Spinner size="lg" />
                    <p className="text-sm text-muted">{intl.formatMessage({ id: 'receiving_transaction.action_please_wait', defaultMessage: 'Please wait…' })}</p>
                  </Modal.Body>
                </>
              ) : modalAction === 'success' ? (
                <>
                  <Modal.Header>
                    <Modal.Icon><Icon icon="solar:check-circle-bold" className="size-12 text-success" /></Modal.Icon>
                    <Modal.Heading>{intl.formatMessage({ id: 'receiving_transaction.action_success_title', defaultMessage: 'Done' })}</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <p className="text-center text-sm text-muted">{resultMessage}</p>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button onPress={handleModalClose}>{intl.formatMessage({ id: 'receiving_transaction.action_close', defaultMessage: 'Close' })}</Button>
                  </Modal.Footer>
                </>
              ) : modalAction === 'error' ? (
                <>
                  <Modal.Header>
                    <Modal.Icon><Icon icon="solar:close-circle-bold" className="size-12 text-danger" /></Modal.Icon>
                    <Modal.Heading>{intl.formatMessage({ id: 'receiving_transaction.action_error_title', defaultMessage: 'Something went wrong' })}</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <p className="text-center text-sm text-muted">{resultMessage}</p>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button onPress={handleModalClose}>{intl.formatMessage({ id: 'receiving_transaction.action_close', defaultMessage: 'Close' })}</Button>
                  </Modal.Footer>
                </>
              ) : (
                <>
                  <Modal.Header>
                    <Modal.Icon>
                      <Icon
                        icon={modalAction === 'confirm-approve' ? 'solar:check-circle-bold' : 'solar:close-circle-bold'}
                        className={`size-10 ${modalAction === 'confirm-approve' ? 'text-success' : 'text-danger'}`}
                      />
                    </Modal.Icon>
                    <Modal.Heading>
                      {modalAction === 'confirm-approve'
                        ? intl.formatMessage({ id: 'receiving_transaction.confirm_approve_title', defaultMessage: 'Confirm Approve' })
                        : intl.formatMessage({ id: 'receiving_transaction.confirm_reject_title', defaultMessage: 'Confirm Reject' })}
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body className="space-y-4">
                    <p className="text-sm text-muted">
                      {modalAction === 'confirm-approve'
                        ? intl.formatMessage({ id: 'receiving_transaction.confirm_approve_desc', defaultMessage: 'Approve this transaction? This action cannot be undone.' })
                        : intl.formatMessage({ id: 'receiving_transaction.confirm_reject_desc', defaultMessage: 'Reject this transaction? This action cannot be undone.' })}
                    </p>
                    <TextField fullWidth>
                      <Label>{intl.formatMessage({ id: 'receiving_transaction.approval_message_label', defaultMessage: 'Message' })}</Label>
                      <TextArea
                        rows={4}
                        variant="secondary"
                        value={approvalMessage}
                        onChange={(e) => setApprovalMessage(e.target.value)}
                        placeholder={intl.formatMessage({ id: 'receiving_transaction.approval_message_placeholder', defaultMessage: 'Add a message (optional)' })}
                      />
                    </TextField>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="ghost" onPress={handleModalClose}>{intl.formatMessage({ id: 'receiving_transaction.action_cancel', defaultMessage: 'Cancel' })}</Button>
                    <Button
                      variant={modalAction === 'confirm-reject' ? 'danger' : 'primary'}
                      onPress={() => void handleConfirmSubmit()}
                    >
                      {modalAction === 'confirm-approve'
                        ? intl.formatMessage({ id: 'receiving_transaction.action_approve', defaultMessage: 'Approve' })
                        : intl.formatMessage({ id: 'receiving_transaction.action_reject', defaultMessage: 'Reject' })}
                    </Button>
                  </Modal.Footer>
                </>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}

export { ReceivingTransactionDetailPage };
