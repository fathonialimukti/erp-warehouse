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
  const [approvalStatus, setApprovalStatus] = useState<EditableApprovalStatus>('DRAFT');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    setPaletIds(detailQuery.data.items?.map((item) => item.palletId).join(', ') ?? '');
    setApprovalStatus(toEditableApprovalStatus(detailQuery.data.approvalStatus));
  }, [detailQuery.data]);

  const createMutation = useMutation<unknown, unknown, OutboundTransactionCreateInput>({
    mutationFn: (payload) => trpcClient.outboundTransaction.create.mutate(payload),
  });
  const updateMutation = useMutation<unknown, unknown, OutboundTransactionUpdateInput>({
    mutationFn: (payload) => trpcClient.outboundTransaction.update.mutate({ id: id!, ...payload }),
  });

  const parsedPalletIds = splitCommaSeparatedValues(palletIds);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!outgoingLocationId.trim()) {
      setErrorMessage(intl.formatMessage({ id: 'transaction.outgoing_form.error_location_id', defaultMessage: 'Outbound location ID is required.' }));
      return;
    }

    if (parsedPalletIds.length === 0) {
      setErrorMessage(intl.formatMessage({ id: 'transaction.outgoing_form.error_pallet_ids', defaultMessage: 'At least one pallet ID is required.' }));
      return;
    }

    const payload = {
      outgoingLocationId,
      date: date ? new Date(date) : new Date(),
      notes,
      approvalStatus,
      palletIds: parsedPalletIds,
    }

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
      <form className="space-y-6" onSubmit={handleSubmit}>
        <TransactionFormCard
          actions={
            <>
              <Button variant="secondary" type="button" onPress={() => navigate('/transactions/outbound')}>
                <Icon icon="solar:arrow-left-linear" className="size-4" />
                {intl.formatMessage({ id: 'transaction_outgoingform_back', defaultMessage: 'Back' })}
              </Button>
              <Button type="submit" variant="primary" isDisabled={createMutation.isPending || updateMutation.isPending || parsedPalletIds.length === 0}>
                {isEdit
                  ? intl.formatMessage({ id: 'transaction_outgoingform_submitupdate', defaultMessage: 'Update' })
                  : intl.formatMessage({ id: 'transaction_outgoingform_submitcreate', defaultMessage: 'Create' })}
              </Button>
            </>
          }
          description={isEdit
            ? intl.formatMessage({ id: 'transaction_outgoingform_descriptionedit', defaultMessage: 'Update the outbound transaction.' })
            : intl.formatMessage({ id: 'transaction_outgoingform_descriptioncreate', defaultMessage: 'Enter data to create a new outbound transaction.' })}
          title={isEdit
            ? intl.formatMessage({ id: 'transaction_outgoingform_titleedit', defaultMessage: 'Edit Outbound Transaction' })
            : intl.formatMessage({ id: 'transaction_outgoingform_titlecreate', defaultMessage: 'Create Outbound Transaction' })}
        >
          <TransactionTextField
            error={errorMessage && !outgoingLocationId.trim() ? intl.formatMessage({ id: 'transaction.outgoing_form.error_location_id', defaultMessage: 'Outbound location ID is required.' }) : undefined}
            isDisabled={createMutation.isPending || updateMutation.isPending}
            isInvalid={Boolean(errorMessage) && !outgoingLocationId.trim()}
            isRequired
            label={intl.formatMessage({ id: 'transaction_outgoingform_labellocationid', defaultMessage: 'Outbound Location ID' })}
            name="outgoingLocationId"
            onChange={setLokasiKeluarId}
            value={outgoingLocationId}
          />
          <TransactionTextField
            isDisabled={createMutation.isPending || updateMutation.isPending}
            label={intl.formatMessage({ id: 'transaction_outgoingform_labeldate', defaultMessage: 'Date' })}
            name="date"
            onChange={setTanggal}
            type="date"
            value={date}
          />
          <div className="md:col-span-2">
            <TransactionTextField
              isDisabled={createMutation.isPending || updateMutation.isPending}
              label={intl.formatMessage({ id: 'transaction_outgoingform_labeldescription', defaultMessage: 'Description' })}
              name="notes"
              onChange={setKeterangan}
              value={notes}
            />
          </div>
          <div className="md:col-span-2">
            <TransactionTextField
              error={errorMessage && parsedPalletIds.length === 0 ? intl.formatMessage({ id: 'transaction.outgoing_form.error_pallet_ids', defaultMessage: 'At least one pallet ID is required.' }) : undefined}
              isDisabled={createMutation.isPending || updateMutation.isPending}
              isInvalid={Boolean(errorMessage) && parsedPalletIds.length === 0}
              isRequired
              label={intl.formatMessage({ id: 'transaction_outgoingform_labelpalletids', defaultMessage: 'Pallet IDs' })}
              name="palletIds"
              onChange={setPaletIds}
              placeholder={intl.formatMessage({ id: 'transaction_outgoingform_placeholderpalletids', defaultMessage: 'ID1, ID2, ID3' })}
              value={palletIds}
            />
          </div>
          <TransactionStatusSelect
            isDisabled={createMutation.isPending || updateMutation.isPending}
            label={intl.formatMessage({ id: 'transaction_outgoingform_labelstatus', defaultMessage: 'Status' })}
            onChange={setApprovalStatus}
            value={approvalStatus}
          />
          {errorMessage ? <p className="md:col-span-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{errorMessage}</p> : null}
        </TransactionFormCard>
      </form>
    </section>
  );
}
