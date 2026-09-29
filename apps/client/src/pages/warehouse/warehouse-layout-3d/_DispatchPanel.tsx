import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Chip,
  Label,
  ListBox,
  Select,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMutation } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useIntl } from "react-intl";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { trpcClient } from "../../../lib/trpc";
import { aiDispatchStageAtom } from "../../../lib/atoms";

export interface DispatchData {
  items: Array<{
    outboundTransactionItemId: string;
    skuId: string;
    skuName: string | null;
    palletTypeName: string | null;
    palletTypeObjectId: string | null;
    quantity: number;
  }>;
  availablePallets: Array<{
    palletId: string;
    palletNumber?: string | null;
    outboundTransactionItemId: string;
  }>;
  assignedPallets: Array<{
    palletId: string;
    palletNumber?: string | null;
    outboundTransactionItemId: string;
  }>;
}
export type DispatchItem = DispatchData["items"][number];

type DispatchStatus = "PENDING" | "PARTIAL" | "COMPLETED";

interface OutboundTransactionListItem {
  id: string;
  reference: string | null;
  dispatchStatus: DispatchStatus;
}

const DISPATCH_STATUS_BADGE: Record<
  DispatchStatus,
  { label: string; color: "default" | "warning" | "success" }
> = {
  PENDING: { label: "Pending", color: "default" },
  PARTIAL: { label: "Partial", color: "warning" },
  COMPLETED: { label: "Completed", color: "success" },
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
  onItemActivate: (
    itemId: string | null,
    palletTypeObjectId: string | null,
  ) => void;
  onConfirmDispatch: () => void;
  isDispatching: boolean;
  dispatchStage: "idle" | "confirm" | "loading" | "success" | "error";
  onSetDispatchStage: (stage: "idle" | "confirm" | "error") => void;
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
  const totalSelected = Array.from(dispatchSelections.values()).reduce(
    (s, v) => s + v.size,
    0,
  );
  const totalNeeded = (assignmentData?.items ?? []).reduce(
    (s, i) => s + i.quantity,
    0,
  );

  // Lookup palletNumber by palletId for chip display
  const palletNumberById = new Map<string, string | null>();
  for (const p of assignmentData?.availablePallets ?? []) {
    palletNumberById.set(p.palletId, p.palletNumber ?? null);
  }
  for (const p of assignmentData?.assignedPallets ?? []) {
    palletNumberById.set(p.palletId, p.palletNumber ?? null);
  }

  const handleTransactionChange = (key: string | null) => {
    onTransactionChange(key);
    onItemActivate(null, null);
    onSetDispatchStage("idle");
  };

  return (
    <div
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
      onPointerDown={(e) => e.stopPropagation()}
      data-ai-context={JSON.stringify({
        section: "dispatch-panel",
        selectedTransactionId,
        activeItemId,
        totalSelected,
        totalNeeded,
      })}
    >
      <Card
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Card.Header>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon
                icon="solar:delivery-bold-duotone"
                style={{ width: 20, height: 20 }}
              />
              <Card.Title>Dispatch Outbound</Card.Title>
            </div>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label="Close dispatch panel"
              onPress={onClose}
            >
              <Icon icon="mdi:close" style={{ width: 16, height: 16 }} />
            </Button>
          </div>
        </Card.Header>

        <Card.Content
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {allDone ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                padding: "32px 16px",
                textAlign: "center",
              }}
            >
              <div style={{ animation: "putaway-bounce 1s ease-in-out 2" }}>
                <Icon
                  icon="solar:truck-speed-bold-duotone"
                  style={{
                    width: 56,
                    height: 56,
                    color: "var(--heroui-success)",
                  }}
                />
              </div>
              <div>
                <p
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--heroui-success)",
                  }}
                >
                  All Dispatched
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--heroui-foreground-60)",
                    marginTop: 4,
                  }}
                >
                  All approved outbound transactions have been dispatched.
                </p>
              </div>
              <Button size="sm" variant="ghost" onPress={onClose}>
                Close Session
              </Button>
            </div>
          ) : (
            <>
              <Select
                value={selectedTransactionId ?? ""}
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
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            width: "100%",
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontFamily: "ui-monospace, monospace",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {txn.reference ?? txn.id}
                          </span>
                          <Chip
                            size="sm"
                            color={
                              DISPATCH_STATUS_BADGE[txn.dispatchStatus].color
                            }
                          >
                            {DISPATCH_STATUS_BADGE[txn.dispatchStatus].label}
                          </Chip>
                        </div>
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              {selectedTransactionId && (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {assignmentLoading ? (
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <Spinner size="sm" />
                      <span style={{ fontSize: 14 }}>Loading…</span>
                    </div>
                  ) : dispatchStage === "success" ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 12,
                        padding: "24px 0",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{ animation: "putaway-bounce 1s ease-in-out 2" }}
                      >
                        <Icon
                          icon="solar:truck-speed-bold-duotone"
                          style={{
                            width: 40,
                            height: 40,
                            color: "var(--heroui-success)",
                          }}
                        />
                      </div>
                      <p
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--heroui-success)",
                        }}
                      >
                        Dispatched!
                      </p>
                    </div>
                  ) : dispatchStage === "error" ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          padding: 12,
                          borderRadius: 8,
                          background: "var(--heroui-danger-50)",
                          border: "1px solid var(--heroui-danger-200)",
                        }}
                      >
                        <Icon
                          icon="solar:close-circle-bold"
                          style={{
                            width: 16,
                            height: 16,
                            color: "var(--heroui-danger)",
                            flexShrink: 0,
                            marginTop: 1,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--heroui-danger)",
                          }}
                        >
                          {dispatchError}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => onSetDispatchStage("idle")}
                      >
                        Go back
                      </Button>
                    </div>
                  ) : dispatchStage === "confirm" ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 8,
                          background: "var(--heroui-warning-50)",
                          border: "1px solid var(--heroui-warning-200)",
                        }}
                      >
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--heroui-warning-700)",
                          }}
                        >
                          Confirm Dispatch
                        </p>
                        <p
                          style={{
                            fontSize: 12,
                            color: "var(--heroui-warning-600)",
                            marginTop: 4,
                          }}
                        >
                          Assigning {totalSelected} pallet
                          {totalSelected !== 1 ? "s" : ""} and marking as
                          dispatched. This cannot be undone.
                        </p>
                      </div>
                      {isDispatching ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            padding: "12px 0",
                          }}
                        >
                          <Spinner size="sm" />
                          <span style={{ fontSize: 13 }}>Dispatching…</span>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                          <Button
                            size="sm"
                            variant="ghost"
                            style={{ flex: 1 }}
                            onPress={() => onSetDispatchStage("idle")}
                          >
                            Back
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            style={{ flex: 1 }}
                            onPress={onConfirmDispatch}
                          >
                            Confirm
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    assignmentData && (
                      <>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--heroui-foreground-60)",
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 600,
                                color:
                                  totalSelected === totalNeeded &&
                                  totalNeeded > 0
                                    ? "var(--heroui-success)"
                                    : "var(--heroui-foreground)",
                              }}
                            >
                              {totalSelected}
                            </span>
                            <span> / {totalNeeded} pallets selected</span>
                          </div>
                        </div>

                        {activeItemId && (
                          <div
                            style={{
                              padding: "8px 12px",
                              borderRadius: 8,
                              background: "var(--heroui-primary-50)",
                              border: "1px solid var(--heroui-primary-200)",
                            }}
                          >
                            <p
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "var(--heroui-primary-700)",
                              }}
                            >
                              Click a matching pallet in the 3D view
                            </p>
                            <p
                              style={{
                                fontSize: 11,
                                color: "var(--heroui-primary-600)",
                                marginTop: 2,
                              }}
                            >
                              Non-matching pallets are dimmed.
                            </p>
                          </div>
                        )}

                        {assignmentData.items.map((item) => {
                          const selected =
                            dispatchSelections.get(
                              item.outboundTransactionItemId,
                            ) ?? new Set<string>();
                          const isActive =
                            activeItemId === item.outboundTransactionItemId;
                          const isMet = selected.size >= item.quantity;
                          return (
                            <div
                              key={item.outboundTransactionItemId}
                              style={{
                                border: `1px solid ${isActive ? "var(--heroui-primary-300)" : "var(--heroui-divider)"}`,
                                borderRadius: 8,
                                overflow: "hidden",
                                transition: "border-color 0.15s",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  isActive
                                    ? onItemActivate(null, null)
                                    : onItemActivate(
                                        item.outboundTransactionItemId,
                                        item.palletTypeObjectId ?? null,
                                      )
                                }
                                style={{
                                  width: "100%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: "10px 12px",
                                  background: isActive
                                    ? "var(--heroui-primary-50)"
                                    : "var(--heroui-content1)",
                                  border: "none",
                                  cursor: "pointer",
                                  gap: 8,
                                  textAlign: "left",
                                  transition: "background 0.15s",
                                }}
                              >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <p
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: isActive
                                        ? "var(--heroui-primary-700)"
                                        : "var(--heroui-foreground)",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {item.skuName ?? item.skuId}
                                  </p>
                                  <p
                                    style={{
                                      fontSize: 11,
                                      color: isActive
                                        ? "var(--heroui-primary-600)"
                                        : "var(--heroui-foreground-60)",
                                      marginTop: 1,
                                    }}
                                  >
                                    {item.palletTypeName ?? "—"}
                                  </p>
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    flexShrink: 0,
                                  }}
                                >
                                  <Chip
                                    size="sm"
                                    color={
                                      selected.size > item.quantity
                                        ? "danger"
                                        : isMet
                                          ? "success"
                                          : selected.size > 0
                                            ? "warning"
                                            : "default"
                                    }
                                  >
                                    {selected.size}/{item.quantity}
                                  </Chip>
                                  <Icon
                                    icon={
                                      isActive
                                        ? "mdi:cursor-default-click"
                                        : "mdi:chevron-right"
                                    }
                                    style={{
                                      width: 15,
                                      height: 15,
                                      color: isActive
                                        ? "var(--heroui-primary)"
                                        : "var(--heroui-foreground-40)",
                                    }}
                                  />
                                </div>
                              </button>

                              {selected.size > 0 && (
                                <div
                                  style={{
                                    padding: "6px 12px",
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 4,
                                    background: "var(--heroui-content2)",
                                    borderTop:
                                      "1px solid var(--heroui-divider)",
                                  }}
                                >
                                  {Array.from(selected).map((palletId) => (
                                    <button
                                      key={palletId}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onTogglePallet(
                                          item.outboundTransactionItemId,
                                          palletId,
                                        );
                                      }}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 3,
                                        fontSize: 10,
                                        fontFamily: "ui-monospace, monospace",
                                        background: "var(--heroui-primary-100)",
                                        color: "var(--heroui-primary-700)",
                                        border:
                                          "1px solid var(--heroui-primary-200)",
                                        borderRadius: 4,
                                        padding: "2px 5px",
                                        cursor: "pointer",
                                      }}
                                    >
                                      {palletNumberById.get(palletId) ??
                                        palletId}
                                      <Icon
                                        icon="mdi:close"
                                        style={{ width: 10, height: 10 }}
                                      />
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

              {selectedTransactionId &&
                assignmentData &&
                !assignmentLoading &&
                dispatchStage === "idle" && (
                  <>
                    <AiAnalysisSection
                      key={`analysis-${selectedTransactionId}`}
                      selectedTransactionId={selectedTransactionId}
                    />
                    <AiSuggestSection
                      key={`suggest-${selectedTransactionId}`}
                      selectedTransactionId={selectedTransactionId}
                      assignmentData={assignmentData}
                      palletNumberById={palletNumberById}
                    />
                  </>
                )}

              {!selectedTransactionId && !txnLoading && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: "var(--heroui-content2)",
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--heroui-foreground-60)",
                    }}
                  >
                    Select an approved outbound transaction to begin dispatch.
                  </p>
                </div>
              )}
            </>
          )}
        </Card.Content>

        {selectedTransactionId &&
          dispatchStage === "idle" &&
          assignmentData &&
          !assignmentLoading && (
            <Card.Footer
              style={{ display: "flex", gap: 8, padding: "12px 16px" }}
            >
              <Button
                size="sm"
                variant="ghost"
                style={{ flex: 1 }}
                onPress={() => handleTransactionChange(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                style={{ flex: 2 }}
                isDisabled={totalSelected === 0}
                onPress={() => onSetDispatchStage("confirm")}
              >
                <Icon
                  icon="solar:delivery-bold-duotone"
                  style={{ width: 15, height: 15 }}
                />
                Dispatch ({totalSelected})
              </Button>
            </Card.Footer>
          )}
      </Card>
    </div>
  );
}

