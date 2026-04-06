import { useEffect, useState } from 'react';
import { Button, Fieldset, Input } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ImageUploadField from '../../components/ImageUploadField';
import { trpcClient } from '../../lib/trpc';

export default function WarehouseFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const { data: detailData, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['warehouseDetail', id],
    enabled: isEdit,
    queryFn: () => trpcClient.warehouse.gudang.detail.query({ id: id ?? '' }),
  });

  const [nama, setNama] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [alamat, setAlamat] = useState('');
  const [kapasitasTotal, setKapasitasTotal] = useState('');
  const [foto, setFoto] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!detailData) {
      return;
    }

    setWarehouseId(detailData.id);
    setNama(detailData.nama);
    setAlamat(detailData.alamat);
    setKapasitasTotal(detailData.kapasitasTotal ? String(detailData.kapasitasTotal) : '');
    setFoto(detailData.foto ?? undefined);
  }, [detailData]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!warehouseId.trim() || !nama.trim() || !alamat.trim()) {
      setErrorMessage('Kode gudang, nama, dan alamat wajib diisi.');
      return;
    }

    const kapasitas = kapasitasTotal.trim() ? Number(kapasitasTotal) : undefined;
    if (kapasitasTotal.trim() && Number.isNaN(kapasitas)) {
      setErrorMessage('Kapasitas total harus berupa angka.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        const updated = await trpcClient.warehouse.gudang.update.mutate({
          currentId: id,
          id: warehouseId.trim(),
          nama: nama.trim(),
          alamat: alamat.trim(),
          kapasitasTotal: kapasitas,
          foto,
        });

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['warehouseList'] }),
          queryClient.removeQueries({ queryKey: ['warehouseDetail', id] }),
          queryClient.removeQueries({ queryKey: ['warehouseDetail', updated.id] }),
        ]);

        navigate(`/warehouse/${updated.id}`);
      } else {
        const created = await trpcClient.warehouse.gudang.create.mutate({
          id: warehouseId.trim(),
          nama: nama.trim(),
          alamat: alamat.trim(),
          kapasitasTotal: kapasitas,
          foto,
        });

        await queryClient.invalidateQueries({ queryKey: ['warehouseList'] });
        queryClient.removeQueries({ queryKey: ['warehouseDetail', created.id] });

        navigate(`/warehouse/${created.id}`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Gagal menyimpan gudang.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEdit && isLoadingDetail) {
    return <p className="text-sm text-muted">Memuat detail gudang...</p>;
  }

  return (
    <section className="space-y-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{isEdit ? 'Edit Gudang' : 'Tambah Gudang'}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {isEdit ? 'Perbarui data gudang.' : 'Isi data gudang baru.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" type="button" onPress={() => navigate('/warehouse')}>
            <Icon icon="solar:alt-arrow-left-linear" className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <Fieldset className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <Fieldset.Legend className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">Informasi Gudang</Fieldset.Legend>
          <Fieldset.Group className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <label className="form-label">Foto Gudang</label>
              <ImageUploadField value={foto} onChange={setFoto} />
            </div>
            <div className="space-y-1">
              <label className="form-label" htmlFor="warehouse-id">
                Kode Gudang
              </label>
              <Input
                id="warehouse-id"
                type="text"
                value={warehouseId}
                onChange={(event) => setWarehouseId(event.target.value)}
                placeholder="Kode gudang (contoh: WH001)"
                fullWidth
                variant="secondary"
                readOnly={isEdit}
                className={isEdit ? "bg-gray-50 dark:bg-gray-800" : ""}
              />
              {isEdit && (
                <p className="text-xs text-muted">Kode gudang tidak dapat diubah setelah dibuat</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="form-label" htmlFor="warehouse-name">
                Nama
              </label>
              <Input
                id="warehouse-name"
                type="text"
                value={nama}
                onChange={(event) => setNama(event.target.value)}
                placeholder="Nama gudang"
                fullWidth
                variant="secondary"
              />
            </div>
            <div className="space-y-1">
              <label className="form-label" htmlFor="warehouse-address">
                Alamat
              </label>
              <Input
                id="warehouse-address"
                type="text"
                value={alamat}
                onChange={(event) => setAlamat(event.target.value)}
                placeholder="Alamat gudang"
                fullWidth
                variant="secondary"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="form-label" htmlFor="warehouse-capacity">
                Kapasitas Total
              </label>
              <Input
                id="warehouse-capacity"
                type="number"
                value={kapasitasTotal}
                onChange={(event) => setKapasitasTotal(event.target.value)}
                placeholder="Contoh: 1000"
                fullWidth
                variant="secondary"
              />
            </div>
          </Fieldset.Group>

          {errorMessage && (
            <p className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{errorMessage}</p>
          )}

          <Fieldset.Actions className="mt-6 flex justify-end gap-2">
            <Button variant="primary" type="submit" isDisabled={isSubmitting}>
              {isEdit ? 'Simpan Perubahan' : 'Buat Gudang'}
            </Button>
          </Fieldset.Actions>
        </Fieldset>
      </form>
    </section>
  );
}
