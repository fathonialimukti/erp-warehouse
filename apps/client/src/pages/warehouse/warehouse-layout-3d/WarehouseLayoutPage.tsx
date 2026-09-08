import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button, ButtonGroup, Card, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAtomValue, useSetAtom } from 'jotai';
import { useIntl } from 'react-intl';
import type { inferProcedureOutput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';
import {
  hasPermissionAtom,
  aiPutawaySelectionAtom,
  aiPutawayHighlightAtom,
  aiPutawayStageAtom,
  aiPutawayUnstageAtom,
  aiPutawaySaveAtom,
  aiPutawaySelectTransactionAtom,
  aiDispatchSelectionAtom,
  aiDispatchStageAtom,
  aiDispatchUnstageAtom,
  aiDispatchSaveAtom,
  aiDispatchSelectTransactionAtom,
  aiChatOpenAtom,
  aiChatPresetMessageAtom,
} from '../../../lib/atoms';
import {
  WarehouseScene,
  type PalletInteractionInfo,
} from './_WarehouseScene';
import { AGING_CATEGORY_COLORS } from './_WarehouseModel';
import { DetailModal } from './_DetailModal';
import { PutawayPanel, type SelectedPalletInfo } from './_PutawayPanel';
import { DispatchPanel, type DispatchData, type DispatchSelectionMap } from './_DispatchPanel';
import { PageHeader } from '../../../components/PageHeader';

type AssignmentData = {
  putawayStatus: string;
  allPallets: Array<{ palletId: string; storageLocationId: string | null }>;
};
type WarehouseDetail = inferProcedureOutput<AppRouter['warehouse']['warehouse']['detail']>;

interface OutboundTxnListItem {
  id: string;
  reference: string | null;
  dispatchStatus: 'PENDING' | 'PARTIAL' | 'COMPLETED';
  transactionType: string;
}

function WarehouseLayoutPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canAssign = hasPermission('transaction@putaway');
  const canDispatch = hasPermission('transaction@dispatch');

  // Inline AI putaway highlight: when the user hovers a staged card in the
  // PutawayPanel, the corresponding storage location lights up in the 3D view.
  const [localHighlight, setLocalHighlight] = useState<string | null>(null);

  // ── Aging mode state ──────────────────────────────────────────────────────
  const [agingMode, setAgingMode] = useState(false);
  const [palletAgingMap, setPalletAgingMap] = useState<Record<string, { daysSinceMovement: number | null; agingCategory: string }>>({});

  const handleAgingMapChange = useCallback(
    (map: Record<string, { daysSinceMovement: number | null; agingCategory: string }>) => {
      setPalletAgingMap(map);
    },
    [],
  );

  // AI chat → putaway control bridge (atoms written by AiAssistant tool handlers)
  const aiPutawaySelection = useAtomValue(aiPutawaySelectionAtom);
  const aiPutawayHighlight = useAtomValue(aiPutawayHighlightAtom);
  const aiPutawayStage = useAtomValue(aiPutawayStageAtom);
  const aiPutawayUnstage = useAtomValue(aiPutawayUnstageAtom);
  const aiPutawaySave = useAtomValue(aiPutawaySaveAtom);
  const aiPutawaySelectTransaction = useAtomValue(aiPutawaySelectTransactionAtom);
  // AI chat → dispatch control bridge
  const aiDispatchSelection = useAtomValue(aiDispatchSelectionAtom);
  const aiDispatchStage = useAtomValue(aiDispatchStageAtom);
  const aiDispatchUnstage = useAtomValue(aiDispatchUnstageAtom);
  const aiDispatchSave = useAtomValue(aiDispatchSaveAtom);
  const aiDispatchSelectTransaction = useAtomValue(aiDispatchSelectTransactionAtom);
  const setAiChatOpen = useSetAtom(aiChatOpenAtom);
  const setAiChatPresetMessage = useSetAtom(aiChatPresetMessageAtom);
  // Save error surfaced to the PutawayPanel so the user sees why save failed
  const [saveError, setSaveError] = useState<string | null>(null);

  // AI highlight takes precedence over local hover highlight
  const highlightedLocationId = aiPutawayHighlight?.storageLocationId ?? localHighlight;

  const { data: warehouseQueryData, isLoading: isLoadingWarehouse } = useQuery({
    queryKey: ['warehouseDetail', id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.warehouse.warehouse.detail.query({ id: id ?? '' }),
  });
  const warehouse = warehouseQueryData as WarehouseDetail | undefined;

  const showGrid = false;

  const agingCounts = useMemo(() => {
    const counts = { active: 0, slow_moving: 0, dead_stock: 0, no_data: 0 };
    for (const d of Object.values(palletAgingMap)) {
      if (d.agingCategory in counts) {
        counts[d.agingCategory as keyof typeof counts] += 1;
      }
    }
    return counts;
  }, [palletAgingMap]);

  const [detailModal, setDetailModal] = useState<{ x: number; y: number; info: PalletInteractionInfo } | null>(null);
  const [activeSidePanel, setActiveSidePanel] = useState<'putaway' | 'dispatch' | null>(null);
  const putawayMode = activeSidePanel === 'putaway';
  const [selectedPallet, setSelectedPallet] = useState<SelectedPalletInfo | null>(null);
  const [activePutawayTransactionId, setActivePutawayTransactionId] = useState<string | null>(null);
  const [activePutawayTransactionType, setActivePutawayTransactionType] = useState<string | null>(null);
  // Staged putaway assignments: palletId → storageLocationId. Locally staged
  // but NOT yet persisted. The user clicks Save to commit the whole batch.
  const [stagedAssignments, setStagedAssignments] = useState<Map<string, string>>(() => new Map());
  const [activeDispatchTransactionId, setActiveDispatchTransactionId] = useState<string | null>(null);
  const [activeDispatchTransactionType, setActiveDispatchTransactionType] = useState<string | null>(null);

  // ── Dispatch 3D-driven state ───────────────────────────────────────────────
  const [dispatchSelections, setDispatchSelections] = useState<DispatchSelectionMap>(() => new Map());
  const [dispatchActiveItemId, setDispatchActiveItemId] = useState<string | null>(null);
  const [dispatchActivePalletTypeObjectId, setDispatchActivePalletTypeObjectId] = useState<string | null>(null);
  const [dispatchStage, setDispatchStage] = useState<'idle' | 'confirm' | 'loading' | 'success' | 'error'>('idle');
  const [dispatchError, setDispatchError] = useState('');
  const intl = useIntl();

  // Outbound transaction list for the dispatch panel selector
  const { data: outboundTxnList, isLoading: outboundTxnLoading } = useQuery<{ data: OutboundTxnListItem[] }>({
    queryKey: ['transactionDispatchList', 'APPROVED', 'dispatch-panel'],
    enabled: activeSidePanel === 'dispatch',
    queryFn: () =>
      trpcClient.transaction.dispatch.list.query({
        approvalStatus: 'APPROVED',
        dispatchOpenStatus: 'OPEN',
        limit: 50,
      }) as Promise<{ data: OutboundTxnListItem[] }>,
  });
  const pendingDispatchTxns = outboundTxnList?.data ?? [];
  const allDispatchDone = !outboundTxnLoading && Boolean(outboundTxnList) && pendingDispatchTxns.length === 0;

  // Putaway transaction list (page scope) — used to resolve the selected
  // transaction's type for the unified transaction.putaway.* calls.
  const { data: putawayTxnList } = useQuery<{ data: Array<{ id: string; reference: string | null; putawayStatus: 'PENDING' | 'PARTIAL' | 'COMPLETED'; transactionType: string }> }>({
    queryKey: ['transactionPutawayList', id, 'APPROVED'],
    enabled: activeSidePanel === 'putaway' && Boolean(id),
    queryFn: () =>
      trpcClient.transaction.putaway.list.query({
        warehouseId: id ?? '',
        approvalStatus: 'APPROVED',
        limit: 50,
      }) as Promise<{ data: Array<{ id: string; reference: string | null; putawayStatus: 'PENDING' | 'PARTIAL' | 'COMPLETED'; transactionType: string }> }>,
  });
  const pendingPutawayTxns = (putawayTxnList?.data ?? []).filter((t) => t.putawayStatus !== 'COMPLETED');

  // Dispatch assignment data for the selected transaction
  const { data: dispatchAssignmentData, isLoading: dispatchAssignmentLoading } = useQuery<DispatchData>({
    queryKey: ['dispatchAssignmentData', activeDispatchTransactionId],
    enabled: Boolean(activeDispatchTransactionId) && Boolean(activeDispatchTransactionType),
    queryFn: () =>
      trpcClient.transaction.dispatch.getAssignmentData.query({
        transactionType: activeDispatchTransactionType!,
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
      return trpcClient.transaction.dispatch.submitAssignment.mutate({
        transactionType: activeDispatchTransactionType!,
        outboundTransactionId: activeDispatchTransactionId!,
        assignments: flatAssignments,
      });
    },
    onSuccess: () => {
      setDispatchStage('success');
      queryClient.invalidateQueries({ queryKey: ['transactionDispatchList'] });
      queryClient.invalidateQueries({ queryKey: ['outboundTransactionDetail', activeDispatchTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['transactionDispatchList', 'APPROVED', 'dispatch-panel'] });
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
    setStagedAssignments(new Map());
    if (activePutawayTransactionId) {
      queryClient.invalidateQueries({ queryKey: ['putawayAssignmentData', activePutawayTransactionId] });
      setActivePutawayTransactionId(null);
      setActivePutawayTransactionType(null);
    }
    if (id) {
      queryClient.invalidateQueries({ queryKey: ['warehouseLayoutScene', id] });
    }
  };

  const handleCloseDispatch = () => {
    setActiveSidePanel(null);
    setActiveDispatchTransactionId(null);
    setActiveDispatchTransactionType(null);
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
   * Putaway assignment mutation (batch commit).
   * The backend replaces ALL assignments for a transaction on each call,
   * so we merge existing already-saved pairs + newly staged pairs into the
   * final payload. Called only when the user clicks Save in the PutawayPanel.
   */
  const assignMutation = useMutation({
    mutationFn: (vars: { transactionType: string; inboundTransactionId: string; assignments: Array<{ palletId: string; storageLocationId: string }> }) => {
      console.log('[Putaway] submitAssignment', vars);
      setSaveError(null);
      return trpcClient.transaction.putaway.submitAssignment.mutate(vars);
    },
    onSuccess: (_, vars) => {
      console.log('[Putaway] save success', vars);
      queryClient.invalidateQueries({ queryKey: ['warehouseLayoutScene', id] });
      queryClient.invalidateQueries({ queryKey: ['putawayAssignmentData', vars.inboundTransactionId] });
      setSelectedPallet(null);
      setStagedAssignments(new Map());
    },
    onError: (err, vars) => {
      console.error('[Putaway] save error', err, vars);
      const msg = err instanceof Error ? err.message : 'Failed to save assignments';
      setSaveError(msg);
    },
  });

  /**
   * Stage a pallet→location assignment locally (no server call).
   * Called when the user clicks an empty location in the 3D view while a
   * pallet is selected. The assignment shows up as a green "staged" card in
   * the panel and is only persisted when the user clicks Save.
   */
  const handleEmptyLocationClick = (storageLocationId: string) => {
    if (!selectedPallet || assignMutation.isPending) return;
    setStagedAssignments((prev) => {
      const next = new Map(prev);
      next.set(selectedPallet.palletId, storageLocationId);
      return next;
    });
    setSelectedPallet(null);
    if (localHighlight) setLocalHighlight(null);
  };

  /** Un-stage a single pallet assignment (user clicked the staged card to undo). */
  const handleUnstageAssignment = (palletId: string) => {
    setStagedAssignments((prev) => {
      const next = new Map(prev);
      next.delete(palletId);
      return next;
    });
  };

  /**
   * Commit all staged assignments to the server. Merges staged pairs with
   * existing already-saved pairs (the backend replaces ALL assignments on
   * each call) and runs the submitPalletAssignment mutation in one batch.
   */
  const handleSaveAssignments = () => {
    console.log('[Putaway] handleSaveAssignments called', {
      activePutawayTransactionId,
      stagedSize: stagedAssignments.size,
      stagedEntries: Array.from(stagedAssignments.entries()),
    });
    if (!activePutawayTransactionId || stagedAssignments.size === 0) {
      console.warn('[Putaway] save skipped — no transaction or no staged assignments');
      return;
    }
    const cached = queryClient.getQueryData<AssignmentData>([
      'putawayAssignmentData',
      activePutawayTransactionId,
    ]);
    console.log('[Putaway] cached assignment data', cached);
    const stagedPalletIds = new Set(stagedAssignments.keys());
    const existingPairs = (cached?.allPallets ?? [])
      .filter((p) => p.storageLocationId && !stagedPalletIds.has(p.palletId))
      .map((p) => ({ palletId: p.palletId, storageLocationId: p.storageLocationId! }));
    const stagedPairs = Array.from(stagedAssignments.entries()).map(([palletId, storageLocationId]) => ({
      palletId,
      storageLocationId,
    }));
    const payload = {
      transactionType: activePutawayTransactionType!,
      inboundTransactionId: activePutawayTransactionId,
      assignments: [...existingPairs, ...stagedPairs],
    };
    console.log('[Putaway] mutating with payload', payload);
    assignMutation.mutate(payload);
  };

  /**
   * Stage AI-proposed assignments locally (no server call). The user reviews
   * them in the panel and clicks Save to commit — same flow as manual staging.
   */
  const handleStageProposals = (
    assignments: Array<{ palletId: string; storageLocationId: string }>,
  ) => {
    setStagedAssignments((prev) => {
      const next = new Map(prev);
      for (const a of assignments) next.set(a.palletId, a.storageLocationId);
      return next;
    });
  };

  // ── AI chat → putaway control effects ────────────────────────────────────
  // Each atom is written by the AiAssistant tool handlers; these effects apply
  // the action to local state. Written-value-as-trigger pattern: the component
  // reads the atom value and reacts.

  // selectPutawayPallet → open putaway panel + select the pallet
  useEffect(() => {
    if (!aiPutawaySelection) return;
    setActiveSidePanel('putaway');
    setActivePutawayTransactionId(aiPutawaySelection.inboundTransactionId);
    setSelectedPallet({
      palletId: aiPutawaySelection.palletId,
      inboundTransactionId: aiPutawaySelection.inboundTransactionId,
    });
  }, [aiPutawaySelection]);

  // selectPutawayTransaction → open putaway panel + select the transaction
  useEffect(() => {
    if (!aiPutawaySelectTransaction) return;
    setActiveSidePanel('putaway');
    setActivePutawayTransactionId(aiPutawaySelectTransaction.inboundTransactionId);
    setStagedAssignments(new Map());
  }, [aiPutawaySelectTransaction]);

  // stagePutawayAssignment → stage one or more pallet→location pairs locally
  useEffect(() => {
    if (!aiPutawayStage) return;
    handleStageProposals(aiPutawayStage.assignments);
  }, [aiPutawayStage]);

  // unstagePutawayAssignment → remove a single pallet from staging
  useEffect(() => {
    if (!aiPutawayUnstage) return;
    handleUnstageAssignment(aiPutawayUnstage.palletId);
  }, [aiPutawayUnstage]);

  // savePutawayAssignments → commit all staged assignments to the server
  useEffect(() => {
    if (aiPutawaySave === null) return;
    handleSaveAssignments();
  }, [aiPutawaySave]);

  // ── Dispatch AI atom → local state bridge (mirrors putaway pattern) ────────
  // selectDispatchItem → open dispatch panel + select the item
  useEffect(() => {
    if (!aiDispatchSelection) return;
    setActiveSidePanel('dispatch');
    setActiveDispatchTransactionId(aiDispatchSelection.transactionId);
    setDispatchActiveItemId(aiDispatchSelection.itemId);
  }, [aiDispatchSelection]);

  // selectDispatchTransaction → open dispatch panel + select the transaction
  useEffect(() => {
    if (!aiDispatchSelectTransaction) return;
    setActiveSidePanel('dispatch');
    setActiveDispatchTransactionId(aiDispatchSelectTransaction.transactionId);
    setDispatchSelections(new Map());
  }, [aiDispatchSelectTransaction]);

  // stagePickAssignment → stage one or more item→pallet picks locally
  useEffect(() => {
    if (!aiDispatchStage) return;
    setDispatchSelections((prev) => {
      const next = new Map(prev);
      for (const { outboundTransactionItemId, palletId } of aiDispatchStage.assignments) {
        if (!next.has(outboundTransactionItemId)) {
          next.set(outboundTransactionItemId, new Set());
        }
        next.get(outboundTransactionItemId)!.add(palletId);
      }
      return next;
    });
  }, [aiDispatchStage]);

  // unstagePickAssignment → remove a single pallet from staging
  useEffect(() => {
    if (!aiDispatchUnstage) return;
    setDispatchSelections((prev) => {
      const next = new Map(prev);
      for (const [itemId, palletSet] of next.entries()) {
        if (palletSet.has(aiDispatchUnstage.palletId)) {
          palletSet.delete(aiDispatchUnstage.palletId);
          if (palletSet.size === 0) next.delete(itemId);
        }
      }
      return next;
    });
  }, [aiDispatchUnstage]);

  // savePickAssignments → commit all staged picks to the server
  useEffect(() => {
    if (aiDispatchSave === null) return;
    dispatchMutation.mutate();
  }, [aiDispatchSave, dispatchMutation]);

  // Handler for the "AI Assist" button in the PutawayPanel — opens the chat
  // with a putaway-focused preset message so the LLM starts the workflow.
  const handleAiAssist = () => {
    const txnId = activePutawayTransactionId ?? '';
    const preset = txnId
      ? `Help me putaway the unassigned pallets for inbound transaction ${txnId}. Read the page context, recommend the best storage location for each pallet, stage the assignments, then save them.`
      : `Help me putaway pallets in this warehouse. First read the page context to find which inbound transactions need putaway, then select one and recommend locations for each pallet.`;
    setAiChatPresetMessage(preset);
    setAiChatOpen(true);
  };

  if (isLoadingWarehouse || !warehouse) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 120px)' }}>
        <Spinner />
      </div>
    );
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', gap: 12 }}
      data-ai-context={JSON.stringify({
        section: 'warehouse-layout',
        warehouseId: warehouse?.id ?? null,
        warehouseName: warehouse?.name ?? null,
        activeSidePanel,
        putawayMode,
        canAssign,
        canDispatch,
      })}
    >
      {/* Toolbar row */}
      <PageHeader
        title={warehouse.name}
        onBack={() => navigate('/warehouse')}
      >
        {(canAssign || canDispatch) && (
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
        <Button
          variant={agingMode ? 'primary' : 'tertiary'}
          onPress={() => setAgingMode((prev) => !prev)}
        >
          <Icon icon="solar:clock-circle-bold-duotone" style={{ width: 16, height: 16 }} />
          {intl.formatMessage({ id: 'warehouse.layout.aging_mode', defaultMessage: 'Aging mode' })}
        </Button>
      </PageHeader>

      {/* Scene row: canvas (flex 7) + side panel (flex 3) */}
      <div style={{ display: 'flex', flex: 1, gap: 12, minHeight: 0 }}>
        {/* Canvas column — shrinks when a panel is open */}
        <div style={{ flex: activeSidePanel ? 7 : 1, minWidth: 0, transition: 'flex 0.3s ease', display: 'flex', flexDirection: 'column' }}>
          <Card style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Card.Content style={{ flex: 1, padding: 0 }}>
              <WarehouseScene
                showGrid={showGrid}
                warehouseId={id}
                putawayMode={putawayMode}
                selectedPalletId={selectedPallet?.palletId ?? null}
                highlightedLocationId={highlightedLocationId}
                stagedAssignments={stagedAssignments}
                onEmptyLocationClick={handleEmptyLocationClick}
                dispatchActivePalletTypeObjectIds={dispatchActivePalletTypeObjectIds}
                agingMode={agingMode}
                onAgingMapChange={handleAgingMapChange}
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
            {agingMode && (
              <Card.Content className="flex flex-wrap items-center gap-3 border-t border-default-100">
                <Legend legend={intl.formatMessage({ id: 'warehouse.layout.aging_mode', defaultMessage: 'Aging mode' })} />
                <LegendItem
                  color={AGING_CATEGORY_COLORS.active}
                  label={intl.formatMessage({ id: 'warehouse.layout.aging_legend_active', defaultMessage: 'Active (< 30 days)' })}
                  value={agingCounts.active}
                />
                <LegendItem
                  color={AGING_CATEGORY_COLORS.slow_moving}
                  label={intl.formatMessage({ id: 'warehouse.layout.aging_legend_slow_moving', defaultMessage: 'Slow Moving (30-180 days)' })}
                  value={agingCounts.slow_moving}
                />
                <LegendItem
                  color={AGING_CATEGORY_COLORS.dead_stock}
                  label={intl.formatMessage({ id: 'warehouse.layout.aging_legend_dead_stock', defaultMessage: 'Dead Stock (> 180 days)' })}
                  value={agingCounts.dead_stock}
                />
                <LegendItem
                  color={AGING_CATEGORY_COLORS.no_data}
                  label={intl.formatMessage({ id: 'warehouse.layout.aging_legend_no_data', defaultMessage: 'No movement data' })}
                  value={agingCounts.no_data}
                />
              </Card.Content>
            )}
          </Card>
        </div>

        {/* Side panel column — only rendered when a panel is active */}
        {activeSidePanel && (
          <div style={{ flex: 3, minWidth: 280, maxWidth: 420, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {activeSidePanel === 'putaway' && id && (
              <PutawayPanel
                warehouseId={id}
                selectedTransactionId={activePutawayTransactionId}
                transactionType={activePutawayTransactionType}
                onTransactionChange={(txnId) => {
                  setActivePutawayTransactionId(txnId);
                  setActivePutawayTransactionType(
                    txnId ? (pendingPutawayTxns.find((t) => t.id === txnId)?.transactionType ?? null) : null,
                  );
                  setStagedAssignments(new Map());
                }}
                selectedPalletId={selectedPallet?.palletId ?? null}
                onPalletSelect={setSelectedPallet}
                onClose={handleClosePutaway}
                onAiAssist={handleAiAssist}
                onHighlightLocation={setLocalHighlight}
                stagedAssignments={stagedAssignments}
                onUnstageAssignment={handleUnstageAssignment}
                onSaveAssignments={handleSaveAssignments}
                isSaving={assignMutation.isPending}
                saveError={saveError}
                onDismissSaveError={() => setSaveError(null)}
              />
            )}
            {activeSidePanel === 'dispatch' && (
              <DispatchPanel
                selectedTransactionId={activeDispatchTransactionId}
                onTransactionChange={(id) => {
                  setActiveDispatchTransactionId(id);
                  setActiveDispatchTransactionType(
                    id ? (pendingDispatchTxns.find((t) => t.id === id)?.transactionType ?? null) : null,
                  );
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

function LegendItem({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="flex items-center gap-2 text-xs text-muted">
      <span className="size-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <span>{label}</span>
      <span className="font-mono text-foreground">{value}</span>
    </span>
  );
}

function Legend({ legend }: { legend: string }) {
  return <span className="text-xs font-semibold text-foreground">{legend}</span>;
}

export { WarehouseLayoutPage };
