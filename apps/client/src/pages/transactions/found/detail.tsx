import { useIntl } from 'react-intl';
import { Button, Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';
import { ApprovalStatusChip, DetailField, DetailSectionCard, normalizeApprovalHistory } from '../shared';

type FoundTransactionUpdateInput = inferProcedureInput<AppRouter['foundTransaction']['update']>;
type FoundTransactionApproveInput = inferProcedureInput<AppRouter['foundTransaction']['approve']>;
type FoundTransactionRejectInput = inferProcedureInput<AppRouter['foundTransaction']['reject']>;
interface FoundTransactionDetail {
  id: string;
  approvalStatus: string;
  date: string;
  notes: string | null;
  findingType: string | null;
  reference: string | null;
  approvalHistory?: unknown;
  items?: Array<{ skuId: string; palletTypeId: string | null; quantity: number }>;
}

export default function FoundTransactionDetailPage() {
  const navigate = useNavigate();
  const intl = useIntl();
  const { id } = useParams<{ id?: string }>();
  const queryClient = useQueryClient();

  const proposeMutation = useMutation<unknown, unknown, FoundTransactionUpdateInput>({
    mutationFn: (payload) => trpcClient.foundTransaction.update.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['foundTransactionList'] });
    },
  });

  const approveMutation = useMutation<unknown, unknown, FoundTransactionApproveInput>({
    mutationFn: (payload) => trpcClient.foundTransaction.approve.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['foundTransactionList'] });
    },
  });

  const rejectMutation = useMutation<unknown, unknown, FoundTransactionRejectInput>({
    mutationFn: (payload) => trpcClient.foundTransaction.reject.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['foundTransactionList'] });
    },
  });

  const handlePropose = async () => {
    if (!data || !id) return;
    const approvalHistory = normalizeApprovalHistory(data.approvalHistory);

    await proposeMutation.mutateAsync({
      id: id!,
      approvalStatus: 'PENDING',
      date: data.date,
      findingType: data.findingType ?? '',
      reference: data.reference ?? '',
      notes: data.notes ?? '',
      items: data.items?.map((item) => ({
        skuId: item.skuId,
        palletTypeId: item.palletTypeId ?? '',
        quantity: item.quantity,
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
    queryKey: ['foundTransactionDetail', id],
    queryFn: () => trpcClient.foundTransaction.detail.query({ id: id! }),
    enabled: Boolean(id),
  });

  const data = queryData as FoundTransactionDetail | undefined;
  const detail = data;

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Card.Title>{intl.formatMessage({ id: 'transaction.foundDetail.title', defaultMessage: 'Found Transaction Details' })}</Card.Title>
            <Card.Description>{intl.formatMessage({ id: 'transaction.foundDetail.description', defaultMessage: 'Showing found transaction details for ID {id}.' }, { id })}</Card.Description>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {detail?.approvalStatus === 'DRAFT' ? (
              <Button variant="primary" onPress={handlePropose} isDisabled={proposeMutation.isPending}>
                {intl.formatMessage({ id: 'transaction.foundDetail.propose', defaultMessage: 'Propose' })}
              </Button>
            ) : null}
            {detail?.approvalStatus === 'PENDING' ? (
              <>
                <Button variant="primary" onPress={handleApprove} isDisabled={approveMutation.isPending}>
                  {intl.formatMessage({ id: 'transaction.foundDetail.approve', defaultMessage: 'Approve' })}
                </Button>
                <Button variant="danger" onPress={handleReject} isDisabled={rejectMutation.isPending}>
                  {intl.formatMessage({ id: 'transaction.foundDetail.reject', defaultMessage: 'Reject' })}
                </Button>
              </>
            ) : null}
            {detail ? <ApprovalStatusChip status={detail.approvalStatus} /> : null}
          </div>
          <Button variant="secondary" onPress={() => navigate('/transactions/found')}>
            <Icon icon="solar:arrow-left-linear" className="size-4" />
            {intl.formatMessage({ id: 'transaction.foundDetail.back', defaultMessage: 'Back' })}
          </Button>
        </Card.Header>

        <Card.Content>
          {isLoading ? (
            <p className="text-sm text-muted">{intl.formatMessage({ id: 'transaction.foundDetail.loading', defaultMessage: 'Loading data...' })}</p>
          ) : !detail ? (
            <p className="text-sm text-danger">{intl.formatMessage({ id: 'transaction.foundDetail.notFound', defaultMessage: 'Found transaction not found.' })}</p>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <DetailSectionCard
                description={intl.formatMessage({ id: 'transaction.foundDetail.overviewDescription', defaultMessage: 'Core found transaction metadata and recovery context.' })}
                title={intl.formatMessage({ id: 'transaction.foundDetail.overviewTitle', defaultMessage: 'Overview' })}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <DetailField label={intl.formatMessage({ id: 'transaction.foundDetail.fieldTransactionId', defaultMessage: 'Transaction ID' })} mono value={detail.id} />
                  <DetailField label={intl.formatMessage({ id: 'transaction.foundDetail.fieldStatus', defaultMessage: 'Status' })} value={<ApprovalStatusChip status={detail.approvalStatus} />} />
                  <DetailField label={intl.formatMessage({ id: 'transaction.foundDetail.fieldDate', defaultMessage: 'Date' })} value={intl.formatDate(new Date(detail.date), { year: 'numeric', month: 'long', day: 'numeric' })} />
                  <DetailField label={intl.formatMessage({ id: 'transaction.foundDetail.fieldFoundType', defaultMessage: 'Found Type' })} value={detail.findingType ?? '-'} />
                  <DetailField label={intl.formatMessage({ id: 'transaction.foundDetail.fieldReference', defaultMessage: 'Reference' })} value={detail.reference ?? '-'} />
                  <DetailField label={intl.formatMessage({ id: 'transaction.foundDetail.fieldNotes', defaultMessage: 'Notes' })} value={detail.notes || '-'} />
                </div>
              </DetailSectionCard>

              <DetailSectionCard
                description={intl.formatMessage({ id: 'transaction.foundDetail.itemsDescription', defaultMessage: 'Recovered items associated with this found transaction.' })}
                title={intl.formatMessage({ id: 'transaction.foundDetail.itemsTitle', defaultMessage: 'Recovered Items' })}
              >
                {detail.items?.length ? (
                  <div className="space-y-3">
                    {detail.items.map((item, index) => (
                      <div key={`${item.skuId}-${item.palletTypeId}-${index}`} className="rounded-2xl border border-border/70 bg-surface p-4">
                        <div className="grid gap-3 md:grid-cols-3">
                          <DetailField label={intl.formatMessage({ id: 'transaction.foundDetail.itemSkuId', defaultMessage: 'SKU ID' })} mono value={item.skuId} />
                          <DetailField label={intl.formatMessage({ id: 'transaction.foundDetail.itemPalletTypeId', defaultMessage: 'Pallet Type ID' })} mono value={item.palletTypeId} />
                          <DetailField label={intl.formatMessage({ id: 'transaction.foundDetail.itemQuantity', defaultMessage: 'Quantity' })} value={String(item.quantity)} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">{intl.formatMessage({ id: 'transaction.foundDetail.itemsEmpty', defaultMessage: 'No recovered items recorded for this transaction.' })}</p>
                )}
              </DetailSectionCard>
            </div>
          )}
        </Card.Content>
      </Card>
    </section>
  );
}
