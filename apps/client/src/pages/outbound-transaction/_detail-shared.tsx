/**
 * Shared detail-page building blocks for OUTBOUND transactions.
 *
 * The presentational components (HeroSummaryCard, KpiCard, TransactionItemsTable,
 * AuditTrail, CalloutCard, DetailSkeleton, ActionModal, MetaItem, numQty, status
 * color maps) live in the inbound sibling `_detail-shared.tsx` and are re-exported
 * here so both inbound and outbound detail pages stay visually consistent without
 * duplicating component code.
 *
 * This file additionally provides:
 *  - `HERO_GRADIENTS`: distinct tints per outbound domain.
 *  - `useTransactionDetailActions`: approve / reject / delete hook typed for the
 *    five outbound tRPC resources.
 */

export {
  ActionModal,
  AuditTrail,
  CalloutCard,
  DetailSkeleton,
  HeroSummaryCard,
  KpiCard,
  MetaItem,
  TransactionItemsTable,
  numQty,
  APPROVAL_COLOR,
  PUTAWAY_COLOR,
  resolveStatusColor,
  type ActionKind,
  type ActionModalMessages,
  type AuditTrailMessages,
  type DetailItemRow,
  type ItemsTableMessages,
} from '../inbound-transaction/_detail-shared';

import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { trpcClient } from '../../lib/trpc';
import type { ActionKind } from '../inbound-transaction/_detail-shared';

// ─── Hero gradient per outbound domain ───────────────────────────────────────

export const HERO_GRADIENTS: Record<string, string> = {
  shipment:
    'bg-[linear-gradient(160deg,rgba(2,132,199,0.12)_0%,rgba(14,165,233,0.06)_30%,rgba(255,255,255,0.98)_65%)] dark:bg-[linear-gradient(160deg,rgba(2,132,199,0.24)_0%,rgba(14,165,233,0.10)_30%,rgba(39,39,42,0.96)_65%)]',
  wipIssue:
    'bg-[linear-gradient(160deg,rgba(217,119,6,0.12)_0%,rgba(245,158,11,0.06)_30%,rgba(255,255,255,0.98)_65%)] dark:bg-[linear-gradient(160deg,rgba(217,119,6,0.24)_0%,rgba(245,158,11,0.10)_30%,rgba(39,39,42,0.96)_65%)]',
  returnToSupplier:
    'bg-[linear-gradient(160deg,rgba(124,58,237,0.12)_0%,rgba(167,139,250,0.06)_30%,rgba(255,255,255,0.98)_65%)] dark:bg-[linear-gradient(160deg,rgba(124,58,237,0.24)_0%,rgba(167,139,250,0.10)_30%,rgba(39,39,42,0.96)_65%)]',
  disposal:
    'bg-[linear-gradient(160deg,rgba(220,38,38,0.12)_0%,rgba(248,113,113,0.06)_30%,rgba(255,255,255,0.98)_65%)] dark:bg-[linear-gradient(160deg,rgba(220,38,38,0.24)_0%,rgba(248,113,113,0.10)_30%,rgba(39,39,42,0.96)_65%)]',
  loss:
    'bg-[linear-gradient(160deg,rgba(100,116,139,0.14)_0%,rgba(148,163,184,0.07)_30%,rgba(255,255,255,0.98)_65%)] dark:bg-[linear-gradient(160deg,rgba(100,116,139,0.26)_0%,rgba(148,163,184,0.12)_30%,rgba(39,39,42,0.96)_65%)]',
};

// ─── Shared approve / reject / delete actions ────────────────────────────────

export type OutboundResource =
  | 'shipment'
  | 'wipIssue'
  | 'returnToSupplier'
  | 'disposal'
  | 'lossTransaction';

export const useTransactionDetailActions = ({
  resource,
  id,
  detailQueryKey,
  listQueryKey,
  backPath,
}: {
  resource: OutboundResource;
  id?: string;
  detailQueryKey: string;
  listQueryKey: string;
  backPath: string;
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionModal, setActionModal] = useState<{ kind: ActionKind; message: string } | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: [detailQueryKey, id] });
    queryClient.invalidateQueries({ queryKey: [listQueryKey] });
  };

  const approveMutation = useMutation({
    mutationFn: (input: { id: string; message?: string }) =>
      trpcClient[resource].approve.mutate(input) as Promise<unknown>,
    onSuccess: () => {
      invalidateAll();
      setActionModal(null);
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: (input: { id: string; message?: string }) =>
      trpcClient[resource].reject.mutate(input) as Promise<unknown>,
    onSuccess: () => {
      invalidateAll();
      setActionModal(null);
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (input: { id: string }) => trpcClient[resource].delete.mutate(input) as Promise<unknown>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [listQueryKey] });
      queryClient.removeQueries({ queryKey: [detailQueryKey, id] });
      navigate(backPath);
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const handleConfirm = async () => {
    if (!actionModal || !id) return;
    setIsActing(true);
    setActionError(null);
    try {
      if (actionModal.kind === 'approve') {
        await approveMutation.mutateAsync({ id, message: actionModal.message || undefined });
      }
      if (actionModal.kind === 'reject') {
        await rejectMutation.mutateAsync({ id, message: actionModal.message || undefined });
      }
      if (actionModal.kind === 'delete') {
        await deleteMutation.mutateAsync({ id });
      }
    } finally {
      setIsActing(false);
    }
  };

  return { actionModal, setActionModal, isActing, actionError, setActionError, handleConfirm };
};
