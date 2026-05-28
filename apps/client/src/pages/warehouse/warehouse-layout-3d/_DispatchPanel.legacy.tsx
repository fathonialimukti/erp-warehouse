// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Chip, Label, ListBox, Select, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferProcedureOutput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';

type DispatchData = inferProcedureOutput<AppRouter['outboundTransaction']['getDispatchAssignmentData']>;
type DispatchItem = DispatchData['items'][number];
type DispatchPallet = DispatchData['availablePallets'][number];

// Map<outboundTransactionItemId, Set<palletId>>
type SelectionMap = Map<string, Set<string>>;

type DispatchStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED';

interface OutboundTransactionListItem {
  id: string;
  reference: string | null;
  dispatchStatus: DispatchStatus;
}

interface OutboundTransactionListResponse {
  data: Array<OutboundTransactionListItem>;
}

const DISPATCH_STATUS_BADGE: Record<DispatchStatus, { label: string; color: 'default' | 'warning' | 'success' }> = {
  PENDING:   { label: 'Pending',   color: 'default' },
  PARTIAL:   { label: 'Partial',   color: 'warning' },
  COMPLETED: { label: 'Completed', color: 'success' },
};

export interface DispatchPanelProps {
  selectedTransactionId: string | null;
  onTransactionChange: (id: string | null) => void;
  onClose: () => void;
}

