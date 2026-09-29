import type { ReactNode } from "react";
import { useAtomValue } from "jotai";
import { useMessage } from "../../lib/useMessage";
import { Card, Input, Label, Table, TextArea, TextField } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { z } from "zod";
import { trpcClient } from "../../lib/trpc";
import { hasPermissionAtom } from "../../lib/atoms";
import { useAiFillForm } from "../../components/AiAssistant/useAiFillForm";
import { SupplierSelectSearch } from "../../components/SupplierSelectSearch";
import { WarehouseSelectSearch } from "../../components/WarehouseSelectSearch";
import {
  DocHeaderCard,
  EditableLinesTable,
  FormFooterBar,
  FormPageShell,
  TransactionFormModal,
  useDocForm,
  type TransactionItemsColumn,
} from "../../components/form";

/**
 * Purchase orders have no shared form schema in `@repo/schemas` (the package
 * only ships the wire create/update schemas, which require supplier/warehouse/
 * items and would flag a pristine form). This page keeps the relaxed
 * all-optional form shape — same pattern as the `*FormSchema` exports used by
 * the other header+lines pages.
 */
const purchaseOrderFormSchema = z.object({
  supplierId: z.string().optional(),
  warehouseId: z.string().optional(),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        skuId: z.string().optional(),
        quantity: z.string().optional(),
        unitPrice: z.string().optional(),
        details: z.string().optional(),
      }),
    )
    .optional(),
});

interface FormItem {
  _id: string | null;
  skuId: string;
  quantity: string;
  unitPrice: string;
  details: string;
}

function emptyItem(): FormItem {
  return { _id: null, skuId: "", quantity: "1", unitPrice: "", details: "" };
}

type FormValues = {
  supplierId: string;
  warehouseId: string;
  expectedDate: string;
  notes: string;
  items: FormItem[];
};

/** Unwrap a tRPC vanilla-client query/procedure into its resolved wire type. */
type DetailOf<Q> = Q extends (...args: never[]) => Promise<infer R> ? R : never;

/** Client-side shape of `purchaseOrder.detail` (uses `status`, not `approvalStatus`). */
type PurchaseOrderDetail = DetailOf<
  typeof trpcClient.purchaseOrder.detail.query
>;

const defaultFormValues = (): FormValues => ({
  supplierId: "",
  warehouseId: "",
  expectedDate: "",
  notes: "",
  items: [emptyItem()],
});

const transformDetailToFormValues = (d: PurchaseOrderDetail): FormValues => {
  const items: FormItem[] =
    (d.items?.length ?? 0) > 0
      ? d.items.map((item) => ({
          _id: (item as { id?: string | null }).id ?? null,
          skuId: String(item.skuId ?? ""),
          quantity: String(item.quantity ?? "1"),
          unitPrice:
            item.unitPrice === null || item.unitPrice === undefined
              ? ""
              : String(item.unitPrice),
          details: String(item.details ?? ""),
        }))
      : [emptyItem()];
  return {
    supplierId: d.supplier?.id ?? "",
    warehouseId: d.warehouse?.id ?? "",
    expectedDate: d.expectedDate ? String(d.expectedDate).slice(0, 10) : "",
    notes: d.notes ?? "",
    items,
  };
};

interface Props {
  id?: string;
  isEdit: boolean;
  initialValues: FormValues | null;
  /** Detail still loading on edit pages — shell shows the spinner. */
  isLoading?: boolean;
  /** Not-found / wrong-status message on edit pages — shell shows the guard. */
  guard?: ReactNode;
}

