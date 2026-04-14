import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Input } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';

type OutboundTransactionCreateInput = inferProcedureInput<AppRouter['outboundTransaction']['create']>;
type OutboundTransactionUpdateInput = Omit<inferProcedureInput<AppRouter['outboundTransaction']['update']>, 'id'>;

export default function OutboundTransactionFormPage() {
  const navigate = useNavigate();
  const intl = useIntl();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const [outgoingLocationId, setLokasiKeluarId] = useState('');
  const [notes, setKeterangan] = useState('');
  const [date, setTanggal] = useState('');
  const [palletIds, setPaletIds] = useState('');
  const [approvalStatus, setApprovalStatus] = useState<NonNullable<OutboundTransactionCreateInput['approvalStatus']>>('DRAFT');

  const detailQuery = useQuery({
    queryKey: ['outboundTransactionDetail', id],
    queryFn: () => trpcClient.outboundTransaction.detail.query({ id: id! }),
    enabled: isEdit && Boolean(id),
  });

  useEffect(() => {
    if (!detailQuery.data) return;
    setLokasiKeluarId(detailQuery.data.outgoingLocationId);
    setKeterangan(detailQuery.data.notes ?? '');
    setTanggal(detailQuery.data.date.split('T')[0]);
    setPaletIds(detailQuery.data.items?.map((item: any) => item.palletId).join(', ') ?? '');
    setApprovalStatus(detailQuery.data.approvalStatus ?? 'DRAFT');
  }, [detailQuery.data]);

  const createMutation = useMutation<unknown, unknown, OutboundTransactionCreateInput>({
    mutationFn: (payload) => trpcClient.outboundTransaction.create.mutate(payload),
  });
  const updateMutation = useMutation<unknown, unknown, OutboundTransactionUpdateInput>({
    mutationFn: (payload) => trpcClient.outboundTransaction.update.mutate({ id: id!, ...payload }),
  });

  const handleSubmit = async () => {
    const payload = {
      outgoingLocationId,
      date: date ? new Date(date) : new Date(),
      notes,
      approvalStatus,
      palletIds: palletIds.split(',').map((value) => value.trim()).filter(Boolean),
    };

    try {
      if (isEdit) {
        await updateMutation.mutateAsync(payload);
      } else {
        await createMutation.mutateAsync(payload);
      }
      navigate('/transactions/outbound');
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
                ? intl.formatMessage({ id: 'transaction.outgoingForm.titleEdit', defaultMessage: 'Edit Outbound Transaction' })
                : intl.formatMessage({ id: 'transaction.outgoingForm.titleCreate', defaultMessage: 'Create Outbound Transaction' })}
            </Card.Title>
            <Card.Description>
              {isEdit
                ? intl.formatMessage({ id: 'transaction.outgoingForm.descriptionEdit', defaultMessage: 'Update the outbound transaction.' })
                : intl.formatMessage({ id: 'transaction.outgoingForm.descriptionCreate', defaultMessage: 'Enter data to create a new outbound transaction.' })}
            </Card.Description>
          </div>
          <Button variant="secondary" onPress={() => navigate('/transactions/outbound')}>
            <Icon icon="solar:arrow-left-linear" className="size-4" />
            {intl.formatMessage({ id: 'transaction.outgoingForm.back', defaultMessage: 'Back' })}
          </Button>
        </Card.Header>

        <Card.Content className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.outgoingForm.labelLocationId', defaultMessage: 'Outbound Location ID' })}
              </label>
              <Input value={outgoingLocationId} onChange={(event) => setLokasiKeluarId(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.outgoingForm.labelDate', defaultMessage: 'Date' })}
              </label>
              <Input type="date" value={date} onChange={(event) => setTanggal(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.outgoingForm.labelDescription', defaultMessage: 'Description' })}
              </label>
              <Input value={notes} onChange={(event) => setKeterangan(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.outgoingForm.labelPalletIds', defaultMessage: 'Pallet IDs' })}
              </label>
              <Input
                value={palletIds}
                onChange={(event) => setPaletIds(event.target.value)}
                placeholder={intl.formatMessage({ id: 'transaction.outgoingForm.placeholderPalletIds', defaultMessage: 'ID1, ID2, ID3' })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.outgoingForm.labelStatus', defaultMessage: 'Status' })}
              </label>
              <select className="block w-full rounded border border-muted bg-background px-3 py-2 text-sm text-foreground" value={approvalStatus} onChange={(event) => setApprovalStatus(event.target.value as NonNullable<OutboundTransactionCreateInput['approvalStatus']>) }>
                <option value="DRAFT">{intl.formatMessage({ id: 'transaction.outgoingForm.optionDraft', defaultMessage: 'Draft' })}</option>
                <option value="PENDING">{intl.formatMessage({ id: 'transaction.outgoingForm.optionPropose', defaultMessage: 'Propose' })}</option>
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
                ? intl.formatMessage({ id: 'transaction.outgoingForm.submitUpdate', defaultMessage: 'Update' })
                : intl.formatMessage({ id: 'transaction.outgoingForm.submitCreate', defaultMessage: 'Create' })}
            </Button>
            <Button variant="secondary" onPress={() => navigate('/transactions/outbound')}>
              {intl.formatMessage({ id: 'transaction.outgoingForm.cancel', defaultMessage: 'Cancel' })}
            </Button>
          </div>
        </Card.Content>
      </Card>
    </section>
  );
}
