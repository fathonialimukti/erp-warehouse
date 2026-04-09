import { useEffect, useState } from 'react';
import { Button, Card, Input } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';

type TransaksiKeluarCreateInput = inferProcedureInput<AppRouter['transaksiKeluar']['create']>;
type TransaksiKeluarUpdateInput = Omit<inferProcedureInput<AppRouter['transaksiKeluar']['update']>, 'id'>;

export default function TransaksiKeluarFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const [lokasiKeluarId, setLokasiKeluarId] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [tanggal, setTanggal] = useState('');
  const [paletIds, setPaletIds] = useState('');
  const [statusApproval, setStatusApproval] = useState<NonNullable<TransaksiKeluarCreateInput['statusApproval']>>('DRAFT');

  const detailQuery = useQuery({
    queryKey: ['transaksiKeluarDetail', id],
    queryFn: () => trpcClient.transaksiKeluar.detail.query({ id: id! }),
    enabled: isEdit && Boolean(id),
  });

  useEffect(() => {
    if (!detailQuery.data) return;
    setLokasiKeluarId(detailQuery.data.lokasiKeluarId);
    setKeterangan(detailQuery.data.keterangan ?? '');
    setTanggal(detailQuery.data.tanggal.split('T')[0]);
    setPaletIds(detailQuery.data.items?.map((item: any) => item.paletId).join(', ') ?? '');
    setStatusApproval(detailQuery.data.statusApproval ?? 'DRAFT');
  }, [detailQuery.data]);

  const createMutation = useMutation<unknown, unknown, TransaksiKeluarCreateInput>({
    mutationFn: (payload) => trpcClient.transaksiKeluar.create.mutate(payload),
  });
  const updateMutation = useMutation<unknown, unknown, TransaksiKeluarUpdateInput>({
    mutationFn: (payload) => trpcClient.transaksiKeluar.update.mutate({ id: id!, ...payload }),
  });

  const handleSubmit = async () => {
    const payload = {
      lokasiKeluarId,
      tanggal: tanggal ? new Date(tanggal) : new Date(),
      keterangan,
      statusApproval,
      paletIds: paletIds.split(',').map((value) => value.trim()).filter(Boolean),
    };

    try {
      if (isEdit) {
        await updateMutation.mutateAsync(payload);
      } else {
        await createMutation.mutateAsync(payload);
      }
      navigate('/transaksi/keluar');
    } catch {
      // ignore
    }
  };

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Card.Title>{isEdit ? 'Edit Transaksi Keluar' : 'Buat Transaksi Keluar'}</Card.Title>
            <Card.Description>
              {isEdit ? 'Perbarui transaksi keluar.' : 'Isi data untuk membuat transaksi keluar baru.'}
            </Card.Description>
          </div>
          <Button variant="secondary" onPress={() => navigate('/transaksi/keluar')}>
            <Icon icon="solar:arrow-left-linear" className="size-4" />
            Kembali
          </Button>
        </Card.Header>

        <Card.Content className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground">Lokasi Keluar ID</label>
              <Input value={lokasiKeluarId} onChange={(event) => setLokasiKeluarId(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Tanggal</label>
              <Input type="date" value={tanggal} onChange={(event) => setTanggal(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Keterangan</label>
              <Input value={keterangan} onChange={(event) => setKeterangan(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Palet IDs</label>
              <Input value={paletIds} onChange={(event) => setPaletIds(event.target.value)} placeholder="ID1, ID2, ID3" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Status</label>
              <select className="block w-full rounded border border-muted bg-background px-3 py-2 text-sm text-foreground" value={statusApproval} onChange={(event) => setStatusApproval(event.target.value as NonNullable<TransaksiKeluarCreateInput['statusApproval']>)}>
                <option value="DRAFT">Draft</option>
                <option value="MENUNGGU">Propose</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="primary"
              onPress={handleSubmit}
              isDisabled={createMutation.isPending || updateMutation.isPending}
            >
              {isEdit ? 'Update' : 'Create'}
            </Button>
            <Button variant="secondary" onPress={() => navigate('/transaksi/keluar')}>
              Batal
            </Button>
          </div>
        </Card.Content>
      </Card>
    </section>
  );
}
