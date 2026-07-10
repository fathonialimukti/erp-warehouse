import { Button, Card, Chip, Label, ListBox, Select, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useQuery } from '@tanstack/react-query';
import { trpcClient } from '../../../lib/trpc';

interface AssignmentData {
  putawayStatus: string;
  allPallets: Array<{
    palletId: string;
    palletNumber: string | null;
    storageLocationId: string | null;
    palletTypeObjectId: string | null;
    skuName: string | null;
    palletTypeName: string | null;
  }>;
}
type AssignedPallet = AssignmentData['allPallets'][number];

export interface SelectedPalletInfo {
  palletId: string;
  inboundTransactionId: string;
}

interface PutawayPanelProps {
  warehouseId: string;
  selectedTransactionId: string | null;
  /** WarehouseTransactionType of the selected transaction (RECEIVING, WIP_COMPLETION, …). */
  transactionType: string | null;
  onTransactionChange: (transactionId: string | null) => void;
  selectedPalletId: string | null;
  onPalletSelect: (info: SelectedPalletInfo | null) => void;
  onClose: () => void;
  /** Open the AI chat panel with a putaway-focused preset message. */
  onAiAssist: () => void;
  /** Highlight a storage location in the 3D view (e.g. on hover). */
  onHighlightLocation: (storageLocationId: string | null) => void;
  /** Locally staged assignments: palletId → storageLocationId (not yet saved). */
  stagedAssignments: Map<string, string>;
  /** Un-stage a single pallet assignment (undo). */
  onUnstageAssignment: (palletId: string) => void;
  /** Commit all staged assignments to the server. */
  onSaveAssignments: () => void;
  isSaving: boolean;
  /** Error message from the last save attempt (null if no error). */
  saveError: string | null;
  /** Dismiss the save error. */
  onDismissSaveError: () => void;
}

type PutawayStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED';

interface InboundTransactionListItem {
  id: string;
  reference: string | null;
  putawayStatus: PutawayStatus;
  transactionType: string;
}

interface InboundTransactionListResponse {
  data: Array<InboundTransactionListItem>;
}

const PUTAWAY_STATUS_BADGE: Record<PutawayStatus, { label: string; color: 'default' | 'warning' | 'success' }> = {
  PENDING:   { label: 'Pending',   color: 'default' },
  PARTIAL:   { label: 'Partial',   color: 'warning' },
  COMPLETED: { label: 'Completed', color: 'success' },
};

