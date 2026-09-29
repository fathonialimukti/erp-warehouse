import { useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Chip,
  Fieldset,
  FieldsetLegend,
  FieldGroup,
  Label,
  Modal,
  Separator,
  Skeleton,
  Table,
  TextArea,
  TextField,
} from "@heroui/react";
import type { ChipProps } from "@heroui/react";
import {
  CheckCircleIcon,
  CloseCircleIcon,
  PenIcon,
  PutawayIcon,
  SpinnerIcon,
  TrashIcon,
} from "../../assets/IconRegistry";
import { trpcClient } from "../../lib/trpc";
import { numQty } from "../../lib/transaction-document";
import { ApprovalHistory } from "../../components/ApprovalHistory";

// ─── Status color maps ───────────────────────────────────────────────────────

export const APPROVAL_COLOR: Record<string, ChipProps["color"]> = {
  DRAFT: "default",
  PROPOSED: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export const PUTAWAY_COLOR: Record<string, ChipProps["color"]> = {
  PENDING: "default",
  PARTIAL: "warning",
  COMPLETED: "success",
};

export const resolveStatusColor = (
  map: Record<string, ChipProps["color"]>,
  status: string,
): ChipProps["color"] => map[status] ?? "default";

// ─── Quantity helper — canonical copy lives in lib/transaction-document ──────

export { numQty };

// ─── Hero gradient per inbound domain ────────────────────────────────────────

export const HERO_GRADIENTS: Record<string, string> = {
  found:
    "bg-[linear-gradient(160deg,rgba(217,119,6,0.12)_0%,rgba(245,158,11,0.06)_30%,rgba(255,255,255,0.98)_65%)] dark:bg-[linear-gradient(160deg,rgba(217,119,6,0.24)_0%,rgba(245,158,11,0.10)_30%,rgba(39,39,42,0.96)_65%)]",
  rmaReceipt:
    "bg-[linear-gradient(160deg,rgba(124,58,237,0.12)_0%,rgba(167,139,250,0.06)_30%,rgba(255,255,255,0.98)_65%)] dark:bg-[linear-gradient(160deg,rgba(124,58,237,0.24)_0%,rgba(167,139,250,0.10)_30%,rgba(39,39,42,0.96)_65%)]",
  wipCompletion:
    "bg-[linear-gradient(160deg,rgba(5,150,105,0.12)_0%,rgba(16,185,129,0.06)_30%,rgba(255,255,255,0.98)_65%)] dark:bg-[linear-gradient(160deg,rgba(5,150,105,0.24)_0%,rgba(16,185,129,0.10)_30%,rgba(39,39,42,0.96)_65%)]",
};

// ─── Small presentational helpers ────────────────────────────────────────────

export const MetaItem = ({
  icon,
  label,
  value,
  mono,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  mono?: boolean;
}) => (
  <div className="flex flex-col gap-1">
    <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
      {icon}
      {label}
    </span>
    <span
      className={
        mono ? "font-mono text-sm text-foreground" : "text-sm text-foreground"
      }
    >
      {value ?? "—"}
    </span>
  </div>
);

export const KpiCard = ({
  icon,
  label,
  value,
  hint,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
  color?: ChipProps["color"];
}) => (
  <Card variant="secondary" className="overflow-hidden">
    <Card.Content className="flex items-center gap-4 p-4">
      <div
        className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
          color ? `text-${color} bg-${color}/10` : "bg-accent/10 text-accent"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          {label}
        </p>
        <p className="mt-0.5 text-xl font-semibold text-foreground">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      </div>
    </Card.Content>
  </Card>
);

// ─── Loading skeleton ────────────────────────────────────────────────────────

export const DetailSkeleton = () => (
  <section className="space-y-6">
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-64 rounded-lg" />
      <Skeleton className="h-9 w-40 rounded-lg" />
    </div>
    <Card className="overflow-hidden">
      <Card.Content className="space-y-4 p-6">
        <Skeleton className="h-6 w-48 rounded" />
        <Skeleton className="h-4 w-72 rounded" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </Card.Content>
    </Card>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} className="h-64 rounded-2xl" />
      ))}
    </div>
    <Skeleton className="h-80 rounded-2xl" />
  </section>
);

