import { Button, Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';

type InboundTransactionUpdateInput = inferProcedureInput<AppRouter['inboundTransaction']['update']>;
type InboundTransactionApproveInput = inferProcedureInput<AppRouter['inboundTransaction']['approve']>;
type InboundTransactionRejectInput = inferProcedureInput<AppRouter['inboundTransaction']['reject']>;

export default function InboundTransactionDetailPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const queryClient = useQueryClient();

  const proposeMutation = useMutation<unknown, unknown, InboundTransactionUpdateInput>({
    mutationFn: (payload) => trpcClient.inboundTransaction.update.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inboundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['inboundTransactionList'] });
    },
  });

  const approveMutation = useMutation<unknown, unknown, InboundTransactionApproveInput>({
    mutationFn: (payload) => trpcClient.inboundTransaction.approve.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inboundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['inboundTransactionList'] });
    },
  });

  const rejectMutation = useMutation<unknown, unknown, InboundTransactionRejectInput>({
    mutationFn: (payload) => trpcClient.inboundTransaction.reject.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inboundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['inboundTransactionList'] });
    },
  });

  const handlePropose = async () => {
    if (!data || !id) return;
    const approvalHistory = (data as any)?.approvalHistory ?? [];

    await proposeMutation.mutateAsync({
      id: id!,
      approvalStatus: 'PENDING',
      incomingLocationId: data.incomingLocationId ?? undefined,
      date: data.date,
      notes: data.notes ?? '',
      items: data.items?.map((item: any) => ({
        skuId: item.skuId,
        quantity: item.quantity,
        palletTypeId: item.palletTypeId,
      })) ?? [],
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
    queryKey: ['inboundTransactionDetail', id],
    queryFn: () => trpcClient.inboundTransaction.detail.query({ id: id! }),
    enabled: Boolean(id),
  });

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Card.Title>{intl.formatMessage({ id: 'transaction.incomingDetail.title', defaultMessage: 'Inbound Transaction Detail' })}</Card.Title>
            <Card.Description>
              {intl.formatMessage(
                { id: 'transaction.incomingDetail.description', defaultMessage: 'Showing inbound transaction details for ID {id}.' },
                { id: id ?? '' },
              )}
            </Card.Description>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data?.approvalStatus === 'DRAFT' ? (
              <Button variant="secondary" onPress={handlePropose} isDisabled={proposeMutation.isPending}>
                {intl.formatMessage({ id: 'transaction.incomingDetail.propose', defaultMessage: 'Propose' })}
              </Button>
            ) : null}
            {data?.approvalStatus === 'PENDING' ? (
              <>
                <Button variant="primary" onPress={handleApprove} isDisabled={approveMutation.isPending}>
                  {intl.formatMessage({ id: 'transaction.incomingDetail.approve', defaultMessage: 'Approve' })}
                </Button>
                <Button variant="danger" onPress={handleReject} isDisabled={rejectMutation.isPending}>
                  {intl.formatMessage({ id: 'transaction.incomingDetail.reject', defaultMessage: 'Reject' })}
                </Button>
              </>
            ) : null}
          </div>
          <Button variant="secondary" onPress={() => navigate('/transactions/inbound')}>
            <Icon icon="solar:arrow-left-linear" className="size-4" />
            {intl.formatMessage({ id: 'transaction.incomingDetail.back', defaultMessage: 'Back' })}
          </Button>
        </Card.Header>

        <Card.Content>
          {isLoading ? (
            <p className="text-sm text-muted">
              {intl.formatMessage({ id: 'transaction.incomingDetail.loading', defaultMessage: 'Loading transaction data...' })}
            </p>
          ) : (
            <pre className="rounded bg-surface p-4 text-sm text-foreground">{JSON.stringify(data, null, 2)}</pre>
          )}
        </Card.Content>
      </Card>
    </section>
  );
}
