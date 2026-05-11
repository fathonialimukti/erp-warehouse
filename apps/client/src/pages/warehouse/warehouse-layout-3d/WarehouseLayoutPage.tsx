import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Button, ButtonGroup, Card, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { DispatchPanel } from './_DispatchPanel';

type AssignmentData = inferProcedureOutput<AppRouter['inboundTransaction']['getAssignmentData']>;

/** Switch to `'live'` to load layout from the database (TRPC). */
const WAREHOUSE_DATA_SOURCE: WarehouseDataSourceMode = 'live'; // 'live' || 'mock'

/**
 * When `WAREHOUSE_DATA_SOURCE === 'mock'`, also render a pallet model at every
 * `floor_placeholder.*` from the GLB (same behaviour as the old stress test).
 */
const WAREHOUSE_MOCK_FILL_ALL_PLACEHOLDERS = true;

function WarehouseLayoutPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canAssign = hasPermission('inbound_transaction@putaway');
  const canDispatch = hasPermission('outbound_transaction@dispatch');

  const showGrid = false;
  const [detailModal, setDetailModal] = useState<{ x: number; y: number; info: PalletInteractionInfo } | null>(null);
  const [activeSidePanel, setActiveSidePanel] = useState<'putaway' | 'dispatch' | null>(null);
  const putawayMode = activeSidePanel === 'putaway';
  const [selectedPallet, setSelectedPallet] = useState<SelectedPalletInfo | null>(null);
  const [activePutawayTransactionId, setActivePutawayTransactionId] = useState<string | null>(null);
  const [activeDispatchTransactionId, setActiveDispatchTransactionId] = useState<string | null>(null);

  // Close detail modal when putaway mode activates
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', gap: 12 }}>
      {/* Toolbar row */}
      {(canAssign || canDispatch) && WAREHOUSE_DATA_SOURCE === 'live' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {assignMutation.isPending && <Spinner size="sm" />}
          <ButtonGroup variant="tertiary">
            {canAssign && (
              <Button
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
                onPress={() => {
                  if (activeSidePanel === 'dispatch') {
                    setActiveSidePanel(null);
                    return;
                  }
                  setActiveSidePanel('dispatch');
                }}
              >
                <Icon icon="solar:delivery-bold-duotone" style={{ width: 16, height: 16 }} />
                {activeSidePanel === 'dispatch' ? 'Exit Dispatch' : 'Dispatch'}
              </Button>
            )}
          </ButtonGroup>
        </div>
      )}

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
                onPalletClick={(info) => {
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
                onTransactionChange={setActiveDispatchTransactionId}
                onClose={() => setActiveSidePanel(null)}
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
