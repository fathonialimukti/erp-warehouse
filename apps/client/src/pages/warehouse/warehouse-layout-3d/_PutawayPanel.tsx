import { Button, Card, Chip, Label, ListBox, Select, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useQuery } from '@tanstack/react-query';
import type { inferProcedureOutput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';

type AssignmentData = inferProcedureOutput<AppRouter['inboundTransaction']['getAssignmentData']>;
type AssignedPallet = AssignmentData['allPallets'][number];

export interface SelectedPalletInfo {
  palletId: string;
  inboundTransactionId: string;
}

interface PutawayPanelProps {
  warehouseId: string;
  selectedTransactionId: string | null;
  onTransactionChange: (transactionId: string | null) => void;
  selectedPalletId: string | null;
  onPalletSelect: (info: SelectedPalletInfo | null) => void;
  onClose: () => void;
}

type PutawayStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED';

interface InboundTransactionListItem {
  id: string;
  reference: string | null;
  putawayStatus: PutawayStatus;
}

interface InboundTransactionListResponse {
  data: Array<InboundTransactionListItem>;
}

const PUTAWAY_STATUS_BADGE: Record<PutawayStatus, { label: string; color: 'default' | 'warning' | 'success' }> = {
  PENDING:   { label: 'Pending',   color: 'default' },
  PARTIAL:   { label: 'Partial',   color: 'warning' },
  COMPLETED: { label: 'Completed', color: 'success' },
};

export function PutawayPanel({ warehouseId, selectedTransactionId, onTransactionChange, selectedPalletId, onPalletSelect, onClose }: PutawayPanelProps) {

  const { data: txnList, isLoading: txnLoading } = useQuery<InboundTransactionListResponse>({
    queryKey: ['inboundTransactionList', warehouseId, 'APPROVED'],
    queryFn: () =>
      trpcClient.inboundTransaction.list.query({
        warehouseId,
        approvalStatus: 'APPROVED',
        limit: 50,
      }),
  });

  // Only show transactions that still have pallets to assign
  const pendingTxns = (txnList?.data ?? []).filter((t) => t.putawayStatus !== 'COMPLETED');
  const allTransactionsDone = !txnLoading && Boolean(txnList) && txnList!.data.length > 0 && pendingTxns.length === 0;

  const { data: assignmentData, isLoading: assignmentLoading } = useQuery({
    queryKey: ['putawayAssignmentData', selectedTransactionId],
    queryFn: () =>
      trpcClient.inboundTransaction.getAssignmentData.query({
        inboundTransactionId: selectedTransactionId!,
      }),
    enabled: Boolean(selectedTransactionId),
  });

  const unassignedPallets = assignmentData?.allPallets.filter((p) => !p.storageLocationId) ?? [];

  const handleTransactionChange = (key: string | null) => {
    onTransactionChange(key);
    onPalletSelect(null);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Card style={{ flex: 1,overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Card.Header>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon icon="solar:box-bold-duotone" style={{ width: 20, height: 20 }} />
              <Card.Title>Putaway Inbound Transaction</Card.Title>
            </div>
            <Button isIconOnly size="sm" variant="ghost" aria-label="Close putaway panel" onPress={onClose}>
              <Icon icon="mdi:close" style={{ width: 16, height: 16 }} />
            </Button>
          </div>
        </Card.Header>

        <Card.Content style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* All transactions completed — celebrate */}
          {allTransactionsDone ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ animation: 'putaway-bounce 1s ease-in-out 2' }}>
                <Icon
                  icon="solar:medal-ribbons-star-bold-duotone"
                  style={{ width: 56, height: 56, color: 'var(--heroui-success)' }}
                />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--heroui-success)' }}>Putaway Complete</p>
                <p style={{ fontSize: 12, color: 'var(--heroui-foreground-60)', marginTop: 4 }}>
                  All approved transactions have been fully assigned.
                </p>
              </div>
              <Button size="sm" variant="ghost" onPress={onClose}>
                Close Session
              </Button>
            </div>
          ) : (
          <>
          {/* Transaction selector */}
          <Select
            value={selectedTransactionId ?? ''}
            onChange={(key) => handleTransactionChange(String(key) || null)}
            isDisabled={txnLoading}
            placeholder="Select approved transaction"
            variant="secondary"
          >
            <Label>Inbound Transaction</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {pendingTxns.map((txn) => (
                  <ListBox.Item key={txn.id} id={txn.id}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8 }}>
                      <span style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {txn.reference ?? txn.id}
                      </span>
                      <Chip size="sm" color={PUTAWAY_STATUS_BADGE[txn.putawayStatus].color}>
                        {PUTAWAY_STATUS_BADGE[txn.putawayStatus].label}
                      </Chip>
                    </div>
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          {/* Pallet list */}
          {selectedTransactionId && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {assignmentLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Spinner size="sm" />
                  <span style={{ fontSize: 14 }}>Loading pallets…</span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>Unassigned Pallets</div>
                      <div style={{ fontSize: 11, color: 'var(--heroui-foreground-60)' }}>
                        {assignmentData?.putawayStatus ?? 'PENDING'}
                      </div>
                    </div>
                    <Chip size="sm" color={unassignedPallets.length > 0 ? 'warning' : 'success'}>
                      {unassignedPallets.length} remaining
                    </Chip>
                  </div>

                  {unassignedPallets.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 0', textAlign: 'center' }}>
                      <Icon icon="solar:check-circle-bold-duotone" style={{ width: 32, height: 32, color: 'var(--heroui-success)' }} />
                      <span style={{ fontSize: 14, fontWeight: 500 }}>All pallets assigned!</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {unassignedPallets.map((pallet) => (
                        <PalletCard
                          key={pallet.palletId}
                          pallet={pallet}
                          isSelected={selectedPalletId === pallet.palletId}
                          onSelect={() => {
                            if (selectedPalletId === pallet.palletId) {
                              onPalletSelect(null);
                            } else {
                              onPalletSelect({ palletId: pallet.palletId, inboundTransactionId: selectedTransactionId });
                            }
                          }}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Instruction hint */}
          {selectedPalletId && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs font-semibold text-primary">Ready to assign</p>
              <p className="text-xs text-foreground/70 mt-1">
                Click a highlighted empty location in the 3D view.
              </p>
            </div>
          )}
          </>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}

interface PalletCardProps {
  pallet: AssignedPallet;
  isSelected: boolean;
  onSelect: () => void;
}

function PalletCard({ pallet, isSelected, onSelect }: PalletCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition-all ${
        isSelected
          ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
          : 'border-divider bg-content1 hover:bg-content2'
      }`}
    >
      <p className="font-mono text-xs text-foreground/60">{pallet.palletId}</p>
      <p className="text-sm font-medium text-foreground mt-0.5">{pallet.skuName}</p>
      <p className="text-xs text-foreground/60">{pallet.palletTypeName}</p>
    </button>
  );
}
