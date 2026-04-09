import { useEffect, useState } from 'react';
import { Button, Card, Input } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';

type TransaksiTemuanCreateInput = inferProcedureInput<AppRouter['transaksiTemuan']['create']>;
type TransaksiTemuanUpdateInput = Omit<inferProcedureInput<AppRouter['transaksiTemuan']['update']>, 'id'>;

export default function TransaksiTemuanFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const [jenisTemuan, setJenisTemuan] = useState('');
  const [referensi, setReferensi] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [tanggal, setTanggal] = useState('');
  const [skuId, setSkuId] = useState('');
  const [jenisPaletId, setJenisPaletId] = useState('');
  const [jumlah, setJumlah] = useState('1');
  const [statusApproval, setStatusApproval] = useState<NonNullable<TransaksiTemuanCreateInput['statusApproval']>>('DRAFT');

  const detailQuery = useQuery({
    queryKey: ['transaksiTemuanDetail', id],
    queryFn: () => trpcClient.transaksiTemuan.detail.query({ id: id! }),
    enabled: isEdit && Boolean(id),
  });

  useEffect(() => {
    if (!detailQuery.data) return;
    setJenisTemuan(detailQuery.data.jenisTemuan ?? '');
    setReferensi(detailQuery.data.referensi ?? '');
    setKeterangan(detailQuery.data.keterangan ?? '');
    setTanggal(detailQuery.data.tanggal.split('T')[0]);
    setSkuId(detailQuery.data.items?.[0]?.skuId ?? '');
    setJenisPaletId(detailQuery.data.items?.[0]?.jenisPaletId ?? '');
    setJumlah(String(detailQuery.data.items?.[0]?.jumlah ?? 1));
    setStatusApproval(detailQuery.data.statusApproval ?? 'DRAFT');
  }, [detailQuery.data]);

  const createMutation = useMutation<unknown, unknown, TransaksiTemuanCreateInput>({
    mutationFn: (payload) => trpcClient.transaksiTemuan.create.mutate(payload),
  });
  const updateMutation = useMutation<unknown, unknown, TransaksiTemuanUpdateInput>({
    mutationFn: (payload) => trpcClient.transaksiTemuan.update.mutate({ id: id!, ...payload }),
  });

  const handleSubmit = async () => {
    const payload = {
      tanggal: tanggal ? new Date(tanggal) : new Date(),
      jenisTemuan,
      referensi,
      keterangan,
      statusApproval,
      items: [
        {
          skuId,
          jenisPaletId,
          jumlah: Number(jumlah),
        },
      ],
    };

    try {
      if (isEdit) {
        await updateMutation.mutateAsync(payload);
      } else {
        await createMutation.mutateAsync(payload);
      }
      navigate('/transaksi/temuan');
    } catch {
      // ignore
    }
  };

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Card.Title>{isEdit ? 'Edit Transaksi Temuan' : 'Buat Transaksi Temuan'}</Card.Title>
            <Card.Description>
              {isEdit ? 'Perbarui transaksi temuan.' : 'Isi data untuk membuat transaksi temuan baru.'}
            </Card.Description>
          </div>
          <Button variant="secondary" onPress={() => navigate('/transaksi/temuan')}>
            <Icon icon="solar:arrow-left-linear" className="size-4" />
            Kembali
          </Button>
        </Card.Header>

        <Card.Content className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground">Jenis Temuan</label>
              <Input value={jenisTemuan} onChange={(event) => setJenisTemuan(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Referensi</label>
              <Input value={referensi} onChange={(event) => setReferensi(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Keterangan</label>
              <Input value={keterangan} onChange={(event) => setKeterangan(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Tanggal</label>
              <Input type="date" value={tanggal} onChange={(event) => setTanggal(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">SKU ID</label>
              <Input value={skuId} onChange={(event) => setSkuId(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Jenis Palet ID</label>
              <Input value={jenisPaletId} onChange={(event) => setJenisPaletId(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Jumlah</label>
              <Input type="number" value={jumlah} onChange={(event) => setJumlah(event.target.value)} min={1} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Status</label>
              <select className="block w-full rounded border border-muted bg-background px-3 py-2 text-sm text-foreground" value={statusApproval} onChange={(event) => setStatusApproval(event.target.value as NonNullable<TransaksiTemuanCreateInput['statusApproval']>)}>
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
            <Button variant="secondary" onPress={() => navigate('/transaksi/temuan')}>
              Batal
            </Button>
          </div>
        </Card.Content>
      </Card>
    </section>
  );
}
