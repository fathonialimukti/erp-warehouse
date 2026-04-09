import { Button, Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';

type TransaksiMasukUpdateInput = inferProcedureInput<AppRouter['transaksiMasuk']['update']>;
type TransaksiMasukApproveInput = inferProcedureInput<AppRouter['transaksiMasuk']['approve']>;
type TransaksiMasukRejectInput = inferProcedureInput<AppRouter['transaksiMasuk']['reject']>;

export default function TransaksiMasukDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const queryClient = useQueryClient();

  const proposeMutation = useMutation<unknown, unknown, TransaksiMasukUpdateInput>({
    mutationFn: (payload) => trpcClient.transaksiMasuk.update.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaksiMasukDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['transaksiMasukList'] });
    },
  });

  const approveMutation = useMutation<unknown, unknown, TransaksiMasukApproveInput>({
    mutationFn: (payload) => trpcClient.transaksiMasuk.approve.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaksiMasukDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['transaksiMasukList'] });
    },
  });

  const rejectMutation = useMutation<unknown, unknown, TransaksiMasukRejectInput>({
    mutationFn: (payload) => trpcClient.transaksiMasuk.reject.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaksiMasukDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['transaksiMasukList'] });
    },
  });

  const handlePropose = async () => {
    if (!data || !id) return;
    const approvalHistory = (data as any)?.approvalHistory ?? [];

    await proposeMutation.mutateAsync({
      id: id!,
      statusApproval: 'MENUNGGU',
      lokasiMasukId: data.lokasiMasukId ?? undefined,
      tanggal: data.tanggal,
      keterangan: data.keterangan ?? '',
      items: data.items?.map((item: any) => ({
        skuId: item.skuId,
        jumlah: item.jumlah,
        jenisPaletId: item.jenisPaletId,
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
    queryKey: ['transaksiMasukDetail', id],
    queryFn: () => trpcClient.transaksiMasuk.detail.query({ id: id! }),
    enabled: Boolean(id),
  });

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Card.Title>Detail Transaksi Masuk</Card.Title>
            <Card.Description>Menampilkan detail transaksi masuk untuk ID {id}.</Card.Description>
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
          <Button variant="secondary" onPress={() => navigate('/transaksi/masuk')}>
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
