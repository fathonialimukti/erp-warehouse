import { useIntl } from 'react-intl';
import { Button, Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';

type OutboundTransactionUpdateInput = inferProcedureInput<AppRouter['outboundTransaction']['update']>;
type OutboundTransactionApproveInput = inferProcedureInput<AppRouter['outboundTransaction']['approve']>;
type OutboundTransactionRejectInput = inferProcedureInput<AppRouter['outboundTransaction']['reject']>;

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
    const approvalHistory = (data as any)?.approvalHistory ?? [];

    await proposeMutation.mutateAsync({
      id: id!,
      approvalStatus: 'PENDING',
      outgoingLocationId: data.outgoingLocationId,
      date: data.date,
      notes: data.notes ?? '',
      palletIds: data.items?.map((item: any) => item.palletId) ?? [],
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

  const { data, isLoading } = useQuery({
    queryKey: ['outboundTransactionDetail', id],
    queryFn: () => trpcClient.outboundTransaction.detail.query({ id: id! }),
    enabled: Boolean(id),
  });

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Card.Title>{intl.formatMessage({ id: 'transaction.outgoingDetail.title', defaultMessage: 'Outbound Transaction Details' })}</Card.Title>
            <Card.Description>{intl.formatMessage({ id: 'transaction.outgoingDetail.description', defaultMessage: 'Showing outbound transaction details for ID {id}.' }, { id })}</Card.Description>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data?.approvalStatus === 'DRAFT' ? (
              <Button variant="secondary" onPress={handlePropose} isDisabled={proposeMutation.isPending}>
                {intl.formatMessage({ id: 'transaction.outgoingDetail.propose', defaultMessage: 'Propose' })}
              </Button>
            ) : null}
            {data?.approvalStatus === 'PENDING' ? (
              <>
                <Button variant="primary" onPress={handleApprove} isDisabled={approveMutation.isPending}>
                  {intl.formatMessage({ id: 'transaction.outgoingDetail.approve', defaultMessage: 'Approve' })}
                </Button>
                <Button variant="danger" onPress={handleReject} isDisabled={rejectMutation.isPending}>
                  {intl.formatMessage({ id: 'transaction.outgoingDetail.reject', defaultMessage: 'Reject' })}
                </Button>
              </>
            ) : null}

          </div>
          <Button variant="secondary" onPress={() => navigate('/transactions/outbound')}>
            <Icon icon="solar:arrow-left-linear" className="size-4" />
            {intl.formatMessage({ id: 'transaction.outgoingDetail.back', defaultMessage: 'Back' })}
          </Button>
        </Card.Header>

        <Card.Content>
          {isLoading ? (
            <p className="text-sm text-muted">{intl.formatMessage({ id: 'transaction.outgoingDetail.loading', defaultMessage: 'Loading data...' })}</p>
          ) : (
            <pre className="rounded bg-surface p-4 text-sm text-foreground">{JSON.stringify(data, null, 2)}</pre>
          )}
        </Card.Content>
      </Card>
    </section>
  );
}
