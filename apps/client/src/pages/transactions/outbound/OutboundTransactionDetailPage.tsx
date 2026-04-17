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

type OutboundTransactionUpdateInput = inferProcedureInput<AppRouter['outboundTransaction']['update']>;
type OutboundTransactionApproveInput = inferProcedureInput<AppRouter['outboundTransaction']['approve']>;
type OutboundTransactionRejectInput = inferProcedureInput<AppRouter['outboundTransaction']['reject']>;

interface OutboundTransactionDetailItem {
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

interface OutboundTransactionDetail {
  id: string;
  approvalStatus: string;
  date: string;
  notes: string | null;
  outgoingLocationId: string;
  approvalHistory?: unknown;
  items?: OutboundTransactionDetailItem[];
}


const OutboundTransactionDetailPage = () => {
  const navigate = useNavigate();
  const intl = useIntl();
  const { id } = useParams<{ id?: string }>();
  const queryClient = useQueryClient();

  const proposeMutation = useMutation<unknown, unknown, OutboundTransactionUpdateInput>({
    mutationFn: (payload) => trpcClient.outboundTransaction.update.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionList'] });
    },
  });

  const approveMutation = useMutation<unknown, unknown, OutboundTransactionApproveInput>({
    mutationFn: (payload) => trpcClient.outboundTransaction.approve.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionList'] });
    },
  });

  const rejectMutation = useMutation<unknown, unknown, OutboundTransactionRejectInput>({
    mutationFn: (payload) => trpcClient.outboundTransaction.reject.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionList'] });
    },
  });

  const { data: queryData, isLoading } = useQuery({
    queryKey: ['outboundTransactionDetail', id],
    queryFn: () => trpcClient.outboundTransaction.detail.query({ id: id! }),
    enabled: Boolean(id),
  });

  const data = queryData as OutboundTransactionDetail | undefined;
  const detail = data;

  const palletSummary = useMemo(() => {
    const totalLines = detail?.items?.length ?? 0;
    const uniquePalletCount = new Set(detail?.items?.map((item) => item.palletId) ?? []).size;
    const dispatchedCount = detail?.items?.filter((item) => item.pallet?.status === 'DISPATCHED').length ?? 0;
    const uniqueSkuCount = new Set(
      detail?.items
        ?.map((item) => item.pallet?.palletType?.sku?.name)
        .filter((name): name is string => Boolean(name)) ?? [],
    ).size;

    return {
      dispatchedCount,
      totalLines,
      uniquePalletCount,
      uniqueSkuCount,
    };
  }, [detail?.items]);

  const formattedDate = detail
    ? intl.formatDate(new Date(detail.date), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    : '-';

  const handlePropose = async () => {
    if (!data || !id) return;
    const approvalHistory = normalizeApprovalHistory(data.approvalHistory);

    await proposeMutation.mutateAsync({
      id,
      approvalStatus: 'PENDING',
      outgoingLocationId: data.outgoingLocationId,
      date: data.date,
      notes: data.notes ?? '',
      palletIds: data.items?.map((item) => item.palletId) ?? [],
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
        title={intl.formatMessage({ id: 'transaction_outgoingdetail_title', defaultMessage: 'Outbound Transaction Details' })}
        onBack={() => navigate('/transactions')}
      />

      {isLoading ? (
        <p className="text-sm text-muted">{intl.formatMessage({ id: 'transaction_outgoingdetail_loading', defaultMessage: 'Loading data...' })}</p>
      ) : !detail ? (
        <div className="space-y-3">
          <p className="text-sm text-danger">{intl.formatMessage({ id: 'transaction.outgoing_detail.not_found', defaultMessage: 'Outbound transaction not found.' })}</p>
          <Button variant="ghost" onPress={() => navigate('/transactions')}>
            {intl.formatMessage({ id: 'transaction_outgoingdetail_back', defaultMessage: 'Back' })}
          </Button>
        </div>
      ) : (
        <>
          <Card>
            <Card.Header>
              <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
                <div className="flex h-56 w-full items-center justify-center rounded-[1.25rem] border border-border/50 bg-warning/10">
                  <Icon icon="solar:delivery-linear" className="size-16 text-warning" />
                </div>

                <div className="flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                      {intl.formatMessage({ id: 'transaction.outgoing_detail.field_transaction_id', defaultMessage: 'Transaction ID' })}
                    </p>
                    <p className="font-mono text-sm text-foreground">{detail.id}</p>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                      {intl.formatMessage({ id: 'transaction.outgoing_detail.hero_title', defaultMessage: 'Outbound Transaction' })}
                    </h1>
                    <div className="flex flex-wrap gap-2">
                      <ApprovalStatusChip status={detail.approvalStatus} />
                      <Chip variant="soft" color="accent" size="sm">
                        {intl.formatMessage(
                          { id: 'transaction.outgoing_detail.chip_line_items', defaultMessage: '{count} pallets' },
                          { count: palletSummary.totalLines },
                        )}
                      </Chip>
                      <Chip variant="soft" color="warning" size="sm">
                        {intl.formatMessage(
                          { id: 'transaction.outgoing_detail.chip_dispatched', defaultMessage: '{count} dispatched' },
                          { count: palletSummary.dispatchedCount },
                        )}
                      </Chip>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        {intl.formatMessage({ id: 'transaction.outgoing_detail.field_date', defaultMessage: 'Date' })}
                      </p>
                      <p className="text-sm text-foreground">{formattedDate}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        {intl.formatMessage({ id: 'transaction.outgoing_detail.field_location', defaultMessage: 'Outbound Location' })}
                      </p>
                      <p className="font-mono text-sm text-foreground">{detail.outgoingLocationId}</p>
                    </div>
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        {intl.formatMessage({ id: 'transaction.outgoing_detail.field_notes', defaultMessage: 'Notes' })}
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
                    {intl.formatMessage({ id: 'transaction.outgoing_detail.items_title', defaultMessage: 'Pallets' })}
                  </Card.Title>
                  <Card.Description>
                    {intl.formatMessage({ id: 'transaction.outgoing_detail.items_description', defaultMessage: 'Pallets scheduled for outbound movement in this transaction.' })}
                  </Card.Description>
                </div>
                <div className="flex flex-wrap gap-2">
                  {detail.approvalStatus === 'DRAFT' ? (
                    <Button variant="primary" onPress={handlePropose} isDisabled={proposeMutation.isPending}>
                      {intl.formatMessage({ id: 'transaction_outgoingdetail_propose', defaultMessage: 'Propose' })}
                    </Button>
                  ) : null}
                  {detail.approvalStatus === 'PENDING' ? (
                    <>
                      <Button variant="primary" onPress={handleApprove} isDisabled={approveMutation.isPending}>
                        {intl.formatMessage({ id: 'transaction_outgoingdetail_approve', defaultMessage: 'Approve' })}
                      </Button>
                      <Button variant="danger" onPress={handleReject} isDisabled={rejectMutation.isPending}>
                        {intl.formatMessage({ id: 'transaction_outgoingdetail_reject', defaultMessage: 'Reject' })}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </Card.Header>

            <Card.Content>
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label={intl.formatMessage({ id: 'transaction.outgoing_detail.items_table_aria', defaultMessage: 'Outbound transaction pallets table' })}>
                    <Table.Header>
                      <Table.Column isRowHeader>
                        <span className="font-semibold">
                          {intl.formatMessage({ id: 'transaction.outgoing_detail.item_pallet_id', defaultMessage: 'Pallet ID' })}
                        </span>
                      </Table.Column>
                      <Table.Column>
                        <span className="font-semibold">
                          {intl.formatMessage({ id: 'transaction.outgoing_detail.item_status', defaultMessage: 'Pallet Status' })}
                        </span>
                      </Table.Column>
                      <Table.Column>
                        <span className="font-semibold">
                          {intl.formatMessage({ id: 'transaction.outgoing_detail.item_pallet_type', defaultMessage: 'Pallet Type' })}
                        </span>
                      </Table.Column>
                      <Table.Column>
                        <span className="font-semibold">
                          {intl.formatMessage({ id: 'transaction.outgoing_detail.item_sku_name', defaultMessage: 'SKU' })}
                        </span>
                      </Table.Column>
                    </Table.Header>
                    <Table.Body
                      renderEmptyState={() => (
                        <EmptyState className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
                          <Icon icon="solar:box-linear" className="size-6 text-muted" />
                          <span className="text-sm text-muted">
                            {intl.formatMessage({ id: 'transaction.outgoing_detail.items_empty', defaultMessage: 'No pallets recorded for this transaction.' })}
                          </span>
                        </EmptyState>
                      )}
                    >
                      {detail.items?.map((item, index) => (
                        <Table.Row key={`${item.palletId}-${index}`} id={`${item.palletId}-${index}`}>
                          <Table.Cell>
                            <span className="font-mono text-sm text-foreground">{item.palletId}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-sm text-foreground">{item.pallet?.status ?? '-'}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-sm text-foreground">{item.pallet?.palletType?.name ?? '-'}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-sm text-foreground">{item.pallet?.palletType?.sku?.name ?? '-'}</span>
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
                        { id: 'transaction.outgoing_detail.items_summary', defaultMessage: '{lines} pallets listed, {dispatched} dispatched' },
                        { lines: palletSummary.totalLines, dispatched: palletSummary.dispatchedCount },
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

export default OutboundTransactionDetailPage;