const PurchaseOrderForm = ({
  id,
  isEdit,
  initialValues,
  isLoading = false,
  guard,
}: Props) => {
  const t = useMessage();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = isEdit
    ? hasPermission("purchase_order@update")
    : hasPermission("purchase_order@create");

  const modalMessages = {
    saving: t("po.form_saving", "Saving…"),
    successTitle: t("po.form_success_title", "Saved"),
    errorTitle: t("po.form_error_title", "Error"),
    confirmPropose: t("po.form_confirm_propose", "Confirm Propose"),
    confirmDraft: t("po.form_confirm_save", "Confirm Save"),
    confirmSave: t("po.form_confirm_save", "Confirm Save"),
    confirmProposeDesc: t(
      "po.form_confirm_propose_desc",
      "Propose this purchase order?",
    ),
    confirmDraftDesc: t(
      "po.form_confirm_save_desc",
      "Save this purchase order?",
    ),
    confirmSaveDesc: t(
      "po.form_confirm_save_desc",
      "Save this purchase order?",
    ),
    messageLabel: t("po.form_message_label", "Message"),
    messagePlaceholder: t(
      "po.form_message_placeholder",
      "Add a note (optional)",
    ),
    cancel: t("po.form_cancel", "Cancel"),
    confirm: t("po.form_confirm", "Confirm"),
    close: t("po.form_close", "Close"),
    viewDetail: t("po.form_view_detail", "View Detail"),
  };

  const { data: warehouseListData } = useQuery({
    queryKey: ["warehouseOptions"],
    queryFn: () =>
      trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 999 }),
  });
  const warehouses = warehouseListData?.data ?? [];

  const { data: supplierListData } = useQuery({
    queryKey: ["supplierOptions"],
    queryFn: () => trpcClient.supplier.list.query({ page: 1, limit: 999 }),
  });
  const suppliers = supplierListData?.data ?? [];

  const docForm = useDocForm<FormValues, any>({
    formId: "purchase-order-form",
    isEdit,
    id,
    initialValues,
    defaultValues: defaultFormValues,
    schema: purchaseOrderFormSchema,
    // Purchase orders keep a single save action (no draft/propose pair on the
    // form — the propose flow lives on the detail page). Creates go out with
    // the server-side DRAFT default; edits force `status` back to DRAFT,
    // exactly as the pre-kit page did.
    intentMode: "single-save",
    toPayload: (parsed) => {
      const items = (parsed.items as FormItem[]).map((item) => ({
        skuId: item.skuId,
        quantity: Number(item.quantity) || 0,
        unitPrice: item.unitPrice === "" ? undefined : Number(item.unitPrice),
        details: (item.details ?? "").trim() || undefined,
      }));
      const base = {
        supplierId: parsed.supplierId,
        warehouseId: parsed.warehouseId,
        expectedDate: parsed.expectedDate || undefined,
        notes: (parsed.notes ?? "").trim() || undefined,
        items,
      };
      return isEdit ? { ...base, approvalStatus: "DRAFT" } : base;
    },
    createCaller: (payload) => trpcClient.purchaseOrder.create.mutate(payload),
    updateCaller: (payload) => trpcClient.purchaseOrder.update.mutate(payload),
    listQueryKey: "purchaseOrderList",
    detailQueryKey: "purchaseOrderDetail",
    redirectOnSuccess: (savedId) => `/purchase-order/${savedId ?? id}`,
    modalMessages,
    successMessageCreate: t(
      "po.form_create_success",
      "Purchase order created.",
    ),
    successMessageUpdate: t(
      "po.form_update_success",
      "Purchase order updated.",
    ),
    errorFallback: t("error_generic", "An unexpected error occurred."),
    missingRequired: (values) => {
      const missing: string[] = [];
      if (!values.supplierId) missing.push("supplierId");
      if (!values.warehouseId) missing.push("warehouseId");
      const rows = Array.isArray(values.items) ? values.items : [];
      if (rows.length === 0) missing.push("items");
      rows.forEach((item, index) => {
        if (!item?.skuId) missing.push(`items[${index}].skuId`);
        if (!(Number(item?.quantity) > 0))
          missing.push(`items[${index}].quantity`);
      });
      return missing;
    },
    computeTotals: (values) => {
      const rows = Array.isArray(values.items) ? values.items : [];
      return {
        totalItems: rows.length,
        totalQuantity: rows.reduce(
          (sum, item) => sum + (Number(item.quantity) || 0),
          0,
        ),
      };
    },
    computeCanSubmit: (values) => {
      const rows = Array.isArray(values.items) ? values.items : [];
      return (
        Boolean(values.supplierId) &&
        Boolean(values.warehouseId) &&
        rows.length > 0 &&
        rows.every((item) => item.skuId && Number(item.quantity) > 0)
      );
    },
  });

  // The JSX below binds via `<form.Field>` — same form instance the hook owns.
  const form = docForm.form;

  const aiSetters: Record<string, (v: unknown) => void> = {
    supplierId: (v) => docForm.form.setFieldValue("supplierId", String(v)),
    expectedDate: (v) => {
      const s = String(v ?? "");
      docForm.form.setFieldValue(
        "expectedDate",
        s.length >= 10 ? s.slice(0, 10) : s,
      );
    },
    notes: (v) => docForm.form.setFieldValue("notes", String(v)),
    items: (v) => {
      if (!Array.isArray(v)) return;
      const items: FormItem[] = v.map((item: Record<string, unknown>) => ({
        _id: (item._id as string | null) ?? null,
        skuId: String(item.skuId ?? ""),
        quantity: String(item.quantity ?? "1"),
        unitPrice: String(item.unitPrice ?? ""),
        details: String(item.details ?? ""),
      }));
      docForm.form.setFieldValue(
        "items",
        items.length > 0 ? items : [emptyItem()],
      );
    },
  };
  // The warehouse is read-only on edit pages (fixed at order creation) — the
  // AI must not change it invisibly there.
  if (!isEdit) {
    aiSetters.warehouseId = (v) =>
      docForm.form.setFieldValue("warehouseId", String(v));
  }
  useAiFillForm(aiSetters);

  const values = docForm.formValues;
  const totalQty = (values.items ?? []).reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0,
  );
  const totalValue = (values.items ?? []).reduce(
    (sum, item) =>
      sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );
  const warehouseName = warehouses.find(
    (w) => w.id === values.warehouseId,
  )?.name;

  const columns: TransactionItemsColumn<FormItem>[] = [
    {
      key: "skuId",
      cell: "skuSelect",
      header: t("po.field_sku", "SKU"),
      ariaLabel: t("po.field_sku", "SKU"),
      placeholder: t("po.form_sku_placeholder", "Select SKU"),
      searchPlaceholder: t("po.form_sku_search", "Search SKU..."),
      emptyLabel: t("po.form_sku_empty", "No SKU found"),
      requiredMessage: t("po.form_sku_required", "SKU is required"),
    },
    {
      key: "quantity",
      cell: "number",
      header: t("po.field_quantity", "Qty (pallets)"),
      label: t("po.field_quantity", "Qty (pallets)"),
      min: 1,
      ruleMessage: t("po.form_qty_rule", "Must be at least 1"),
    },
    {
      key: "unitPrice",
      cell: "number",
      header: t("po.field_unit_price", "Unit price"),
      label: t("po.field_unit_price", "Unit price"),
      min: 0,
      ruleMessage: t("po.form_price_rule", "Must be at least 0"),
    },
  ];

  return (
    <FormPageShell
      formId="purchase-order-form"
      mode={isEdit ? "edit" : "create"}
      entityId={id}
      title={
        isEdit
          ? t("po.form_title_edit", "Edit Purchase Order")
          : t("po.form_title_create", "New Purchase Order")
      }
      backTo="/purchase-order"
      validationErrors={docForm.validationErrors}
      aiFields={["supplierId", "warehouseId", "expectedDate", "notes", "items"]}
      extraContext={{
        availableWarehouses: warehouses.map((w) => ({
          id: w.id,
          label: w.name,
        })),
        availableSuppliers: suppliers.map((s) => ({
          id: s.id,
          label: s.name ?? s.code ?? s.id,
        })),
      }}
      header={
        <DocHeaderCard
          title={t("po.section_parties_title", "Supplier & Delivery")}
          description={t(
            "po.section_parties_desc",
            "Who supplies the order and where the pallets should land.",
          )}
          icon="solar:cart-linear"
        >
          <form.Field
            name="supplierId"
            validators={{
              onChange: ({ value }) =>
                !value
                  ? t("po.form_supplier_required", "Supplier is required")
                  : undefined,
            }}
          >
            {(field) => (
              <SupplierSelectSearch
                queryKeyBase="poSupplier"
                value={field.state.value || ""}
                onChange={(v) => field.handleChange(String(v ?? ""))}
                label={t("po.field_supplier", "Supplier")}
                isDisabled={docForm.isSubmitting}
                isInvalid={field.state.meta.errors.length > 0}
                errorMessage={field.state.meta.errors.join(", ")}
              />
            )}
          </form.Field>
          {isEdit ? (
            <TextField
              isDisabled
              fullWidth
              value={warehouseName ?? ""}
              onChange={() => undefined}
            >
              <Label>{t("po.field_warehouse", "Warehouse")}</Label>
              <Input
                value={warehouseName ?? ""}
                variant="secondary"
                disabled
                aria-label={t("po.field_warehouse", "Warehouse")}
              />
            </TextField>
          ) : (
            <form.Field
              name="warehouseId"
              validators={{
                onChange: ({ value }) =>
                  !value
                    ? t("po.form_warehouse_required", "Warehouse is required")
                    : undefined,
              }}
            >
              {(field) => (
                <WarehouseSelectSearch
                  queryKeyBase="po-warehouse"
                  value={field.state.value || ""}
                  onChange={(v) => field.handleChange(String(v ?? ""))}
                  label={t("po.field_warehouse", "Warehouse")}
                  ariaLabel={t("po.field_warehouse", "Warehouse")}
                  placeholder={t("common.select_placeholder", "Select…")}
                  searchPlaceholder={t(
                    "po.form_warehouse_search",
                    "Search warehouse...",
                  )}
                  emptyLabel={t(
                    "po.form_warehouse_empty",
                    "No warehouse found",
                  )}
                  isDisabled={docForm.isSubmitting}
                  isInvalid={field.state.meta.errors.length > 0}
                  errorMessage={field.state.meta.errors.join(", ")}
                />
              )}
            </form.Field>
          )}
          <form.Field name="expectedDate">
            {(field) => (
              <TextField
                fullWidth
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              >
                <Label>{t("po.field_expected", "Expected date")}</Label>
                <Input
                  type="date"
                  variant="secondary"
                  aria-label={t("po.field_expected", "Expected date")}
                />
              </TextField>
            )}
          </form.Field>
          <form.Field name="notes">
            {(field) => (
              <TextField
                isDisabled={docForm.isSubmitting}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
                fullWidth
              >
                <Label>{t("po.field_notes", "Notes")}</Label>
                <TextArea
                  rows={4}
                  variant="secondary"
                  placeholder={t(
                    "po.notes_placeholder",
                    "e.g. Split delivery — first drop arrives Friday",
                  )}
                />
              </TextField>
            )}
          </form.Field>
        </DocHeaderCard>
      }
      aside={
        <Card>
          <Card.Header>
            <Card.Title>{t("po.preview_title", "Order Preview")}</Card.Title>
            <Card.Description>
              {t(
                "po.preview_desc",
                "Live summary of the purchase order you are building.",
              )}
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <dl className="space-y-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">
                  {t("po.field_supplier", "Supplier")}
                </dt>
                <dd className="text-foreground">
                  {values.supplierId ? "✓" : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">
                  {t("po.field_warehouse", "Warehouse")}
                </dt>
                <dd className="text-right font-medium text-foreground">
                  {warehouseName ?? "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">
                  {t("po.field_expected", "Expected date")}
                </dt>
                <dd className="text-right font-medium text-foreground">
                  {values.expectedDate || "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">
                  {t("po.preview_lines", "Line items")}
                </dt>
                <dd className="font-semibold text-foreground">
                  {values.items.length > 1 || values.items[0]?.skuId
                    ? values.items.length
                    : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">
                  {t("po.preview_pallets", "Pallets")}
                </dt>
                <dd className="font-semibold text-foreground">
                  {totalQty > 0 ? totalQty : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">
                  {t("po.preview_value", "Est. value")}
                </dt>
                <dd className="font-semibold tabular-nums text-success">
                  {totalValue > 0 ? totalValue.toLocaleString() : "—"}
                </dd>
              </div>
            </dl>
          </Card.Content>
        </Card>
      }
      below={
        <form.Field name="items">
          {(itemsField) => (
            <EditableLinesTable
              field={itemsField}
              columns={columns}
              createItem={emptyItem}
              isDisabled={docForm.isSubmitting}
              title={t("po.items_section", "Items")}
              description={t(
                "po.section_items_desc",
                "The SKUs, pallet quantities, and agreed unit prices.",
              )}
              icon="solar:box-linear"
              labels={{
                add: t("po.add_item", "Add item"),
                empty: t(
                  "po.form_no_items",
                  'No items. Click "Add Item" to start.',
                ),
                aria: t("po.form_items_aria", "Purchase order items"),
              }}
              totalsFooter={
                <Table.Row>
                  <Table.Cell />
                  <Table.Cell />
                  <Table.Cell>
                    <span className="text-xs font-semibold text-muted">
                      {t("po.preview_value", "Est. value")}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="font-semibold tabular-nums text-success">
                      {totalValue > 0 ? totalValue.toLocaleString() : "0"}
                    </span>
                  </Table.Cell>
                  <Table.Cell />
                </Table.Row>
              }
            />
          )}
        </form.Field>
      }
      footer={
        <FormFooterBar
          mode="single-save"
          canSave={canSave}
          canSubmit={docForm.canSubmit}
          isSubmitting={docForm.isSubmitting}
          isDirty={docForm.isDirty}
          isEdit={isEdit}
          totals={{
            items: docForm.totals?.totalItems ?? 0,
            quantity: docForm.totals?.totalQuantity ?? 0,
            amount: totalValue > 0 ? totalValue : undefined,
          }}
          labels={{
            save: isEdit
              ? t("po.submit_update", "Save Changes")
              : t("po.submit_create", "Create Order"),
            incomplete: t(
              "po.form_incomplete",
              "Supplier, warehouse & items required",
            ),
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
      isLoading={isLoading}
      guard={guard}
      isDisabled={docForm.isSubmitting}
    />
  );
};

const PurchaseOrderFormPage = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const {
    data: detailData,
    isLoading: detailLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["purchaseOrderDetail", id],
    queryFn: () => trpcClient.purchaseOrder.detail.query({ id: id ?? "" }),
    enabled: isEdit,
  });

  const detail = detailData as PurchaseOrderDetail | undefined;
  const initialValues =
    isEdit && detail ? transformDetailToFormValues(detail) : null;

  let guard: ReactNode = null;
  if (isEdit && isError) {
    guard = (
      <p className="text-sm text-danger">
        {(error as Error | null)?.message ?? "Failed to load purchase order."}
      </p>
    );
  } else if (isEdit && !detail && !detailLoading) {
    guard = <p className="text-sm text-danger">Purchase order not found.</p>;
  } else if (
    isEdit &&
    detail &&
    !["DRAFT", "REJECTED"].includes(detail.status)
  ) {
    guard = (
      <p className="text-sm text-warning">
        This purchase order cannot be edited in its current state.
      </p>
    );
  }

  return (
    <PurchaseOrderForm
      id={id}
      isEdit={isEdit}
      initialValues={initialValues}
      isLoading={isEdit && detailLoading}
      guard={guard}
    />
  );
};

export { PurchaseOrderFormPage };