export function PutawayPanel({
  warehouseId,
  selectedTransactionId,
  transactionType,
  onTransactionChange,
  selectedPalletId,
  onPalletSelect,
  onClose,
  onAiAssist,
  onHighlightLocation,
  stagedAssignments,
  onUnstageAssignment,
  onSaveAssignments,
  isSaving,
  saveError,
  onDismissSaveError,
}: PutawayPanelProps) {

  const { data: txnList, isLoading: txnLoading } = useQuery<InboundTransactionListResponse>({
    queryKey: ['transactionPutawayList', warehouseId, 'APPROVED'],
    queryFn: () =>
      trpcClient.transaction.putaway.list.query({
        warehouseId,
        approvalStatus: 'APPROVED',
        limit: 50,
      }) as unknown as Promise<InboundTransactionListResponse>,
  });

  // Only show transactions that still have pallets to assign
  const pendingTxns = (txnList?.data ?? []).filter((t) => t.putawayStatus !== 'COMPLETED');
  const allTransactionsDone = !txnLoading && Boolean(txnList) && txnList!.data.length > 0 && pendingTxns.length === 0;

  const { data: assignmentData, isLoading: assignmentLoading } = useQuery<AssignmentData>({
    queryKey: ['putawayAssignmentData', selectedTransactionId],
    queryFn: () =>
      trpcClient.transaction.putaway.getAssignmentData.query({
        transactionType: transactionType!,
        inboundTransactionId: selectedTransactionId!,
      }) as unknown as Promise<AssignmentData>,
    enabled: Boolean(selectedTransactionId) && Boolean(transactionType),
  });

  const allPallets = assignmentData?.allPallets ?? [];
  const unassignedPallets = allPallets.filter((p) => !p.storageLocationId);
  const assignedPallets = allPallets.filter((p) => p.storageLocationId);

  const handleTransactionChange = (key: string | null) => {
    onTransactionChange(key);
    onPalletSelect(null);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      onPointerDown={(e) => e.stopPropagation()}
      data-ai-context={JSON.stringify({
        section: 'putaway-panel',
        warehouseId,
        selectedTransactionId,
        selectedPalletId,
        unassignedPalletCount: unassignedPallets.length,
        putawayStatus: assignmentData?.putawayStatus ?? null,
      })}
    >
      <Card style={{ flex: 1,overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Card.Header>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon icon="solar:box-bold-duotone" style={{ width: 20, height: 20 }} />
              <Card.Title>Putaway Inbound Transaction</Card.Title>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {selectedTransactionId && (
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label="AI-assisted putaway"
                  onPress={onAiAssist}
                >
                  <Icon icon="solar:magic-stick-2-bold-duotone" style={{ width: 16, height: 16 }} />
                  AI Assist
                </Button>
              )}
              <Button isIconOnly size="sm" variant="ghost" aria-label="Close putaway panel" onPress={onClose}>
                <Icon icon="mdi:close" style={{ width: 16, height: 16 }} />
              </Button>
            </div>
          </div>
        </Card.Header>

        <Card.Content style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* All transactions completed — celebrate */}
          {allTransactionsDone ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ animation: 'putaway-bounce 1s ease-in-out 2' }}>
                <Icon
                  icon="fluent:box-multiple-checkmark-20-filled"
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minHeight: 0 }}>
              {assignmentLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Spinner size="sm" />
                  <span style={{ fontSize: 14 }}>Loading pallets…</span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>Pallets</div>
                      <div style={{ fontSize: 11, color: 'var(--heroui-foreground-60)' }}>
                        {assignmentData?.putawayStatus ?? 'PENDING'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Chip size="sm" color="success">{assignedPallets.length} assigned</Chip>
                      <Chip size="sm" color={unassignedPallets.length > 0 ? 'warning' : 'success'}>
                        {unassignedPallets.length} pending
                      </Chip>
                    </div>
                  </div>

                  {allPallets.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 0', textAlign: 'center' }}>
                      <Icon icon="solar:check-circle-bold-duotone" style={{ width: 32, height: 32, color: 'var(--heroui-success)' }} />
                      <span style={{ fontSize: 14, fontWeight: 500 }}>All pallets assigned!</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1, minHeight: 0 }}>
                      {allPallets.map((pallet) => {
                        const stagedLocation = stagedAssignments.get(pallet.palletId) ?? null;
                        const isSelected = selectedPalletId === pallet.palletId;
                        const isAssigned = Boolean(pallet.storageLocationId);
                        return (
                          <PalletCard
                            key={pallet.palletId}
                            pallet={pallet}
                            isSelected={isSelected}
                            stagedLocationId={stagedLocation}
                            isAssigned={isAssigned}
                            onSelect={() => {
                              if (isAssigned) return; // Already saved — no action
                              if (stagedLocation) {
                                // Clicking a staged card un-stages it (undo)
                                onUnstageAssignment(pallet.palletId);
                              } else if (isSelected) {
                                onPalletSelect(null);
                              } else {
                                onPalletSelect({ palletId: pallet.palletId, inboundTransactionId: selectedTransactionId });
                              }
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Instruction hint */}
          {selectedPalletId && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs font-semibold text-primary">Ready to place</p>
              <p className="text-xs text-foreground/70 mt-1">
                Click an empty location in the 3D view to stage the assignment.
              </p>
            </div>
          )}

          {/* Save error — shown when the last save attempt failed */}
          {saveError && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--heroui-danger-50)' }}>
              <Icon icon="solar:danger-triangle-bold-duotone" style={{ width: 16, height: 16, color: 'var(--heroui-danger)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--heroui-danger)' }}>Save failed</p>
                <p style={{ fontSize: 11, color: 'var(--heroui-foreground-60)', marginTop: 2, wordBreak: 'break-word' }}>
                  {saveError}
                </p>
                <Button size="sm" variant="ghost" onPress={onDismissSaveError} style={{ marginTop: 6, padding: '2px 8px' }}>
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {/* Save bar — sticky at the bottom when there are staged assignments */}
          {stagedAssignments.size > 0 && (
            <div style={{
              display: 'flex',
              gap: 8,
              padding: '10px 12px',
              borderTop: '1px solid var(--heroui-divider)',
              background: 'var(--heroui-content1)',
              position: 'sticky',
              bottom: 0,
            }}>
              <Button
                size="sm"
                variant="primary"
                onPress={onSaveAssignments}
                isDisabled={isSaving}
                style={{ flex: 1 }}
              >
                {isSaving ? (
                  <><Spinner size="sm" /> Saving…</>
                ) : (
                  <><Icon icon="solar:diskette-bold-duotone" style={{ width: 16, height: 16 }} /> Save ({stagedAssignments.size})</>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onPress={() => {
                  for (const palletId of stagedAssignments.keys()) onUnstageAssignment(palletId);
                }}
                isDisabled={isSaving}
              >
                Clear
              </Button>
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
  stagedLocationId: string | null;
  isAssigned: boolean;
  onSelect: () => void;
}

function PalletCard({ pallet, isSelected, stagedLocationId, isAssigned, onSelect }: PalletCardProps) {
  const isStaged = Boolean(stagedLocationId);
  const assignedLocation = pallet.storageLocationId;

  // Assigned (already saved) — green, shows location, not clickable
  if (isAssigned) {
    return (
      <div
        className="w-full rounded-lg border p-3 text-left border-success/40 bg-success/5"
        style={{ opacity: 0.85, cursor: 'default' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="font-mono text-xs text-foreground/60">{pallet.palletNumber ?? pallet.palletId}</p>
            <p className="text-sm font-medium text-foreground mt-0.5">{pallet.skuName}</p>
          </div>
          <Chip size="sm" variant="soft" color="success">Assigned</Chip>
        </div>
        {assignedLocation && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
            <Icon icon="solar:arrow-right-bold-duotone" style={{ width: 12, height: 12, color: 'var(--heroui-success)' }} />
            <span style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: 'var(--heroui-success)' }}>
              {assignedLocation}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Staged (locally, not yet saved) — green, shows staged location, clickable to undo
  // Pending (not selected, not staged) — default
  // Selected (waiting for location click) — primary highlight
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition-all ${
        isStaged
          ? 'border-success bg-success/10 ring-1 ring-success/40'
          : isSelected
            ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
            : 'border-divider bg-content1 hover:bg-content2'
      }`}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="font-mono text-xs text-foreground/60">{pallet.palletNumber ?? pallet.palletId}</p>
          <p className="text-sm font-medium text-foreground mt-0.5">{pallet.skuName}</p>
        </div>
        {isStaged ? (
          <Icon icon="solar:check-circle-bold-duotone" style={{ width: 18, height: 18, color: 'var(--heroui-success)', flexShrink: 0 }} />
        ) : (
          <Chip size="sm" variant="soft" color="warning">Pending</Chip>
        )}
      </div>
      {isStaged && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
          <Icon icon="solar:arrow-right-bold-duotone" style={{ width: 12, height: 12, color: 'var(--heroui-success)' }} />
          <span style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: 'var(--heroui-success)' }}>
            {stagedLocationId}
          </span>
          <span style={{ fontSize: 10, color: 'var(--heroui-foreground-60)' }}>(staged — click to undo)</span>
        </div>
      )}
    </button>
  );
}
