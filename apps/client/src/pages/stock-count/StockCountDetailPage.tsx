import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useAtomValue } from "jotai";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Modal, TextArea } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useNavigate, useParams } from "react-router";
import { PageHeader } from "../../components/PageHeader";
import { UnsavedChangesBadge } from "../../components/UnsavedChangesBadge";
import { hasPermissionAtom } from "../../lib/atoms";
import { trpcClient } from "../../lib/trpc";

type CountLine = {
  id: string;
  skuId: string;
  systemQty: { toNumber: () => number } | number;
  countedQty: { toNumber: () => number } | null;
  variance: { toNumber: () => number } | null;
  sku: { id: string; code: string | null; name: string };
  pallet: { id: string; palletNumber: string | null } | null;
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "text-default-500",
  IN_PROGRESS: "text-warning",
  COMPLETED: "text-success",
  CANCELLED: "text-danger",
};

export function StockCountDetailPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canUpdate = hasPermission("stock_count@update");
  const canApprove = hasPermission("stock_count@approve");
  const queryClient = useQueryClient();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [rejectOpen, setRejectOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: count, isLoading } = useQuery({
    queryKey: ["stockCountDetail", id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.stockCount.detail.query({ id: id ?? "" }),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      trpcClient.stockCount.saveCounts.mutate({
        id: id!,
        lines: Object.entries(counts)
          .filter(([, value]) => value !== "")
          .map(([lineId, value]) => ({ lineId, countedQty: Number(value) })),
      }),
    onSuccess: () => {
      setCounts({});
      void queryClient.invalidateQueries({
        queryKey: ["stockCountDetail", id],
      });
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Failed to save counts"),
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      trpcClient.stockCount.approve.mutate({
        id: id!,
        message: message.trim() || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["stockCountDetail", id],
      });
      void queryClient.invalidateQueries({ queryKey: ["stockCountList"] });
      setRejectOpen(false);
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Failed to approve count"),
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      trpcClient.stockCount.transition.mutate({ id: id!, status: "CANCELLED" }),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ["stockCountDetail", id],
      }),
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Failed to cancel count"),
  });

  const lines = useMemo<CountLine[]>(
    () => (count?.lines ?? []) as unknown as CountLine[],
    [count],
  );
  const toNum = (
    value: { toNumber: () => number } | number | null,
  ): number | null =>
    value === null
      ? null
      : typeof value === "number"
        ? value
        : value.toNumber();

  const isEditable = count?.status === "IN_PROGRESS" && canUpdate;
  const dirtyCount = Object.values(counts).filter((v) => v !== "").length;

  if (isLoading) {
    return (
      <p className="text-sm text-muted">
        {intl.formatMessage({
          id: "common.loading",
          defaultMessage: "Loading…",
        })}
      </p>
    );
  }
  if (!count) {
    return (
      <p className="text-sm text-danger">
        {intl.formatMessage({
          id: "stock_count.not_found",
          defaultMessage: "Stock count not found.",
        })}
      </p>
    );
  }

  return (
    <section
      className="space-y-4"
      data-ai-context={JSON.stringify({
        section: "stock-count-detail",
        documentNumber: count.documentNumber,
      })}
    >
      <PageHeader
        title={count.documentNumber ?? count.id}
        onBack={() => navigate("/stock-count")}
      >
        {isEditable ? (
          <>
            <Button
              variant="secondary"
              isPending={cancelMutation.isPending}
              onPress={() => cancelMutation.mutate()}
            >
              <Icon icon="solar:close-circle-linear" className="text-danger" />
              {intl.formatMessage({
                id: "stock_count.cancel",
                defaultMessage: "Cancel Count",
              })}
            </Button>
            <Button
              variant="primary"
              isPending={saveMutation.isPending}
              isDisabled={dirtyCount === 0}
              onPress={() => {
                setError(null);
                saveMutation.mutate();
              }}
            >
              <Icon icon="solar:diskette-linear" className="size-4" />
              {intl.formatMessage({
                id: "stock_count.save_counts",
                defaultMessage: "Save Counts",
              })}
              {dirtyCount > 0 ? ` (${dirtyCount})` : ""}
            </Button>
          </>
        ) : null}
        {count.status === "IN_PROGRESS" && canApprove ? (
          <Button
            variant="primary"
            onPress={() => {
              setMessage("");
              setRejectOpen(true);
            }}
          >
            <Icon icon="solar:check-circle-linear" />
            {intl.formatMessage({
              id: "stock_count.approve",
              defaultMessage: "Approve & Generate Adjustments",
            })}
          </Button>
        ) : null}
      </PageHeader>

      {error ? (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-xl border px-3 py-1.5">
          <span
            className={`font-mono font-semibold ${STATUS_COLORS[count.status]}`}
          >
            {count.status}
          </span>
        </span>
        <span className="rounded-xl border px-3 py-1.5">
          {count.warehouse.name}
        </span>
        {count.isBlindCount ? (
          <span className="rounded-xl border px-3 py-1.5">
            {intl.formatMessage({
              id: "stock_count.blind_badge",
              defaultMessage: "Blind count",
            })}
          </span>
        ) : null}
      </div>

      <Card>
        <Card.Content>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted">
                  <th className="px-3 py-2">
                    {intl.formatMessage({
                      id: "stock_count.column_pallet",
                      defaultMessage: "Pallet",
                    })}
                  </th>
                  <th className="px-3 py-2">
                    {intl.formatMessage({
                      id: "stock_count.column_sku",
                      defaultMessage: "SKU",
                    })}
                  </th>
                  <th className="px-3 py-2 text-right">
                    {intl.formatMessage({
                      id: "stock_count.column_system_qty",
                      defaultMessage: "System",
                    })}
                  </th>
                  <th className="px-3 py-2 text-right">
                    {intl.formatMessage({
                      id: "stock_count.column_counted_qty",
                      defaultMessage: "Counted",
                    })}
                  </th>
                  <th className="px-3 py-2 text-right">
                    {intl.formatMessage({
                      id: "stock_count.column_variance",
                      defaultMessage: "Variance",
                    })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const systemQty = toNum(line.systemQty) ?? 0;
                  const countedQty = toNum(line.countedQty);
                  const variance = toNum(line.variance);
                  const localValue = counts[line.id];
                  return (
                    <tr key={line.id} className="border-b">
                      <td className="px-3 py-2 font-mono text-xs">
                        {line.pallet?.palletNumber ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-sm">{line.sku.name}</p>
                        <p className="font-mono text-xs text-muted">
                          {line.sku.code ?? ""}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {count.isBlindCount && countedQty === null
                          ? "••"
                          : systemQty}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {isEditable ? (
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            className="w-20 rounded-lg border bg-content1 px-2 py-1 text-right font-mono text-sm"
                            value={
                              localValue ??
                              (countedQty !== null ? String(countedQty) : "")
                            }
                            onChange={(e) =>
                              setCounts((prev) => ({
                                ...prev,
                                [line.id]: e.target.value,
                              }))
                            }
                            aria-label={intl.formatMessage({
                              id: "stock_count.column_counted_qty",
                              defaultMessage: "Counted",
                            })}
                          />
                        ) : (
                          <span className="font-mono">{countedQty ?? "—"}</span>
                        )}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono ${variance !== null && variance !== 0 ? "font-semibold text-danger" : ""}`}
                      >
                        {variance !== null
                          ? variance > 0
                            ? `+${variance}`
                            : variance
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card.Content>
      </Card>

      {isEditable && dirtyCount > 0 ? (
        <div className="flex justify-end">
          <UnsavedChangesBadge count={dirtyCount} />
        </div>
      ) : null}

      <Modal isOpen={rejectOpen} onOpenChange={setRejectOpen}>
        <Modal.Backdrop>
          <Modal.Container size="md">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>
                  {intl.formatMessage({
                    id: "stock_count.approve_dialog_title",
                    defaultMessage: "Approve Stock Count",
                  })}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm">
                  {intl.formatMessage({
                    id: "stock_count.approve_dialog_hint",
                    defaultMessage:
                      "Approving generates DRAFT Loss (shortage) and Found (surplus) transactions that follow their own approval flow.",
                  })}
                </p>
                <TextArea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  aria-label={intl.formatMessage({
                    id: "stock_count.approval_note",
                    defaultMessage: "Approval note",
                  })}
                  placeholder={intl.formatMessage({
                    id: "stock_count.approval_note",
                    defaultMessage: "Approval note (optional)",
                  })}
                />
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="secondary"
                  onPress={() => setRejectOpen(false)}
                >
                  {intl.formatMessage({
                    id: "action_cancel",
                    defaultMessage: "Cancel",
                  })}
                </Button>
                <Button
                  variant="primary"
                  isPending={approveMutation.isPending}
                  onPress={() => approveMutation.mutate()}
                >
                  {intl.formatMessage({
                    id: "stock_count.approve_confirm",
                    defaultMessage: "Approve",
                  })}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}
