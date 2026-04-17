import { useIntl } from 'react-intl';
import { Button, Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';
import { ApprovalStatusChip, DetailField, DetailSectionCard, normalizeApprovalHistory } from '../shared';

interface LossTransactionDetail {
  approvalHistory?: unknown;
  approvalStatus: string;
  date: string;
  estimatedValue: number | string | null;
  id: string;
  lossReason: string | null;
  notes: string | null;
  paletPivots?: Array<{
    palletId: string;
  }>;
  reference: string | null;
}

type LostTransactionUpdateInput = inferProcedureInput<AppRouter['lossTransaction']['update']>;
type LostTransactionApproveInput = inferProcedureInput<AppRouter['lossTransaction']['approve']>;
type LostTransactionRejectInput = inferProcedureInput<AppRouter['lossTransaction']['reject']>;

export default function LostTransactionDetailPage() {
  const navigate = useNavigate();
  const intl = useIntl();
  const { id } = useParams<{ id?: string }>();
  const queryClient = useQueryClient();

  const proposeMutation = useMutation<unknown, unknown, LostTransactionUpdateInput>({
    mutationFn: (payload) => trpcClient.lossTransaction.update.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lossTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['lossTransactionList'] });
    },
  });

  const approveMutation = useMutation<unknown, unknown, LostTransactionApproveInput>({
    mutationFn: (payload) => trpcClient.lossTransaction.approve.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lossTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['lossTransactionList'] });
    },
  });

  const rejectMutation = useMutation<unknown, unknown, LostTransactionRejectInput>({
    mutationFn: (payload) => trpcClient.lossTransaction.reject.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lossTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['lossTransactionList'] });
    },
  });

  const handlePropose = async () => {
    if (!queryData || !id) return;
    const data = queryData as LossTransactionDetail;
    const approvalHistory = normalizeApprovalHistory(data.approvalHistory);

    await proposeMutation.mutateAsync({
      id: id!,
      approvalStatus: 'PENDING',
      date: data.date,
      lossReason: data.lossReason ?? '',
      estimatedValue: data.estimatedValue != null ? Number(data.estimatedValue) : undefined,
      reference: data.reference ?? '',
      notes: data.notes ?? '',
      palletIds: data.paletPivots?.map((pivot) => pivot.palletId) ?? [],
      approvalHistory,
    });
  };

  const handleApprove = async () => {
    if (!id) return;
    await approveMutation.mutateAsync({ id: id! });
  };

  const handleReject = async () => {
    if (!id) return;
    await rejectMutation.mutateAsync({ id: id! });
  };

  const { data: queryData, isLoading } = useQuery({
    queryKey: ['lossTransactionDetail', id],
    queryFn: () => trpcClient.lossTransaction.detail.query({ id: id! }),
    enabled: Boolean(id),
  });

  const detail = queryData as LossTransactionDetail | undefined;

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Card.Title>{intl.formatMessage({ id: 'transaction_lostdetail_title', defaultMessage: 'Loss Transaction Details' })}</Card.Title>
            <Card.Description>{intl.formatMessage({ id: 'transaction_lostdetail_description', defaultMessage: 'Showing loss transaction details for ID {id}.' }, { id })}</Card.Description>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {detail?.approvalStatus === 'DRAFT' ? (
              <Button variant="primary" onPress={handlePropose} isDisabled={proposeMutation.isPending}>
                {intl.formatMessage({ id: 'transaction_lostdetail_propose', defaultMessage: 'Propose' })}
              </Button>
            ) : null}
            {detail?.approvalStatus === 'PENDING' ? (
              <>
                <Button variant="primary" onPress={handleApprove} isDisabled={approveMutation.isPending}>
                  {intl.formatMessage({ id: 'transaction_lostdetail_approve', defaultMessage: 'Approve' })}
                </Button>
                <Button variant="danger" onPress={handleReject} isDisabled={rejectMutation.isPending}>
                  {intl.formatMessage({ id: 'transaction_lostdetail_reject', defaultMessage: 'Reject' })}
                </Button>
              </>
            ) : null}
            {detail ? <ApprovalStatusChip status={detail.approvalStatus} /> : null}
          </div>
          <Button variant="secondary" onPress={() => navigate('/transactions/loss')}>
            <Icon icon="solar:arrow-left-linear" className="size-4" />
            {intl.formatMessage({ id: 'transaction_lostdetail_back', defaultMessage: 'Back' })}
          </Button>
        </Card.Header>

        <Card.Content>
          {isLoading ? (
            <p className="text-sm text-muted">{intl.formatMessage({ id: 'transaction_lostdetail_loading', defaultMessage: 'Loading data...' })}</p>
          ) : !detail ? (
            <p className="text-sm text-danger">{intl.formatMessage({ id: 'transaction.lost_detail.not_found', defaultMessage: 'Loss transaction not found.' })}</p>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <DetailSectionCard
                description={intl.formatMessage({ id: 'transaction.lost_detail.overview_description', defaultMessage: 'Core loss transaction metadata and financial impact context.' })}
                title={intl.formatMessage({ id: 'transaction.lost_detail.overview_title', defaultMessage: 'Overview' })}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <DetailField label={intl.formatMessage({ id: 'transaction.lost_detail.field_transaction_id', defaultMessage: 'Transaction ID' })} mono value={detail.id} />
                  <DetailField label={intl.formatMessage({ id: 'transaction.lost_detail.field_status', defaultMessage: 'Status' })} value={<ApprovalStatusChip status={detail.approvalStatus} />} />
                  <DetailField label={intl.formatMessage({ id: 'transaction.lost_detail.field_date', defaultMessage: 'Date' })} value={intl.formatDate(new Date(detail.date), { year: 'numeric', month: 'long', day: 'numeric' })} />
                  <DetailField label={intl.formatMessage({ id: 'transaction.lost_detail.field_reason', defaultMessage: 'Loss Reason' })} value={detail.lossReason ?? '-'} />
                  <DetailField label={intl.formatMessage({ id: 'transaction.lost_detail.field_estimated_value', defaultMessage: 'Estimated Value' })} value={detail.estimatedValue != null ? `Rp ${Number(detail.estimatedValue).toLocaleString('id-ID')}` : '-'} />
                  <DetailField label={intl.formatMessage({ id: 'transaction.lost_detail.field_reference', defaultMessage: 'Reference' })} value={detail.reference ?? '-'} />
                  <DetailField label={intl.formatMessage({ id: 'transaction.lost_detail.field_notes', defaultMessage: 'Notes' })} value={detail.notes || '-'} />
                </div>
              </DetailSectionCard>

              <DetailSectionCard
                description={intl.formatMessage({ id: 'transaction.lost_detail.pallets_description', defaultMessage: 'Pallets included in this loss report.' })}
                title={intl.formatMessage({ id: 'transaction.lost_detail.pallets_title', defaultMessage: 'Pallets' })}
              >
                {detail.paletPivots?.length ? (
                  <div className="space-y-3">
                    {detail.paletPivots.map((pivot, index) => (
                      <div key={`${pivot.palletId}-${index}`} className="rounded-2xl border border-border/70 bg-surface p-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <DetailField label={intl.formatMessage({ id: 'transaction.lost_detail.item_pallet_id', defaultMessage: 'Pallet ID' })} mono value={pivot.palletId} />
                          <DetailField label={intl.formatMessage({ id: 'transaction.lost_detail.item_sequence', defaultMessage: 'Line Number' })} value={String(index + 1)} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">{intl.formatMessage({ id: 'transaction.lost_detail.pallets_empty', defaultMessage: 'No pallets recorded for this transaction.' })}</p>
                )}
              </DetailSectionCard>
            </div>
          )}
        </Card.Content>
      </Card>
    </section>
  );
}
