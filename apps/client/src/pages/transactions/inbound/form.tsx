import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Input } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';

type InboundTransactionCreateInput = inferProcedureInput<AppRouter['inboundTransaction']['create']>;
type InboundTransactionUpdateInput = Omit<inferProcedureInput<AppRouter['inboundTransaction']['update']>, 'id'>;

export default function InboundTransactionFormPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const [notes, setKeterangan] = useState('');
  const [date, setTanggal] = useState('');
  const [skuId, setSkuId] = useState('');
  const [palletTypeId, setJenisPaletId] = useState('');
  const [quantity, setJumlah] = useState('1');
  const [approvalStatus, setApprovalStatus] = useState<NonNullable<InboundTransactionCreateInput['approvalStatus']>>('DRAFT');

  const detailQuery = useQuery({
    queryKey: ['inboundTransactionDetail', id],
    queryFn: () => trpcClient.inboundTransaction.detail.query({ id: id! }),
    enabled: isEdit && Boolean(id),
  });

  useEffect(() => {
    if (!detailQuery.data) return;
    setKeterangan(detailQuery.data.notes ?? '');
    setTanggal(detailQuery.data.date.split('T')[0]);
    setSkuId(detailQuery.data.items?.[0]?.skuId ?? '');
    setJenisPaletId(detailQuery.data.items?.[0]?.palletTypeId ?? '');
    setJumlah(String(detailQuery.data.items?.[0]?.quantity ?? 1));
    setApprovalStatus(detailQuery.data.approvalStatus ?? 'DRAFT');
  }, [detailQuery.data]);

  const createMutation = useMutation<unknown, unknown, InboundTransactionCreateInput>({
    mutationFn: (payload) => trpcClient.inboundTransaction.create.mutate(payload),
  });
  const updateMutation = useMutation<unknown, unknown, InboundTransactionUpdateInput>({
    mutationFn: (payload) => trpcClient.inboundTransaction.update.mutate({ id: id!, ...payload }),
  });

  const handleSubmit = async () => {
    const payload = {
      date: date ? new Date(date) : new Date(),
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
      navigate('/transactions/inbound');
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
                ? intl.formatMessage({ id: 'transaction.incomingForm.titleEdit', defaultMessage: 'Edit Incoming Transaction' })
                : intl.formatMessage({ id: 'transaction.incomingForm.titleCreate', defaultMessage: 'Create Incoming Transaction' })}
            </Card.Title>
            <Card.Description>
              {isEdit
                ? intl.formatMessage({ id: 'transaction.incomingForm.descriptionEdit', defaultMessage: 'Update the incoming transaction.' })
                : intl.formatMessage({ id: 'transaction.incomingForm.descriptionCreate', defaultMessage: 'Enter information to create a new incoming transaction.' })}
            </Card.Description>
          </div>
          <Button variant="secondary" onPress={() => navigate('/transactions/inbound')}>
            <Icon icon="solar:arrow-left-linear" className="size-4" />
            {intl.formatMessage({ id: 'transaction.incomingForm.back', defaultMessage: 'Back' })}
          </Button>
        </Card.Header>

        <Card.Content className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.incomingForm.labelDescription', defaultMessage: 'Description' })}
              </label>
              <Input value={notes} onChange={(event) => setKeterangan(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.incomingForm.labelDate', defaultMessage: 'Date' })}
              </label>
              <Input type="date" value={date} onChange={(event) => setTanggal(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.incomingForm.labelSkuId', defaultMessage: 'SKU ID' })}
              </label>
              <Input
                value={skuId}
                onChange={(event) => setSkuId(event.target.value)}
                placeholder={intl.formatMessage({ id: 'transaction.incomingForm.placeholderSkuId', defaultMessage: 'Enter SKU ID' })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.incomingForm.labelPalletTypeId', defaultMessage: 'Pallet Type ID' })}
              </label>
              <Input
                value={palletTypeId}
                onChange={(event) => setJenisPaletId(event.target.value)}
                placeholder={intl.formatMessage({ id: 'transaction.incomingForm.placeholderPalletTypeId', defaultMessage: 'Enter pallet type ID' })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.incomingForm.labelQuantity', defaultMessage: 'Quantity' })}
              </label>
              <Input type="number" value={quantity} onChange={(event) => setJumlah(event.target.value)} min={1} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.incomingForm.labelStatus', defaultMessage: 'Status' })}
              </label>
              <select
                className="block w-full rounded border border-muted bg-background px-3 py-2 text-sm text-foreground"
                value={approvalStatus}
                onChange={(event) => setApprovalStatus(event.target.value as NonNullable<InboundTransactionCreateInput['approvalStatus']>)}
              >
                <option value="DRAFT">{intl.formatMessage({ id: 'transaction.incomingForm.optionDraft', defaultMessage: 'Draft' })}</option>
                <option value="PENDING">{intl.formatMessage({ id: 'transaction.incomingForm.optionPropose', defaultMessage: 'Propose' })}</option>
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
                ? intl.formatMessage({ id: 'transaction.incomingForm.submitUpdate', defaultMessage: 'Update' })
                : intl.formatMessage({ id: 'transaction.incomingForm.submitCreate', defaultMessage: 'Create' })}
            </Button>
            <Button variant="secondary" onPress={() => navigate('/transactions/inbound')}>
              {intl.formatMessage({ id: 'transaction.incomingForm.cancel', defaultMessage: 'Cancel' })}
            </Button>
          </div>
        </Card.Content>
      </Card>
    </section>
  );
}
