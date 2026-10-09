import { useMessage } from "../../lib/useMessage";
import { useQuery } from "@tanstack/react-query";
import { Chip, Label, ListBox, Select, Switch, TextArea } from "@heroui/react";
import { AppIcon } from "../../components/AppIcon";
import { z } from "zod";
import { SkuSelectSearch } from "../../components/SkuSelectSearch";
import { trpcClient } from "../../lib/trpc";
import {
  DocHeaderCard,
  FormAiTip,
  FormFooterBar,
  FormPageShell,
  FormPreviewCard,
  TransactionFormModal,
  useDocForm,
} from "../../components/form";

type FormValues = {
  warehouseId: string;
  isBlindCount: boolean;
  skuId: string;
  notes: string;
};

/**
 * Stock counts have no shared form schema in `@repo/schemas` (the package only
 * ships the wire create schema, which requires a warehouse and would flag a
 * pristine form). Keep the relaxed all-optional form shape — same pattern as
 * the purchase-order page's local form schema.
 */
const stockCountFormSchema = z.object({
  warehouseId: z.string().optional(),
  isBlindCount: z.boolean().optional(),
  skuId: z.string().optional(),
  notes: z.string().optional(),
});

const defaultFormValues = (): FormValues => ({
  warehouseId: "",
  isBlindCount: true,
  skuId: "",
  notes: "",
});

