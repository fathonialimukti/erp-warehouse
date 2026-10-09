import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useAtomValue } from "jotai";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
} from "@heroui/react";
import { AppIcon } from "../../components/AppIcon";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { SkuSelectSearch } from "../../components/SkuSelectSearch";
import { SupplierSelectSearch } from "../../components/SupplierSelectSearch";
import { hasPermissionAtom } from "../../lib/atoms";
import { trpcClient } from "../../lib/trpc";
import { useListPage } from "../../lib/useListPage";
import type { ColumnDef } from "@tanstack/react-table";

interface ReorderRow {
  id: string;
  sku: { id: string; code: string | null; name: string; baseUnit: string };
  warehouse: { id: string; code: string | null; name: string };
  minQty: number;
  maxQty: number;
  reorderPoint: number;
  onHand: number;
  status: "below_min" | "below_reorder" | "ok";
  suggestedQty: number;
  preferredSupplier: {
    id: string;
    name: string;
    leadTimeDays: number | null;
    minimumOrderQty: number | null;
    unitPrice: number | null;
  } | null;
}

interface PolicyFormState {
  id?: string;
  skuId: string;
  warehouseId: string;
  minQty: string;
  maxQty: string;
  reorderPoint: string;
  preferredSupplierId: string;
}

const STATUS_COLORS: Record<string, string> = {
  below_min: "text-danger",
  below_reorder: "text-warning",
  ok: "text-success",
};

const emptyForm = (): PolicyFormState => ({
  skuId: "",
  warehouseId: "",
  minQty: "0",
  maxQty: "0",
  reorderPoint: "0",
  preferredSupplierId: "",
});

