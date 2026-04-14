import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Input } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';

type FoundTransactionCreateInput = inferProcedureInput<AppRouter['foundTransaction']['create']>;
type FoundTransactionUpdateInput = Omit<inferProcedureInput<AppRouter['foundTransaction']['update']>, 'id'>;

export default function FoundTransactionFormPage() {
  const navigate = useNavigate();
  const intl = useIntl();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const [findingType, setFindingType] = useState('');
  const [reference, setReferensi] = useState('');
  const [notes, setKeterangan] = useState('');
  const [date, setTanggal] = useState('');
  const [skuId, setSkuId] = useState('');
  const [palletTypeId, setJenisPaletId] = useState('');
  const [quantity, setJumlah] = useState('1');
  const [approvalStatus, setApprovalStatus] = useState<NonNullable<FoundTransactionCreateInput['approvalStatus']>>('DRAFT');

  const detailQuery = useQuery({
    queryKey: ['foundTransactionDetail', id],
    queryFn: () => trpcClient.foundTransaction.detail.query({ id: id! }),
    enabled: isEdit && Boolean(id),
  });

  useEffect(() => {
    if (!detailQuery.data) return;
    setFindingType(detailQuery.data.findingType ?? '');
    setReferensi(detailQuery.data.reference ?? '');
    setKeterangan(detailQuery.data.notes ?? '');
    setTanggal(detailQuery.data.date.split('T')[0]);
    setSkuId(detailQuery.data.items?.[0]?.skuId ?? '');
    setJenisPaletId(detailQuery.data.items?.[0]?.palletTypeId ?? '');
    setJumlah(String(detailQuery.data.items?.[0]?.quantity ?? 1));
    setApprovalStatus(detailQuery.data.approvalStatus ?? 'DRAFT');
  }, [detailQuery.data]);

  const createMutation = useMutation<unknown, unknown, FoundTransactionCreateInput>({
    mutationFn: (payload) => trpcClient.foundTransaction.create.mutate(payload),
  });
  const updateMutation = useMutation<unknown, unknown, FoundTransactionUpdateInput>({
    mutationFn: (payload) => trpcClient.foundTransaction.update.mutate({ id: id!, ...payload }),
  });

  const handleSubmit = async () => {
    const payload = {
      date: date ? new Date(date) : new Date(),
      findingType,
      reference,
      notes,
      approvalStatus,
      items: [
        {
          skuId,
          palletTypeId,
          quantity: Number(quantity),
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
          </Button>
        </Card.Header>

        <Card.Content className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.foundForm.labelFoundType', defaultMessage: 'Found Type' })}
              </label>
              <Input value={findingType} onChange={(event) => setFindingType(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.foundForm.labelReference', defaultMessage: 'Reference' })}
              </label>
              <Input value={reference} onChange={(event) => setReferensi(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.foundForm.labelRemarks', defaultMessage: 'Remarks' })}
              </label>
              <Input value={notes} onChange={(event) => setKeterangan(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.foundForm.labelDate', defaultMessage: 'Date' })}
              </label>
              <Input type="date" value={date} onChange={(event) => setTanggal(event.target.value)} />
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
              <Input value={palletTypeId} onChange={(event) => setJenisPaletId(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.foundForm.labelQuantity', defaultMessage: 'Quantity' })}
              </label>
              <Input type="number" value={quantity} onChange={(event) => setJumlah(event.target.value)} min={1} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.foundForm.labelStatus', defaultMessage: 'Status' })}
              </label>
              <select className="block w-full rounded border border-muted bg-background px-3 py-2 text-sm text-foreground" value={approvalStatus} onChange={(event) => setApprovalStatus(event.target.value as NonNullable<FoundTransactionCreateInput['approvalStatus']>) }>
                <option value="DRAFT">{intl.formatMessage({ id: 'transaction.foundForm.optionDraft', defaultMessage: 'Draft' })}</option>
                <option value="PENDING">{intl.formatMessage({ id: 'transaction.foundForm.optionPropose', defaultMessage: 'Propose' })}</option>
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