export function StockCountFormPage() {
  const t = useMessage();

  const { data: warehouses } = useQuery({
    queryKey: ["warehouseListForFilter"],
    queryFn: () =>
      trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const modalMessages = {
    saving: t("stock_count.form_saving", "Saving…"),
    successTitle: t("stock_count.form_success_title", "Saved"),
    errorTitle: t("stock_count.form_error_title", "Error"),
    confirmPropose: t("stock_count.form_confirm_propose", "Confirm Propose"),
    confirmDraft: t("stock_count.form_confirm_save", "Confirm Save"),
    confirmSave: t("stock_count.form_confirm_save", "Confirm Save"),
    confirmProposeDesc: t(
      "stock_count.form_confirm_propose_desc",
      "Propose this count?",
    ),
    confirmDraftDesc: t(
      "stock_count.form_confirm_save_desc",
      "Start this count?",
    ),
    confirmSaveDesc: t(
      "stock_count.form_confirm_save_desc",
      "Start this count?",
    ),
    messageLabel: t("stock_count.form_message_label", "Message"),
    messagePlaceholder: t(
      "stock_count.form_message_placeholder",
      "Add a note (optional)",
    ),
    cancel: t("action_cancel", "Cancel"),
    confirm: t("stock_count.form_confirm", "Confirm"),
    close: t("stock_count.form_close", "Close"),
    viewDetail: t("stock_count.form_view_detail", "View Detail"),
  };

  // Create-only page (route-guarded, no permission atom today): single Save
  // action, count lines are server-snapshotted on create — no lines table.
  const docForm = useDocForm<FormValues, any>({
    formId: "stock-count-form",
    isEdit: false,
    initialValues: null,
    defaultValues: defaultFormValues,
    schema: stockCountFormSchema,
    intentMode: "single-save",
    toPayload: (parsed) => ({
      warehouseId: parsed.warehouseId,
      isBlindCount: parsed.isBlindCount ?? true,
      // Single-select filter: omit the key entirely so the server snapshots
      // every SKU in the warehouse (see `createStockCountSchema.skuIds`).
      skuIds: parsed.skuId ? [parsed.skuId] : undefined,
      notes: (parsed.notes ?? "").trim() || undefined,
    }),
    createCaller: (payload) => trpcClient.stockCount.create.mutate(payload),
    listQueryKey: "stockCountList",
    detailQueryKey: "stockCountDetail",
    redirectOnSuccess: (savedId) => `/stock-count/${savedId ?? ""}`,
    modalMessages,
    successMessageCreate: t(
      "stock_count.form_create_success",
      "Cycle count created.",
    ),
    successMessageUpdate: t(
      "stock_count.form_update_success",
      "Cycle count updated.",
    ),
    errorFallback: t("stock_count.form_error", "Failed to create count"),
    missingRequired: (values) => (values.warehouseId ? [] : ["warehouseId"]),
    computeCanSubmit: (values) => Boolean(values.warehouseId),
  });

  // The JSX below binds via `<form.Field>` — same form instance the hook owns.
  const form = docForm.form;

  const values = docForm.formValues;
  const warehouseName = warehouses?.data.find(
    (w) => w.id === values.warehouseId,
  )?.name;
  const selectedSkuId = values.skuId;

  // Resolve the chosen SKU's code for the preview row (the picker only hands
  // back an id).
  const { data: selectedSku } = useQuery({
    queryKey: ["stockCountSkuLabel", selectedSkuId],
    queryFn: () => trpcClient.sku.detail.query({ id: selectedSkuId }),
    enabled: Boolean(selectedSkuId),
    staleTime: 5 * 60 * 1000,
  });
  const skuFilterLabel = selectedSku
    ? `${selectedSku.code ?? selectedSkuId}`
    : selectedSkuId || undefined;

  return (
    <FormPageShell
      formId="stock-count-form"
      mode="create"
      title={t("stock_count.form_title", "New Cycle Count")}
      backTo="/stock-count"
      validationErrors={docForm.validationErrors}
      aiFields={["warehouseId", "isBlindCount", "skuId", "notes"]}
      extraContext={{
        availableWarehouses: (warehouses?.data ?? []).map((w) => ({
          id: w.id,
          label: w.name,
        })),
      }}
      statusChip={
        warehouseName ? (
          <Chip size="sm" variant="soft" color="accent">
            <span className="inline-flex items-center gap-1">
              <AppIcon name="building" className="size-3.5" />
              {warehouseName}
            </span>
          </Chip>
        ) : undefined
      }
      header={
        <>
          <DocHeaderCard
            title={t("stock_count.form_section", "Count Session")}
            description={t(
              "stock_count.form_description",
              "All available pallets in the selected warehouse are snapshotted as count lines.",
            )}
            icon="building"
            columns={false}
          >
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <form.Field name="warehouseId">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="stock-count-warehouse">
                        {t("stock_count.field_warehouse", "Warehouse")}
                      </Label>
                      <Select
                        id="stock-count-warehouse"
                        selectedKey={field.state.value || null}
                        onSelectionChange={(key) =>
                          field.handleChange(typeof key === "string" ? key : "")
                        }
                        variant="secondary"
                        fullWidth
                        isDisabled={docForm.isSubmitting}
                        aria-label={t(
                          "stock_count.field_warehouse",
                          "Warehouse",
                        )}
                      >
                        <Select.Trigger>
                          <Select.Value>
                            {warehouseName ??
                              t("common.select_placeholder", "Select…")}
                          </Select.Value>
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {(warehouses?.data ?? []).map((w) => (
                              <ListBox.Item
                                key={w.id}
                                id={w.id}
                                textValue={w.name}
                              >
                                <Label>{w.name}</Label>
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>
                  )}
                </form.Field>

                <form.Field name="isBlindCount">
                  {(field) => (
                    <div className="flex flex-row items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <Label htmlFor="blind-count">
                          {t("stock_count.field_blind", "Blind count")}
                        </Label>
                        <span className="text-sm text-muted">
                          {t(
                            "stock_count.field_blind_hint",
                            "Hide system quantities so counters enter what they actually find.",
                          )}
                        </span>
                      </div>
                      <Switch
                        id="blind-count"
                        isSelected={field.state.value}
                        isDisabled={docForm.isSubmitting}
                        onChange={(selected) =>
                          field.handleChange(Boolean(selected))
                        }
                      >
                        <Switch.Content>
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                        </Switch.Content>
                      </Switch>
                    </div>
                  )}
                </form.Field>
              </div>

              <form.Field name="skuId">
                {(field) => (
                  <SkuSelectSearch
                    queryKeyBase="stockCountSku"
                    value={field.state.value}
                    onChange={(value) => field.handleChange(value)}
                    label={t(
                      "stock_count.field_sku_filter",
                      "SKU filter (optional)",
                    )}
                    placeholder={t(
                      "stock_count.field_sku_filter_placeholder",
                      "All SKUs in this warehouse",
                    )}
                    searchPlaceholder={t(
                      "stock_count.field_sku_filter_search",
                      "Search SKU code or name",
                    )}
                    emptyLabel={t(
                      "stock_count.field_sku_filter_empty",
                      "No SKUs found",
                    )}
                    loadingLabel={t(
                      "stock_count.field_sku_filter_loading",
                      "Loading SKUs…",
                    )}
                    isDisabled={docForm.isSubmitting}
                    ariaLabel={t(
                      "stock_count.field_sku_filter",
                      "SKU filter (optional)",
                    )}
                  />
                )}
              </form.Field>
            </div>
          </DocHeaderCard>

          <DocHeaderCard
            title={t("stock_count.field_notes", "Notes")}
            description={t(
              "stock_count.form_notes_desc",
              "Anything the counting team should know before they start.",
            )}
            icon="document"
            columns={false}
          >
            <form.Field name="notes">
              {(field) => (
                <TextArea
                  aria-label={t("stock_count.field_notes", "Notes")}
                  placeholder={t(
                    "stock_count.notes_placeholder",
                    "e.g. Section A is being reorganized — start from Section B",
                  )}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  rows={4}
                  fullWidth
                  variant="secondary"
                />
              )}
            </form.Field>
          </DocHeaderCard>
        </>
      }
      aside={
        <FormPreviewCard
          title={t("stock_count.preview_title", "Session Preview")}
          icon="clipboard-list"
          description={t(
            "stock_count.preview_desc",
            "Live summary of the count you are about to start.",
          )}
          fillLabel={t("form.preview_fill", "Completed")}
          rows={[
            {
              label: t("stock_count.field_warehouse", "Warehouse"),
              value: warehouseName,
              icon: "building",
              tone: "accent",
            },
            {
              label: t("stock_count.field_blind", "Blind count"),
              value: values.isBlindCount
                ? t("stock_count.preview_on", "On")
                : t("stock_count.preview_off", "Off"),
              icon: values.isBlindCount ? "eye-off" : "eye",
              tone: values.isBlindCount ? "warning" : "default",
            },
            {
              label: t("stock_count.field_sku_filter", "SKU filter"),
              value:
                skuFilterLabel ?? t("stock_count.preview_all_skus", "All SKUs"),
              icon: "box-search",
            },
            {
              label: t("stock_count.field_notes", "Notes"),
              value: values.notes,
              icon: "document",
            },
          ]}
          footer={<FormAiTip />}
        />
      }
      footer={
        <FormFooterBar
          mode="single-save"
          // Route-guarded page — no permission gate today (no hasPermissionAtom).
          canSave
          canSubmit={docForm.canSubmit}
          isSubmitting={docForm.isSubmitting}
          isDirty={docForm.isDirty}
          isEdit={false}
          labels={{
            save: t("stock_count.form_submit", "Start Count"),
            incomplete: t("stock_count.form_incomplete", "Warehouse required"),
          }}
          onSave={() => docForm.handleActionConfirm("SAVE")}
        />
      }
      modal={
        <TransactionFormModal
          modalStage={docForm.modalStage}
          intent={docForm.intent}
          resultMessage={docForm.resultMessage}
          approvalMessage={docForm.approvalMessage}
          onApprovalMessageChange={docForm.setApprovalMessage}
          messages={modalMessages}
          onModalClose={docForm.handleModalClose}
          onConfirmSubmit={docForm.handleConfirmSubmit}
          onViewDetail={docForm.handleViewDetail}
        />
      }
      isDisabled={docForm.isSubmitting}
    />
  );
}