function PolicyDialog({
  isOpen,
  onOpenChange,
  form,
  setForm,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  form: PolicyFormState;
  setForm: (next: PolicyFormState) => void;
}) {
  const intl = useIntl();
  const queryClient = useQueryClient();
  const isEdit = Boolean(form.id);
  const [error, setError] = useState<string | null>(null);

  const { data: warehouses } = useQuery({
    queryKey: ["warehouseListForFilter"],
    queryFn: () =>
      trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const upsertMutation = useMutation({
    mutationFn: () =>
      trpcClient.reorder.upsertPolicy.mutate({
        skuId: form.skuId,
        warehouseId: form.warehouseId,
        minQty: Number(form.minQty) || 0,
        maxQty: Number(form.maxQty) || 0,
        reorderPoint: Number(form.reorderPoint) || 0,
        preferredSupplierId: form.preferredSupplierId || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reorderList"] });
      onOpenChange(false);
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Failed to save policy"),
  });

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                {isEdit
                  ? intl.formatMessage({
                      id: "reorder.dialog_edit_title",
                      defaultMessage: "Edit Reorder Policy",
                    })
                  : intl.formatMessage({
                      id: "reorder.dialog_create_title",
                      defaultMessage: "New Reorder Policy",
                    })}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-4">
                <SkuSelectSearch
                  queryKeyBase="reorderSku"
                  value={form.skuId}
                  onChange={(value) => setForm({ ...form, skuId: value })}
                  label={intl.formatMessage({
                    id: "reorder.field_sku",
                    defaultMessage: "SKU",
                  })}
                  isDisabled={isEdit}
                />
                <TextField
                  fullWidth
                  name="warehouse"
                  value={form.warehouseId}
                  onChange={(v) => setForm({ ...form, warehouseId: v })}
                >
                  <Label>
                    {intl.formatMessage({
                      id: "reorder.field_warehouse",
                      defaultMessage: "Warehouse",
                    })}
                  </Label>
                  <Select
                    selectedKey={form.warehouseId || null}
                    onSelectionChange={(key) =>
                      setForm({
                        ...form,
                        warehouseId: typeof key === "string" ? key : "",
                      })
                    }
                    variant="secondary"
                    isDisabled={isEdit}
                    aria-label={intl.formatMessage({
                      id: "reorder.field_warehouse",
                      defaultMessage: "Warehouse",
                    })}
                  >
                    <Select.Trigger>
                      <Select.Value>
                        {warehouses?.data.find((w) => w.id === form.warehouseId)
                          ?.name ??
                          intl.formatMessage({
                            id: "common.select_placeholder",
                            defaultMessage: "Select…",
                          })}
                      </Select.Value>
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {(warehouses?.data ?? []).map((w) => (
                          <ListBox.Item key={w.id} id={w.id} textValue={w.name}>
                            <Label>{w.name}</Label>
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </TextField>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <TextField
                    fullWidth
                    name="minQty"
                    value={form.minQty}
                    onChange={(v) => setForm({ ...form, minQty: v })}
                  >
                    <Label>
                      {intl.formatMessage({
                        id: "reorder.field_min",
                        defaultMessage: "Min (pallets)",
                      })}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      variant="secondary"
                      aria-label={intl.formatMessage({
                        id: "reorder.field_min",
                        defaultMessage: "Min",
                      })}
                    />
                  </TextField>
                  <TextField
                    fullWidth
                    name="reorderPoint"
                    value={form.reorderPoint}
                    onChange={(v) => setForm({ ...form, reorderPoint: v })}
                  >
                    <Label>
                      {intl.formatMessage({
                        id: "reorder.field_reorder_point",
                        defaultMessage: "Reorder point",
                      })}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      variant="secondary"
                      aria-label={intl.formatMessage({
                        id: "reorder.field_reorder_point",
                        defaultMessage: "Reorder point",
                      })}
                    />
                  </TextField>
                  <TextField
                    fullWidth
                    name="maxQty"
                    value={form.maxQty}
                    onChange={(v) => setForm({ ...form, maxQty: v })}
                  >
                    <Label>
                      {intl.formatMessage({
                        id: "reorder.field_max",
                        defaultMessage: "Max (pallets)",
                      })}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      variant="secondary"
                      aria-label={intl.formatMessage({
                        id: "reorder.field_max",
                        defaultMessage: "Max",
                      })}
                    />
                  </TextField>
                </div>
                <SupplierSelectSearch
                  queryKeyBase="reorderSupplier"
                  value={form.preferredSupplierId}
                  onChange={(value) =>
                    setForm({ ...form, preferredSupplierId: value })
                  }
                  label={intl.formatMessage({
                    id: "reorder.field_supplier",
                    defaultMessage: "Preferred supplier",
                  })}
                  ariaLabel={intl.formatMessage({
                    id: "reorder.field_supplier",
                    defaultMessage: "Preferred supplier",
                  })}
                />
                {error ? <p className="text-sm text-danger">{error}</p> : null}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={() => onOpenChange(false)}>
                {intl.formatMessage({
                  id: "action_cancel",
                  defaultMessage: "Cancel",
                })}
              </Button>
              <Button
                variant="primary"
                isPending={upsertMutation.isPending}
                isDisabled={!form.skuId || !form.warehouseId}
                onPress={() => {
                  setError(null);
                  upsertMutation.mutate();
                }}
              >
                {intl.formatMessage({
                  id: "action_save",
                  defaultMessage: "Save",
                })}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export function ReorderPage() {
  const intl = useIntl();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canRead = hasPermission("reorder@read");
  const canManage = hasPermission("reorder@manage");
  const queryClient = useQueryClient();

  const [warehouseId, setWarehouseId] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<PolicyFormState>(emptyForm());

  const { data: warehouses } = useQuery({
    queryKey: ["warehouseListForFilter"],
    queryFn: () =>
      trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const columns: ColumnDef<ReorderRow>[] = useMemo(
    () => [
      {
        id: "sku",
        header: intl.formatMessage({
          id: "reorder.column_sku",
          defaultMessage: "SKU",
        }),
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-semibold">{row.original.sku.name}</p>
            <p className="font-mono text-xs text-muted">
              {row.original.sku.code ?? "—"}
            </p>
          </div>
        ),
      },
      {
        id: "warehouse",
        header: intl.formatMessage({
          id: "reorder.column_warehouse",
          defaultMessage: "Warehouse",
        }),
        cell: ({ row }) => (
          <span className="text-sm">{row.original.warehouse.name}</span>
        ),
      },
      {
        id: "onHand",
        header: intl.formatMessage({
          id: "reorder.column_on_hand",
          defaultMessage: "On hand",
        }),
        cell: ({ row }) => (
          <span
            className={`font-mono text-sm font-semibold ${STATUS_COLORS[row.original.status]}`}
          >
            {row.original.onHand}
          </span>
        ),
      },
      {
        id: "thresholds",
        header: intl.formatMessage({
          id: "reorder.column_thresholds",
          defaultMessage: "Min / Reorder / Max",
        }),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted">
            {row.original.minQty} / {row.original.reorderPoint} /{" "}
            {row.original.maxQty}
          </span>
        ),
      },
      {
        id: "suggested",
        header: intl.formatMessage({
          id: "reorder.column_suggested",
          defaultMessage: "Suggested order",
        }),
        cell: ({ row }) => (
          <span
            className={`font-mono text-sm ${row.original.suggestedQty > 0 ? "font-semibold text-warning" : "text-muted"}`}
          >
            {row.original.suggestedQty}
          </span>
        ),
      },
      {
        id: "supplier",
        header: intl.formatMessage({
          id: "reorder.column_supplier",
          defaultMessage: "Preferred supplier",
        }),
        cell: ({ row }) =>
          row.original.preferredSupplier ? (
            <div>
              <p className="text-sm">{row.original.preferredSupplier.name}</p>
              {row.original.preferredSupplier.leadTimeDays !== null ? (
                <p className="text-xs text-muted">
                  {intl.formatMessage(
                    {
                      id: "reorder.lead_time",
                      defaultMessage: "Lead time: {days}d",
                    },
                    { days: row.original.preferredSupplier.leadTimeDays },
                  )}
                </p>
              ) : null}
            </div>
          ) : (
            <span className="text-muted">—</span>
          ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          canManage ? (
            <div
              className="flex gap-1"
              role="group"
              aria-label={intl.formatMessage({
                id: "reorder.row_actions",
                defaultMessage: "Reorder policy actions",
              })}
            >
              <Button
                isIconOnly
                variant="ghost"
                size="sm"
                aria-label={intl.formatMessage({
                  id: "action_edit",
                  defaultMessage: "Edit",
                })}
                onPress={() => {
                  setForm({
                    id: row.original.id,
                    skuId: row.original.sku.id,
                    warehouseId: row.original.warehouse.id,
                    minQty: String(row.original.minQty),
                    maxQty: String(row.original.maxQty),
                    reorderPoint: String(row.original.reorderPoint),
                    preferredSupplierId:
                      row.original.preferredSupplier?.id ?? "",
                  });
                  setDialogOpen(true);
                }}
              >
                <AppIcon name="pen" className="text-warning" />
              </Button>
              <Button
                isIconOnly
                variant="ghost"
                size="sm"
                aria-label={intl.formatMessage({
                  id: "action_delete",
                  defaultMessage: "Delete",
                })}
                onPress={() => deleteMutation.mutate({ id: row.original.id })}
              >
                <AppIcon name="trash" className="text-danger" />
              </Button>
            </div>
          ) : null,
      },
    ],

    [intl, canManage],
  );

  const list = useListPage<ReorderRow>({
    queryKey: ["reorderList"],
    queryFn: async (input) => {
      const result = await trpcClient.reorder.list.query({
        warehouseId: warehouseId || undefined,
        status:
          (statusFilter as "all" | "below_min" | "below_reorder" | "ok") ||
          "all",
      });
      // server-side filtering already applied; local slicing for pagination parity
      const start = (input.page - 1) * input.limit;
      const rows = result.data as ReorderRow[];
      return {
        data: rows.slice(start, start + input.limit),
        meta: {
          page: input.page,
          limit: input.limit,
          total: rows.length,
          totalPages: Math.max(1, Math.ceil(rows.length / input.limit)),
        },
      };
    },
    columns,
    resetDeps: [warehouseId, statusFilter],
  });

  const deleteMutation = useMutation({
    mutationFn: (payload: { id: string }) =>
      trpcClient.reorder.deletePolicy.mutate(payload),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["reorderList"] }),
  });

  if (!canRead) {
    return (
      <Card>
        <Card.Content>
          <p className="text-sm text-danger">
            {intl.formatMessage({
              id: "reorder.permission_denied",
              defaultMessage:
                "You do not have permission to view reorder points.",
            })}
          </p>
        </Card.Content>
      </Card>
    );
  }

  const summary = list.query.data?.data
    ? {
        belowMin: list.query.data.data.filter(
          (row) => row.status === "below_min",
        ).length,
        belowReorder: list.query.data.data.filter(
          (row) => row.status === "below_reorder",
        ).length,
        ok: list.query.data.data.filter((row) => row.status === "ok").length,
      }
    : null;

  return (
    <section
      className="space-y-4"
      data-ai-context={JSON.stringify({ section: "reorder-points" })}
    >
      <PageHeader
        title={intl.formatMessage({
          id: "reorder.title",
          defaultMessage: "Reorder Points",
        })}
        onBack={() => window.history.back()}
      >
        {canManage ? (
          <Button
            variant="primary"
            onPress={() => {
              setForm(emptyForm());
              setDialogOpen(true);
            }}
          >
            <AppIcon name="plus" />
            {intl.formatMessage({
              id: "reorder.new_policy",
              defaultMessage: "New Policy",
            })}
          </Button>
        ) : null}
      </PageHeader>

      {summary ? (
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-1.5">
            {intl.formatMessage({
              id: "reorder.below_min",
              defaultMessage: "Below min",
            })}
            : <strong>{summary.belowMin}</strong>
          </span>
          <span className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-1.5">
            {intl.formatMessage({
              id: "reorder.below_reorder",
              defaultMessage: "Below reorder point",
            })}
            : <strong>{summary.belowReorder}</strong>
          </span>
          <span className="rounded-xl border border-success/40 bg-success/10 px-3 py-1.5">
            {intl.formatMessage({
              id: "reorder.ok",
              defaultMessage: "Healthy",
            })}
            : <strong>{summary.ok}</strong>
          </span>
        </div>
      ) : null}

      <Card>
        <Card.Content>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <TextField fullWidth className="max-w-48" name="warehouse-filter">
              <Label>
                {intl.formatMessage({
                  id: "reorder.filter_warehouse",
                  defaultMessage: "Warehouse",
                })}
              </Label>
              <Select
                selectedKey={warehouseId || null}
                onSelectionChange={(key) =>
                  setWarehouseId(typeof key === "string" ? key : "")
                }
                variant="secondary"
                aria-label={intl.formatMessage({
                  id: "reorder.filter_warehouse",
                  defaultMessage: "Warehouse",
                })}
              >
                <Select.Trigger>
                  <Select.Value>
                    {warehouses?.data.find((w) => w.id === warehouseId)?.name ??
                      intl.formatMessage({
                        id: "reorder.filter_all_warehouses",
                        defaultMessage: "All warehouses",
                      })}
                  </Select.Value>
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="__all" textValue="__all">
                      <Label>
                        {intl.formatMessage({
                          id: "reorder.filter_all_warehouses",
                          defaultMessage: "All warehouses",
                        })}
                      </Label>
                    </ListBox.Item>
                    {(warehouses?.data ?? []).map((w) => (
                      <ListBox.Item key={w.id} id={w.id} textValue={w.name}>
                        <Label>{w.name}</Label>
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </TextField>

            <TextField fullWidth className="max-w-44" name="status-filter">
              <Label>
                {intl.formatMessage({
                  id: "reorder.filter_status",
                  defaultMessage: "Status",
                })}
              </Label>
              <Select
                selectedKey={statusFilter}
                onSelectionChange={(key) =>
                  setStatusFilter(typeof key === "string" ? key : "all")
                }
                variant="secondary"
                aria-label={intl.formatMessage({
                  id: "reorder.filter_status",
                  defaultMessage: "Status",
                })}
              >
                <Select.Trigger>
                  <Select.Value>
                    {statusFilter === "all"
                      ? intl.formatMessage({
                          id: "reorder.filter_all",
                          defaultMessage: "All",
                        })
                      : statusFilter}
                  </Select.Value>
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {[
                      {
                        id: "all",
                        label: intl.formatMessage({
                          id: "reorder.filter_all",
                          defaultMessage: "All",
                        }),
                      },
                      {
                        id: "below_min",
                        label: intl.formatMessage({
                          id: "reorder.below_min",
                          defaultMessage: "Below min",
                        }),
                      },
                      {
                        id: "below_reorder",
                        label: intl.formatMessage({
                          id: "reorder.below_reorder",
                          defaultMessage: "Below reorder point",
                        }),
                      },
                      {
                        id: "ok",
                        label: intl.formatMessage({
                          id: "reorder.ok",
                          defaultMessage: "Healthy",
                        }),
                      },
                    ].map((opt) => (
                      <ListBox.Item key={opt.id} id={opt.id} textValue={opt.id}>
                        <Label>{opt.label}</Label>
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </TextField>
          </div>

          <DataTable
            table={list.table}
            columns={columns}
            isLoading={list.isLoading}
            error={
              list.query.isError
                ? {
                    message: intl.formatMessage({
                      id: "reorder.error_load",
                      defaultMessage: "Failed to load reorder policies.",
                    }),
                    onRetry: () => void list.query.refetch(),
                  }
                : undefined
            }
            emptyState={{
              icon: "box",
              message: intl.formatMessage({
                id: "reorder.empty",
                defaultMessage: "No reorder policies yet.",
              }),
            }}
            loadingMessage={intl.formatMessage({
              id: "common.loading",
              defaultMessage: "Loading…",
            })}
            ariaLabel={intl.formatMessage({
              id: "reorder.table_aria",
              defaultMessage: "Reorder policies",
            })}
            totalEntries={list.totalEntries}
            pageStart={list.pageStart}
            pageEnd={list.pageEnd}
          />
        </Card.Content>
      </Card>

      <PolicyDialog
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        form={form}
        setForm={setForm}
      />
    </section>
  );
}
