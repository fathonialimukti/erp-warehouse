import { useEffect, useState } from 'react';
import { Button, Fieldset, Input } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ImageUploadField from '../../components/ImageUploadField';
import { trpcClient } from '../../lib/trpc';

export default function SkuFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const { data: detailData, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['skuDetail', id],
    enabled: isEdit,
    queryFn: () => trpcClient.sku.detail.query({ id: id ?? '' }),
  });

  const [kode, setKode] = useState('');
  const [nama, setNama] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [foto, setFoto] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!detailData) {
      return;
    }

    setKode(detailData.id);
    setNama(detailData.nama);
    setDeskripsi(detailData.deskripsi ?? '');
    setFoto(detailData.foto ?? undefined);
  }, [detailData]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!kode.trim() || !nama.trim()) {
      setErrorMessage('Kode dan nama SKU wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        const updated = await trpcClient.sku.update.mutate({
          id,
          kode: kode.trim(),
          nama: nama.trim(),
          deskripsi: deskripsi.trim() || undefined,
          foto,
        });

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['skuList'] }),
          queryClient.removeQueries({ queryKey: ['skuDetail', id] }),
          queryClient.removeQueries({ queryKey: ['skuDetail', updated.id] }),
        ]);

        navigate(`/skus/${updated.id}`);
      } else {
        const created = await trpcClient.sku.create.mutate({
          kode: kode.trim(),
          nama: nama.trim(),
          deskripsi: deskripsi.trim() || undefined,
          foto,
        });

        await queryClient.invalidateQueries({ queryKey: ['skuList'] });
        queryClient.removeQueries({ queryKey: ['skuDetail', created.id] });

        navigate(`/skus/${created.id}`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Gagal menyimpan SKU.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEdit && isLoadingDetail) {
    return <p className="text-sm text-muted">Memuat detail SKU...</p>;
  }

  return (
    <section className="space-y-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{isEdit ? 'Edit SKU' : 'Tambah SKU'}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {isEdit ? 'Perbarui data SKU.' : 'Isi data SKU baru.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" type="button" onPress={() => navigate('/skus')}>
            <Icon icon="solar:alt-arrow-left-linear" className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <Fieldset className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <Fieldset.Legend className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">Informasi SKU</Fieldset.Legend>
          <Fieldset.Group className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <label className="form-label">Foto SKU</label>
              <ImageUploadField value={foto} onChange={setFoto} />
            </div>
            <div className="space-y-1">
              <label className="form-label" htmlFor="sku-kode">
                Kode SKU
              </label>
              <Input
                id="sku-kode"
                type="text"
                value={kode}
                onChange={(event) => setKode(event.target.value)}
                placeholder="Contoh: SKU-001"
                fullWidth
                variant="secondary"
              />
            </div>
            <div className="space-y-1">
              <label className="form-label" htmlFor="sku-nama">
                Nama SKU
              </label>
              <Input
                id="sku-nama"
                type="text"
                value={nama}
                onChange={(event) => setNama(event.target.value)}
                placeholder="Nama produk"
                fullWidth
                variant="secondary"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="form-label" htmlFor="sku-deskripsi">
                Deskripsi
              </label>
              <Input
                id="sku-deskripsi"
                type="text"
                value={deskripsi}
                onChange={(event) => setDeskripsi(event.target.value)}
                placeholder="Deskripsi singkat SKU"
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
              {isEdit ? 'Simpan Perubahan' : 'Buat SKU'}
            </Button>
          </Fieldset.Actions>
        </Fieldset>
      </form>
    </section>
  );
}
