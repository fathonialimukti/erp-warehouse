import { useIntl } from 'react-intl';
import { Button, Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';
import { ApprovalStatusChip, DetailField, DetailSectionCard, normalizeApprovalHistory } from '../shared';

type OutboundTransactionUpdateInput = inferProcedureInput<AppRouter['outboundTransaction']['update']>;
type OutboundTransactionApproveInput = inferProcedureInput<AppRouter['outboundTransaction']['approve']>;
type OutboundTransactionRejectInput = inferProcedureInput<AppRouter['outboundTransaction']['reject']>;
interface OutboundTransactionDetail {
  id: string;
  approvalStatus: string;
  date: string;
  notes: string | null;
  outgoingLocationId: string | null;
  approvalHistory?: unknown;
  items?: Array<{ palletId: string }>;
}

export default function OutboundTransactionDetailPage() {
  const navigate = useNavigate();
  const intl = useIntl();
  const { id } = useParams<{ id?: string }>();
  const queryClient = useQueryClient();

  const proposeMutation = useMutation<unknown, unknown, OutboundTransactionUpdateInput>({
    mutationFn: (payload) => trpcClient.outboundTransaction.update.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionList'] });
    },
  });

  const approveMutation = useMutation<unknown, unknown, OutboundTransactionApproveInput>({
    mutationFn: (payload) => trpcClient.outboundTransaction.approve.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionList'] });
    },
  });

  const rejectMutation = useMutation<unknown, unknown, OutboundTransactionRejectInput>({
    mutationFn: (payload) => trpcClient.outboundTransaction.reject.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionList'] });
    },
  });

  const handlePropose = async () => {
    if (!data || !id) return;
    const approvalHistory = normalizeApprovalHistory(data.approvalHistory);

    await proposeMutation.mutateAsync({
      id: id!,
      approvalStatus: 'PENDING',
      outgoingLocationId: data.outgoingLocationId ?? '',
      date: data.date,
      notes: data.notes ?? '',
      palletIds: data.items?.map((item) => item.palletId) ?? [],
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
    queryKey: ['outboundTransactionDetail', id],
    queryFn: () => trpcClient.outboundTransaction.detail.query({ id: id! }),
    enabled: Boolean(id),
  });

  const data = queryData as OutboundTransactionDetail | undefined;
  const detail = data;

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Card.Title>{intl.formatMessage({ id: 'transaction.outgoingDetail.title', defaultMessage: 'Outbound Transaction Details' })}</Card.Title>
            <Card.Description>{intl.formatMessage({ id: 'transaction.outgoingDetail.description', defaultMessage: 'Showing outbound transaction details for ID {id}.' }, { id })}</Card.Description>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {detail?.approvalStatus === 'DRAFT' ? (
              <Button variant="primary" onPress={handlePropose} isDisabled={proposeMutation.isPending}>
                {intl.formatMessage({ id: 'transaction.outgoingDetail.propose', defaultMessage: 'Propose' })}
              </Button>
            ) : null}
            {detail?.approvalStatus === 'PENDING' ? (
              <>
                <Button variant="primary" onPress={handleApprove} isDisabled={approveMutation.isPending}>
                  {intl.formatMessage({ id: 'transaction.outgoingDetail.approve', defaultMessage: 'Approve' })}
                </Button>
                <Button variant="danger" onPress={handleReject} isDisabled={rejectMutation.isPending}>
                  {intl.formatMessage({ id: 'transaction.outgoingDetail.reject', defaultMessage: 'Reject' })}
                </Button>
              </>
            ) : null}
            {detail ? <ApprovalStatusChip status={detail.approvalStatus} /> : null}
          </div>
          <Button variant="secondary" onPress={() => navigate('/transactions/outbound')}>
            <Icon icon="solar:arrow-left-linear" className="size-4" />
            {intl.formatMessage({ id: 'transaction.outgoingDetail.back', defaultMessage: 'Back' })}
          </Button>
        </Card.Header>

        <Card.Content>
          {isLoading ? (
            <p className="text-sm text-muted">{intl.formatMessage({ id: 'transaction.outgoingDetail.loading', defaultMessage: 'Loading data...' })}</p>
          ) : !detail ? (
            <p className="text-sm text-danger">{intl.formatMessage({ id: 'transaction.outgoingDetail.notFound', defaultMessage: 'Outbound transaction not found.' })}</p>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <DetailSectionCard
                description={intl.formatMessage({ id: 'transaction.outgoingDetail.overviewDescription', defaultMessage: 'Core outbound transaction metadata and dispatch context.' })}
                title={intl.formatMessage({ id: 'transaction.outgoingDetail.overviewTitle', defaultMessage: 'Overview' })}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <DetailField label={intl.formatMessage({ id: 'transaction.outgoingDetail.fieldTransactionId', defaultMessage: 'Transaction ID' })} mono value={detail.id} />
                  <DetailField label={intl.formatMessage({ id: 'transaction.outgoingDetail.fieldStatus', defaultMessage: 'Status' })} value={<ApprovalStatusChip status={detail.approvalStatus} />} />
                  <DetailField label={intl.formatMessage({ id: 'transaction.outgoingDetail.fieldDate', defaultMessage: 'Date' })} value={intl.formatDate(new Date(detail.date), { year: 'numeric', month: 'long', day: 'numeric' })} />
                  <DetailField label={intl.formatMessage({ id: 'transaction.outgoingDetail.fieldLocation', defaultMessage: 'Outbound Location' })} value={detail.outgoingLocationId ?? '-'} />
                  <DetailField label={intl.formatMessage({ id: 'transaction.outgoingDetail.fieldNotes', defaultMessage: 'Notes' })} value={detail.notes || '-'} />
                  <DetailField label={intl.formatMessage({ id: 'transaction.outgoingDetail.fieldPalletCount', defaultMessage: 'Pallet Count' })} value={String(detail.items?.length ?? 0)} />
                </div>
              </DetailSectionCard>

              <DetailSectionCard
                description={intl.formatMessage({ id: 'transaction.outgoingDetail.itemsDescription', defaultMessage: 'Pallets scheduled for outbound movement in this transaction.' })}
                title={intl.formatMessage({ id: 'transaction.outgoingDetail.itemsTitle', defaultMessage: 'Pallets' })}
              >
                {detail.items?.length ? (
                  <div className="space-y-3">
                    {detail.items.map((item, index) => (
                      <div key={`${item.palletId}-${index}`} className="rounded-2xl border border-border/70 bg-surface p-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <DetailField label={intl.formatMessage({ id: 'transaction.outgoingDetail.itemPalletId', defaultMessage: 'Pallet ID' })} mono value={item.palletId} />
                          <DetailField label={intl.formatMessage({ id: 'transaction.outgoingDetail.itemSequence', defaultMessage: 'Line Number' })} value={String(index + 1)} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">{intl.formatMessage({ id: 'transaction.outgoingDetail.itemsEmpty', defaultMessage: 'No pallets recorded for this transaction.' })}</p>
                )}
              </DetailSectionCard>
            </div>
          )}
        </Card.Content>
      </Card>
    </section>
  );
}
