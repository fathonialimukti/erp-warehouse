import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useAtomValue } from 'jotai';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Modal, TextArea } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { hasPermissionAtom } from '../../lib/atoms';
import { trpcClient } from '../../lib/trpc';

interface PurchaseOrderDetail {
  id: string;
  documentNumber: string | null;
  status: string;
  notes: string | null;
  expectedDate: string | null;
  supplier: { id: string; code: string | null; name: string };
  warehouse: { id: string; code: string | null; name: string };
  approvalHistory: unknown;
  items: Array<{
    id: string;
    quantity: string | number;
    receivedQty: string | number;
    unitPrice: string | number | null;
    details: string | null;
    sku: { id: string; code: string | null; name: string };
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'text-default-500',
  PROPOSED: 'text-warning',
  APPROVED: 'text-primary',
  REJECTED: 'text-danger',
  RECEIVING: 'text-warning',
  CLOSED: 'text-success',
  CANCELLED: 'text-default-500',
};

export function PurchaseOrderDetailPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canUpdate = hasPermission('purchase_order@update');
  const canApprove = hasPermission('purchase_order@approve');
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<'approve' | 'reject' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: poData, isLoading } = useQuery({
    queryKey: ['purchaseOrderDetail', id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.purchaseOrder.detail.query({ id: id ?? '' }),
  });
  const po = poData as PurchaseOrderDetail | undefined;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['purchaseOrderDetail', id] });
    void queryClient.invalidateQueries({ queryKey: ['purchaseOrderList'] });
  };

  const approveMutation = useMutation({
    mutationFn: () => trpcClient.purchaseOrder.approve.mutate({ id: id!, message: message.trim() || undefined }),
    onSuccess: () => {
      invalidate();
      setModal(null);
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => trpcClient.purchaseOrder.reject.mutate({ id: id!, message: message.trim() || undefined }),
    onSuccess: () => {
      invalidate();
      setModal(null);
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to reject'),
  });

  const proposeMutation = useMutation({
    mutationFn: () =>
      trpcClient.purchaseOrder.update.mutate({
        id: po!.id,
        supplierId: po!.supplier.id,
        warehouseId: po!.warehouse.id,
        expectedDate: po!.expectedDate ? String(po!.expectedDate).slice(0, 10) : undefined,
        notes: po!.notes ?? undefined,
        approvalStatus: 'PROPOSED',
        items: po!.items.map((item) => ({
          skuId: item.sku.id,
          quantity: Number(item.quantity),
          unitPrice: item.unitPrice ? Number(item.unitPrice) : undefined,
          details: item.details ?? undefined,
        })),
      }),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to propose'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => trpcClient.purchaseOrder.cancel.mutate({ id: id! }),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to cancel'),
  });

  if (isLoading) {
    return <p className="text-sm text-muted">{intl.formatMessage({ id: 'common.loading', defaultMessage: 'Loading…' })}</p>;
  }
  if (!po) {
    return <p className="text-sm text-danger">{intl.formatMessage({ id: 'po.not_found', defaultMessage: 'Purchase order not found.' })}</p>;
  }

  const orderedTotal = po.items.reduce((sum, item) => sum + Number(item.quantity), 0);
  const receivedTotal = po.items.reduce((sum, item) => sum + Number(item.receivedQty), 0);
  const status = po.status as string;
  const history = po.approvalHistory as Array<{ process: string; userName: string; timeframe: string; message: string }> | null;

  return (
    <section className="space-y-4" data-ai-context={JSON.stringify({ section: 'purchase-order-detail', documentNumber: po.documentNumber })}>
      <PageHeader
        title={po.documentNumber ?? po.id}
        onBack={() => navigate('/purchase-order')}
        onEdit={status === 'DRAFT' || status === 'REJECTED' ? () => navigate(`/purchase-order/${po.id}/edit`) : undefined}
      >
        {status === 'PROPOSED' && canApprove ? (
          <>
            <Button variant="secondary" onPress={() => { setMessage(''); setModal('reject'); }}>
              <Icon icon="solar:close-circle-linear" className="text-danger" />
              {intl.formatMessage({ id: 'action_reject', defaultMessage: 'Reject' })}
            </Button>
            <Button variant="primary" onPress={() => { setMessage(''); setModal('approve'); }}>
              <Icon icon="solar:check-circle-linear" />
              {intl.formatMessage({ id: 'action_approve', defaultMessage: 'Approve' })}
            </Button>
          </>
        ) : null}
        {status === 'DRAFT' && canUpdate ? (
          <Button variant="secondary" isPending={proposeMutation.isPending} onPress={() => proposeMutation.mutate()}>
            <Icon icon="solar:paper-plane-linear" />
            {intl.formatMessage({ id: 'po.propose', defaultMessage: 'Propose' })}
          </Button>
        ) : null}
        {(status === 'DRAFT' || (status === 'APPROVED' && receivedTotal === 0) || status === 'REJECTED' || status === 'CANCELLED') && canUpdate ? (
          <Button variant="secondary" isPending={cancelMutation.isPending} onPress={() => cancelMutation.mutate()}>
            <Icon icon="solar:close-circle-linear" className="text-danger" />
            {intl.formatMessage({ id: 'po.cancel', defaultMessage: 'Cancel' })}
          </Button>
        ) : null}
      </PageHeader>

      {error ? (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-xl border px-3 py-1.5">
          <span className={`font-mono font-semibold ${STATUS_COLORS[status]}`}>{status}</span>
        </span>
        <span className="rounded-xl border px-3 py-1.5">{po.supplier.name}</span>
        <span className="rounded-xl border px-3 py-1.5">{po.warehouse.name}</span>
        {po.expectedDate ? (
          <span className="rounded-xl border px-3 py-1.5">
            {intl.formatMessage({ id: 'po.expected_badge', defaultMessage: 'Expected: {date}' }, { date: new Date(po.expectedDate).toLocaleDateString() })}
          </span>
        ) : null}
        <span className="rounded-xl border px-3 py-1.5 font-mono">
          {intl.formatMessage({ id: 'po.received_badge', defaultMessage: '{received} / {ordered} pallets' }, { received: receivedTotal, ordered: orderedTotal })}
        </span>
      </div>

      <Card>
        <Card.Header>
          <Card.Title>{intl.formatMessage({ id: 'po.items_section', defaultMessage: 'Items' })}</Card.Title>
        </Card.Header>
        <Card.Content>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted">
                  <th className="px-3 py-2">{intl.formatMessage({ id: 'po.field_sku', defaultMessage: 'SKU' })}</th>
                  <th className="px-3 py-2 text-right">{intl.formatMessage({ id: 'po.field_quantity', defaultMessage: 'Ordered' })}</th>
                  <th className="px-3 py-2 text-right">{intl.formatMessage({ id: 'po.column_received', defaultMessage: 'Received' })}</th>
                  <th className="px-3 py-2 text-right">{intl.formatMessage({ id: 'po.field_unit_price', defaultMessage: 'Unit price' })}</th>
                </tr>
              </thead>
              <tbody>
                {po.items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-3 py-2">
                      <p className="text-sm">{item.sku.name}</p>
                      <p className="font-mono text-xs text-muted">{item.sku.code ?? ''}</p>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{Number(item.quantity)}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(item.receivedQty)}</td>
                    <td className="px-3 py-2 text-right font-mono">{item.unitPrice ? Number(item.unitPrice) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card.Content>
      </Card>

      {history && history.length > 0 ? (
        <Card>
          <Card.Header>
            <Card.Title>{intl.formatMessage({ id: 'po.approval_history', defaultMessage: 'Approval history' })}</Card.Title>
          </Card.Header>
          <Card.Content>
            <ul className="space-y-2 text-sm">
              {history.map((entry, index) => (
                <li key={index} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold">{entry.process}</span>
                  <span>{entry.userName}</span>
                  <span className="text-xs text-muted">{new Date(entry.timeframe).toLocaleString()}</span>
                  {entry.message ? <span className="text-xs text-muted">— {entry.message}</span> : null}
                </li>
              ))}
            </ul>
          </Card.Content>
        </Card>
      ) : null}

      <Modal isOpen={modal !== null} onOpenChange={(open) => !open && setModal(null)}>
        <Modal.Backdrop>
          <Modal.Container size="md">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>
                  {modal === 'approve'
                    ? intl.formatMessage({ id: 'action_approve', defaultMessage: 'Approve' })
                    : intl.formatMessage({ id: 'action_reject', defaultMessage: 'Reject' })}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <TextArea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  aria-label={intl.formatMessage({ id: 'po.approval_note', defaultMessage: 'Note' })}
                  placeholder={intl.formatMessage({ id: 'po.approval_note', defaultMessage: 'Note (optional)' })}
                />
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onPress={() => setModal(null)}>
                  {intl.formatMessage({ id: 'action_cancel', defaultMessage: 'Cancel' })}
                </Button>
                <Button
                  variant="primary"
                  isPending={approveMutation.isPending || rejectMutation.isPending}
                  onPress={() => (modal === 'approve' ? approveMutation.mutate() : rejectMutation.mutate())}
                >
                  {modal === 'approve'
                    ? intl.formatMessage({ id: 'action_approve', defaultMessage: 'Approve' })
                    : intl.formatMessage({ id: 'action_reject', defaultMessage: 'Reject' })}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}
