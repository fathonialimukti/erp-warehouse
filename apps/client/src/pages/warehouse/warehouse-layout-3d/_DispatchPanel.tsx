import { Button, Card, Chip, Label, ListBox, Select, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';

export interface DispatchData {
  items: Array<{
    outboundTransactionItemId: string;
    skuId: string;
    skuName: string | null;
    palletTypeName: string | null;
    palletTypeObjectId: string | null;
    quantity: number;
  }>;
  availablePallets: Array<{ palletId: string; outboundTransactionItemId: string }>;
  assignedPallets: Array<{ palletId: string; outboundTransactionItemId: string }>;
}
export type DispatchItem = DispatchData['items'][number];

type DispatchStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED';

interface OutboundTransactionListItem {
  id: string;
  reference: string | null;
  dispatchStatus: DispatchStatus;
}

const DISPATCH_STATUS_BADGE: Record<DispatchStatus, { label: string; color: 'default' | 'warning' | 'success' }> = {
  PENDING:   { label: 'Pending',   color: 'default' },
  PARTIAL:   { label: 'Partial',   color: 'warning' },
  COMPLETED: { label: 'Completed', color: 'success' },
};

// Map<outboundTransactionItemId, Set<palletId>>
export type DispatchSelectionMap = Map<string, Set<string>>;

export interface DispatchPanelProps {
  selectedTransactionId: string | null;
  onTransactionChange: (id: string | null) => void;
  pendingTxns: OutboundTransactionListItem[];
  txnLoading: boolean;
  assignmentData: DispatchData | undefined;
  assignmentLoading: boolean;
  dispatchSelections: DispatchSelectionMap;
  onTogglePallet: (itemId: string, palletId: string) => void;
  activeItemId: string | null;
  onItemActivate: (itemId: string | null, palletTypeObjectId: string | null) => void;
  onConfirmDispatch: () => void;
  isDispatching: boolean;
  dispatchStage: 'idle' | 'confirm' | 'loading' | 'success' | 'error';
  onSetDispatchStage: (stage: 'idle' | 'confirm' | 'error') => void;
  dispatchError: string;
  allDone: boolean;
  onClose: () => void;
}

export function DispatchPanel({
  selectedTransactionId,
  onTransactionChange,
  pendingTxns,
  txnLoading,
  assignmentData,
  assignmentLoading,
  dispatchSelections,
  onTogglePallet,
  activeItemId,
  onItemActivate,
  onConfirmDispatch,
  isDispatching,
  dispatchStage,
  onSetDispatchStage,
  dispatchError,
  allDone,
  onClose,
}: DispatchPanelProps) {
  const totalSelected = Array.from(dispatchSelections.values()).reduce((s, v) => s + v.size, 0);
  const totalNeeded = (assignmentData?.items ?? []).reduce((s, i) => s + i.quantity, 0);

  const handleTransactionChange = (key: string | null) => {
    onTransactionChange(key);
    onItemActivate(null, null);
    onSetDispatchStage('idle');
  };

  return (
    <div
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Card style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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

        <Card.Content style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {allDone ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ animation: 'putaway-bounce 1s ease-in-out 2' }}>
                <Icon icon="solar:truck-speed-bold-duotone" style={{ width: 56, height: 56, color: 'var(--heroui-success)' }} />
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

              {selectedTransactionId && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {assignmentLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Spinner size="sm" />
                      <span style={{ fontSize: 14 }}>Loading…</span>
                    </div>
                  ) : dispatchStage === 'success' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0', textAlign: 'center' }}>
                      <div style={{ animation: 'putaway-bounce 1s ease-in-out 2' }}>
                        <Icon icon="solar:truck-speed-bold-duotone" style={{ width: 40, height: 40, color: 'var(--heroui-success)' }} />
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--heroui-success)' }}>Dispatched!</p>
                    </div>
                  ) : dispatchStage === 'error' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 8, background: 'var(--heroui-danger-50)', border: '1px solid var(--heroui-danger-200)' }}>
                        <Icon icon="solar:close-circle-bold" style={{ width: 16, height: 16, color: 'var(--heroui-danger)', flexShrink: 0, marginTop: 1 }} />
                        <span style={{ fontSize: 12, color: 'var(--heroui-danger)' }}>{dispatchError}</span>
                      </div>
                      <Button size="sm" variant="ghost" onPress={() => onSetDispatchStage('idle')}>Go back</Button>
                    </div>
                  ) : dispatchStage === 'confirm' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 8, background: 'var(--heroui-warning-50)', border: '1px solid var(--heroui-warning-200)' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--heroui-warning-700)' }}>Confirm Dispatch</p>
                        <p style={{ fontSize: 12, color: 'var(--heroui-warning-600)', marginTop: 4 }}>
                          Assigning {totalSelected} pallet{totalSelected !== 1 ? 's' : ''} and marking as dispatched. This cannot be undone.
                        </p>
                      </div>
                      {isDispatching ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0' }}>
                          <Spinner size="sm" />
                          <span style={{ fontSize: 13 }}>Dispatching…</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Button size="sm" variant="ghost" style={{ flex: 1 }} onPress={() => onSetDispatchStage('idle')}>Back</Button>
                          <Button size="sm" variant="primary" style={{ flex: 1 }} onPress={onConfirmDispatch}>Confirm</Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    assignmentData && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ fontSize: 12, color: 'var(--heroui-foreground-60)' }}>
                            <span style={{ fontWeight: 600, color: totalSelected === totalNeeded && totalNeeded > 0 ? 'var(--heroui-success)' : 'var(--heroui-foreground)' }}>{totalSelected}</span>
                            <span> / {totalNeeded} pallets selected</span>
                          </div>
                        </div>

                        {activeItemId && (
                          <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--heroui-primary-50)', border: '1px solid var(--heroui-primary-200)' }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--heroui-primary-700)' }}>Click a matching pallet in the 3D view</p>
                            <p style={{ fontSize: 11, color: 'var(--heroui-primary-600)', marginTop: 2 }}>Non-matching pallets are dimmed.</p>
                          </div>
                        )}

                        {assignmentData.items.map((item) => {
                          const selected = dispatchSelections.get(item.outboundTransactionItemId) ?? new Set<string>();
                          const isActive = activeItemId === item.outboundTransactionItemId;
                          const isMet = selected.size >= item.quantity;
                          return (
                            <div
                              key={item.outboundTransactionItemId}
                              style={{
                                border: `1px solid ${isActive ? 'var(--heroui-primary-300)' : 'var(--heroui-divider)'}`,
                                borderRadius: 8,
                                overflow: 'hidden',
                                transition: 'border-color 0.15s',
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  isActive
                                    ? onItemActivate(null, null)
                                    : onItemActivate(item.outboundTransactionItemId, item.palletTypeObjectId ?? null)
                                }
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '10px 12px',
                                  background: isActive ? 'var(--heroui-primary-50)' : 'var(--heroui-content1)',
                                  border: 'none',
                                  cursor: 'pointer',
                                  gap: 8,
                                  textAlign: 'left',
                                  transition: 'background 0.15s',
                                }}
                              >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <p style={{ fontSize: 12, fontWeight: 600, color: isActive ? 'var(--heroui-primary-700)' : 'var(--heroui-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.skuName ?? item.skuId}
                                  </p>
                                  <p style={{ fontSize: 11, color: isActive ? 'var(--heroui-primary-600)' : 'var(--heroui-foreground-60)', marginTop: 1 }}>
                                    {item.palletTypeName ?? '—'}
                                  </p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                  <Chip size="sm" color={selected.size > item.quantity ? 'danger' : isMet ? 'success' : selected.size > 0 ? 'warning' : 'default'}>
                                    {selected.size}/{item.quantity}
                                  </Chip>
                                  <Icon
                                    icon={isActive ? 'mdi:cursor-default-click' : 'mdi:chevron-right'}
                                    style={{ width: 15, height: 15, color: isActive ? 'var(--heroui-primary)' : 'var(--heroui-foreground-40)' }}
                                  />
                                </div>
                              </button>

                              {selected.size > 0 && (
                                <div style={{ padding: '6px 12px', display: 'flex', flexWrap: 'wrap', gap: 4, background: 'var(--heroui-content2)', borderTop: '1px solid var(--heroui-divider)' }}>
                                  {Array.from(selected).map((palletId) => (
                                    <button
                                      key={palletId}
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); onTogglePallet(item.outboundTransactionItemId, palletId); }}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 3,
                                        fontSize: 10,
                                        fontFamily: 'ui-monospace, monospace',
                                        background: 'var(--heroui-primary-100)',
                                        color: 'var(--heroui-primary-700)',
                                        border: '1px solid var(--heroui-primary-200)',
                                        borderRadius: 4,
                                        padding: '2px 5px',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {palletId}
                                      <Icon icon="mdi:close" style={{ width: 10, height: 10 }} />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
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

        {selectedTransactionId && dispatchStage === 'idle' && assignmentData && !assignmentLoading && (
          <Card.Footer style={{ display: 'flex', gap: 8, padding: '12px 16px' }}>
            <Button size="sm" variant="ghost" style={{ flex: 1 }} onPress={() => handleTransactionChange(null)}>Cancel</Button>
            <Button
              size="sm"
              variant="primary"
              style={{ flex: 2 }}
              isDisabled={totalSelected === 0}
              onPress={() => onSetDispatchStage('confirm')}
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
