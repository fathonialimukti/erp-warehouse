import { Button, Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';

type TransaksiKeluarUpdateInput = inferProcedureInput<AppRouter['transaksiKeluar']['update']>;
type TransaksiKeluarApproveInput = inferProcedureInput<AppRouter['transaksiKeluar']['approve']>;
type TransaksiKeluarRejectInput = inferProcedureInput<AppRouter['transaksiKeluar']['reject']>;

export default function TransaksiKeluarDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const queryClient = useQueryClient();

  const proposeMutation = useMutation<unknown, unknown, TransaksiKeluarUpdateInput>({
    mutationFn: (payload) => trpcClient.transaksiKeluar.update.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaksiKeluarDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['transaksiKeluarList'] });
    },
  });

  const approveMutation = useMutation<unknown, unknown, TransaksiKeluarApproveInput>({
    mutationFn: (payload) => trpcClient.transaksiKeluar.approve.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaksiKeluarDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['transaksiKeluarList'] });
    },
  });

  const rejectMutation = useMutation<unknown, unknown, TransaksiKeluarRejectInput>({
    mutationFn: (payload) => trpcClient.transaksiKeluar.reject.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaksiKeluarDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['transaksiKeluarList'] });
    },
  });

  const handlePropose = async () => {
    if (!data || !id) return;
    const approvalHistory = (data as any)?.approvalHistory ?? [];

    await proposeMutation.mutateAsync({
      id: id!,
      statusApproval: 'MENUNGGU',
      lokasiKeluarId: data.lokasiKeluarId,
      tanggal: data.tanggal,
      keterangan: data.keterangan ?? '',
      paletIds: data.items?.map((item: any) => item.paletId) ?? [],
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
    queryKey: ['transaksiKeluarDetail', id],
    queryFn: () => trpcClient.transaksiKeluar.detail.query({ id: id! }),
    enabled: Boolean(id),
  });

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Card.Title>Detail Transaksi Keluar</Card.Title>
            <Card.Description>Menampilkan detail transaksi keluar untuk ID {id}.</Card.Description>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data?.statusApproval === 'DRAFT' ? (
              <Button variant="secondary" onPress={handlePropose} isDisabled={proposeMutation.isPending}>
                Propose
              </Button>
            ) : null} 
            {data?.statusApproval === 'MENUNGGU' ? (
              <>
                <Button variant="primary" onPress={handleApprove} isDisabled={approveMutation.isPending}>
                  Approve
                </Button>
                <Button variant="danger" onPress={handleReject} isDisabled={rejectMutation.isPending}>
                  Reject
                </Button>
              </>
            ) : null} 
          </div>
          <Button variant="secondary" onPress={() => navigate('/transaksi/keluar')}>
            <Icon icon="solar:arrow-left-linear" className="size-4" />
            Kembali
          </Button>
        </Card.Header>

        <Card.Content>
          {isLoading ? (
            <p className="text-sm text-muted">Memuat data...</p>
          ) : (
            <pre className="rounded bg-surface p-4 text-sm text-foreground">{JSON.stringify(data, null, 2)}</pre>
          )}
        </Card.Content>
      </Card>
    </section>
  );
}
