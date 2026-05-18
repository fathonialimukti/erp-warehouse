import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button, ButtonGroup, Card, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import type { inferProcedureOutput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';
import { hasPermissionAtom } from '../../../lib/atoms';
import {
  WarehouseScene,
  type PalletInteractionInfo,
  type WarehouseDataSourceMode,
} from './_WarehouseScene';
import { DetailModal } from './_DetailModal';
import { PutawayPanel, type SelectedPalletInfo } from './_PutawayPanel';
import { DispatchPanel, type DispatchData, type DispatchSelectionMap } from './_DispatchPanel';
import { PageHeader } from '../../../components/PageHeader';

type AssignmentData = inferProcedureOutput<AppRouter['inboundTransaction']['getAssignmentData']>;
type WarehouseDetail = inferProcedureOutput<AppRouter['warehouse']['warehouse']['detail']>;

interface OutboundTxnListItem {
  id: string;
  reference: string | null;
  dispatchStatus: 'PENDING' | 'PARTIAL' | 'COMPLETED';
}

/** Switch to `'live'` to load layout from the database (TRPC). */
const WAREHOUSE_DATA_SOURCE: WarehouseDataSourceMode = 'live'; // 'live' || 'mock'

/**
 * When `WAREHOUSE_DATA_SOURCE === 'mock'`, also render a pallet model at every
 * `floor_placeholder.*` from the GLB (same behaviour as the old stress test).
 */
const WAREHOUSE_MOCK_FILL_ALL_PLACEHOLDERS = true;

function WarehouseLayoutPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canAssign = hasPermission('inbound_transaction@putaway');
  const canDispatch = hasPermission('outbound_transaction@dispatch');

  const { data: warehouseQueryData, isLoading: isLoadingWarehouse } = useQuery({
    queryKey: ['warehouseDetail', id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.warehouse.warehouse.detail.query({ id: id ?? '' }),
  });
  const warehouse = warehouseQueryData as WarehouseDetail | undefined;

  const showGrid = false;
  const [detailModal, setDetailModal] = useState<{ x: number; y: number; info: PalletInteractionInfo } | null>(null);
  const [activeSidePanel, setActiveSidePanel] = useState<'putaway' | 'dispatch' | null>(null);
  const putawayMode = activeSidePanel === 'putaway';
  const [selectedPallet, setSelectedPallet] = useState<SelectedPalletInfo | null>(null);
  const [activePutawayTransactionId, setActivePutawayTransactionId] = useState<string | null>(null);
  const [activeDispatchTransactionId, setActiveDispatchTransactionId] = useState<string | null>(null);

  // ── Dispatch 3D-driven state ───────────────────────────────────────────────
  const [dispatchSelections, setDispatchSelections] = useState<DispatchSelectionMap>(() => new Map());
  const [dispatchActiveItemId, setDispatchActiveItemId] = useState<string | null>(null);
  const [dispatchActivePalletTypeObjectId, setDispatchActivePalletTypeObjectId] = useState<string | null>(null);
  const [dispatchStage, setDispatchStage] = useState<'idle' | 'confirm' | 'loading' | 'success' | 'error'>('idle');
  const [dispatchError, setDispatchError] = useState('');

  // Outbound transaction list for the dispatch panel selector
  const { data: outboundTxnList, isLoading: outboundTxnLoading } = useQuery<{ data: OutboundTxnListItem[] }>({
    queryKey: ['outboundTransactionList', 'APPROVED', 'dispatch-panel'],
    enabled: activeSidePanel === 'dispatch',
    queryFn: () =>
      trpcClient.outboundTransaction.list.query({
        approvalStatus: 'APPROVED',
        dispatchOpenStatus: 'OPEN',
        limit: 50,
      }) as Promise<{ data: OutboundTxnListItem[] }>,
  });
  const pendingDispatchTxns = outboundTxnList?.data ?? [];
  const allDispatchDone = !outboundTxnLoading && Boolean(outboundTxnList) && pendingDispatchTxns.length === 0;

  // Dispatch assignment data for the selected transaction
  const { data: dispatchAssignmentData, isLoading: dispatchAssignmentLoading } = useQuery({
    queryKey: ['dispatchAssignmentData', activeDispatchTransactionId],
    enabled: Boolean(activeDispatchTransactionId),
    queryFn: () =>
      trpcClient.outboundTransaction.getDispatchAssignmentData.query({
        outboundTransactionId: activeDispatchTransactionId!,
      }),
    staleTime: 0,
  });

  // Pre-populate selections from already-assigned pallets when assignment data loads
  useEffect(() => {
    if (!dispatchAssignmentData) return;
    const initial: DispatchSelectionMap = new Map();
    for (const p of dispatchAssignmentData.assignedPallets) {
      const set = initial.get(p.outboundTransactionItemId) ?? new Set<string>();
      set.add(p.palletId);
      initial.set(p.outboundTransactionItemId, set);
    }
    setDispatchSelections(initial);
    setDispatchStage('idle');
  }, [dispatchAssignmentData]);

  // Dispatch mutation
  const dispatchMutation = useMutation({
    mutationFn: () => {
      const flatAssignments: { outboundTransactionItemId: string; palletId: string }[] = [];
      for (const [itemId, palletSet] of dispatchSelections.entries()) {
        for (const palletId of palletSet) flatAssignments.push({ outboundTransactionItemId: itemId, palletId });
      }
      return trpcClient.outboundTransaction.SubmitDispatchAssignment.mutate({
        outboundTransactionId: activeDispatchTransactionId!,
        assignments: flatAssignments,
      });
    },
    onSuccess: () => {
      setDispatchStage('success');
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionList'] });
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionDetail', activeDispatchTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionList', 'APPROVED', 'dispatch-panel'] });
      queryClient.invalidateQueries({ queryKey: ['warehouseLayoutScene', id] });
      setTimeout(() => {
        setActiveDispatchTransactionId(null);
        setDispatchSelections(new Map());
        setDispatchActiveItemId(null);
        setDispatchActivePalletTypeObjectId(null);
        setDispatchStage('idle');
      }, 1800);
    },
    onError: (err) => {
      setDispatchError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setDispatchStage('error');
    },
  });

  const handleItemActivate = (itemId: string | null, palletTypeObjectId: string | null) => {
    setDispatchActiveItemId(itemId);
    setDispatchActivePalletTypeObjectId(palletTypeObjectId);
  };

  const handleDispatchTogglePallet = (itemId: string, palletId: string) => {
    setDispatchSelections((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(itemId) ?? []);
      if (set.has(palletId)) { set.delete(palletId); } else { set.add(palletId); }
      next.set(itemId, set);
      return next;
    });
  };

  /** Set of pallet-type objectIds for scene dimming. Set when a dispatch item is active. */
  const dispatchActivePalletTypeObjectIds = useMemo<Set<string> | null>(() => {
    if (activeSidePanel !== 'dispatch' || !dispatchActivePalletTypeObjectId) return null;
    return new Set([dispatchActivePalletTypeObjectId]);
  }, [activeSidePanel, dispatchActivePalletTypeObjectId]);
  useEffect(() => {
    if (putawayMode) setDetailModal(null);
  }, [putawayMode]);

  useEffect(() => {
    if (!detailModal) return;
    const closeAll = () => setDetailModal(null);
    document.addEventListener('pointerdown', closeAll);
    return () => document.removeEventListener('pointerdown', closeAll);
  }, [detailModal]);

  const handleClosePutaway = () => {
    setActiveSidePanel(null);
    setSelectedPallet(null);
    if (activePutawayTransactionId) {
      queryClient.invalidateQueries({ queryKey: ['putawayAssignmentData', activePutawayTransactionId] });
      setActivePutawayTransactionId(null);
    }
    if (id) {
      queryClient.invalidateQueries({ queryKey: ['warehouseLayoutScene', id] });
    }
  };

  const handleCloseDispatch = () => {
    setActiveSidePanel(null);
    setActiveDispatchTransactionId(null);
    setDispatchSelections(new Map());
    setDispatchActiveItemId(null);
    setDispatchActivePalletTypeObjectId(null);
    setDispatchStage('idle');
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDetailModal(null);
        if (putawayMode) {
          handleClosePutaway();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [putawayMode, activePutawayTransactionId]);

  /**
   * Putaway assignment mutation.
   * The backend replaces ALL assignments for a transaction on each call,
   * so we read existing pairs from the query cache and include them alongside the new one.
   */
  const assignMutation = useMutation({
    mutationFn: (vars: { inboundTransactionId: string; palletId: string; storageLocationId: string }) => {
      const cached = queryClient.getQueryData<AssignmentData>(['putawayAssignmentData', vars.inboundTransactionId]);
      const existingPairs = (cached?.allPallets ?? [])
        .filter((p) => p.storageLocationId && p.palletId !== vars.palletId)
        .map((p) => ({ palletId: p.palletId, storageLocationId: p.storageLocationId! }));

      return trpcClient.inboundTransaction.SubmitPalletAssignment.mutate({
        inboundTransactionId: vars.inboundTransactionId,
        assignments: [...existingPairs, { palletId: vars.palletId, storageLocationId: vars.storageLocationId }],
      });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['warehouseLayoutScene', id] });
      queryClient.invalidateQueries({ queryKey: ['putawayAssignmentData', vars.inboundTransactionId] });
      setSelectedPallet(null);
    },
  });

  const handleEmptyLocationClick = (storageLocationId: string) => {
    if (!selectedPallet || assignMutation.isPending) return;
    assignMutation.mutate({
      inboundTransactionId: selectedPallet.inboundTransactionId,
      palletId: selectedPallet.palletId,
      storageLocationId,
    });
  };

  if (isLoadingWarehouse || !warehouse) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 120px)' }}>
        <Spinner />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', gap: 12 }}>
      {/* Toolbar row */}
      <PageHeader
        title={warehouse.name}
        onBack={() => navigate('/warehouse')}
      >
        {(canAssign || canDispatch) && WAREHOUSE_DATA_SOURCE === 'live' && (
          <>
            {canAssign && (
              <Button
                variant='tertiary'
                onPress={() => {
                  if (putawayMode) {
                    handleClosePutaway();
                    return;
                  }
                  setActiveSidePanel('putaway');
                  setSelectedPallet(null);
                }}
              >
                <Icon icon="solar:box-bold-duotone" style={{ width: 16, height: 16 }} />
                {putawayMode ? 'Exit Putaway' : 'Putaway'}
              </Button>
            )}
            {canDispatch && (
              <Button
              variant='tertiary'
              onPress={() => {
                if (activeSidePanel === 'dispatch') {
                  setActiveSidePanel(null);
                  return;
                }
                setActiveSidePanel('dispatch');
              }}
              >
                {canAssign && canDispatch && <ButtonGroup.Separator />}
                <Icon icon="solar:delivery-bold-duotone" style={{ width: 16, height: 16 }} />
                {activeSidePanel === 'dispatch' ? 'Exit Dispatch' : 'Dispatch'}
              </Button>
            )}
          </>
        )}
      </PageHeader>

      {/* Scene row: canvas (flex 7) + side panel (flex 3) */}
      <div style={{ display: 'flex', flex: 1, gap: 12, minHeight: 0 }}>
        {/* Canvas column — shrinks when a panel is open */}
        <div style={{ flex: activeSidePanel ? 7 : 1, minWidth: 0, transition: 'flex 0.3s ease', display: 'flex', flexDirection: 'column' }}>
          <Card style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Card.Content style={{ flex: 1, padding: 0 }}>
              <WarehouseScene
                showGrid={showGrid}
                dataSource={WAREHOUSE_DATA_SOURCE}
                warehouseId={id}
                mockFillAllPlaceholders={
                  WAREHOUSE_DATA_SOURCE === 'mock' && WAREHOUSE_MOCK_FILL_ALL_PLACEHOLDERS
                }
                putawayMode={putawayMode}
                selectedPalletId={selectedPallet?.palletId ?? null}
                onEmptyLocationClick={handleEmptyLocationClick}
                dispatchActivePalletTypeObjectIds={dispatchActivePalletTypeObjectIds}
                onPalletClick={(info) => {
                  // Dispatch mode: add clicked pallet to the active item's selection
                  if (activeSidePanel === 'dispatch' && dispatchActiveItemId && dispatchAssignmentData) {
                    const available = dispatchAssignmentData.availablePallets.find(
                      (p) => p.palletId === info.palletId && p.outboundTransactionItemId === dispatchActiveItemId,
                    );
                    if (available) {
                      handleDispatchTogglePallet(dispatchActiveItemId, info.palletId);
                    }
                    return;
                  }
                  if (putawayMode) return;
                  const modalW = 340;
                  const modalH = 300;
                  const x = info.screenX + modalW > window.innerWidth ? info.screenX - modalW : info.screenX + 4;
                  const y = info.screenY + modalH > window.innerHeight ? info.screenY - modalH : info.screenY + 4;
                  setDetailModal({ x, y, info });
                }}
                onPalletContextMenu={() => {
                  // Intentionally empty for now; right-click behavior will be redesigned.
                }}
              />
            </Card.Content>
          </Card>
        </div>

        {/* Side panel column — only rendered when a panel is active */}
        {activeSidePanel && (
          <div style={{ flex: 3, minWidth: 280, maxWidth: 420, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {activeSidePanel === 'putaway' && id && (
              <PutawayPanel
                warehouseId={id}
                selectedTransactionId={activePutawayTransactionId}
                onTransactionChange={setActivePutawayTransactionId}
                selectedPalletId={selectedPallet?.palletId ?? null}
                onPalletSelect={setSelectedPallet}
                onClose={handleClosePutaway}
              />
            )}
            {activeSidePanel === 'dispatch' && (
              <DispatchPanel
                selectedTransactionId={activeDispatchTransactionId}
                onTransactionChange={(id) => {
                  setActiveDispatchTransactionId(id);
                  setDispatchSelections(new Map());
                  setDispatchActiveItemId(null);
                  setDispatchActivePalletTypeObjectId(null);
                  setDispatchStage('idle');
                }}
                pendingTxns={pendingDispatchTxns as Array<{ id: string; reference: string | null; dispatchStatus: 'PENDING' | 'PARTIAL' | 'COMPLETED' }>}
                txnLoading={outboundTxnLoading}
                assignmentData={dispatchAssignmentData as DispatchData | undefined}
                assignmentLoading={dispatchAssignmentLoading}
                dispatchSelections={dispatchSelections}
                onTogglePallet={handleDispatchTogglePallet}
                activeItemId={dispatchActiveItemId}
                onItemActivate={handleItemActivate}
                onConfirmDispatch={() => dispatchMutation.mutate()}
                isDispatching={dispatchMutation.isPending}
                dispatchStage={dispatchStage}
                onSetDispatchStage={(s) => setDispatchStage(s)}
                dispatchError={dispatchError}
                allDone={allDispatchDone}
                onClose={handleCloseDispatch}
              />
            )}
          </div>
        )}
      </div>

      {detailModal && !putawayMode && (
        <DetailModal
          data={detailModal}
          onClose={() => setDetailModal(null)}
        />
      )}
    </div>
  );
}

export { WarehouseLayoutPage };