// ─── Hero summary card ───────────────────────────────────────────────────────

export const HeroSummaryCard = ({
  gradientClass,
  title,
  subtitle,
  statusChips,
  actions,
  metaItems,
}: {
  gradientClass: string;
  title: string;
  subtitle: string;
  statusChips: ReactNode;
  actions: ReactNode;
  metaItems: ReactNode;
}) => (
  <Card
    className={`overflow-hidden rounded-3xl border border-border/70 p-5 shadow-[0_20px_50px_rgba(3,105,161,0.10)] lg:p-7 ${gradientClass}`}
  >
    <Card.Content className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">{statusChips}</div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h2>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>
      <Separator />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{metaItems}</div>
    </Card.Content>
  </Card>
);

// ─── Items table ─────────────────────────────────────────────────────────────

export interface DetailItemRow {
  id: string;
  sku?: { code?: string | null; name: string } | null;
  quantity: number | { toNumber(): number } | unknown;
  details?: string | null;
}

// ─── Callout card (domain-specific highlight strip) ──────────────────────────

export const CalloutCard = ({
  icon,
  tone = "accent",
  title,
  description,
  children,
}: {
  icon?: ReactNode;
  tone?: "accent" | "success" | "warning" | "danger" | "default";
  title: string;
  description?: string;
  children?: ReactNode;
}) => {
  const toneBg: Record<string, string> = {
    accent: "bg-accent/10 text-accent",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-danger/10 text-danger",
    default: "bg-default/10 text-muted",
  };
  return (
    <Card variant="secondary" className="overflow-hidden">
      <Card.Content className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          {icon ? (
            <div
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${toneBg[tone]}`}
            >
              {icon}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {description ? (
              <p className="mt-0.5 text-xs text-muted">{description}</p>
            ) : null}
          </div>
        </div>
        {children ? <div className="pl-12">{children}</div> : null}
      </Card.Content>
    </Card>
  );
};

export interface ItemsTableMessages {
  sectionTitle: string;
  sectionDesc: string;
  skuCode: string;
  skuName: string;
  qty: string;
  details: string;
  total: string;
  empty: string;
}

export const TransactionItemsTable = ({
  items,
  totalQuantity,
  messages,
  actions,
}: {
  items: DetailItemRow[];
  totalQuantity: number;
  messages: ItemsTableMessages;
  /** Optional header actions (e.g. QR download button). */
  actions?: ReactNode;
}) => (
  <Card>
    <Card.Header>
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div>
            <Card.Title>{messages.sectionTitle}</Card.Title>
            <Card.Description>{messages.sectionDesc}</Card.Description>
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </Card.Header>
    <Card.Content>
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label={messages.sectionTitle}>
            <Table.Header>
              <Table.Column isRowHeader>
                <span className="text-xs font-semibold">#</span>
              </Table.Column>
              <Table.Column>
                <span className="text-xs font-semibold">
                  {messages.skuCode}
                </span>
              </Table.Column>
              <Table.Column>
                <span className="text-xs font-semibold">
                  {messages.skuName}
                </span>
              </Table.Column>
              <Table.Column>
                <span className="text-xs font-semibold">{messages.qty}</span>
              </Table.Column>
              <Table.Column>
                <span className="text-xs font-semibold">
                  {messages.details}
                </span>
              </Table.Column>
            </Table.Header>
            <Table.Body
              renderEmptyState={() => (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <span className="text-sm text-muted">{messages.empty}</span>
                </div>
              )}
            >
              {items.map((item, index) => (
                <Table.Row key={item.id} id={item.id}>
                  <Table.Cell>
                    <span className="font-mono text-sm text-muted">
                      {index + 1}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="font-mono text-sm text-foreground">
                      {item.sku?.code ?? "—"}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-sm text-foreground">
                      {item.sku?.name ?? "—"}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="font-semibold text-foreground">
                      {numQty(item.quantity).toLocaleString()}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-sm text-muted">
                      {item.details || "—"}
                    </span>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
            <Table.Footer>
              <Table.Row>
                <Table.Cell />
                <Table.Cell />
                <Table.Cell>
                  <span className="text-xs font-semibold text-muted">
                    {messages.total}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <span className="font-semibold text-foreground">
                    {totalQuantity.toLocaleString()}
                  </span>
                </Table.Cell>
                <Table.Cell />
              </Table.Row>
            </Table.Footer>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </Card.Content>
  </Card>
);

// ─── Audit trail ─────────────────────────────────────────────────────────────

export interface AuditTrailMessages {
  sectionTitle: string;
  sectionDesc: string;
  createdBy: string;
  createdAt: string;
  approvedBy: string;
  approvedAt: string;
  putawayStatus: string;
}

export const AuditTrail = ({
  messages,
  createdBy,
  createdAt,
  approvedBy,
  approvedAt,
  putawayStatus,
  putawayLabel,
  putawayColor,
  approvalHistory,
}: {
  messages: AuditTrailMessages;
  createdBy?: string | null;
  createdAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  putawayStatus: string;
  putawayLabel: string;
  putawayColor: ChipProps["color"];
  approvalHistory?: unknown;
}) => (
  <Fieldset>
    <FieldsetLegend>
      <div className="flex items-center gap-2">{messages.sectionTitle}</div>
    </FieldsetLegend>
    <FieldGroup>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetaItem label={messages.createdBy} value={createdBy ?? "—"} />
        <MetaItem label={messages.createdAt} value={createdAt ?? "—"} />
        <MetaItem label={messages.approvedBy} value={approvedBy ?? "—"} />
        <MetaItem label={messages.approvedAt} value={approvedAt ?? "—"} />
        <MetaItem
          label={messages.putawayStatus}
          value={
            <Chip color={putawayColor} variant="soft" size="sm">
              {putawayLabel}
            </Chip>
          }
        />
        <MetaItem label={putawayStatus} value={putawayStatus} />
      </div>
      <div className="flex justify-end">
        <ApprovalHistory approvalHistory={approvalHistory} />
      </div>
    </FieldGroup>
  </Fieldset>
);

// ─── Action modal (approve / reject / delete) ────────────────────────────────

export type ActionKind = "approve" | "reject" | "delete";

export interface ActionModalMessages {
  processing: string;
  pleaseWait: string;
  errorTitle: string;
  close: string;
  approveTitle: string;
  rejectTitle: string;
  deleteTitle: string;
  approveDesc: string;
  rejectDesc: string;
  deleteBody: string;
  messageLabel: string;
  messagePlaceholder: string;
  cancel: string;
  approve: string;
  reject: string;
  deleteConfirm: string;
}

export const ActionModal = ({
  isOpen,
  isActing,
  actionError,
  kind,
  message,
  onMessageChange,
  onClose,
  onConfirm,
  messages,
}: {
  isOpen: boolean;
  isActing: boolean;
  actionError: string | null;
  kind: ActionKind | null;
  message: string;
  onMessageChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  messages: ActionModalMessages;
}) => (
  <Modal>
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !isActing) onClose();
      }}
      isDismissable={!isActing}
      isKeyboardDismissDisabled={isActing}
    >
      <Modal.Container size="sm">
        <Modal.Dialog>
          {isActing ? (
            <>
              <Modal.Header>
                <Modal.Heading>{messages.processing}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col items-center gap-4 py-8">
                <SpinnerIcon size={32} className="animate-spin text-accent" />
                <p className="text-sm text-muted">{messages.pleaseWait}</p>
              </Modal.Body>
            </>
          ) : actionError ? (
            <>
              <Modal.Header>
                <Modal.Icon>
                  <CloseCircleIcon size={48} className="text-danger" />
                </Modal.Icon>
                <Modal.Heading>{messages.errorTitle}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-center text-sm text-muted">{actionError}</p>
              </Modal.Body>
              <Modal.Footer>
                <Button onPress={onClose}>{messages.close}</Button>
              </Modal.Footer>
            </>
          ) : (
            <>
              <Modal.Header>
                <Modal.Icon>
                  {kind === "approve" ? (
                    <CheckCircleIcon size={40} className="text-success" />
                  ) : kind === "reject" ? (
                    <CloseCircleIcon size={40} className="text-danger" />
                  ) : (
                    <TrashIcon size={40} className="text-danger" />
                  )}
                </Modal.Icon>
                <Modal.Heading>
                  {kind === "approve"
                    ? messages.approveTitle
                    : kind === "reject"
                      ? messages.rejectTitle
                      : messages.deleteTitle}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-4">
                <p className="text-sm text-muted">
                  {kind === "approve"
                    ? messages.approveDesc
                    : kind === "reject"
                      ? messages.rejectDesc
                      : messages.deleteBody}
                </p>
                {(kind === "approve" || kind === "reject") && (
                  <TextField fullWidth>
                    <Label>{messages.messageLabel}</Label>
                    <TextArea
                      rows={3}
                      variant="secondary"
                      value={message}
                      onChange={(e) => onMessageChange(e.target.value)}
                      placeholder={messages.messagePlaceholder}
                    />
                  </TextField>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={onClose}>
                  {messages.cancel}
                </Button>
                <Button
                  variant={kind === "approve" ? "primary" : "danger"}
                  onPress={onConfirm}
                >
                  {kind === "approve"
                    ? messages.approve
                    : kind === "reject"
                      ? messages.reject
                      : messages.deleteConfirm}
                </Button>
              </Modal.Footer>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  </Modal>
);

// ─── Shared approve / reject / delete actions ────────────────────────────────

export type InboundResource =
  "foundTransaction" | "rmaReceipt" | "wipCompletion";

export const useTransactionDetailActions = ({
  resource,
  id,
  detailQueryKey,
  listQueryKey,
  backPath,
}: {
  resource: InboundResource;
  id?: string;
  detailQueryKey: string;
  listQueryKey: string;
  backPath: string;
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionModal, setActionModal] = useState<{
    kind: ActionKind;
    message: string;
  } | null>(null);
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
    mutationFn: (input: { id: string }) =>
      trpcClient[resource].delete.mutate(input) as Promise<unknown>,
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
      if (actionModal.kind === "approve") {
        await approveMutation.mutateAsync({
          id,
          message: actionModal.message || undefined,
        });
      }
      if (actionModal.kind === "reject") {
        await rejectMutation.mutateAsync({
          id,
          message: actionModal.message || undefined,
        });
      }
      if (actionModal.kind === "delete") {
        await deleteMutation.mutateAsync({ id });
      }
    } finally {
      setIsActing(false);
    }
  };

  return {
    actionModal,
    setActionModal,
    isActing,
    actionError,
    setActionError,
    handleConfirm,
  };
};

// ─── Shared Putaway button ───────────────────────────────────────────────────

export const PutawayButton = ({
  warehouseId,
  transactionId,
}: {
  warehouseId: string;
  transactionId: string;
}) => (
  <Button
    variant="tertiary"
    onPress={() => {
      window.location.href = `/warehouse/${warehouseId}/layout?inboundTransactionId=${transactionId}`;
    }}
  >
    <PutawayIcon size={16} />
    <span className="hidden md:block">Putaway</span>
  </Button>
);

export { PenIcon };
