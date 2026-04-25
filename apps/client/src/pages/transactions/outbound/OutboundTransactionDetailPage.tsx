import { useMemo, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { Button, Chip, Description, EmptyState, FieldGroup, Fieldset, FieldsetLegend, Label, Modal, Spinner, Table, TextArea, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';
import { ApprovalHistory } from '../../../components/ApprovalHistory';
import { PageHeader } from '../../../components/PageHeader';
import { ApprovalStatusChip } from '../shared';
import { hasPermissionAtom } from '../../../lib/atoms';

type OutboundTransactionApproveInput = inferProcedureInput<AppRouter['outboundTransaction']['approve']>;
type OutboundTransactionRejectInput = inferProcedureInput<AppRouter['outboundTransaction']['reject']>;
type OutboundTransactionProposeInput = inferProcedureInput<AppRouter['outboundTransaction']['propose']>;

interface OutboundTransactionDetailItem {
  skuId: string;
  palletTypeId: string | null;
  details?: string | null;
  pallets?: Array<{ id: string; status: string }>;
  sku?: { name?: string | null };
  palletType?: { name?: string | null };
}

interface OutboundTransactionDetail {
  id: string;
  approvalStatus: string;
  date: string;
  recipient?: string | null;
  reference?: string | null;
  notes?: string | null;
  approvalHistory?: unknown;
  createdBy?: { name?: string | null };
  approvedBy?: { name?: string | null };
  items?: OutboundTransactionDetailItem[];
}

const OutboundTransactionDetailPage = () => {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canApprove = hasPermission('approval_approve');
  const canUpdate = hasPermission('warehouse_transaction_update');

  type ModalAction = 'idle' | 'confirm-propose' | 'confirm-approve' | 'confirm-reject' | 'loading' | 'success' | 'error';
  const [approvalMessage, setApprovalMessage] = useState('');
  const [modalAction, setModalAction] = useState<ModalAction>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const resultTimerRef = useRef<number | null>(null);
  const actionRef = useRef<'propose' | 'approve' | 'reject'>('propose');

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

  const { data: queryData, isLoading } = useQuery({
    queryKey: ['outboundTransactionDetail', id],
    queryFn: () => trpcClient.outboundTransaction.detail.query({ id: id! }),
    enabled: Boolean(id),
  });

  const detail = queryData as OutboundTransactionDetail | undefined;

  const proposeMutation = useMutation<unknown, unknown, OutboundTransactionProposeInput>({
    mutationFn: (payload) => trpcClient.outboundTransaction.propose.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionList'] });
      setResultMessage(intl.formatMessage({ id: 'transaction.outbound_detail.propose_success', defaultMessage: 'Transaction proposed for approval.' }));
      setModalAction('success');
      clearResultTimer();
      resultTimerRef.current = window.setTimeout(() => setModalAction('idle'), 1800);
    },
    onError: (err) => {
      setResultMessage(err instanceof Error ? err.message : intl.formatMessage({ id: 'error_generic', defaultMessage: 'An unexpected error occurred.' }));
      setModalAction('error');
    },
  });

  const approveMutation = useMutation<unknown, unknown, OutboundTransactionApproveInput>({
    mutationFn: (payload) => trpcClient.outboundTransaction.approve.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionList'] });
      setResultMessage(intl.formatMessage({ id: 'transaction.outbound_detail.approve_success', defaultMessage: 'Transaction approved successfully.' }));
      setModalAction('success');
      clearResultTimer();
      resultTimerRef.current = window.setTimeout(() => setModalAction('idle'), 1800);
    },
    onError: (err) => {
      setResultMessage(err instanceof Error ? err.message : intl.formatMessage({ id: 'error_generic', defaultMessage: 'An unexpected error occurred.' }));
      setModalAction('error');
    },
  });

  const rejectMutation = useMutation<unknown, unknown, OutboundTransactionRejectInput>({
    mutationFn: (payload) => trpcClient.outboundTransaction.reject.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionList'] });
      setResultMessage(intl.formatMessage({ id: 'transaction.outbound_detail.reject_success', defaultMessage: 'Transaction rejected.' }));
      setModalAction('success');
      clearResultTimer();
      resultTimerRef.current = window.setTimeout(() => setModalAction('idle'), 1800);
    },
    onError: (err) => {
      setResultMessage(err instanceof Error ? err.message : intl.formatMessage({ id: 'error_generic', defaultMessage: 'An unexpected error occurred.' }));
      setModalAction('error');
    },
  });

  const handleConfirmSubmit = async () => {
    if (!id) return;
    setModalAction('loading');

    try {
      if (actionRef.current === 'propose') {
        await proposeMutation.mutateAsync({ id, message: approvalMessage || undefined });
      } else if (actionRef.current === 'approve') {
        await approveMutation.mutateAsync({ id, message: approvalMessage || undefined });
      } else {
        await rejectMutation.mutateAsync({ id, message: approvalMessage || undefined });
      }
    } catch {
      // errors handled by mutation onError
    }
  };

  const summary = useMemo(() => {
    const count = detail?.items?.reduce((sum, item) => sum + (item.pallets?.length ?? 0), 0) ?? 0;
    const uniqueSkuCount = new Set(detail?.items?.map((item) => item.sku?.name ?? item.skuId)).size;
    const releasedPalletCount = detail?.items?.reduce(
      (sum, item) => sum + (item.pallets?.filter((pallet) => pallet.status === 'RELEASED').length ?? 0),
      0,
    );
    return { count, uniqueSkuCount, releasedPalletCount };
  }, [detail?.items]);

  const formattedDate = detail
    ? intl.formatDate(new Date(detail.date), { year: 'numeric', month: 'long', day: 'numeric' })
    : '-';

  return (
    <section className="space-y-6">
      <PageHeader
        title={intl.formatMessage({ id: 'transaction.outbound_detail.title', defaultMessage: 'Outbound Transaction Detail' })}
        onBack={() => navigate('/transactions')}
        onEdit={canUpdate && ['DRAFT', 'REJECTED'].includes(detail?.approvalStatus ?? '') ? () => navigate(`/transactions/outbound/form/${id}`) : undefined}
      />

      {isLoading ? (
        <p className="text-sm text-muted">{intl.formatMessage({ id: 'transaction.outbound_detail.loading', defaultMessage: 'Loading transaction data...' })}</p>
      ) : !detail ? (
        <div className="space-y-3">
          <p className="text-sm text-danger">{intl.formatMessage({ id: 'transaction.outbound_detail.not_found', defaultMessage: 'Outbound transaction not found.' })}</p>
          <Button variant="ghost" onPress={() => navigate('/transactions')}>
            {intl.formatMessage({ id: 'transaction.outbound_detail.back', defaultMessage: 'Back' })}
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Fieldset>
              <FieldsetLegend>
                {intl.formatMessage({ id: 'transaction.outbound_detail.section_transaction', defaultMessage: 'Transaction details' })}
              </FieldsetLegend>
              <FieldGroup>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-muted">
                      {intl.formatMessage({ id: 'transaction.outbound_detail.field_transaction_id', defaultMessage: 'Transaction ID' })}
                    </p>
                    <p className="mt-2 font-mono text-sm text-foreground">{detail.id}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">
                      {intl.formatMessage({ id: 'transaction.outbound_detail.field_recipient', defaultMessage: 'Recipient' })}
                    </p>
                    <p className="mt-2 text-sm text-foreground">{detail.recipient ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">
                      {intl.formatMessage({ id: 'transaction.outbound_detail.field_reference', defaultMessage: 'Reference' })}
                    </p>
                    <p className="mt-2 text-sm text-foreground">{detail.reference ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">
                      {intl.formatMessage({ id: 'transaction.outbound_detail.field_date', defaultMessage: 'Date' })}
                    </p>
                    <p className="mt-2 text-sm text-foreground">{formattedDate}</p>
                  </div>
                </div>
              </FieldGroup>
            </Fieldset>

            <Fieldset>
              <FieldsetLegend>
                {intl.formatMessage({ id: 'transaction.outbound_detail.section_summary', defaultMessage: 'Status summary' })}
              </FieldsetLegend>
              <FieldGroup>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold text-muted">
                      {intl.formatMessage({ id: 'transaction.outbound_detail.field_status', defaultMessage: 'Status' })}
                    </p>
                    <ApprovalStatusChip status={detail.approvalStatus} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold text-muted">
                      {intl.formatMessage({ id: 'transaction.outbound_detail.field_created_by', defaultMessage: 'Created by' })}
                    </p>
                    <p className="mt-2 text-sm text-foreground">{detail.createdBy?.name ?? '-'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Chip variant="soft" color="accent" size="sm">
                      {intl.formatMessage({ id: 'transaction.outbound_detail.chip_pallet_count', defaultMessage: '{count} pallets' }, { count: summary.count })}
                    </Chip>
                    <Chip variant="soft" color="warning" size="sm">
                      {intl.formatMessage({ id: 'transaction.outbound_detail.chip_sku_count', defaultMessage: '{count} SKU(s)' }, { count: summary.uniqueSkuCount })}
                    </Chip>
                  </div>
                </div>
              </FieldGroup>
            </Fieldset>
          </div>

          <div className="flex justify-end">
            <ApprovalHistory approvalHistory={detail.approvalHistory} />
          </div>

          <Fieldset>
            <Fieldset.Legend>
              {intl.formatMessage({ id: 'transaction.outbound_detail.section_items', defaultMessage: 'Transaction Items' })}
            </Fieldset.Legend>
            <Description>
              {intl.formatMessage({ id: 'transaction.outbound_detail.section_items_description', defaultMessage: 'Grouped items and reserved pallets for this outbound transaction.' })}
            </Description>
            <FieldGroup>
              {detail.items?.length ? (
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content aria-label={intl.formatMessage({ id: 'transaction.outbound_detail.item_table_aria', defaultMessage: 'Outbound transaction items' })}>
                      <Table.Header>
                        <Table.Column>{intl.formatMessage({ id: 'transaction.outbound_detail.detail_col_sku', defaultMessage: 'SKU' })}</Table.Column>
                        <Table.Column>{intl.formatMessage({ id: 'transaction.outbound_detail.detail_col_pallet_type', defaultMessage: 'Pallet Type' })}</Table.Column>
                        <Table.Column>{intl.formatMessage({ id: 'transaction.outbound_detail.detail_col_details', defaultMessage: 'Details' })}</Table.Column>
                        <Table.Column>{intl.formatMessage({ id: 'transaction.outbound_detail.detail_col_pallets', defaultMessage: 'Pallets' })}</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {detail.items.map((item, index) => (
                          <Table.Row key={`${item.skuId}-${item.palletTypeId ?? 'none'}-${index}`} id={`${item.skuId}-${item.palletTypeId ?? 'none'}-${index}`}>
                            <Table.Cell>{item.sku?.name ?? item.skuId}</Table.Cell>
                            <Table.Cell>{item.palletType?.name ?? item.palletTypeId ?? '-'}</Table.Cell>
                            <Table.Cell>{item.details ?? '-'}</Table.Cell>
                            <Table.Cell>{item.pallets?.length ?? 0}</Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              ) : (
                <EmptyState>
                  {intl.formatMessage({ id: 'transaction.outbound_detail.empty_items', defaultMessage: 'No items found for this transaction.' })}
                </EmptyState>
              )}
            </FieldGroup>
          </Fieldset>

          <div className="flex justify-end gap-2">
            {canUpdate && detail?.approvalStatus === 'DRAFT' && (
              <Button className="bg-warning text-warning-foreground" onPress={() => { actionRef.current = 'propose'; setApprovalMessage(''); setModalAction('confirm-propose'); }}>
                <Icon icon="mdi:send" className="size-4" />
                {intl.formatMessage({ id: 'inbound_transaction.propose', defaultMessage: 'Propose' })}
              </Button>
            )}
            {canApprove && detail?.approvalStatus === 'PROPOSED' && (
              <>
                <Button className="bg-success text-success-foreground" onPress={() => { actionRef.current = 'approve'; setApprovalMessage(''); setModalAction('confirm-approve'); }}>
                  <Icon icon="mdi:check" className="size-4" />
                  {intl.formatMessage({ id: 'inbound_transaction.approve', defaultMessage: 'Approve' })}
                </Button>
                <Button className="bg-danger text-danger-foreground" onPress={() => { actionRef.current = 'reject'; setApprovalMessage(''); setModalAction('confirm-reject'); }}>
                  <Icon icon="mdi:close" className="size-4" />
                  {intl.formatMessage({ id: 'inbound_transaction.reject', defaultMessage: 'Reject' })}
                </Button>
              </>
            )}
            {canApprove && detail?.approvalStatus === 'APPROVED' && (
              <Button className="bg-danger text-danger-foreground" onPress={() => { actionRef.current = 'reject'; setApprovalMessage(''); setModalAction('confirm-reject'); }}>
                <Icon icon="mdi:close" className="size-4" />
                {intl.formatMessage({ id: 'inbound_transaction.reject', defaultMessage: 'Reject' })}
              </Button>
            )}
          </div>

          <Modal>
            <Modal.Backdrop
              isOpen={modalAction !== 'idle'}
              onOpenChange={(open) => {
                if (!open) handleModalClose();
              }}
              isDismissable={modalAction !== 'loading'}
              isKeyboardDismissDisabled={modalAction === 'loading'}
            >
              <Modal.Container size="sm">
                <Modal.Dialog>
                  {modalAction === 'loading' ? (
                    <>
                      <Modal.Header>
                        <Modal.Heading>{intl.formatMessage({ id: 'transaction.outbound_detail.action_processing', defaultMessage: 'Processing…' })}</Modal.Heading>
                      </Modal.Header>
                      <Modal.Body className="flex flex-col items-center gap-4 py-8">
                        <Spinner size="lg" />
                        <p className="text-sm text-muted">
                          {intl.formatMessage({ id: 'transaction.outbound_detail.action_please_wait', defaultMessage: 'Please wait…' })}
                        </p>
                      </Modal.Body>
                    </>
                  ) : modalAction === 'success' ? (
                    <>
                      <Modal.Header>
                        <Modal.Icon>
                          <Icon icon="solar:check-circle-bold" className="size-12 text-success" />
                        </Modal.Icon>
                        <Modal.Heading>{intl.formatMessage({ id: 'transaction.outbound_detail.action_success_title', defaultMessage: 'Done' })}</Modal.Heading>
                      </Modal.Header>
                      <Modal.Body>
                        <p className="text-center text-sm text-muted">{resultMessage}</p>
                      </Modal.Body>
                      <Modal.Footer>
                        <Button onPress={handleModalClose}>
                          {intl.formatMessage({ id: 'transaction.outbound_detail.action_close', defaultMessage: 'Close' })}
                        </Button>
                      </Modal.Footer>
                    </>
                  ) : modalAction === 'error' ? (
                    <>
                      <Modal.Header>
                        <Modal.Icon>
                          <Icon icon="solar:close-circle-bold" className="size-12 text-danger" />
                        </Modal.Icon>
                        <Modal.Heading>{intl.formatMessage({ id: 'transaction.outbound_detail.action_error_title', defaultMessage: 'Something went wrong' })}</Modal.Heading>
                      </Modal.Header>
                      <Modal.Body>
                        <p className="text-center text-sm text-muted">{resultMessage}</p>
                      </Modal.Body>
                      <Modal.Footer>
                        <Button onPress={handleModalClose}>
                          {intl.formatMessage({ id: 'transaction.outbound_detail.action_close', defaultMessage: 'Close' })}
                        </Button>
                      </Modal.Footer>
                    </>
                  ) : (
                    <>
                      <Modal.Header>
                        <Modal.Icon>
                          <Icon
                            icon={
                              modalAction === 'confirm-propose'
                                ? 'mdi:send'
                                : modalAction === 'confirm-approve'
                                  ? 'solar:check-circle-bold'
                                  : 'solar:close-circle-bold'
                            }
                            className={
                              modalAction === 'confirm-propose'
                                ? 'size-10 text-warning'
                                : modalAction === 'confirm-approve'
                                  ? 'size-10 text-success'
                                  : 'size-10 text-danger'
                            }
                          />
                        </Modal.Icon>
                        <Modal.Heading>
                          {modalAction === 'confirm-propose'
                            ? intl.formatMessage({ id: 'transaction.outbound_detail.confirm_propose_title', defaultMessage: 'Confirm Propose' })
                            : modalAction === 'confirm-approve'
                              ? intl.formatMessage({ id: 'transaction.outbound_detail.confirm_approve_title', defaultMessage: 'Confirm Approve' })
                              : intl.formatMessage({ id: 'transaction.outbound_detail.confirm_reject_title', defaultMessage: 'Confirm Reject' })}
                        </Modal.Heading>
                      </Modal.Header>
                      <Modal.Body className="space-y-4">
                        <p className="text-sm text-muted">
                          {modalAction === 'confirm-propose'
                            ? intl.formatMessage({ id: 'transaction.outbound_detail.confirm_propose_desc', defaultMessage: 'Send this transaction for approval and change its status to pending?' })
                            : modalAction === 'confirm-approve'
                              ? intl.formatMessage({ id: 'transaction.outbound_detail.confirm_approve_desc', defaultMessage: 'Approve this transaction? This action cannot be undone.' })
                              : intl.formatMessage({ id: 'transaction.outbound_detail.confirm_reject_desc', defaultMessage: 'Reject this transaction? This action cannot be undone.' })}
                        </p>
                        <TextField fullWidth>
                          <Label>
                            {intl.formatMessage({ id: 'transaction.outbound_detail.approval_message_label', defaultMessage: 'Message' })}
                          </Label>
                          <TextArea
                            rows={4}
                            variant="secondary"
                            value={approvalMessage}
                            onChange={(event) => setApprovalMessage(event.target.value)}
                            placeholder={intl.formatMessage({ id: 'transaction.outbound_detail.approval_message_placeholder', defaultMessage: 'Add a message for this action (optional)' })}
                          />
                        </TextField>
                      </Modal.Body>
                      <Modal.Footer>
                        <Button variant="ghost" onPress={handleModalClose}>
                          {intl.formatMessage({ id: 'transaction.outbound_detail.action_cancel', defaultMessage: 'Cancel' })}
                        </Button>
                        <Button
                          variant={modalAction === 'confirm-reject' ? 'danger' : 'primary'}
                          onPress={() => void handleConfirmSubmit()}
                        >
                          {modalAction === 'confirm-propose'
                            ? intl.formatMessage({ id: 'transaction.outbound_detail.action_send', defaultMessage: 'Send for approval' })
                            : modalAction === 'confirm-approve'
                              ? intl.formatMessage({ id: 'transaction.outbound_detail.action_approve', defaultMessage: 'Approve' })
                              : intl.formatMessage({ id: 'transaction.outbound_detail.action_reject', defaultMessage: 'Reject' })}
                        </Button>
                      </Modal.Footer>
                    </>
                  )}
                </Modal.Dialog>
              </Modal.Container>
            </Modal.Backdrop>
          </Modal>

        </>
      )}
    </section>
  );
};

export default OutboundTransactionDetailPage;