export function DispatchPanel({ selectedTransactionId, onTransactionChange, onClose }: DispatchPanelProps) {
  const queryClient = useQueryClient();
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [selections, setSelections] = useState<SelectionMap>(() => new Map());
  const [isConfirming, setIsConfirming] = useState(false);
  const [stage, setStage] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // ── Transaction list ──────────────────────────────────────────────────────
  const { data: txnList, isLoading: txnLoading } = useQuery<OutboundTransactionListResponse>({
    queryKey: ['outboundTransactionList', 'APPROVED', 'dispatch-panel'],
    queryFn: () =>
      trpcClient.outboundTransaction.list.query({
        approvalStatus: 'APPROVED',
        dispatchStatus: 'PENDING',
        limit: 50,
      }),
  });

  const pendingTxns = (txnList?.data ?? []).filter((t) => t.dispatchStatus !== 'COMPLETED');
  const allDone = !txnLoading && Boolean(txnList) && pendingTxns.length === 0;

  // ── Assignment data ───────────────────────────────────────────────────────
  const { data: assignmentData, isLoading: assignmentLoading } = useQuery({
    queryKey: ['dispatchAssignmentData', selectedTransactionId],
    queryFn: () =>
      trpcClient.outboundTransaction.getDispatchAssignmentData.query({
        outboundTransactionId: selectedTransactionId!,
      }),
    enabled: Boolean(selectedTransactionId),
    staleTime: 0,
  });

  // Pre-populate from already-assigned pallets
  useEffect(() => {
    if (!assignmentData) return;
    const initial: SelectionMap = new Map();
    for (const p of assignmentData.assignedPallets) {
      const set = initial.get(p.outboundTransactionItemId) ?? new Set<string>();
      set.add(p.palletId);
      initial.set(p.outboundTransactionItemId, set);
    }
    setSelections(initial);
    setIsConfirming(false);
    setStage('idle');
  }, [assignmentData]);

  // Available pallets indexed by itemId
  const availableByItem = useMemo<Map<string, DispatchPallet[]>>(() => {
    if (!assignmentData) return new Map();
    const map = new Map<string, DispatchPallet[]>();
    for (const p of assignmentData.availablePallets) {
      const arr = map.get(p.outboundTransactionItemId) ?? [];
      arr.push(p);
      map.set(p.outboundTransactionItemId, arr);
    }
    return map;
  }, [assignmentData]);

  const togglePallet = (itemId: string, palletId: string) => {
    setSelections((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(itemId) ?? []);
      if (set.has(palletId)) { set.delete(palletId); } else { set.add(palletId); }
      next.set(itemId, set);
      return next;
    });
  };

  const handleAutoFill = () => {
    if (!assignmentData) return;
    const next: SelectionMap = new Map();
    for (const item of assignmentData.items) {
      const available = availableByItem.get(item.outboundTransactionItemId) ?? [];
      next.set(item.outboundTransactionItemId, new Set(available.slice(0, item.quantity).map((p) => p.palletId)));
    }
    setSelections(next);
  };

  const handleReset = () => setSelections(new Map());

  const totalSelected = useMemo(
    () => Array.from(selections.values()).reduce((sum, s) => sum + s.size, 0),
    [selections],
  );

  const totalNeeded = useMemo(
    () => (assignmentData?.items ?? []).reduce((sum, i) => sum + i.quantity, 0),
    [assignmentData],
  );

  const isComplete = totalSelected === totalNeeded && totalNeeded > 0;

  const flatAssignments = useMemo(() => {
    const result: { outboundTransactionItemId: string; palletId: string }[] = [];
    for (const [itemId, palletSet] of selections.entries()) {
      for (const palletId of palletSet) result.push({ outboundTransactionItemId: itemId, palletId });
    }
    return result;
  }, [selections]);

  const dispatchMutation = useMutation({
    mutationFn: () =>
      trpcClient.outboundTransaction.SubmitDispatchAssignment.mutate({
        outboundTransactionId: selectedTransactionId!,
        assignments: flatAssignments,
      }),
    onSuccess: () => {
      setStage('success');
      setIsConfirming(false);
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionList'] });
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionDetail', selectedTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionList', 'APPROVED', 'dispatch-panel'] });
      setTimeout(() => { onTransactionChange(null); setStage('idle'); }, 1800);
    },
    onError: (err) => {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setStage('error');
      setIsConfirming(false);
    },
  });

  const handleTransactionChange = (key: string | null) => {
    onTransactionChange(key);
    setSelections(new Map());
    setIsConfirming(false);
    setStage('idle');
  };

  return (
    <div
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Card style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Card.Header>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon icon="solar:delivery-bold-duotone" style={{ width: 20, height: 20 }} />
              <Card.Title>Dispatch Outbound</Card.Title>
            </div>
            <Button isIconOnly size="sm" variant="ghost" aria-label="Close dispatch panel" onPress={onClose}>
              <Icon icon="mdi:close" style={{ width: 16, height: 16 }} />
            </Button>
          </div>
        </Card.Header>

        {/* Body */}
        <Card.Content style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* All done — celebrate */}
          {allDone ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ animation: 'putaway-bounce 1s ease-in-out 2' }}>
                <Icon icon="fluent:vehicle-truck-checkmark-24-filled" style={{ width: 56, height: 56, color: 'var(--heroui-success)' }} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--heroui-success)' }}>All Dispatched</p>
                <p style={{ fontSize: 12, color: 'var(--heroui-foreground-60)', marginTop: 4 }}>
                  All approved outbound transactions have been dispatched.
                </p>
              </div>
              <Button size="sm" variant="ghost" onPress={onClose}>Close Session</Button>
            </div>
          ) : (
            <>
              {/* Transaction selector */}
              <Select
                value={selectedTransactionId ?? ''}
                onChange={(key) => handleTransactionChange(String(key) || null)}
                isDisabled={txnLoading}
                placeholder="Select outbound transaction"
                variant="secondary"
              >
                <Label>Outbound Transaction</Label>
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
                          <Chip size="sm" color={DISPATCH_STATUS_BADGE[txn.dispatchStatus].color}>
                            {DISPATCH_STATUS_BADGE[txn.dispatchStatus].label}
                          </Chip>
                        </div>
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              {/* Assignment area */}
              {selectedTransactionId && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {assignmentLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Spinner size="sm" />
                      <span style={{ fontSize: 14 }}>Loading…</span>
                    </div>
                  ) : stage === 'success' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0', textAlign: 'center' }}>
                      <div style={{ animation: 'putaway-bounce 1s ease-in-out 2' }}>
                        <Icon icon="solar:truck-speed-bold-duotone" style={{ width: 40, height: 40, color: 'var(--heroui-success)' }} />
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--heroui-success)' }}>Dispatched!</p>
                    </div>
                  ) : stage === 'error' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 8, background: 'var(--heroui-danger-50)', border: '1px solid var(--heroui-danger-200)' }}>
                        <Icon icon="solar:close-circle-bold" style={{ width: 16, height: 16, color: 'var(--heroui-danger)', flexShrink: 0, marginTop: 1 }} />
                        <span style={{ fontSize: 12, color: 'var(--heroui-danger)' }}>{errorMessage}</span>
                      </div>
                      <Button size="sm" variant="ghost" onPress={() => setStage('idle')}>Go back</Button>
                    </div>
                  ) : isConfirming ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 8, background: 'var(--heroui-warning-50)', border: '1px solid var(--heroui-warning-200)' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--heroui-warning-700)' }}>Confirm Dispatch</p>
                        <p style={{ fontSize: 12, color: 'var(--heroui-warning-600)', marginTop: 4 }}>
                          Assigning {totalSelected} pallet{totalSelected !== 1 ? 's' : ''} and marking as dispatched. This cannot be undone.
                        </p>
                      </div>
                      {dispatchMutation.isPending ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0' }}>
                          <Spinner size="sm" />
                          <span style={{ fontSize: 13 }}>Dispatching…</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Button size="sm" variant="ghost" style={{ flex: 1 }} onPress={() => setIsConfirming(false)}>Back</Button>
                          <Button size="sm" variant="primary" style={{ flex: 1 }} onPress={() => dispatchMutation.mutate()}>Confirm</Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    assignmentData && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ fontSize: 12, color: 'var(--heroui-foreground-60)' }}>
                            <span style={{ fontWeight: 600, color: isComplete ? 'var(--heroui-success)' : 'var(--heroui-foreground)' }}>{totalSelected}</span>
                            <span> / {totalNeeded} pallets</span>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Button size="sm" variant="ghost" onPress={handleAutoFill}>Auto-fill</Button>
                            <Button size="sm" variant="ghost" onPress={handleReset}>Reset</Button>
                          </div>
                        </div>
                        {assignmentData.items.map((item) => (
                          <DispatchItemSection
                            key={item.outboundTransactionItemId}
                            item={item}
                            available={availableByItem.get(item.outboundTransactionItemId) ?? []}
                            selected={selections.get(item.outboundTransactionItemId) ?? new Set()}
                            isExpanded={expandedItemId === item.outboundTransactionItemId}
                            onToggleExpand={() =>
                              setExpandedItemId((prev) =>
                                prev === item.outboundTransactionItemId ? null : item.outboundTransactionItemId,
                              )
                            }
                            onTogglePallet={(palletId) => togglePallet(item.outboundTransactionItemId, palletId)}
                          />
                        ))}
                      </>
                    )
                  )}
                </div>
              )}

              {!selectedTransactionId && !txnLoading && (
                <div style={{ padding: 12, borderRadius: 8, background: 'var(--heroui-content2)', textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: 'var(--heroui-foreground-60)' }}>
                    Select an approved outbound transaction to begin dispatch.
                  </p>
                </div>
              )}
            </>
          )}
        </Card.Content>

        {selectedTransactionId && stage === 'idle' && !isConfirming && assignmentData && !assignmentLoading && (
          <Card.Footer style={{ display: 'flex', gap: 8, padding: '12px 16px' }}>
            <Button size="sm" variant="ghost" style={{ flex: 1 }} onPress={() => handleTransactionChange(null)}>Cancel</Button>
            <Button
              size="sm"
              variant="primary"
              style={{ flex: 2 }}
              isDisabled={flatAssignments.length === 0}
              onPress={() => setIsConfirming(true)}
            >
              <Icon icon="solar:delivery-bold-duotone" style={{ width: 15, height: 15 }} />
              Dispatch ({totalSelected})
            </Button>
          </Card.Footer>
        )}
      </Card>
    </div>
  );
}

