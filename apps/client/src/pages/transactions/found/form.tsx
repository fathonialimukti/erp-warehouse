import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Input } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';

type FoundTransactionCreateInput = inferProcedureInput<AppRouter['transaksiTemuan']['create']>;
type FoundTransactionUpdateInput = Omit<inferProcedureInput<AppRouter['transaksiTemuan']['update']>, 'id'>;

export default function FoundTransactionFormPage() {
  const navigate = useNavigate();
  const intl = useIntl();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const [jenisTemuan, setJenisTemuan] = useState('');
  const [referensi, setReferensi] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [tanggal, setTanggal] = useState('');
  const [skuId, setSkuId] = useState('');
  const [jenisPaletId, setJenisPaletId] = useState('');
  const [jumlah, setJumlah] = useState('1');
  const [statusApproval, setStatusApproval] = useState<NonNullable<FoundTransactionCreateInput['statusApproval']>>('DRAFT');

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

  const createMutation = useMutation<unknown, unknown, FoundTransactionCreateInput>({
    mutationFn: (payload) => trpcClient.transaksiTemuan.create.mutate(payload),
  });
  const updateMutation = useMutation<unknown, unknown, FoundTransactionUpdateInput>({
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
      navigate('/transactions/found');
    } catch {
      // ignore
    }
  };

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
          <Card.Title>
            {isEdit
              ? intl.formatMessage({ id: 'transaction.foundForm.titleEdit', defaultMessage: 'Edit Found Transaction' })
              : intl.formatMessage({ id: 'transaction.foundForm.titleCreate', defaultMessage: 'Create Found Transaction' })}
          </Card.Title>
          <Card.Description>
            {isEdit
              ? intl.formatMessage({ id: 'transaction.foundForm.descriptionEdit', defaultMessage: 'Update the found transaction.' })
              : intl.formatMessage({ id: 'transaction.foundForm.descriptionCreate', defaultMessage: 'Enter data to create a new found transaction.' })}
          </Card.Description>
        </div>
        <Button variant="secondary" onPress={() => navigate('/transactions/found')}>
          <Icon icon="solar:arrow-left-linear" className="size-4" />
          {intl.formatMessage({ id: 'transaction.foundForm.back', defaultMessage: 'Back' })}

        <Card.Content className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.foundForm.labelFoundType', defaultMessage: 'Found Type' })}
              </label>
              <Input value={jenisTemuan} onChange={(event) => setJenisTemuan(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.foundForm.labelReference', defaultMessage: 'Reference' })}
              </label>
              <Input value={referensi} onChange={(event) => setReferensi(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.foundForm.labelRemarks', defaultMessage: 'Remarks' })}
              </label>
              <Input value={keterangan} onChange={(event) => setKeterangan(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.foundForm.labelDate', defaultMessage: 'Date' })}
              </label>
              <Input type="date" value={tanggal} onChange={(event) => setTanggal(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.foundForm.labelSkuId', defaultMessage: 'SKU ID' })}
              </label>
              <Input value={skuId} onChange={(event) => setSkuId(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.foundForm.labelPalletTypeId', defaultMessage: 'Pallet Type ID' })}
              </label>
              <Input value={jenisPaletId} onChange={(event) => setJenisPaletId(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.foundForm.labelQuantity', defaultMessage: 'Quantity' })}
              </label>
              <Input type="number" value={jumlah} onChange={(event) => setJumlah(event.target.value)} min={1} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.foundForm.labelStatus', defaultMessage: 'Status' })}
              </label>
              <select className="block w-full rounded border border-muted bg-background px-3 py-2 text-sm text-foreground" value={statusApproval} onChange={(event) => setStatusApproval(event.target.value as NonNullable<FoundTransactionCreateInput['statusApproval']>) }>
                <option value="DRAFT">{intl.formatMessage({ id: 'transaction.foundForm.optionDraft', defaultMessage: 'Draft' })}</option>
                <option value="MENUNGGU">{intl.formatMessage({ id: 'transaction.foundForm.optionPropose', defaultMessage: 'Propose' })}</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="primary"
              onPress={handleSubmit}
              isDisabled={createMutation.isPending || updateMutation.isPending}
            >
              {isEdit
                ? intl.formatMessage({ id: 'transaction.foundForm.submitUpdate', defaultMessage: 'Update' })
                : intl.formatMessage({ id: 'transaction.foundForm.submitCreate', defaultMessage: 'Create' })}
            </Button>
            <Button variant="secondary" onPress={() => navigate('/transactions/found')}>
              {intl.formatMessage({ id: 'transaction.foundForm.cancel', defaultMessage: 'Cancel' })}
            </Button>
          </div>
        </Card.Content>
      </Card>
    </section>
  );
}
