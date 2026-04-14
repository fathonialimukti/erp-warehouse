import { useIntl } from 'react-intl';
import { Button, Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';

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
    if (!data || !id) return;
    const approvalHistory = (data as any)?.approvalHistory ?? [];

    await proposeMutation.mutateAsync({
      id: id!,
      approvalStatus: 'PENDING',
      date: data.date,
      lossReason: data.lossReason ?? '',
      estimatedValue: data.estimatedValue ?? undefined,
      reference: data.reference ?? '',
      notes: data.notes ?? '',
      palletIds: data.paletPivots?.map((pivot: any) => pivot.palletId) ?? [],
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
    queryKey: ['lossTransactionDetail', id],
    queryFn: () => trpcClient.lossTransaction.detail.query({ id: id! }),
    enabled: Boolean(id),
  });

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Card.Title>{intl.formatMessage({ id: 'transaction.lostDetail.title', defaultMessage: 'Loss Transaction Details' })}</Card.Title>
            <Card.Description>{intl.formatMessage({ id: 'transaction.lostDetail.description', defaultMessage: 'Showing loss transaction details for ID {id}.' }, { id })}</Card.Description>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data?.approvalStatus === 'DRAFT' ? (
              <Button variant="secondary" onPress={handlePropose} isDisabled={proposeMutation.isPending}>
                {intl.formatMessage({ id: 'transaction.lostDetail.propose', defaultMessage: 'Propose' })}
              </Button>
            ) : null}
            {data?.approvalStatus === 'PENDING' ? (
              <>
                <Button variant="primary" onPress={handleApprove} isDisabled={approveMutation.isPending}>
                  {intl.formatMessage({ id: 'transaction.lostDetail.approve', defaultMessage: 'Approve' })}
                </Button>
                <Button variant="danger" onPress={handleReject} isDisabled={rejectMutation.isPending}>
                  {intl.formatMessage({ id: 'transaction.lostDetail.reject', defaultMessage: 'Reject' })}
                </Button>
              </>
            ) : null}

          </div>
          <Button variant="secondary" onPress={() => navigate('/transactions/loss')}>
            <Icon icon="solar:arrow-left-linear" className="size-4" />
            {intl.formatMessage({ id: 'transaction.lostDetail.back', defaultMessage: 'Back' })}
          </Button>
        </Card.Header>

        <Card.Content>
          {isLoading ? (
            <p className="text-sm text-muted">{intl.formatMessage({ id: 'transaction.lostDetail.loading', defaultMessage: 'Loading data...' })}</p>
          ) : (
            <pre className="rounded bg-surface p-4 text-sm text-foreground">{JSON.stringify(data, null, 2)}</pre>
          )}
        </Card.Content>
      </Card>
    </section>
  );
}
