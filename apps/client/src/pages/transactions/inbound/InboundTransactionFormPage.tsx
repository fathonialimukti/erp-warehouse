import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';
import { type EditableApprovalStatus, toEditableApprovalStatus, TransactionFormCard, TransactionStatusSelect, TransactionTextField } from '../shared';

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
  const [approvalStatus, setApprovalStatus] = useState<EditableApprovalStatus>('DRAFT');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    setApprovalStatus(toEditableApprovalStatus(detailQuery.data.approvalStatus));
  }, [detailQuery.data]);

  const hasRequiredFieldError = Boolean(errorMessage) && (!skuId.trim() || !palletTypeId.trim());
  const isQuantityInvalid = Boolean(quantity.trim()) && (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0);

  const createMutation = useMutation<unknown, unknown, InboundTransactionCreateInput>({
    mutationFn: (payload) => trpcClient.inboundTransaction.create.mutate(payload),
  });
  const updateMutation = useMutation<unknown, unknown, InboundTransactionUpdateInput>({
    mutationFn: (payload) => trpcClient.inboundTransaction.update.mutate({ id: id!, ...payload }),
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!skuId.trim() || !palletTypeId.trim()) {
      setErrorMessage(intl.formatMessage({ id: 'transaction.incoming_form.error_required', defaultMessage: 'SKU ID and pallet type ID are required.' }));
      return;
    }

    if (isQuantityInvalid) {
      setErrorMessage(intl.formatMessage({ id: 'transaction.incoming_form.error_quantity', defaultMessage: 'Quantity must be greater than zero.' }));
      return;
    }

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
    }

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
      <form className="space-y-6" onSubmit={handleSubmit}>
        <TransactionFormCard
          actions={
            <>
              <Button variant="secondary" type="button" onPress={() => navigate('/transactions/inbound')}>
                <Icon icon="solar:arrow-left-linear" className="size-4" />
                {intl.formatMessage({ id: 'transaction_incomingform_back', defaultMessage: 'Back' })}
              </Button>
              <Button type="submit" variant="primary" isDisabled={createMutation.isPending || updateMutation.isPending || isQuantityInvalid}>
                {isEdit
                  ? intl.formatMessage({ id: 'transaction_incomingform_submitupdate', defaultMessage: 'Update' })
                  : intl.formatMessage({ id: 'transaction_incomingform_submitcreate', defaultMessage: 'Create' })}
              </Button>
            </>
          }
          description={isEdit
            ? intl.formatMessage({ id: 'transaction_incomingform_descriptionedit', defaultMessage: 'Update the incoming transaction.' })
            : intl.formatMessage({ id: 'transaction_incomingform_descriptioncreate', defaultMessage: 'Enter information to create a new incoming transaction.' })}
          title={isEdit
            ? intl.formatMessage({ id: 'transaction_incomingform_titleedit', defaultMessage: 'Edit Incoming Transaction' })
            : intl.formatMessage({ id: 'transaction_incomingform_titlecreate', defaultMessage: 'Create Incoming Transaction' })}
        >
          <div className="md:col-span-2">
            <TransactionTextField
              isDisabled={createMutation.isPending || updateMutation.isPending}
              label={intl.formatMessage({ id: 'transaction_incomingform_labeldescription', defaultMessage: 'Description' })}
              name="notes"
              onChange={setKeterangan}
              value={notes}
            />
          </div>
          <TransactionTextField
            isDisabled={createMutation.isPending || updateMutation.isPending}
            label={intl.formatMessage({ id: 'transaction_incomingform_labeldate', defaultMessage: 'Date' })}
            name="date"
            onChange={setTanggal}
            type="date"
            value={date}
          />
          <TransactionTextField
            error={hasRequiredFieldError && !skuId.trim() ? intl.formatMessage({ id: 'transaction.incoming_form.error_sku_id', defaultMessage: 'SKU ID is required.' }) : undefined}
            isDisabled={createMutation.isPending || updateMutation.isPending}
            isInvalid={hasRequiredFieldError && !skuId.trim()}
            isRequired
            label={intl.formatMessage({ id: 'transaction_incomingform_labelskuid', defaultMessage: 'SKU ID' })}
            name="skuId"
            onChange={setSkuId}
            placeholder={intl.formatMessage({ id: 'transaction_incomingform_placeholderskuid', defaultMessage: 'Enter SKU ID' })}
            value={skuId}
          />
          <TransactionTextField
            error={hasRequiredFieldError && !palletTypeId.trim() ? intl.formatMessage({ id: 'transaction.incoming_form.error_pallet_type_id', defaultMessage: 'Pallet type ID is required.' }) : undefined}
            isDisabled={createMutation.isPending || updateMutation.isPending}
            isInvalid={hasRequiredFieldError && !palletTypeId.trim()}
            isRequired
            label={intl.formatMessage({ id: 'transaction_incomingform_labelpallettypeid', defaultMessage: 'Pallet Type ID' })}
            name="palletTypeId"
            onChange={setJenisPaletId}
            placeholder={intl.formatMessage({ id: 'transaction_incomingform_placeholderpallettypeid', defaultMessage: 'Enter pallet type ID' })}
            value={palletTypeId}
          />
          <TransactionTextField
            error={isQuantityInvalid ? intl.formatMessage({ id: 'transaction.incoming_form.error_quantity', defaultMessage: 'Quantity must be greater than zero.' }) : undefined}
            isDisabled={createMutation.isPending || updateMutation.isPending}
            isInvalid={isQuantityInvalid}
            isRequired
            label={intl.formatMessage({ id: 'transaction_incomingform_labelquantity', defaultMessage: 'Quantity' })}
            name="quantity"
            onChange={setJumlah}
            type="number"
            value={quantity}
          />
          <TransactionStatusSelect
            isDisabled={createMutation.isPending || updateMutation.isPending}
            label={intl.formatMessage({ id: 'transaction_incomingform_labelstatus', defaultMessage: 'Status' })}
            onChange={setApprovalStatus}
            value={approvalStatus}
          />
          {errorMessage ? <p className="md:col-span-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{errorMessage}</p> : null}
        </TransactionFormCard>
      </form>
    </section>
  );
}
