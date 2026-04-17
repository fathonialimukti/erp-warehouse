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

type FoundTransactionUpdateInput = inferProcedureInput<AppRouter['foundTransaction']['update']>;
type FoundTransactionApproveInput = inferProcedureInput<AppRouter['foundTransaction']['approve']>;
type FoundTransactionRejectInput = inferProcedureInput<AppRouter['foundTransaction']['reject']>;

interface FoundTransactionDetailItem {
  skuId: string;
  palletTypeId: string | null;
  quantity: number;
  sku?: {
    name: string;
  };
  palletType?: {
    name: string;
  };
  pallets?: Array<{ id: string }>;
}

interface FoundTransactionDetail {
  id: string;
  approvalStatus: string;
  date: string;
  notes: string | null;
  findingType: string | null;
  reference: string | null;
  approvalHistory?: unknown;
  items?: FoundTransactionDetailItem[];
}


const FoundTransactionDetailPage = () => {
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

  const { data: queryData, isLoading } = useQuery({
    queryKey: ['foundTransactionDetail', id],
    queryFn: () => trpcClient.foundTransaction.detail.query({ id: id! }),
    enabled: Boolean(id),
  });

  const detail = queryData as FoundTransactionDetail | undefined;

  const foundSummary = useMemo(() => {
    const totalLines = detail?.items?.length ?? 0;
    const totalQuantity = detail?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
    const generatedPallets = detail?.items?.reduce((sum, item) => sum + (item.pallets?.length ?? 0), 0) ?? 0;
    const uniqueSkuCount = new Set(
      detail?.items
        ?.map((item) => item.sku?.name ?? item.skuId)
        .filter((value): value is string => Boolean(value)) ?? [],
    ).size;

    return {
      generatedPallets,
      totalLines,
      totalQuantity,
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
    if (!detail || !id) return;
    const approvalHistory = normalizeApprovalHistory(detail.approvalHistory);

    await proposeMutation.mutateAsync({
      id,
      approvalStatus: 'PENDING',
      date: detail.date,
      findingType: detail.findingType ?? '',
      reference: detail.reference ?? '',
      notes: detail.notes ?? '',
      items: detail.items?.map((item) => ({
        skuId: item.skuId,
        palletTypeId: item.palletTypeId ?? '',
        quantity: item.quantity,
      })) ?? [],
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
        title={intl.formatMessage({ id: 'transaction_founddetail_title', defaultMessage: 'Found Transaction Details' })}
        onBack={() => navigate('/transactions')}
      />

      {isLoading ? (
        <p className="text-sm text-muted">{intl.formatMessage({ id: 'transaction_founddetail_loading', defaultMessage: 'Loading data...' })}</p>
      ) : !detail ? (
        <div className="space-y-3">
          <p className="text-sm text-danger">{intl.formatMessage({ id: 'transaction.found_detail.not_found', defaultMessage: 'Found transaction not found.' })}</p>
          <Button variant="ghost" onPress={() => navigate('/transactions')}>
            {intl.formatMessage({ id: 'transaction_founddetail_back', defaultMessage: 'Back' })}
          </Button>
        </div>
      ) : (
        <>
          <Card>
            <Card.Header>
              <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
                <div className="flex h-56 w-full items-center justify-center rounded-[1.25rem] border border-border/50 bg-success/10">
                  <Icon icon="solar:box-minimalistic-linear" className="size-16 text-success" />
                </div>

                <div className="flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                      {intl.formatMessage({ id: 'transaction.found_detail.field_transaction_id', defaultMessage: 'Transaction ID' })}
                    </p>
                    <p className="font-mono text-sm text-foreground">{detail.id}</p>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                      {intl.formatMessage({ id: 'transaction.found_detail.hero_title', defaultMessage: 'Found Transaction' })}
                    </h1>
                    <div className="flex flex-wrap gap-2">
                      <ApprovalStatusChip status={detail.approvalStatus} />
                      <Chip variant="soft" color="success" size="sm">
                        {intl.formatMessage(
                          { id: 'transaction.found_detail.chip_total_quantity', defaultMessage: '{quantity} units recovered' },
                          { quantity: foundSummary.totalQuantity },
                        )}
                      </Chip>
                      <Chip variant="soft" color="accent" size="sm">
                        {intl.formatMessage(
                          { id: 'transaction.found_detail.chip_generated_pallets', defaultMessage: '{count} pallets generated' },
                          { count: foundSummary.generatedPallets },
                        )}
                      </Chip>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        {intl.formatMessage({ id: 'transaction.found_detail.field_date', defaultMessage: 'Date' })}
                      </p>
                      <p className="text-sm text-foreground">{formattedDate}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        {intl.formatMessage({ id: 'transaction.found_detail.field_found_type', defaultMessage: 'Found Type' })}
                      </p>
                      <p className="text-sm text-foreground">{detail.findingType ?? '-'}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        {intl.formatMessage({ id: 'transaction.found_detail.field_reference', defaultMessage: 'Reference' })}
                      </p>
                      <p className="font-mono text-sm text-foreground">{detail.reference ?? '-'}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        {intl.formatMessage({ id: 'transaction.found_detail.field_notes', defaultMessage: 'Notes' })}
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
                    {intl.formatMessage({ id: 'transaction.found_detail.items_title', defaultMessage: 'Recovered Items' })}
                  </Card.Title>
                  <Card.Description>
                    {intl.formatMessage({ id: 'transaction.found_detail.items_description', defaultMessage: 'Recovered items associated with this found transaction.' })}
                  </Card.Description>
                </div>
                <div className="flex flex-wrap gap-2">
                  {detail.approvalStatus === 'DRAFT' ? (
                    <Button variant="primary" onPress={handlePropose} isDisabled={proposeMutation.isPending}>
                      {intl.formatMessage({ id: 'transaction_founddetail_propose', defaultMessage: 'Propose' })}
                    </Button>
                  ) : null}
                  {detail.approvalStatus === 'PENDING' ? (
                    <>
                      <Button variant="primary" onPress={handleApprove} isDisabled={approveMutation.isPending}>
                        {intl.formatMessage({ id: 'transaction_founddetail_approve', defaultMessage: 'Approve' })}
                      </Button>
                      <Button variant="danger" onPress={handleReject} isDisabled={rejectMutation.isPending}>
                        {intl.formatMessage({ id: 'transaction_founddetail_reject', defaultMessage: 'Reject' })}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </Card.Header>

            <Card.Content>
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label={intl.formatMessage({ id: 'transaction.found_detail.items_table_aria', defaultMessage: 'Found transaction items table' })} onRowAction={(key) => navigate(`/transactions/found/${String(key)}`)}>
                    <Table.Header>
                      <Table.Column isRowHeader>
                        <span className="font-semibold">
                          {intl.formatMessage({ id: 'transaction.found_detail.item_sku_name', defaultMessage: 'SKU' })}
                        </span>
                      </Table.Column>
                      <Table.Column>
                        <span className="font-semibold">
                          {intl.formatMessage({ id: 'transaction.found_detail.item_pallet_type_name', defaultMessage: 'Pallet Type' })}
                        </span>
                      </Table.Column>
                      <Table.Column>
                        <span className="font-semibold">
                          {intl.formatMessage({ id: 'transaction.found_detail.item_quantity', defaultMessage: 'Quantity' })}
                        </span>
                      </Table.Column>
                      <Table.Column>
                        <span className="font-semibold">
                          {intl.formatMessage({ id: 'transaction.found_detail.item_generated_pallets', defaultMessage: 'Generated Pallets' })}
                        </span>
                      </Table.Column>
                    </Table.Header>
                    <Table.Body
                      renderEmptyState={() => (
                        <EmptyState className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
                          <Icon icon="solar:box-linear" className="size-6 text-muted" />
                          <span className="text-sm text-muted">
                            {intl.formatMessage({ id: 'transaction.found_detail.items_empty', defaultMessage: 'No recovered items recorded for this transaction.' })}
                          </span>
                        </EmptyState>
                      )}
                    >
                      {detail.items?.map((item, index) => (
                        <Table.Row key={`${item.skuId}-${item.palletTypeId ?? 'none'}-${index}`} id={`${item.skuId}-${index}`}>
                          <Table.Cell>
                            <span className="text-sm text-foreground">{item.sku?.name ?? item.skuId}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-sm text-foreground">{item.palletType?.name ?? item.palletTypeId ?? '-'}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-sm text-foreground">{item.quantity}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-sm text-foreground">{item.pallets?.length ?? 0}</span>
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
                        { id: 'transaction.found_detail.items_summary', defaultMessage: '{lines} lines, {quantity} total quantity, {pallets} generated pallets' },
                        {
                          lines: foundSummary.totalLines,
                          quantity: foundSummary.totalQuantity,
                          pallets: foundSummary.generatedPallets,
                        },
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

export default FoundTransactionDetailPage;
