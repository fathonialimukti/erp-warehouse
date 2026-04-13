import { useIntl } from 'react-intl';
import { Button, Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';

type TransaksiKehilanganUpdateInput = inferProcedureInput<AppRouter['transaksiKehilangan']['update']>;
type TransaksiKehilanganApproveInput = inferProcedureInput<AppRouter['transaksiKehilangan']['approve']>;
type TransaksiKehilanganRejectInput = inferProcedureInput<AppRouter['transaksiKehilangan']['reject']>;

export default function TransaksiKehilanganDetailPage() {
  const navigate = useNavigate();
  const intl = useIntl();
  const { id } = useParams<{ id?: string }>();
  const queryClient = useQueryClient();

  const proposeMutation = useMutation<unknown, unknown, TransaksiKehilanganUpdateInput>({
    mutationFn: (payload) => trpcClient.transaksiKehilangan.update.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaksiKehilanganDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['transaksiKehilanganList'] });
    },
  });

  const approveMutation = useMutation<unknown, unknown, TransaksiKehilanganApproveInput>({
    mutationFn: (payload) => trpcClient.transaksiKehilangan.approve.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaksiKehilanganDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['transaksiKehilanganList'] });
    },
  });

  const rejectMutation = useMutation<unknown, unknown, TransaksiKehilanganRejectInput>({
    mutationFn: (payload) => trpcClient.transaksiKehilangan.reject.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaksiKehilanganDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['transaksiKehilanganList'] });
    },
  });

  const handlePropose = async () => {
    if (!data || !id) return;
    const approvalHistory = (data as any)?.approvalHistory ?? [];

    await proposeMutation.mutateAsync({
      id: id!,
      statusApproval: 'MENUNGGU',
      tanggal: data.tanggal,
      alasanKehilangan: data.alasanKehilangan ?? '',
      nilaiEstimasi: data.nilaiEstimasi ?? undefined,
      referensi: data.referensi ?? '',
      keterangan: data.keterangan ?? '',
      paletIds: data.paletPivots?.map((pivot: any) => pivot.paletId) ?? [],
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
    queryKey: ['transaksiKehilanganDetail', id],
    queryFn: () => trpcClient.transaksiKehilangan.detail.query({ id: id! }),
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
            {data?.statusApproval === 'DRAFT' ? (
              <Button variant="secondary" onPress={handlePropose} isDisabled={proposeMutation.isPending}>
                {intl.formatMessage({ id: 'transaction.lostDetail.propose', defaultMessage: 'Propose' })}
              </Button>
            ) : null}
            {data?.statusApproval === 'MENUNGGU' ? (
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
          <Button variant="secondary" onPress={() => navigate('/transaksi/kehilangan')}>
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
