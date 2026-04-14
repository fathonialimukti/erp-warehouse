import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Input } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';

type LostTransactionCreateInput = inferProcedureInput<AppRouter['lossTransaction']['create']>;
type LostTransactionUpdateInput = Omit<inferProcedureInput<AppRouter['lossTransaction']['update']>, 'id'>;

export default function LostTransactionFormPage() {
  const navigate = useNavigate();
  const intl = useIntl();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const [lossReason, setAlasanKehilangan] = useState('');
  const [estimatedValue, setNilaiEstimasi] = useState('');
  const [reference, setReferensi] = useState('');
  const [notes, setKeterangan] = useState('');
  const [date, setTanggal] = useState('');
  const [palletIds, setPaletIds] = useState('');
  const [approvalStatus, setApprovalStatus] = useState<NonNullable<LostTransactionCreateInput['approvalStatus']>>('DRAFT');

  const detailQuery = useQuery({
    queryKey: ['lossTransactionDetail', id],
    queryFn: () => trpcClient.lossTransaction.detail.query({ id: id! }),
    enabled: isEdit && Boolean(id),
  });

  useEffect(() => {
    if (!detailQuery.data) return;
    setAlasanKehilangan(detailQuery.data.lossReason ?? '');
    setNilaiEstimasi(detailQuery.data.estimatedValue ? String(detailQuery.data.estimatedValue) : '');
    setReferensi(detailQuery.data.reference ?? '');
    setKeterangan(detailQuery.data.notes ?? '');
    setTanggal(detailQuery.data.date.split('T')[0]);
    setPaletIds(detailQuery.data.paletPivots?.map((pivot: any) => pivot.palletId).join(', ') ?? '');
    setApprovalStatus(detailQuery.data.approvalStatus ?? 'DRAFT');
  }, [detailQuery.data]);

  const createMutation = useMutation<unknown, unknown, LostTransactionCreateInput>({
    mutationFn: (payload) => trpcClient.lossTransaction.create.mutate(payload),
  });
  const updateMutation = useMutation<unknown, unknown, LostTransactionUpdateInput>({
    mutationFn: (payload) => trpcClient.lossTransaction.update.mutate({ id: id!, ...payload }),
  });

  const handleSubmit = async () => {
    const payload = {
      date: date ? new Date(date) : new Date(),
      lossReason,
      estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
      reference,
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
      navigate('/transactions/loss');
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
                ? intl.formatMessage({ id: 'transaction.lostForm.titleEdit', defaultMessage: 'Edit Loss Transaction' })
                : intl.formatMessage({ id: 'transaction.lostForm.titleCreate', defaultMessage: 'Create Loss Transaction' })}
            </Card.Title>
            <Card.Description>
              {isEdit
                ? intl.formatMessage({ id: 'transaction.lostForm.descriptionEdit', defaultMessage: 'Update the loss transaction.' })
                : intl.formatMessage({ id: 'transaction.lostForm.descriptionCreate', defaultMessage: 'Enter data to create a new loss transaction.' })}
            </Card.Description>
          </div>
          <Button variant="secondary" onPress={() => navigate('/transactions/loss')}>
            <Icon icon="solar:arrow-left-linear" className="size-4" />
            {intl.formatMessage({ id: 'transaction.lostForm.back', defaultMessage: 'Back' })}
          </Button>
        </Card.Header>

        <Card.Content className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.lostForm.labelLossReason', defaultMessage: 'Loss Reason' })}
              </label>
              <Input value={lossReason} onChange={(event) => setAlasanKehilangan(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.lostForm.labelEstimatedValue', defaultMessage: 'Estimated Value' })}
              </label>
              <Input type="number" value={estimatedValue} onChange={(event) => setNilaiEstimasi(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.lostForm.labelReference', defaultMessage: 'Reference' })}
              </label>
              <Input value={reference} onChange={(event) => setReferensi(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.lostForm.labelDescription', defaultMessage: 'Description' })}
              </label>
              <Input value={notes} onChange={(event) => setKeterangan(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.lostForm.labelDate', defaultMessage: 'Date' })}
              </label>
              <Input type="date" value={date} onChange={(event) => setTanggal(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.lostForm.labelPalletIds', defaultMessage: 'Pallet IDs' })}
              </label>
              <Input
                value={palletIds}
                onChange={(event) => setPaletIds(event.target.value)}
                placeholder={intl.formatMessage({ id: 'transaction.lostForm.placeholderPalletIds', defaultMessage: 'ID1, ID2, ID3' })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                {intl.formatMessage({ id: 'transaction.lostForm.labelStatus', defaultMessage: 'Status' })}
              </label>
              <select className="block w-full rounded border border-muted bg-background px-3 py-2 text-sm text-foreground" value={approvalStatus} onChange={(event) => setApprovalStatus(event.target.value as NonNullable<LostTransactionCreateInput['approvalStatus']>) }>
                <option value="DRAFT">{intl.formatMessage({ id: 'transaction.lostForm.optionDraft', defaultMessage: 'Draft' })}</option>
                <option value="PENDING">{intl.formatMessage({ id: 'transaction.lostForm.optionPropose', defaultMessage: 'Propose' })}</option>
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
                ? intl.formatMessage({ id: 'transaction.lostForm.submitUpdate', defaultMessage: 'Update' })
                : intl.formatMessage({ id: 'transaction.lostForm.submitCreate', defaultMessage: 'Create' })}
            </Button>
            <Button variant="secondary" onPress={() => navigate('/transactions/loss')}>
              {intl.formatMessage({ id: 'transaction.lostForm.cancel', defaultMessage: 'Cancel' })}
            </Button>
          </div>
        </Card.Content>
      </Card>
    </section>
  );
}