// ─── Item section sub-component ──────────────────────────────────────────────

interface DispatchItemSectionProps {
  item: DispatchItem;
  available: DispatchPallet[];
  selected: Set<string>;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTogglePallet: (palletId: string) => void;
}

function DispatchItemSection({ item, available, selected, isExpanded, onToggleExpand, onTogglePallet }: DispatchItemSectionProps) {
  const isMet = selected.size >= item.quantity;
  const isOver = selected.size > item.quantity;

  return (
    <div style={{ border: '1px solid var(--heroui-divider)', borderRadius: 8, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onToggleExpand}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--heroui-content1)', border: 'none', cursor: 'pointer', gap: 8, textAlign: 'left' }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--heroui-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.skuName ?? item.skuId}
          </p>
          <p style={{ fontSize: 11, color: 'var(--heroui-foreground-60)', marginTop: 1 }}>{item.palletTypeName ?? '—'}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <Chip size="sm" color={isOver ? 'danger' : isMet ? 'success' : selected.size > 0 ? 'warning' : 'default'}>
            {selected.size}/{item.quantity}
          </Chip>
          <Icon icon={isExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'} style={{ width: 16, height: 16, color: 'var(--heroui-foreground-60)' }} />
        </div>
      </button>

      {selected.size > 0 && (
        <div style={{ padding: '6px 12px', display: 'flex', flexWrap: 'wrap', gap: 4, background: 'var(--heroui-content2)' }}>
          {Array.from(selected).map((palletId) => (
            <button
              key={palletId}
              type="button"
              onClick={(e) => { e.stopPropagation(); onTogglePallet(palletId); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontFamily: 'ui-monospace, monospace', background: 'var(--heroui-primary-100)', color: 'var(--heroui-primary-700)', border: '1px solid var(--heroui-primary-200)', borderRadius: 4, padding: '2px 5px', cursor: 'pointer' }}
            >
              {palletId.slice(-8)}
              <Icon icon="mdi:close" style={{ width: 10, height: 10 }} />
            </button>
          ))}
        </div>
      )}

      {isExpanded && (
        <div style={{ maxHeight: 200, overflowY: 'auto', borderTop: '1px solid var(--heroui-divider)' }}>
          {available.length === 0 ? (
            <div style={{ padding: 12, fontSize: 12, color: 'var(--heroui-foreground-40)', textAlign: 'center' }}>No available pallets.</div>
          ) : (
            available.map((pallet) => {
              const isSelected = selected.has(pallet.palletId);
              return (
                <button
                  key={pallet.palletId}
                  type="button"
                  onClick={() => onTogglePallet(pallet.palletId)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: isSelected ? 'var(--heroui-primary-50)' : 'var(--heroui-content1)', border: 'none', borderBottom: '1px solid var(--heroui-divider)', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: `2px solid ${isSelected ? 'var(--heroui-primary)' : 'var(--heroui-divider)'}`, background: isSelected ? 'var(--heroui-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isSelected && <Icon icon="mdi:check" style={{ width: 10, height: 10, color: 'white' }} />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: 'var(--heroui-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pallet.palletId}</p>
                    <p style={{ fontSize: 10, color: 'var(--heroui-foreground-60)' }}>{pallet.palletTypeName}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