// ── AI Analysis ─────────────────────────────────────────────────────────────
// RAG-driven analysis of the selected transaction's pick lines. Rendered
// inline as markdown. Human decides; nothing is auto-applied.

function AiAnalysisSection({
  selectedTransactionId,
}: {
  selectedTransactionId: string;
}) {
  const intl = useIntl();
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState("");

  const analyzeMutation = useMutation({
    mutationFn: () =>
      trpcClient.aiWarehouse.analyzePick.mutate({
        outboundTransactionId: selectedTransactionId,
      }),
    onSuccess: (data) => {
      setMarkdown(data.markdown);
      setStatus("success");
    },
    onError: (err) => {
      setError(
        err instanceof Error
          ? err.message
          : intl.formatMessage({
              id: "dispatch.ai_error",
              defaultMessage: "AI request failed. Please try again.",
            }),
      );
      setStatus("error");
    },
  });

  return (
    <div
      style={{
        border: "1px solid var(--heroui-divider)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: "var(--heroui-content1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon
            icon="solar:magic-stick-2-bold-duotone"
            style={{ width: 14, height: 14, color: "var(--heroui-primary)" }}
          />
          <span style={{ fontSize: 12, fontWeight: 700 }}>
            {intl.formatMessage({
              id: "dispatch.ai_analysis_title",
              defaultMessage: "AI Analysis",
            })}
          </span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          isDisabled={analyzeMutation.isPending}
          onPress={() => analyzeMutation.mutate()}
        >
          {analyzeMutation.isPending ? (
            <>
              <Spinner size="sm" />
              {intl.formatMessage({
                id: "dispatch.ai_analyzing",
                defaultMessage: "Analyzing…",
              })}
            </>
          ) : (
            <>
              {intl.formatMessage({
                id: "dispatch.ai_analyze",
                defaultMessage: "Analyze",
              })}
            </>
          )}
        </Button>
      </div>

      <div style={{ padding: "4px 12px" }}>
        {status === "idle" && (
          <p
            style={{
              fontSize: 11,
              color: "var(--heroui-foreground-60)",
              padding: "6px 0",
            }}
          >
            {intl.formatMessage({
              id: "dispatch.ai_analyze_hint",
              defaultMessage:
                "Get an AI analysis of this transaction's pick lines.",
            })}
          </p>
        )}
        {status === "success" && markdown && <AiMarkdown text={markdown} />}
        {status === "error" && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: 12,
              borderRadius: 8,
              background: "var(--heroui-danger-50)",
              border: "1px solid var(--heroui-danger-200)",
            }}
          >
            <Icon
              icon="solar:close-circle-bold"
              style={{
                width: 16,
                height: 16,
                color: "var(--heroui-danger)",
                flexShrink: 0,
                marginTop: 1,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--heroui-danger)",
                  wordBreak: "break-word",
                }}
              >
                {error}
              </p>
              <Button
                size="sm"
                variant="ghost"
                onPress={() => analyzeMutation.mutate()}
                style={{ marginTop: 6, padding: "2px 8px" }}
              >
                {intl.formatMessage({
                  id: "action_retry",
                  defaultMessage: "Retry",
                })}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── AI Suggest ──────────────────────────────────────────────────────────────
// RAG-driven item→pallet pick suggestions. The human reviews the list and
// clicks "Stage all" to feed the existing staging mechanism — picks are only
// persisted when the user presses Dispatch → Confirm (never auto-saved).

interface AiPickSuggestion {
  outboundTransactionItemId: string;
  palletId: string;
  reason: string;
}

interface AiSuggestSectionProps {
  selectedTransactionId: string;
  assignmentData: DispatchData;
  palletNumberById: Map<string, string | null>;
}

function AiSuggestSection({
  selectedTransactionId,
  assignmentData,
  palletNumberById,
}: AiSuggestSectionProps) {
  const intl = useIntl();
  const setDispatchStage = useSetAtom(aiDispatchStageAtom);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [suggestions, setSuggestions] = useState<AiPickSuggestion[]>([]);
  const [error, setError] = useState("");
  const [staged, setStaged] = useState(false);

  const skuNameById = new Map<string, string | null>();
  for (const item of assignmentData.items) {
    skuNameById.set(item.outboundTransactionItemId, item.skuName ?? item.skuId);
  }

  const suggestMutation = useMutation({
    mutationFn: () =>
      trpcClient.aiWarehouse.suggestPick.mutate({
        outboundTransactionId: selectedTransactionId,
      }),
    onSuccess: (data) => {
      setSuggestions(data.suggestions);
      setStaged(false);
      setStatus("success");
    },
    onError: (err) => {
      setError(
        err instanceof Error
          ? err.message
          : intl.formatMessage({
              id: "dispatch.ai_error",
              defaultMessage: "AI request failed. Please try again.",
            }),
      );
      setStatus("error");
    },
  });

  /** Feed the existing staging mechanism — WarehouseLayoutPage bridges this
   *  atom into the local dispatch selections (green cards). Human confirms. */
  const handleStageAll = () => {
    setDispatchStage({
      assignments: suggestions.map((s) => ({
        outboundTransactionItemId: s.outboundTransactionItemId,
        palletId: s.palletId,
      })),
    });
    setStaged(true);
  };

  return (
    <div
      style={{
        border: "1px solid var(--heroui-divider)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: "var(--heroui-content1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon
            icon="solar:sparkles-linear"
            style={{ width: 14, height: 14, color: "var(--heroui-primary)" }}
          />
          <span style={{ fontSize: 12, fontWeight: 700 }}>
            {intl.formatMessage({
              id: "dispatch.ai_suggest_title",
              defaultMessage: "AI Suggest",
            })}
          </span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          isDisabled={suggestMutation.isPending}
          onPress={() => suggestMutation.mutate()}
        >
          {suggestMutation.isPending ? (
            <>
              <Spinner size="sm" />
              {intl.formatMessage({
                id: "dispatch.ai_suggesting",
                defaultMessage: "Generating suggestions…",
              })}
            </>
          ) : (
            <>
              {intl.formatMessage({
                id: "dispatch.ai_suggest",
                defaultMessage: "Suggest picks",
              })}
            </>
          )}
        </Button>
      </div>

      <div style={{ padding: "4px 12px" }}>
        {status === "idle" && (
          <p
            style={{
              fontSize: 11,
              color: "var(--heroui-foreground-60)",
              padding: "6px 0",
            }}
          >
            {intl.formatMessage({
              id: "dispatch.ai_suggest_hint",
              defaultMessage:
                "Generate AI pick suggestions for this transaction — review and stage them.",
            })}
          </p>
        )}
        {status === "error" && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: 12,
              borderRadius: 8,
              background: "var(--heroui-danger-50)",
              border: "1px solid var(--heroui-danger-200)",
            }}
          >
            <Icon
              icon="solar:close-circle-bold"
              style={{
                width: 16,
                height: 16,
                color: "var(--heroui-danger)",
                flexShrink: 0,
                marginTop: 1,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--heroui-danger)",
                  wordBreak: "break-word",
                }}
              >
                {error}
              </p>
              <Button
                size="sm"
                variant="ghost"
                onPress={() => suggestMutation.mutate()}
                style={{ marginTop: 6, padding: "2px 8px" }}
              >
                {intl.formatMessage({
                  id: "action_retry",
                  defaultMessage: "Retry",
                })}
              </Button>
            </div>
          </div>
        )}
        {status === "success" && suggestions.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "14px 0",
              textAlign: "center",
            }}
          >
            <Icon
              icon="solar:check-circle-bold-duotone"
              style={{ width: 26, height: 26, color: "var(--heroui-success)" }}
            />
            <span
              style={{ fontSize: 12, color: "var(--heroui-foreground-60)" }}
            >
              {intl.formatMessage({
                id: "dispatch.ai_empty",
                defaultMessage:
                  "Nothing to pick — everything is already assigned.",
              })}
            </span>
          </div>
        )}
        {status === "success" && suggestions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {suggestions.map((s) => (
              <div
                key={`${s.outboundTransactionItemId}-${s.palletId}`}
                style={{
                  border: "1px solid var(--heroui-divider)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  background: "var(--heroui-content1)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {skuNameById.get(s.outboundTransactionItemId) ??
                      s.outboundTransactionItemId}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "ui-monospace, monospace",
                      fontWeight: 600,
                      color: "var(--heroui-primary)",
                      background: "var(--heroui-primary-100)",
                      border: "1px solid var(--heroui-primary-200)",
                      borderRadius: 4,
                      padding: "2px 6px",
                      flexShrink: 0,
                    }}
                  >
                    {palletNumberById.get(s.palletId) ?? s.palletId}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--heroui-foreground-60)",
                    marginTop: 4,
                  }}
                >
                  {s.reason}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {status === "success" && suggestions.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderTop: "1px solid var(--heroui-divider)",
            background: "var(--heroui-content2)",
          }}
        >
          <Button
            size="sm"
            variant="secondary"
            onPress={handleStageAll}
            style={{ flexShrink: 0 }}
          >
            <Icon
              icon="solar:clipboard-check-linear"
              style={{ width: 15, height: 15 }}
            />
            {intl.formatMessage({
              id: "dispatch.ai_stage_all",
              defaultMessage: "Stage all",
            })}
          </Button>
          {staged && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: "var(--heroui-success)",
                flex: 1,
                minWidth: 0,
              }}
            >
              <Icon
                icon="solar:check-circle-bold-duotone"
                style={{ width: 13, height: 13, flexShrink: 0 }}
              />
              {intl.formatMessage({
                id: "dispatch.ai_staged",
                defaultMessage: "Staged for review",
              })}
            </span>
          )}
        </div>
      )}

      {staged && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 8,
            background: "var(--heroui-warning-50)",
            border: "1px solid var(--heroui-warning-200)",
          }}
        >
          <Icon
            icon="solar:clipboard-check-linear"
            style={{
              width: 14,
              height: 14,
              color: "var(--heroui-warning-700)",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: "var(--heroui-warning-600)",
              flex: 1,
              minWidth: 0,
            }}
          >
            {intl.formatMessage({
              id: "dispatch.ai_staged_hint",
              defaultMessage:
                "Picks are staged for review — verify the highlighted pallets in the 3D view, then press Dispatch and confirm to save.",
            })}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Markdown rendering (mirrors AiAssistant / AiDigestCard) ─────────────────

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-[15px] font-bold mt-2 mb-1.5">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[14px] font-bold mt-2 mb-1.5">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[13px] font-semibold mt-1.5 mb-1">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="my-1.5 leading-relaxed text-foreground text-sm">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 my-1.5 space-y-0.5 text-sm text-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 my-1.5 space-y-0.5 text-sm text-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline"
    >
      {children}
    </a>
  ),
  code: ({ className, children, ...rest }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="bg-black/10 dark:bg-white/10 rounded px-1 py-0.5 font-mono text-[12px]"
          {...rest}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-black/10 dark:bg-white/10 rounded p-2 my-2 overflow-x-auto text-[12px] font-mono whitespace-pre">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/30 pl-3 my-2 text-muted">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-default-200" />,
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full text-[12px] border-collapse">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-black/5 dark:bg-white/5">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border border-black/10 dark:border-white/10 px-2 py-1 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-black/10 dark:border-white/10 px-2 py-1">
      {children}
    </td>
  ),
};

const sanitizeUrl = (url: string) =>
  /^(https?:|mailto:|#)/.test(url) ? url : "#";

function AiMarkdown({ text }: { text: string }) {
  const rendered = useMemo(
    () => (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
        urlTransform={sanitizeUrl}
      >
        {text}
      </ReactMarkdown>
    ),
    [text],
  );
  return <div className="ai-markdown">{rendered}</div>;
}
