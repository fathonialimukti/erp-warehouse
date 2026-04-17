import { Button, Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';
import { ApprovalStatusChip, DetailField, DetailSectionCard, normalizeApprovalHistory } from '../shared';

type InboundTransactionUpdateInput = inferProcedureInput<AppRouter['inboundTransaction']['update']>;
type InboundTransactionApproveInput = inferProcedureInput<AppRouter['inboundTransaction']['approve']>;
type InboundTransactionRejectInput = inferProcedureInput<AppRouter['inboundTransaction']['reject']>;
interface InboundTransactionDetail {
  id: string;
  approvalStatus: string;
  date: string;
  notes: string | null;
  incomingLocationId: string | null;
  approvalHistory?: unknown;
  items?: Array<{ skuId: string; quantity: number; palletTypeId: string | null }>;
}

export default function InboundTransactionDetailPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const queryClient = useQueryClient();

  const proposeMutation = useMutation<unknown, unknown, InboundTransactionUpdateInput>({
    mutationFn: (payload) => trpcClient.inboundTransaction.update.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inboundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['inboundTransactionList'] });
    },
  });

  const approveMutation = useMutation<unknown, unknown, InboundTransactionApproveInput>({
    mutationFn: (payload) => trpcClient.inboundTransaction.approve.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inboundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['inboundTransactionList'] });
    },
  });

  const rejectMutation = useMutation<unknown, unknown, InboundTransactionRejectInput>({
    mutationFn: (payload) => trpcClient.inboundTransaction.reject.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inboundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['inboundTransactionList'] });
    },
  });

  const handlePropose = async () => {
    if (!data || !id) return;
    const approvalHistory = normalizeApprovalHistory(data.approvalHistory);

    await proposeMutation.mutateAsync({
      id: id!,
      approvalStatus: 'PENDING',
      incomingLocationId: data.incomingLocationId ?? undefined,
      date: data.date,
      notes: data.notes ?? '',
      items: data.items?.map((item) => ({
        skuId: item.skuId,
        quantity: item.quantity,
        palletTypeId: item.palletTypeId ?? '',
      })) ?? [],
      approvalHistory,
    });
  };

  const handleApprove = async () => {
    if (!id) return;
    await approveMutation.mutateAsync({ id: id! });
  };

  const handleReject = async () => {
    if (!id) return;
    await rejectMutation.mutateAsync({ id: id! });
  };

  const { data: queryData, isLoading } = useQuery({
    queryKey: ['inboundTransactionDetail', id],
    queryFn: () => trpcClient.inboundTransaction.detail.query({ id: id! }),
    enabled: Boolean(id),
  });

  const data = queryData as InboundTransactionDetail | undefined;
  const detail = data;

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Card.Title>{intl.formatMessage({ id: 'transaction_incomingdetail_title', defaultMessage: 'Inbound Transaction Detail' })}</Card.Title>
            <Card.Description>
              {intl.formatMessage(
                { id: 'transaction_incomingdetail_description', defaultMessage: 'Showing inbound transaction details for ID {id}.' },
                { id: id ?? '' },
              )}
            </Card.Description>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {detail?.approvalStatus === 'DRAFT' ? (
              <Button variant="primary" onPress={handlePropose} isDisabled={proposeMutation.isPending}>
                {intl.formatMessage({ id: 'transaction_incomingdetail_propose', defaultMessage: 'Propose' })}
              </Button>
            ) : null}
            {detail?.approvalStatus === 'PENDING' ? (
              <>
                <Button variant="primary" onPress={handleApprove} isDisabled={approveMutation.isPending}>
                  {intl.formatMessage({ id: 'transaction_incomingdetail_approve', defaultMessage: 'Approve' })}
                </Button>
                <Button variant="danger" onPress={handleReject} isDisabled={rejectMutation.isPending}>
                  {intl.formatMessage({ id: 'transaction_incomingdetail_reject', defaultMessage: 'Reject' })}
                </Button>
              </>
            ) : null}
            {detail ? <ApprovalStatusChip status={detail.approvalStatus} /> : null}
          </div>
          <Button variant="secondary" onPress={() => navigate('/transactions/inbound')}>
            <Icon icon="solar:arrow-left-linear" className="size-4" />
            {intl.formatMessage({ id: 'transaction_incomingdetail_back', defaultMessage: 'Back' })}
          </Button>
        </Card.Header>

        <Card.Content>
          {isLoading ? (
            <p className="text-sm text-muted">
              {intl.formatMessage({ id: 'transaction_incomingdetail_loading', defaultMessage: 'Loading transaction data...' })}
            </p>
          ) : !detail ? (
            <p className="text-sm text-danger">{intl.formatMessage({ id: 'transaction.incoming_detail.not_found', defaultMessage: 'Inbound transaction not found.' })}</p>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <DetailSectionCard
                description={intl.formatMessage({ id: 'transaction.incoming_detail.overview_description', defaultMessage: 'Core inbound transaction metadata, location, and workflow notes.' })}
                title={intl.formatMessage({ id: 'transaction.incoming_detail.overview_title', defaultMessage: 'Overview' })}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <DetailField label={intl.formatMessage({ id: 'transaction.incoming_detail.field_transaction_id', defaultMessage: 'Transaction ID' })} mono value={detail.id} />
                  <DetailField label={intl.formatMessage({ id: 'transaction.incoming_detail.field_status', defaultMessage: 'Status' })} value={<ApprovalStatusChip status={detail.approvalStatus} />} />
                  <DetailField label={intl.formatMessage({ id: 'transaction.incoming_detail.field_date', defaultMessage: 'Date' })} value={intl.formatDate(new Date(detail.date), { year: 'numeric', month: 'long', day: 'numeric' })} />
                  <DetailField label={intl.formatMessage({ id: 'transaction.incoming_detail.field_location', defaultMessage: 'Inbound Location' })} value={detail.incomingLocationId ?? '-'} />
                  <DetailField label={intl.formatMessage({ id: 'transaction.incoming_detail.field_notes', defaultMessage: 'Notes' })} value={detail.notes || '-'} />
                  <DetailField label={intl.formatMessage({ id: 'transaction.incoming_detail.field_item_count', defaultMessage: 'Item Count' })} value={String(detail.items?.length ?? 0)} />
                </div>
              </DetailSectionCard>

              <DetailSectionCard
                description={intl.formatMessage({ id: 'transaction.incoming_detail.items_description', defaultMessage: 'Inbound line items recorded for this transaction.' })}
                title={intl.formatMessage({ id: 'transaction.incoming_detail.items_title', defaultMessage: 'Items' })}
              >
                {detail.items?.length ? (
                  <div className="space-y-3">
                    {detail.items.map((item, index) => (
                      <div key={`${item.skuId}-${item.palletTypeId}-${index}`} className="rounded-2xl border border-border/70 bg-surface p-4">
                        <div className="grid gap-3 md:grid-cols-3">
                          <DetailField label={intl.formatMessage({ id: 'transaction.incoming_detail.item_sku_id', defaultMessage: 'SKU ID' })} mono value={item.skuId} />
                          <DetailField label={intl.formatMessage({ id: 'transaction.incoming_detail.item_pallet_type_id', defaultMessage: 'Pallet Type ID' })} mono value={item.palletTypeId} />
                          <DetailField label={intl.formatMessage({ id: 'transaction.incoming_detail.item_quantity', defaultMessage: 'Quantity' })} value={String(item.quantity)} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">{intl.formatMessage({ id: 'transaction.incoming_detail.items_empty', defaultMessage: 'No items recorded for this transaction.' })}</p>
                )}
              </DetailSectionCard>
            </div>
          )}
        </Card.Content>
      </Card>
    </section>
  );
}
