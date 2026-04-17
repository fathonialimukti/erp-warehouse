import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';
import { type EditableApprovalStatus, splitCommaSeparatedValues, toEditableApprovalStatus, TransactionFormCard, TransactionStatusSelect, TransactionTextField } from '../shared';

type LostTransactionCreateInput = inferProcedureInput<AppRouter['lossTransaction']['create']>;
type LostTransactionUpdateInput = Omit<inferProcedureInput<AppRouter['lossTransaction']['update']>, 'id'>;

interface LossTransactionFormDetail {
  approvalStatus: string;
  date: string;
  estimatedValue: number | string | null;
  lossReason: string | null;
  notes: string | null;
  reference: string | null;
  palletPivots?: Array<{ palletId: string }>;
}

export const LostTransactionFormPage = () => {
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
  const [approvalStatus, setApprovalStatus] = useState<EditableApprovalStatus>('DRAFT');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ['lossTransactionDetail', id],
    queryFn: () => trpcClient.lossTransaction.detail.query({ id: id! }),
    enabled: isEdit && Boolean(id),
  });

  useEffect(() => {
    const detail = detailQuery.data as LossTransactionFormDetail | undefined;
    if (!detail) return;
    setAlasanKehilangan(detail.lossReason ?? '');
    setNilaiEstimasi(detail.estimatedValue ? String(detail.estimatedValue) : '');
    setReferensi(detail.reference ?? '');
    setKeterangan(detail.notes ?? '');
    setTanggal(detail.date.split('T')[0]);
    setPaletIds(detail.palletPivots?.map((pivot) => pivot.palletId).join(', ') ?? '');
    setApprovalStatus(toEditableApprovalStatus(detail.approvalStatus));
  }, [detailQuery.data]);

  const createMutation = useMutation<unknown, unknown, LostTransactionCreateInput>({
    mutationFn: (payload) => trpcClient.lossTransaction.create.mutate(payload),
  });
  const updateMutation = useMutation<unknown, unknown, LostTransactionUpdateInput>({
    mutationFn: (payload) => trpcClient.lossTransaction.update.mutate({ id: id!, ...payload }),
  });

  const parsedPalletIds = splitCommaSeparatedValues(palletIds);
  const isEstimatedValueInvalid = Boolean(estimatedValue.trim()) && (!Number.isFinite(Number(estimatedValue)) || Number(estimatedValue) < 0);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!lossReason.trim()) {
      setErrorMessage(intl.formatMessage({ id: 'transaction.lost_form.error_loss_reason', defaultMessage: 'Loss reason is required.' }));
      return;
    }

    if (parsedPalletIds.length === 0) {
      setErrorMessage(intl.formatMessage({ id: 'transaction.lost_form.error_pallet_ids', defaultMessage: 'At least one pallet ID is required.' }));
      return;
    }

    if (isEstimatedValueInvalid) {
      setErrorMessage(intl.formatMessage({ id: 'transaction.lost_form.error_estimated_value', defaultMessage: 'Estimated value must be zero or greater.' }));
      return;
    }

    const payload = {
      date: date ? new Date(date) : new Date(),
      lossReason,
      estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
      reference,
      notes,
      approvalStatus,
      palletIds: parsedPalletIds,
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
      <form className="space-y-6" onSubmit={handleSubmit}>
        <TransactionFormCard
          actions={
            <>
              <Button variant="secondary" type="button" onPress={() => navigate('/transactions/loss')}>
                <Icon icon="solar:arrow-left-linear" className="size-4" />
                {intl.formatMessage({ id: 'transaction_lostform_back', defaultMessage: 'Back' })}
              </Button>
              <Button type="submit" variant="primary" isDisabled={createMutation.isPending || updateMutation.isPending || parsedPalletIds.length === 0 || isEstimatedValueInvalid}>
                {isEdit
                  ? intl.formatMessage({ id: 'transaction_lostform_submitupdate', defaultMessage: 'Update' })
                  : intl.formatMessage({ id: 'transaction_lostform_submitcreate', defaultMessage: 'Create' })}
              </Button>
            </>
          }
          description={isEdit
            ? intl.formatMessage({ id: 'transaction_lostform_descriptionedit', defaultMessage: 'Update the loss transaction.' })
            : intl.formatMessage({ id: 'transaction_lostform_descriptioncreate', defaultMessage: 'Enter data to create a new loss transaction.' })}
          title={isEdit
            ? intl.formatMessage({ id: 'transaction_lostform_titleedit', defaultMessage: 'Edit Loss Transaction' })
            : intl.formatMessage({ id: 'transaction_lostform_titlecreate', defaultMessage: 'Create Loss Transaction' })}
        >
          <TransactionTextField
            error={errorMessage && !lossReason.trim() ? intl.formatMessage({ id: 'transaction.lost_form.error_loss_reason', defaultMessage: 'Loss reason is required.' }) : undefined}
            isDisabled={createMutation.isPending || updateMutation.isPending}
            isInvalid={Boolean(errorMessage) && !lossReason.trim()}
            isRequired
            label={intl.formatMessage({ id: 'transaction_lostform_labellossreason', defaultMessage: 'Loss Reason' })}
            name="lossReason"
            onChange={setAlasanKehilangan}
            value={lossReason}
          />
          <TransactionTextField
            error={isEstimatedValueInvalid ? intl.formatMessage({ id: 'transaction.lost_form.error_estimated_value', defaultMessage: 'Estimated value must be zero or greater.' }) : undefined}
            isDisabled={createMutation.isPending || updateMutation.isPending}
            isInvalid={isEstimatedValueInvalid}
            label={intl.formatMessage({ id: 'transaction_lostform_labelestimatedvalue', defaultMessage: 'Estimated Value' })}
            name="estimatedValue"
            onChange={setNilaiEstimasi}
            type="number"
            value={estimatedValue}
          />
          <TransactionTextField
            isDisabled={createMutation.isPending || updateMutation.isPending}
            label={intl.formatMessage({ id: 'transaction_lostform_labelreference', defaultMessage: 'Reference' })}
            name="reference"
            onChange={setReferensi}
            value={reference}
          />
          <TransactionTextField
            isDisabled={createMutation.isPending || updateMutation.isPending}
            label={intl.formatMessage({ id: 'transaction_lostform_labeldate', defaultMessage: 'Date' })}
            name="date"
            onChange={setTanggal}
            type="date"
            value={date}
          />
          <div className="md:col-span-2">
            <TransactionTextField
              isDisabled={createMutation.isPending || updateMutation.isPending}
              label={intl.formatMessage({ id: 'transaction_lostform_labeldescription', defaultMessage: 'Description' })}
              name="notes"
              onChange={setKeterangan}
              value={notes}
            />
          </div>
          <div className="md:col-span-2">
            <TransactionTextField
              error={errorMessage && parsedPalletIds.length === 0 ? intl.formatMessage({ id: 'transaction.lost_form.error_pallet_ids', defaultMessage: 'At least one pallet ID is required.' }) : undefined}
              isDisabled={createMutation.isPending || updateMutation.isPending}
              isInvalid={Boolean(errorMessage) && parsedPalletIds.length === 0}
              isRequired
              label={intl.formatMessage({ id: 'transaction_lostform_labelpalletids', defaultMessage: 'Pallet IDs' })}
              name="palletIds"
              onChange={setPaletIds}
              placeholder={intl.formatMessage({ id: 'transaction_lostform_placeholderpalletids', defaultMessage: 'ID1, ID2, ID3' })}
              value={palletIds}
            />
          </div>
          <TransactionStatusSelect
            isDisabled={createMutation.isPending || updateMutation.isPending}
            label={intl.formatMessage({ id: 'transaction_lostform_labelstatus', defaultMessage: 'Status' })}
            onChange={setApprovalStatus}
            value={approvalStatus}
          />
          {errorMessage ? <p className="md:col-span-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{errorMessage}</p> : null}
        </TransactionFormCard>
      </form>
    </section>
  );
}

export default LostTransactionFormPage;
