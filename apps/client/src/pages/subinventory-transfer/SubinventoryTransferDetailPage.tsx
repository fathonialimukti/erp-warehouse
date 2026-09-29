import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { useIntl } from "react-intl";
import { useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Chip,
  Fieldset,
  FieldsetLegend,
  FieldGroup,
  Separator,
} from "@heroui/react";
import type { ChipProps } from "@heroui/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BoxIcon,
  CheckCircleIcon,
  CloseCircleIcon,
  DocumentIcon,
  LayersIcon,
  PenIcon,
  PutawayIcon,
} from "../../assets/IconRegistry";
import { trpcClient } from "../../lib/trpc";
import { hasPermissionAtom } from "../../lib/atoms";
import { PageHeader } from "../../components/PageHeader";
import {
  ActionModal,
  AuditTrail,
  CalloutCard,
  DetailSkeleton,
  HeroSummaryCard,
  HERO_GRADIENTS,
  KpiCard,
  MetaItem,
  resolveStatusColor,
  useTransactionDetailActions,
  type ActionModalMessages,
  type AuditTrailMessages,
} from "../outbound-transaction/_detail-shared";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SkuRef {
  id: string;
  code?: string | null;
  name: string;
}

interface UserRef {
  id: string;
  name?: string | null;
  email?: string | null;
}

interface WarehouseRef {
  id: string;
  name: string;
}

interface TransferItem {
  id: string;
  palletId: string;
  pallet?: {
    id: string;
    palletNumber?: string | null;
    sku?: SkuRef | null;
  } | null;
  fromLocationId: string;
  fromLocation?: { id: string } | null;
  toLocationId: string;
  toLocation?: { id: string } | null;
}

interface TransferDetail {
  id: string;
  documentNumber?: string | null;
  date: string | Date;
  transferReason?: string | null;
  reference?: string | null;
  notes?: string | null;
  warehouseId: string;
  warehouse: WarehouseRef;
  approvalStatus: string;
  approvalHistory?: unknown;
  createdById: string;
  createdBy: UserRef;
  approvedById?: string | null;
  approvedBy?: UserRef | null;
  approvedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  items: TransferItem[];
}

