import { useIntl } from 'react-intl';
import { Button, Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';

type FoundTransactionUpdateInput = inferProcedureInput<AppRouter['foundTransaction']['update']>;
type FoundTransactionApproveInput = inferProcedureInput<AppRouter['foundTransaction']['approve']>;
type FoundTransactionRejectInput = inferProcedureInput<AppRouter['foundTransaction']['reject']>;

export default function FoundTransactionDetailPage() {
  const navigate = useNavigate();
  const intl = useIntl();
  const { id } = useParams<{ id?: string }>();
  const queryClient = useQueryClient();

  const proposeMutation = useMutation<unknown, unknown, FoundTransactionUpdateInput>({
    mutationFn: (payload) => trpcClient.foundTransaction.update.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['foundTransactionList'] });
    },
  });

  const approveMutation = useMutation<unknown, unknown, FoundTransactionApproveInput>({
    mutationFn: (payload) => trpcClient.foundTransaction.approve.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['foundTransactionList'] });
    },
  });

  const rejectMutation = useMutation<unknown, unknown, FoundTransactionRejectInput>({
    mutationFn: (payload) => trpcClient.foundTransaction.reject.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['foundTransactionList'] });
    },
  });

  const handlePropose = async () => {
    if (!data || !id) return;
    const approvalHistory = (data as any)?.approvalHistory ?? [];

    await proposeMutation.mutateAsync({
      id: id!,
      approvalStatus: 'PENDING',
      date: data.date,
      findingType: data.findingType ?? '',
      reference: data.reference ?? '',
      notes: data.notes ?? '',
      items: data.items?.map((item: any) => ({
        skuId: item.skuId,
        palletTypeId: item.palletTypeId,
        quantity: item.quantity,
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
    queryKey: ['foundTransactionDetail', id],
    queryFn: () => trpcClient.foundTransaction.detail.query({ id: id! }),
    enabled: Boolean(id),
  });

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Card.Title>{intl.formatMessage({ id: 'transaction.foundDetail.title', defaultMessage: 'Found Transaction Details' })}</Card.Title>
            <Card.Description>{intl.formatMessage({ id: 'transaction.foundDetail.description', defaultMessage: 'Showing found transaction details for ID {id}.' }, { id })}</Card.Description>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data?.approvalStatus === 'DRAFT' ? (
              <Button variant="secondary" onPress={handlePropose} isDisabled={proposeMutation.isPending}>
                {intl.formatMessage({ id: 'transaction.foundDetail.propose', defaultMessage: 'Propose' })}
              </Button>
            ) : null}
            {data?.approvalStatus === 'PENDING' ? (
              <>
                <Button variant="primary" onPress={handleApprove} isDisabled={approveMutation.isPending}>
                  {intl.formatMessage({ id: 'transaction.foundDetail.approve', defaultMessage: 'Approve' })}
                </Button>
                <Button variant="danger" onPress={handleReject} isDisabled={rejectMutation.isPending}>
                  {intl.formatMessage({ id: 'transaction.foundDetail.reject', defaultMessage: 'Reject' })}
                </Button>
              </>
            ) : null}

          </div>
          <Button variant="secondary" onPress={() => navigate('/transactions/found')}>
            <Icon icon="solar:arrow-left-linear" className="size-4" />
            {intl.formatMessage({ id: 'transaction.foundDetail.back', defaultMessage: 'Back' })}
          </Button>
        </Card.Header>

        <Card.Content>
          {isLoading ? (
            <p className="text-sm text-muted">{intl.formatMessage({ id: 'transaction.foundDetail.loading', defaultMessage: 'Loading data...' })}</p>
          ) : (
            <pre className="rounded bg-surface p-4 text-sm text-foreground">{JSON.stringify(data, null, 2)}</pre>
          )}
        </Card.Content>
      </Card>
    </section>
  );
}
