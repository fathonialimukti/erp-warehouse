import { useMemo, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { Button, Description, EmptyState, FieldGroup, Fieldset, FieldsetLegend, Modal, Spinner, Table, TextArea, TextField, Label } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';
import { PageHeader } from '../../../components/PageHeader';
import { hasPermissionAtom } from '../../../lib/atoms';

type InboundTransactionProposeInput = inferProcedureInput<AppRouter['inboundTransaction']['propose']>;
type InboundTransactionApproveInput = inferProcedureInput<AppRouter['inboundTransaction']['approve']>;
type InboundTransactionRejectInput = inferProcedureInput<AppRouter['inboundTransaction']['reject']>;

type TransactionUser = {
  name?: string | null;
  email?: string | null;
  username?: string | null;
};

type TransactionLocation = {
  name?: string | null;
  warehouse?: {
    name?: string | null;
  };
};

interface InboundTransactionDetailItem {
  skuId: string;
  quantity: number;
  palletTypeId: string | null;
  supplierReference?: string | null;
  purchaseOrderNumber?: string | null;
  externalBatchNumber?: string | null;
  externalSerialNumber?: string | null;
  receivedQuantity?: number | null;
  damagedQuantity?: number | null;
  missingQuantity?: number | null;
  qualityStatus?: string | null;
  inspectionNotes?: string | null;
  carrierName?: string | null;
  trackingNumber?: string | null;
  shipmentDate?: string | null;
  unitCost?: number | null;
  totalCost?: number | null;
  sku?: {
    name: string;
  };
  palletType?: {
    name: string;
  };
  pallets?: Array<{ id: string }>;
}

interface InboundTransactionDetail {
  id: string;
  approvalStatus: string;
  date: string;
  transactionCode?: string | null;
  sender?: string | null;
  reference?: string | null;
  asnNumber?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  bolNumber?: string | null;
  driverName?: string | null;
  driverContact?: string | null;
  vehiclePlate?: string | null;
  notes: string | null;
  files?: Array<{ name?: string; type?: string; size?: number; url?: string; storedName?: string }> | null;
  createdAt: string;
  updatedAt: string;
  incomingLocation?: TransactionLocation;
  createdBy?: TransactionUser;
  approvedBy?: TransactionUser;
  approvedAt?: string | null;
  approvalHistory?: unknown;
  items?: InboundTransactionDetailItem[];
}

const InboundTransactionDetailPage = () => {
  const intl = useIntl();
  const navigate = useNavigate();

  const hasPermission = useAtomValue(hasPermissionAtom);
  const canApprove = hasPermission('approval_approve');
  const canUpdate = hasPermission('warehouse_transaction_update');

  const { id } = useParams<{ id?: string }>();
  const queryClient = useQueryClient();

  // ─── Modal state machine ────────────────────────────────────────────────
  type ModalAction = 'idle' | 'confirm-propose' | 'confirm-approve' | 'confirm-reject' | 'loading' | 'success' | 'error';
  const [modalAction, setModalAction] = useState<ModalAction>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const [approvalMessage, setApprovalMessage] = useState('');
  const resultTimerRef = useRef<number | null>(null);

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

  const proposeMutation = useMutation<unknown, unknown, InboundTransactionProposeInput>({
    mutationFn: (payload) => trpcClient.inboundTransaction.propose.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inboundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['inboundTransactionList'] });
      setResultMessage(intl.formatMessage({ id: 'inbound_transaction.propose_success', defaultMessage: 'Transaction proposed for approval.' }));
      setModalAction('success');
      clearResultTimer();
      resultTimerRef.current = window.setTimeout(() => setModalAction('idle'), 1800);
    },
    onError: (err) => {
      setResultMessage(err instanceof Error ? err.message : intl.formatMessage({ id: 'error_generic', defaultMessage: 'An unexpected error occurred.' }));
      setModalAction('error');
    },
  });

  const approveMutation = useMutation<unknown, unknown, InboundTransactionApproveInput>({
    mutationFn: (payload) => trpcClient.inboundTransaction.approve.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inboundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['inboundTransactionList'] });
      setResultMessage(intl.formatMessage({ id: 'inbound_transaction.approve_success', defaultMessage: 'Transaction approved successfully.' }));
      setModalAction('success');
      clearResultTimer();
      resultTimerRef.current = window.setTimeout(() => setModalAction('idle'), 1800);
    },
    onError: (err) => {
      setResultMessage(err instanceof Error ? err.message : intl.formatMessage({ id: 'error_generic', defaultMessage: 'An unexpected error occurred.' }));
      setModalAction('error');
    },
  });

  const rejectMutation = useMutation<unknown, unknown, InboundTransactionRejectInput>({
    mutationFn: (payload) => trpcClient.inboundTransaction.reject.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inboundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['inboundTransactionList'] });
      setResultMessage(intl.formatMessage({ id: 'inbound_transaction.reject_success', defaultMessage: 'Transaction rejected.' }));
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
    queryKey: ['inboundTransactionDetail', id],
    queryFn: () => trpcClient.inboundTransaction.detail.query({ id: id! }),
    enabled: Boolean(id),
  });

  const data = queryData as InboundTransactionDetail | undefined;
  const itemCount = useMemo(() => data?.items?.length ?? 0, [data]);

  const actionRef = useRef<'propose' | 'approve' | 'reject'>('propose');

  const handleConfirmSubmit = async () => {
    if (!id || !data) return;
    setModalAction('loading');
    try {
      if (actionRef.current === 'propose') {
        await proposeMutation.mutateAsync({ id });
      } else if (actionRef.current === 'approve') {
        await approveMutation.mutateAsync({ id, message: approvalMessage });
      } else {
        await rejectMutation.mutateAsync({ id, message: approvalMessage });
      }
    } catch {
      // errors handled in mutation onError
    }
  };

  return (
    <section className="space-y-6">
      <PageHeader
        title={intl.formatMessage({ id: 'inbound_transaction.detail_title', defaultMessage: 'Inbound Transaction Detail' })}
        onBack={() => navigate('/transactions')}
        onEdit={canUpdate && data?.approvalStatus === 'DRAFT' ? () => navigate(`/transactions/inbound/form/${id}`) : undefined}
      >

      </PageHeader>

      {isLoading ? (
        <div className="flex min-h-72 flex-col items-center justify-center gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-muted">
            {intl.formatMessage({ id: 'inbound_transaction.detail_loading', defaultMessage: 'Loading transaction data...' })}
          </p>
        </div>
      ) : !data ? (
        <div className="space-y-3">
          <p className="text-sm text-danger">
            {intl.formatMessage({ id: 'transaction.incoming_detail.not_found', defaultMessage: 'Inbound transaction not found.' })}
          </p>
          <Button variant="ghost" onPress={() => navigate('/transactions/inbound')}>
            {intl.formatMessage({ id: 'inbound_transaction.detail_back', defaultMessage: 'Back' })}
          </Button>
        </div>
      ) : (
        <>



          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Fieldset>
              <FieldsetLegend>
                {intl.formatMessage({ id: 'inbound_transaction_form_section_general_legend', defaultMessage: 'Transaction details' })}
              </FieldsetLegend>
              <FieldGroup>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'inbound_transaction_form_label_id', defaultMessage: 'Transaction ID' })}</p>
                    <p className="mt-2 font-mono text-sm text-foreground">{data.id}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'inbound_transaction_form_label_sender', defaultMessage: 'Sender' })}</p>
                    <p className="mt-2 text-sm text-foreground">{data.sender ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'inbound_transaction_form_label_reference', defaultMessage: 'Reference' })}</p>
                    <p className="mt-2 text-sm text-foreground">{data.reference ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'inbound_transaction_form_label_asn_number', defaultMessage: 'ASN Number' })}</p>
                    <p className="mt-2 text-sm text-foreground">{data.asnNumber ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'inbound_transaction_form_label_carrier', defaultMessage: 'Carrier' })}</p>
                    <p className="mt-2 text-sm text-foreground">{data.carrier ?? '-'}</p>
                  </div>
                </div>
              </FieldGroup>
            </Fieldset>

            <Fieldset>
              <FieldsetLegend>
                {intl.formatMessage({ id: 'inbound_transaction_form_section_shipment_legend', defaultMessage: 'Shipment details' })}
              </FieldsetLegend>
              <FieldGroup>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'inbound_transaction_form_label_tracking_number', defaultMessage: 'Tracking Number' })}</p>
                    <p className="mt-2 text-sm text-foreground">{data.trackingNumber ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'inbound_transaction_form_label_bol_number', defaultMessage: 'BOL Number' })}</p>
                    <p className="mt-2 text-sm text-foreground">{data.bolNumber ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'inbound_transaction_form_label_vehicle_plate', defaultMessage: 'Vehicle Plate' })}</p>
                    <p className="mt-2 text-sm text-foreground">{data.vehiclePlate ?? '-'}</p>
                  </div>
                </div>
              </FieldGroup>
            </Fieldset>

            <Fieldset>
              <FieldsetLegend>
                {intl.formatMessage({ id: 'inbound_transaction_form_section_driver_legend', defaultMessage: 'Driver information' })}
              </FieldsetLegend>
              <FieldGroup>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'inbound_transaction_form_label_driver_name', defaultMessage: 'Driver Name' })}</p>
                    <p className="mt-2 text-sm text-foreground">{data.driverName ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'inbound_transaction_form_label_driver_contact', defaultMessage: 'Driver Contact' })}</p>
                    <p className="mt-2 text-sm text-foreground">{data.driverContact ?? '-'}</p>
                  </div>
                </div>
              </FieldGroup>
            </Fieldset>

            <Fieldset>
              <FieldsetLegend>
                {intl.formatMessage({ id: 'inbound_transaction_form_section_notes_legend', defaultMessage: 'Notes & attachments' })}
              </FieldsetLegend>
              <FieldGroup>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'inbound_transaction_form_labelnotes', defaultMessage: 'Notes' })}</p>
                    <p className="mt-2 text-sm text-foreground">{data.notes ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">{intl.formatMessage({ id: 'inbound_transaction_form_label_files', defaultMessage: 'Attachments' })}</p>
                    {data.files?.length ? (
                      <ul className="mt-2 space-y-1">
                        {data.files.map((file, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <Icon icon="solar:file-linear" className="size-4 shrink-0 text-muted" />
                            <a
                              href={file.url ?? '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate text-primary underline-offset-2 hover:underline"
                            >
                              {file.name ?? 'Unnamed file'}
                            </a>
                            {file.size != null && (
                              <span className="shrink-0 text-xs text-muted">{Math.round(file.size / 1024)} KB</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-muted">{intl.formatMessage({ id: 'inbound_transaction.detail_no_attachments', defaultMessage: 'No attachments' })}</p>
                    )}
                  </div>
                </div>
              </FieldGroup>
            </Fieldset>
          </div>

          <Fieldset>
            <Fieldset.Legend>
              {intl.formatMessage({ id: 'inbound_transaction.detail_items_title', defaultMessage: 'Transaction Items' })}
            </Fieldset.Legend>
            <Description>
              {intl.formatMessage({ id: 'inbound_transaction.detail_items_description', defaultMessage: 'Review item-level 3PL and receiving details.' })}
            </Description>
            <FieldGroup>
              {itemCount > 0 ? (
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content aria-label={intl.formatMessage({ id: 'inbound_transaction.detail_items_aria', defaultMessage: 'Inbound transaction items' })} className="hover:none">
                      <Table.Header>
                        <Table.Column>{intl.formatMessage({ id: 'inbound_transaction.detail_col_sku', defaultMessage: 'SKU' })}</Table.Column>
                        <Table.Column>{intl.formatMessage({ id: 'inbound_transaction.detail_col_pallet_type', defaultMessage: 'Pallet Type' })}</Table.Column>
                        <Table.Column>{intl.formatMessage({ id: 'inbound_transaction.detail_col_quantity', defaultMessage: 'Qty' })}</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {data.items?.map((item) => (
                          <Table.Row key={`${item.skuId}-${item.palletTypeId}-${String(item.quantity)}`}>
                            <Table.Cell>{item.sku?.name ?? item.skuId}</Table.Cell>
                            <Table.Cell>{item.palletType?.name ?? item.palletTypeId}</Table.Cell>
                            <Table.Cell>{item.quantity}</Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              ) : (
                <EmptyState>
                  {intl.formatMessage({ id: 'inbound_transaction.detail_no_items', defaultMessage: 'No transaction items available.' })}
                </EmptyState>
              )}
            </FieldGroup>
          </Fieldset>
        </>
      )
      }


      <div className="flex justify-end gap-2">
        {canUpdate && data?.approvalStatus === 'DRAFT' && (
          <Button className="bg-warning text-warning-foreground" onPress={() => { actionRef.current = 'propose'; setApprovalMessage(''); setModalAction('confirm-propose'); }}>
            <Icon icon="mdi:send" className="size-4" />
            {intl.formatMessage({ id: 'inbound_transaction.propose', defaultMessage: 'Propose' })}
          </Button>
        )}
        {canApprove && data?.approvalStatus === 'PROPOSED' && (
        <>
          <Button className="bg-success text-success-foreground" onPress={() => { actionRef.current = 'approve'; setApprovalMessage(''); setModalAction('confirm-approve'); }}>
            <Icon icon="mdi:check" className="size-4 " />
            {intl.formatMessage({ id: 'inbound_transaction.approve', defaultMessage: 'Approve' })}
          </Button>
          <Button className="bg-danger text-danger-foreground" onPress={() => { actionRef.current = 'reject'; setApprovalMessage(''); setModalAction('confirm-reject'); }}>
            <Icon icon="mdi:close" className="size-4" />
            {intl.formatMessage({ id: 'inbound_transaction.reject', defaultMessage: 'Reject' })}
          </Button>
        </>
        )}
      </div>

      {/* ── Confirmation / loading / result modal ────────────────────────── */}
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
                    <Modal.Heading>
                      {intl.formatMessage({ id: 'inbound_transaction.action_processing', defaultMessage: 'Processing…' })}
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body className="flex flex-col items-center gap-4 py-8">
                    <Spinner size="lg" />
                    <p className="text-sm text-muted">
                      {intl.formatMessage({ id: 'inbound_transaction.action_please_wait', defaultMessage: 'Please wait…' })}
                    </p>
                  </Modal.Body>
                </>
              ) : modalAction === 'success' ? (
                <>
                  <Modal.Header>
                    <Modal.Icon>
                      <Icon icon="solar:check-circle-bold" className="size-12 text-success" />
                    </Modal.Icon>
                    <Modal.Heading>
                      {intl.formatMessage({ id: 'inbound_transaction.action_success_title', defaultMessage: 'Done' })}
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <p className="text-center text-sm text-muted">{resultMessage}</p>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button onPress={handleModalClose}>
                      {intl.formatMessage({ id: 'inbound_transaction.action_close', defaultMessage: 'Close' })}
                    </Button>
                  </Modal.Footer>
                </>
              ) : modalAction === 'error' ? (
                <>
                  <Modal.Header>
                    <Modal.Icon>
                      <Icon icon="solar:close-circle-bold" className="size-12 text-danger" />
                    </Modal.Icon>
                    <Modal.Heading>
                      {intl.formatMessage({ id: 'inbound_transaction.action_error_title', defaultMessage: 'Something went wrong' })}
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <p className="text-center text-sm text-muted">{resultMessage}</p>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button onPress={handleModalClose}>
                      {intl.formatMessage({ id: 'inbound_transaction.action_close', defaultMessage: 'Close' })}
                    </Button>
                  </Modal.Footer>
                </>
              ) : (
                // confirm-propose | confirm-approve | confirm-reject
                <>
                  <Modal.Header>
                    <Modal.Icon>
                      <Icon
                        icon={
                          modalAction === 'confirm-propose' ? 'mdi:send'
                            : modalAction === 'confirm-approve' ? 'solar:check-circle-bold'
                              : 'solar:close-circle-bold'
                        }
                        className={`size-10 ${modalAction === 'confirm-propose' ? 'text-warning'
                          : modalAction === 'confirm-approve' ? 'text-success'
                            : 'text-danger'
                          }`}
                      />
                    </Modal.Icon>
                    <Modal.Heading>
                      {modalAction === 'confirm-propose'
                        ? intl.formatMessage({ id: 'inbound_transaction.confirm_propose_title', defaultMessage: 'Confirm Propose' })
                        : modalAction === 'confirm-approve'
                          ? intl.formatMessage({ id: 'inbound_transaction.confirm_approve_title', defaultMessage: 'Confirm Approve' })
                          : intl.formatMessage({ id: 'inbound_transaction.confirm_reject_title', defaultMessage: 'Confirm Reject' })}
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body className="space-y-4">
                    <p className="text-sm text-muted">
                      {modalAction === 'confirm-propose'
                        ? intl.formatMessage({ id: 'inbound_transaction.confirm_propose_desc', defaultMessage: 'Send this transaction for approval and change its status to pending?' })
                        : modalAction === 'confirm-approve'
                          ? intl.formatMessage({ id: 'inbound_transaction.confirm_approve_desc', defaultMessage: 'Approve this transaction? This action cannot be undone.' })
                          : intl.formatMessage({ id: 'inbound_transaction.confirm_reject_desc', defaultMessage: 'Reject this transaction? This action cannot be undone.' })}
                    </p>
                    <TextField fullWidth>
                      <Label>
                        {intl.formatMessage({ id: 'inbound_transaction.approval_message_label', defaultMessage: 'Message' })}
                      </Label>
                      <TextArea
                        rows={4}
                        variant="secondary"
                        value={approvalMessage}
                        onChange={(event) => setApprovalMessage(event.target.value)}
                        placeholder={intl.formatMessage({ id: 'inbound_transaction.approval_message_placeholder', defaultMessage: 'Add a message for this action (optional)' })}
                      />
                    </TextField>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="ghost" onPress={handleModalClose}>
                      {intl.formatMessage({ id: 'inbound_transaction.action_cancel', defaultMessage: 'Cancel' })}
                    </Button>
                    <Button
                      variant={modalAction === 'confirm-reject' ? 'danger' : 'primary'}
                      onPress={() => void handleConfirmSubmit()}
                    >
                      {modalAction === 'confirm-propose'
                        ? intl.formatMessage({ id: 'inbound_transaction.action_send', defaultMessage: 'Send for approval' })
                        : modalAction === 'confirm-approve'
                          ? intl.formatMessage({ id: 'inbound_transaction.action_approve', defaultMessage: 'Approve' })
                          : intl.formatMessage({ id: 'inbound_transaction.action_reject', defaultMessage: 'Reject' })}
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
};

export default InboundTransactionDetailPage;