const APPROVAL_COLOR: Record<string, ChipProps["color"]> = {
  DRAFT: "default",
  PROPOSED: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

// ─── Main component ───────────────────────────────────────────────────────────

function SubinventoryTransferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const intl = useIntl();
  const navigate = useNavigate();
  const hasPermission = useAtomValue(hasPermissionAtom);

  const canApprove = hasPermission("subinventory-transfer@approve");
  const canUpdate = hasPermission("subinventory-transfer@update");
  const canDelete = hasPermission("subinventory-transfer@delete");

  const t = (k: string, fallback: string) =>
    intl.formatMessage({ id: k, defaultMessage: fallback });

  const { data: rawDetail, isLoading } = useQuery({
    queryKey: ["subinventoryTransferDetail", id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.subinventoryTransfer.detail.query({ id: id! }),
  });

  const detail = rawDetail as TransferDetail | undefined;

  const aggregates = useMemo(() => {
    if (!detail)
      return {
        totalPallets: 0,
        distinctSkus: 0,
        distinctFrom: 0,
        distinctTo: 0,
      };
    const skus = new Set<string>();
    const from = new Set<string>();
    const to = new Set<string>();
    for (const item of detail.items) {
      if (item.pallet?.sku?.id) skus.add(item.pallet.sku.id);
      from.add(item.fromLocationId);
      to.add(item.toLocationId);
    }
    return {
      totalPallets: detail.items.length,
      distinctSkus: skus.size,
      distinctFrom: from.size,
      distinctTo: to.size,
    };
  }, [detail]);

  const {
    actionModal,
    setActionModal,
    isActing,
    actionError,
    setActionError,
    handleConfirm,
  } = useTransactionDetailActions({
    resource: "subinventoryTransfer",
    id,
    detailQueryKey: "subinventoryTransferDetail",
    listQueryKey: "subinventoryTransferList",
    backPath: "/subinventory-transfer",
  });

  if (isLoading) return <DetailSkeleton />;

  if (!detail) {
    return (
      <section className="space-y-4">
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <BoxIcon size={32} className="text-muted" />
          <p className="text-sm text-muted">
            {t(
              "subinventory_transfer.detail_not_found",
              "Subinventory transfer not found.",
            )}
          </p>
          <Button
            variant="ghost"
            onPress={() => navigate("/subinventory-transfer")}
          >
            {t("subinventory_transfer.detail_back", "Back")}
          </Button>
        </div>
      </section>
    );
  }

  const approvalColor = resolveStatusColor(
    APPROVAL_COLOR,
    detail.approvalStatus,
  ) as ChipProps["color"];
  const isProposed = detail.approvalStatus === "PROPOSED";
  const isDraft = detail.approvalStatus === "DRAFT";
  const isRejected = detail.approvalStatus === "REJECTED";
  const isApproved = detail.approvalStatus === "APPROVED";
  const isEditable = isDraft || isRejected;
  const hasNotes = Boolean(detail.notes && detail.notes.trim());
  const formattedDate = intl.formatDate(new Date(detail.date), {
    dateStyle: "medium",
  });
  const formattedCreated = intl.formatDate(new Date(detail.createdAt), {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  });
  const formattedApproved = detail.approvedAt
    ? intl.formatDate(new Date(detail.approvedAt), {
        dateStyle: "medium",
        timeStyle: "short",
        hour12: false,
      })
    : null;

  const auditMessages: AuditTrailMessages = {
    sectionTitle: t(
      "subinventory_transfer.detail_section_audit",
      "Audit Trail",
    ),
    sectionDesc: t(
      "subinventory_transfer.detail_section_audit_desc",
      "Who created, approved, and when",
    ),
    createdBy: t("subinventory_transfer.detail_label_created_by", "Created By"),
    createdAt: t("subinventory_transfer.detail_label_created_at", "Created At"),
    approvedBy: t(
      "subinventory_transfer.detail_label_approved_by",
      "Approved By",
    ),
    approvedAt: t(
      "subinventory_transfer.detail_label_approved_at",
      "Approved At",
    ),
    putawayStatus: t(
      "subinventory_transfer.detail_label_movement_status",
      "Movement",
    ),
  };

  const actionMessages: ActionModalMessages = {
    processing: t("subinventory_transfer.processing", "Processing…"),
    pleaseWait: t("subinventory_transfer.action_please_wait", "Please wait…"),
    errorTitle: t(
      "subinventory_transfer.action_error_title",
      "Something went wrong",
    ),
    close: t("subinventory_transfer.close", "Close"),
    approveTitle: t("subinventory_transfer.confirm_approve", "Confirm Approve"),
    rejectTitle: t("subinventory_transfer.confirm_reject", "Confirm Reject"),
    deleteTitle: t(
      "subinventory_transfer.delete_modal_title",
      "Delete subinventory transfer",
    ),
    approveDesc: t(
      "subinventory_transfer.confirm_approve_desc",
      "Approve this subinventory transfer?",
    ),
    rejectDesc: t(
      "subinventory_transfer.confirm_reject_desc",
      "Reject this subinventory transfer?",
    ),
    deleteBody: intl.formatMessage({
      id: "subinventory_transfer.delete_modal_body",
      defaultMessage: "Are you sure you want to delete this record?",
    }),
    messageLabel: t("subinventory_transfer.message_label", "Message"),
    messagePlaceholder: t(
      "subinventory_transfer.message_placeholder",
      "Add a message (optional)",
    ),
    cancel: t("subinventory_transfer.cancel", "Cancel"),
    approve: t("subinventory_transfer.action_approve", "Approve"),
    reject: t("subinventory_transfer.action_reject", "Reject"),
    deleteConfirm: t("subinventory_transfer.delete_confirm", "Delete"),
  };

  return (
    <section
      className="space-y-6"
      data-ai-context={JSON.stringify({
        section: "subinventory-transfer-detail",
        id: detail.id,
        documentNumber: detail.documentNumber,
        approvalStatus: detail.approvalStatus,
        itemCount: detail.items.length,
      })}
    >
      <PageHeader
        title={detail.documentNumber ?? detail.id}
        onBack={() => navigate("/subinventory-transfer")}
        onEdit={
          isEditable && canUpdate
            ? () => navigate(`/subinventory-transfer/${detail.id}/edit`)
            : undefined
        }
        onDelete={
          isDraft && canDelete
            ? () => setActionModal({ kind: "delete", message: "" })
            : undefined
        }
      />

      {/* ── Hero summary card ─────────────────────────────────────────────── */}
      <HeroSummaryCard
        gradientClass={HERO_GRADIENTS.subinventoryTransfer}
        title={detail.documentNumber ?? detail.id}
        subtitle={t(
          "subinventory_transfer.detail_subtitle",
          "Internal pallet relocation within the warehouse",
        )}
        statusChips={
          <Chip color={approvalColor} variant="soft" size="sm">
            {detail.approvalStatus}
          </Chip>
        }
        actions={
          <>
            {isProposed && canApprove && (
              <Button
                variant="primary"
                className="bg-success hover:bg-success-hover"
                onPress={() => setActionModal({ kind: "approve", message: "" })}
              >
                <CheckCircleIcon size={16} />
                {t("subinventory_transfer.action_approve", "Approve")}
              </Button>
            )}
            {isProposed && canApprove && (
              <Button
                variant="danger-soft"
                onPress={() => setActionModal({ kind: "reject", message: "" })}
              >
                <CloseCircleIcon size={16} className="text-danger" />
                {t("subinventory_transfer.action_reject", "Reject")}
              </Button>
            )}
            {isApproved && canApprove && (
              <Button
                variant="danger-soft"
                onPress={() => setActionModal({ kind: "reject", message: "" })}
              >
                <CloseCircleIcon size={16} className="text-danger" />
                {t("subinventory_transfer.action_reject", "Reject")}
              </Button>
            )}
            {isEditable && canUpdate && (
              <Button
                variant="ghost"
                onPress={() =>
                  navigate(`/subinventory-transfer/${detail.id}/edit`)
                }
              >
                <PenIcon size={16} />
                {t("subinventory_transfer.action_edit", "Edit")}
              </Button>
            )}
          </>
        }
        metaItems={
          <>
            <MetaItem
              icon={<DocumentIcon size={13} />}
              label={t(
                "subinventory_transfer.detail_hero_document",
                "Document",
              )}
              value={detail.documentNumber ?? "—"}
              mono
            />
            <MetaItem
              icon={<BoxIcon size={13} />}
              label={t(
                "subinventory_transfer.detail_hero_warehouse",
                "Warehouse",
              )}
              value={detail.warehouse?.name ?? "—"}
            />
            <MetaItem
              icon={<DocumentIcon size={13} />}
              label={t("subinventory_transfer.detail_hero_date", "Date")}
              value={formattedDate}
            />
            <MetaItem
              icon={<LayersIcon size={13} />}
              label={t("subinventory_transfer.detail_hero_reason", "Reason")}
              value={detail.transferReason}
            />
          </>
        }
      />

      {/* ── KPI metric cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={<BoxIcon size={20} />}
          label={t("subinventory_transfer.detail_kpi_pallets", "Pallets Moved")}
          value={aggregates.totalPallets}
          color={approvalColor}
        />
        <KpiCard
          icon={<LayersIcon size={20} />}
          label={t("subinventory_transfer.detail_kpi_skus", "Distinct SKUs")}
          value={aggregates.distinctSkus}
          color={approvalColor}
        />
        <KpiCard
          icon={<ArrowUpIcon size={20} />}
          label={t("subinventory_transfer.detail_kpi_from", "Source Locations")}
          value={aggregates.distinctFrom}
          color={approvalColor}
        />
        <KpiCard
          icon={<ArrowDownIcon size={20} />}
          label={t(
            "subinventory_transfer.detail_kpi_to",
            "Destination Locations",
          )}
          value={aggregates.distinctTo}
          color={approvalColor}
        />
      </div>

      {/* ── Relocation callout (domain-specific) ─────────────────────────── */}
      <CalloutCard
        icon={<PutawayIcon size={18} />}
        tone="accent"
        title={t(
          "subinventory_transfer.detail_callout_title",
          "Internal relocation",
        )}
        description={t(
          "subinventory_transfer.detail_callout_desc",
          "Approving moves each pallet from its source location to the destination. This updates on-hand placement but not total stock.",
        )}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetaItem
            label={t("subinventory_transfer.label_reference", "Reference")}
            value={detail.reference}
            mono
          />
          <MetaItem
            label={t(
              "subinventory_transfer.label_transfer_reason",
              "Transfer Reason",
            )}
            value={detail.transferReason}
          />
        </div>
      </CalloutCard>

      {/* ── Details ──────────────────────────────────────────────────────── */}
      <Fieldset>
        <FieldsetLegend>
          <div className="flex items-center gap-2">
            <PutawayIcon size={18} className="text-accent" />
            {t(
              "subinventory_transfer.detail_section_details",
              "Transfer Details",
            )}
          </div>
        </FieldsetLegend>
        <FieldGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MetaItem
              label={t("subinventory_transfer.label_id", "ID")}
              value={detail.id}
              mono
            />
            <MetaItem
              label={t(
                "subinventory_transfer.label_document_number",
                "Document Number",
              )}
              value={detail.documentNumber}
              mono
            />
            <MetaItem
              label={t("subinventory_transfer.label_date", "Date")}
              value={formattedDate}
            />
            <MetaItem
              label={t("subinventory_transfer.label_warehouse", "Warehouse")}
              value={detail.warehouse?.name}
            />
            <MetaItem
              label={t("subinventory_transfer.label_status", "Status")}
              value={detail.approvalStatus}
            />
            <MetaItem
              label={t(
                "subinventory_transfer.label_transfer_reason",
                "Transfer Reason",
              )}
              value={detail.transferReason}
            />
            <MetaItem
              label={t("subinventory_transfer.label_reference", "Reference")}
              value={detail.reference}
              mono
            />
          </div>
          <Separator />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {t("subinventory_transfer.label_notes", "Notes")}
            </p>
            {hasNotes ? (
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface p-3 text-sm text-foreground">
                {detail.notes}
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted">
                {t("subinventory_transfer.detail_no_notes", "No notes added")}
              </p>
            )}
          </div>
        </FieldGroup>
      </Fieldset>

      {/* ── Transfer flow (creative visualization) ───────────────────────── */}
      <Card>
        <Card.Header>
          <div className="flex items-center gap-2">
            <PutawayIcon size={18} className="text-accent" />
            <div>
              <Card.Title>
                {t("subinventory_transfer.detail_flow_title", "Transfer Flow")}
              </Card.Title>
              <Card.Description>
                {t(
                  "subinventory_transfer.detail_flow_desc",
                  "Each pallet's path from source to destination location.",
                )}
              </Card.Description>
            </div>
          </div>
        </Card.Header>
        <Card.Content className="space-y-3">
          {detail.items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              {t("subinventory_transfer.no_items", "No items available.")}
            </p>
          ) : (
            detail.items.map((item, index) => (
              <div
                key={item.id}
                className="flex flex-col items-stretch gap-3 rounded-2xl border border-border/70 bg-surface/60 p-4 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 font-mono text-xs text-accent">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm text-foreground">
                      {item.pallet?.palletNumber ?? item.palletId}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {item.pallet?.sku?.name ?? "—"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-1 items-center justify-center gap-3">
                  <div className="min-w-0 flex-1 rounded-xl border border-border/70 bg-background px-3 py-2 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                      <ArrowUpIcon size={11} className="mr-1 inline" />
                      {t("subinventory_transfer.col_from", "From Location")}
                    </p>
                    <p className="mt-1 truncate font-mono text-sm text-foreground">
                      {item.fromLocation?.id ?? item.fromLocationId}
                    </p>
                  </div>
                  <PutawayIcon size={20} className="shrink-0 text-accent" />
                  <div className="min-w-0 flex-1 rounded-xl border border-border/70 bg-background px-3 py-2 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                      <ArrowDownIcon size={11} className="mr-1 inline" />
                      {t("subinventory_transfer.col_to", "To Location")}
                    </p>
                    <p className="mt-1 truncate font-mono text-sm text-foreground">
                      {item.toLocation?.id ?? item.toLocationId}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center justify-end">
                  {isApproved ? (
                    <Chip color="success" variant="soft" size="sm">
                      <CheckCircleIcon size={13} className="mr-1" />
                      {t("subinventory_transfer.detail_moved", "Moved")}
                    </Chip>
                  ) : (
                    <Chip color="default" variant="soft" size="sm">
                      {t("subinventory_transfer.detail_pending", "Pending")}
                    </Chip>
                  )}
                </div>
              </div>
            ))
          )}
        </Card.Content>
      </Card>

      {/* ── Audit trail ──────────────────────────────────────────────────── */}
      <AuditTrail
        messages={auditMessages}
        createdBy={detail.createdBy?.name ?? detail.createdBy?.email ?? "—"}
        createdAt={formattedCreated}
        approvedBy={detail.approvedBy?.name ?? detail.approvedBy?.email ?? "—"}
        approvedAt={formattedApproved}
        putawayStatus={detail.approvalStatus}
        putawayLabel={detail.approvalStatus}
        putawayColor={approvalColor}
        approvalHistory={detail.approvalHistory}
      />

      {/* ── Action modal ─────────────────────────────────────────────────── */}
      <ActionModal
        isOpen={actionModal !== null}
        isActing={isActing}
        actionError={actionError}
        kind={actionModal?.kind ?? null}
        message={actionModal?.message ?? ""}
        onMessageChange={(value) =>
          setActionModal((prev) => (prev ? { ...prev, message: value } : prev))
        }
        onClose={() => {
          setActionModal(null);
          setActionError(null);
        }}
        onConfirm={() => void handleConfirm()}
        messages={actionMessages}
      />
    </section>
  );
}

export { SubinventoryTransferDetailPage };
