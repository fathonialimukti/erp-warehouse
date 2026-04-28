import { useMemo } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Chip, EmptyState, Table } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';
import { PageHeader } from '../../../components/PageHeader';
import { ApprovalStatusChip, normalizeApprovalHistory } from '../shared';

interface LossTransactionPivot {
  palletId: string;
  pallet?: {
    status: string;
    palletType?: {
      name: string;
      sku?: {
        name: string;
      };
    };
  };
}

interface LossTransactionDetail {
  approvalHistory?: unknown;
  approvalStatus: string;
  date: string;
  estimatedValue: number | string | null;
  id: string;
  lossReason: string | null;
  notes: string | null;
  palletPivots?: LossTransactionPivot[];
  reference: string | null;
}

type LostTransactionUpdateInput = inferProcedureInput<AppRouter['lossTransaction']['update']>;
type LostTransactionApproveInput = inferProcedureInput<AppRouter['lossTransaction']['approve']>;
type LostTransactionRejectInput = inferProcedureInput<AppRouter['lossTransaction']['reject']>;

function LostTransactionDetailPage() {
  const navigate = useNavigate();
  const intl = useIntl();
  const { id } = useParams<{ id?: string }>();
  const queryClient = useQueryClient();

  const proposeMutation = useMutation<unknown, unknown, LostTransactionUpdateInput>({
    mutationFn: (payload) => trpcClient.lossTransaction.update.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lossTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['lossTransactionList'] });
    },
  });

  const approveMutation = useMutation<unknown, unknown, LostTransactionApproveInput>({
    mutationFn: (payload) => trpcClient.lossTransaction.approve.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lossTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['lossTransactionList'] });
    },
  });

  const rejectMutation = useMutation<unknown, unknown, LostTransactionRejectInput>({
    mutationFn: (payload) => trpcClient.lossTransaction.reject.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lossTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['lossTransactionList'] });
    },
  });

  const { data: queryData, isLoading } = useQuery({
    queryKey: ['lossTransactionDetail', id],
    queryFn: () => trpcClient.lossTransaction.detail.query({ id: id! }),
    enabled: Boolean(id),
  });

  const detail = queryData as LossTransactionDetail | undefined;

  const financialSummary = useMemo(() => {
    const totalPallets = detail?.palletPivots?.length ?? 0;
    const uniquePallets = new Set(detail?.palletPivots?.map((pivot) => pivot.palletId) ?? []).size;
    const lostPallets = detail?.palletPivots?.filter((pivot) => pivot.pallet?.status === 'LOST').length ?? 0;
    const estimatedValue = detail?.estimatedValue != null ? Number(detail.estimatedValue) : 0;

    return {
      estimatedValue,
      lostPallets,
      totalPallets,
      uniquePallets,
    };
  }, [detail?.estimatedValue, detail?.palletPivots]);

  const formattedDate = detail
    ? intl.formatDate(new Date(detail.date), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    : '-';

  const formattedEstimatedValue = detail?.estimatedValue != null
    ? `Rp ${Number(detail.estimatedValue).toLocaleString('id-ID')}`
    : '-';

  const handlePropose = async () => {
    if (!detail || !id) return;
    const approvalHistory = normalizeApprovalHistory(detail.approvalHistory);

    await proposeMutation.mutateAsync({
      id,
      approvalStatus: 'PROPOSED',
      date: detail.date,
      lossReason: detail.lossReason ?? '',
      estimatedValue: detail.estimatedValue != null ? Number(detail.estimatedValue) : undefined,
      reference: detail.reference ?? '',
      notes: detail.notes ?? '',
      palletIds: detail.palletPivots?.map((pivot) => pivot.palletId) ?? [],
      approvalHistory,
    });
  };

  const handleApprove = async () => {
    if (!id) return;
    await approveMutation.mutateAsync({ id });
  };

  const handleReject = async () => {
    if (!id) return;
    await rejectMutation.mutateAsync({ id });
  };

  return (
    <section className="space-y-6">
      <PageHeader
        title={intl.formatMessage({ id: 'transaction_lostdetail_title', defaultMessage: 'Loss Transaction Details' })}
        onBack={() => navigate('/transactions')}
      />

      {isLoading ? (
        <p className="text-sm text-muted">{intl.formatMessage({ id: 'transaction_lostdetail_loading', defaultMessage: 'Loading data...' })}</p>
      ) : !detail ? (
        <div className="space-y-3">
          <p className="text-sm text-danger">{intl.formatMessage({ id: 'transaction.lost_detail.not_found', defaultMessage: 'Loss transaction not found.' })}</p>
          <Button variant="ghost" onPress={() => navigate('/transactions')}>
            {intl.formatMessage({ id: 'transaction_lostdetail_back', defaultMessage: 'Back' })}
          </Button>
        </div>
      ) : (
        <>
          <Card>
            <Card.Header>
              <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
                <div className="flex h-56 w-full items-center justify-center rounded-[1.25rem] border border-border/50 bg-danger/10">
                  <Icon icon="solar:danger-triangle-linear" className="size-16 text-danger" />
                </div>

                <div className="flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                      {intl.formatMessage({ id: 'transaction.lost_detail.field_transaction_id', defaultMessage: 'Transaction ID' })}
                    </p>
                    <p className="font-mono text-sm text-foreground">{detail.id}</p>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                      {intl.formatMessage({ id: 'transaction.lost_detail.hero_title', defaultMessage: 'Loss Transaction' })}
                    </h1>
                    <div className="flex flex-wrap gap-2">
                      <ApprovalStatusChip status={detail.approvalStatus} />
                      <Chip variant="soft" color="danger" size="sm">
                        {intl.formatMessage(
                          { id: 'transaction.lost_detail.chip_total_pallets', defaultMessage: '{count} pallets reported' },
                          { count: financialSummary.totalPallets },
                        )}
                      </Chip>
                      <Chip variant="soft" color="warning" size="sm">
                        {intl.formatMessage(
                          { id: 'transaction.lost_detail.chip_estimated_value', defaultMessage: '{value} estimated' },
                          { value: formattedEstimatedValue },
                        )}
                      </Chip>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        {intl.formatMessage({ id: 'transaction.lost_detail.field_date', defaultMessage: 'Date' })}
                      </p>
                      <p className="text-sm text-foreground">{formattedDate}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        {intl.formatMessage({ id: 'transaction.lost_detail.field_reason', defaultMessage: 'Loss Reason' })}
                      </p>
                      <p className="text-sm text-foreground">{detail.lossReason ?? '-'}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        {intl.formatMessage({ id: 'transaction.lost_detail.field_reference', defaultMessage: 'Reference' })}
                      </p>
                      <p className="font-mono text-sm text-foreground">{detail.reference ?? '-'}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        {intl.formatMessage({ id: 'transaction.lost_detail.field_estimated_value', defaultMessage: 'Estimated Value' })}
                      </p>
                      <p className="text-sm text-foreground">{formattedEstimatedValue}</p>
                    </div>
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        {intl.formatMessage({ id: 'transaction.lost_detail.field_notes', defaultMessage: 'Notes' })}
                      </p>
                      <p className="text-sm text-foreground">{detail.notes || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card.Header>
          </Card>

         

          <Card>
            <Card.Header>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Card.Title className="text-base">
                    {intl.formatMessage({ id: 'transaction.lost_detail.pallets_title', defaultMessage: 'Pallets' })}
                  </Card.Title>
                  <Card.Description>
                    {intl.formatMessage({ id: 'transaction.lost_detail.pallets_description', defaultMessage: 'Pallets included in this loss report.' })}
                  </Card.Description>
                </div>
                <div className="flex flex-wrap gap-2">
                  {detail.approvalStatus === 'DRAFT' ? (
                    <Button variant="primary" onPress={handlePropose} isDisabled={proposeMutation.isPending}>
                      {intl.formatMessage({ id: 'transaction_lostdetail_propose', defaultMessage: 'Propose' })}
                    </Button>
                  ) : null}
                  {detail.approvalStatus === 'PROPOSED' ? (
                    <>
                      <Button variant="primary" onPress={handleApprove} isDisabled={approveMutation.isPending}>
                        {intl.formatMessage({ id: 'transaction_lostdetail_approve', defaultMessage: 'Approve' })}
                      </Button>
                      <Button variant="danger" onPress={handleReject} isDisabled={rejectMutation.isPending}>
                        {intl.formatMessage({ id: 'transaction_lostdetail_reject', defaultMessage: 'Reject' })}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </Card.Header>

            <Card.Content>
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label={intl.formatMessage({ id: 'transaction.lost_detail.pallets_table_aria', defaultMessage: 'Loss transaction pallets table' })} onRowAction={(key) => navigate(`/transactions/loss/${String(key)}`)}>
                    <Table.Header>
                      <Table.Column isRowHeader>
                        <span className="font-semibold">
                          {intl.formatMessage({ id: 'transaction.lost_detail.item_pallet_id', defaultMessage: 'Pallet ID' })}
                        </span>
                      </Table.Column>
                      <Table.Column>
                        <span className="font-semibold">
                          {intl.formatMessage({ id: 'transaction.lost_detail.item_pallet_status', defaultMessage: 'Pallet Status' })}
                        </span>
                      </Table.Column>
                      <Table.Column>
                        <span className="font-semibold">
                          {intl.formatMessage({ id: 'transaction.lost_detail.item_pallet_type', defaultMessage: 'Pallet Type' })}
                        </span>
                      </Table.Column>
                      <Table.Column>
                        <span className="font-semibold">
                          {intl.formatMessage({ id: 'transaction.lost_detail.item_sku_name', defaultMessage: 'SKU' })}
                        </span>
                      </Table.Column>
                    </Table.Header>
                    <Table.Body
                      renderEmptyState={() => (
                        <EmptyState className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
                          <Icon icon="solar:box-linear" className="size-6 text-muted" />
                          <span className="text-sm text-muted">
                            {intl.formatMessage({ id: 'transaction.lost_detail.pallets_empty', defaultMessage: 'No pallets recorded for this transaction.' })}
                          </span>
                        </EmptyState>
                      )}
                    >
                      {detail.palletPivots?.map((pivot, index) => (
                        <Table.Row key={`${pivot.palletId}-${index}`} id={`${pivot.palletId}-${index}`}>
                          <Table.Cell>
                            <span className="font-mono text-sm text-foreground">{pivot.palletId}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-sm text-foreground">{pivot.pallet?.status ?? '-'}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-sm text-foreground">{pivot.pallet?.palletType?.name ?? '-'}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-sm text-foreground">{pivot.pallet?.palletType?.sku?.name ?? '-'}</span>
                          </Table.Cell>
                        </Table.Row>
                      )) ?? []}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
                <Table.Footer>
                  <div className="flex items-center justify-between text-sm text-muted">
                    <span>
                      {intl.formatMessage(
                        { id: 'transaction.lost_detail.pallets_summary', defaultMessage: '{total} pallets listed, {lost} marked LOST' },
                        { total: financialSummary.totalPallets, lost: financialSummary.lostPallets },
                      )}
                    </span>
                  </div>
                </Table.Footer>
              </Table>
            </Card.Content>
          </Card>
        </>
      )}
    </section>
  );
};

export { LostTransactionDetailPage };
