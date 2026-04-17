import { useMemo } from 'react';
import { Button, Card, Chip, EmptyState, Table } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';
import { PageHeader } from '../../../components/PageHeader';
import { ApprovalStatusChip, normalizeApprovalHistory } from '../shared';

type InboundTransactionUpdateInput = inferProcedureInput<AppRouter['inboundTransaction']['update']>;
type InboundTransactionApproveInput = inferProcedureInput<AppRouter['inboundTransaction']['approve']>;
type InboundTransactionRejectInput = inferProcedureInput<AppRouter['inboundTransaction']['reject']>;
interface InboundTransactionDetail {
  id: string;
  approvalStatus: string;
  date: string;
  notes: string | null;
  approvalHistory?: unknown;
  items?: Array<{
    skuId: string;
    quantity: number;
    palletTypeId: string | null;
    sku?: {
      name: string;
    };
    palletType?: {
      name: string;
    };
    pallets?: Array<{ id: string }>;
  }>;
}

const InboundTransactionDetailPage = () => {
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

  const itemSummary = useMemo(() => {
    const totalLines = detail?.items?.length ?? 0;
    const totalQuantity = detail?.items?.reduce((accumulator, item) => accumulator + item.quantity, 0) ?? 0;
    const uniqueSkuCount = new Set(
      detail?.items
        ?.map((item) => item.sku?.name ?? item.skuId)
        .filter((value): value is string => Boolean(value)) ?? [],
    ).size;
    const mappedPalletTypeCount = detail?.items?.filter((item) => Boolean(item.palletTypeId)).length ?? 0;
    const PalletCount = detail?.items?.reduce((sum, item) => sum + (item.pallets?.length ?? 0), 0) ?? 0;

    return {
      PalletCount,
      mappedPalletTypeCount,
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

  return (
    <section className="space-y-6">
      <PageHeader
        title={intl.formatMessage({ id: 'transaction_incomingdetail_title', defaultMessage: 'Inbound Transaction Detail' })}
        onBack={() => navigate('/transactions')}
      />

      {isLoading ? (
        <p className="text-sm text-muted">
          {intl.formatMessage({ id: 'transaction_incomingdetail_loading', defaultMessage: 'Loading transaction data...' })}
        </p>
      ) : !detail ? (
        <div className="space-y-3">
          <p className="text-sm text-danger">{intl.formatMessage({ id: 'transaction.incoming_detail.not_found', defaultMessage: 'Inbound transaction not found.' })}</p>
          <Button variant="ghost" onPress={() => navigate('/transactions/inbound')}>
            {intl.formatMessage({ id: 'transaction_incomingdetail_back', defaultMessage: 'Back' })}
          </Button>
        </div>
      ) : (
        <>
          <Card>
            <Card.Header>
                <div className="flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                      {intl.formatMessage({ id: 'transaction.incoming_detail.field_transaction_id', defaultMessage: 'Transaction ID' })}
                    </p>
                    <p className=" text-xl font-semibold">{detail.id}</p>
                    <div className="flex flex-wrap gap-2">
                      <ApprovalStatusChip status={detail.approvalStatus} />
                      <Chip variant="soft" color="accent" size="sm">
                        {intl.formatMessage(
                          { id: 'transaction.incoming_detail.chip_line_items', defaultMessage: '{count} line items' },
                          { count: itemSummary.totalLines },
                        )}
                      </Chip>
                      <Chip variant="soft" color="success" size="sm">
                        {intl.formatMessage(
                          { id: 'transaction.incoming_detail.chip_total_quantity', defaultMessage: '{quantity} total qty' },
                          { quantity: itemSummary.totalQuantity },
                        )}
                      </Chip>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        {intl.formatMessage({ id: 'transaction.incoming_detail.field_date', defaultMessage: 'Date' })}
                      </p>
                      <p className="text-sm text-foreground">{formattedDate}</p>
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        {intl.formatMessage({ id: 'transaction.incoming_detail.field_notes', defaultMessage: 'Notes' })}
                      </p>
                      <p className="text-sm text-foreground">{detail.notes || '-'}</p>
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
                    {intl.formatMessage({ id: 'transaction.incoming_detail.items_title', defaultMessage: 'Items' })}
                  </Card.Title>
                  <Card.Description>
                    {intl.formatMessage({ id: 'transaction.incoming_detail.items_description', defaultMessage: 'Inbound line items recorded for this transaction.' })}
                  </Card.Description>
                </div>
                <div className="flex flex-wrap gap-2">
                  {detail.approvalStatus === 'DRAFT' ? (
                    <Button variant="primary" onPress={handlePropose} isDisabled={proposeMutation.isPending}>
                      {intl.formatMessage({ id: 'transaction_incomingdetail_propose', defaultMessage: 'Propose' })}
                    </Button>
                  ) : null}
                  {detail.approvalStatus === 'PENDING' ? (
                    <>
                      <Button variant="primary" onPress={handleApprove} isDisabled={approveMutation.isPending}>
                        {intl.formatMessage({ id: 'transaction_incomingdetail_approve', defaultMessage: 'Approve' })}
                      </Button>
                      <Button variant="danger" onPress={handleReject} isDisabled={rejectMutation.isPending}>
                        {intl.formatMessage({ id: 'transaction_incomingdetail_reject', defaultMessage: 'Reject' })}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </Card.Header>

            <Card.Content>
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label={intl.formatMessage({ id: 'transaction.incoming_detail.items_table_aria', defaultMessage: 'Inbound transaction items table' })} onRowAction={(key) => navigate(`/transactions/inbound/${String(key)}`)}>
                    <Table.Header>
                      <Table.Column isRowHeader>
                        <span className="font-semibold">
                          {intl.formatMessage({ id: 'transaction.incoming_detail.item_sku_name', defaultMessage: 'SKU' })}
                        </span>
                      </Table.Column>
                      <Table.Column>
                        <span className="font-semibold">
                          {intl.formatMessage({ id: 'transaction.incoming_detail.item_pallet_type_name', defaultMessage: 'Pallet Type' })}
                        </span>
                      </Table.Column>
                      <Table.Column>
                        <span className="font-semibold">
                          {intl.formatMessage({ id: 'transaction.incoming_detail.item_quantity', defaultMessage: 'Quantity' })}
                        </span>
                      </Table.Column>
                      <Table.Column>
                        <span className="font-semibold">
                          {intl.formatMessage({ id: 'transaction.incoming_detail.item_pallets', defaultMessage: 'Pallets' })}
                        </span>
                      </Table.Column>
                    </Table.Header>
                    <Table.Body
                      renderEmptyState={() => (
                        <EmptyState className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
                          <Icon icon="solar:box-linear" className="size-6 text-muted" />
                          <span className="text-sm text-muted">
                            {intl.formatMessage({ id: 'transaction.incoming_detail.items_empty', defaultMessage: 'No items recorded for this transaction.' })}
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
                        { id: 'transaction.incoming_detail.items_summary', defaultMessage: '{lines} lines, {quantity} total quantity, {pallets}  pallets' },
                        { lines: itemSummary.totalLines, quantity: itemSummary.totalQuantity, pallets: itemSummary.PalletCount },
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

export default InboundTransactionDetailPage;
