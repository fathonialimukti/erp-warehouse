import type { ReactNode } from "react";
import { useAtomValue } from "jotai";
import { useMessage } from "../../../lib/useMessage";
import { Card, Input, Label, TextArea, TextField } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { trpcClient } from "../../../lib/trpc";
import { hasPermissionAtom } from "../../../lib/atoms";
import { useAiFillForm } from "../../../components/AiAssistant/useAiFillForm";
import { FormDatePicker } from "../../../components/FormDatePicker";
import { WarehouseSelectSearch } from "../../../components/WarehouseSelectSearch";
import { SupplierSelectSearch } from "../../../components/SupplierSelectSearch";
import {
  fromDateToLocal,
  getLocalTimeZone,
  today,
} from "@internationalized/date";
import type { DateValue } from "@internationalized/date";
import { returnToSupplierFormSchema } from "@repo/schemas/return-to-supplier";
import {
  DocHeaderCard,
  EditableLinesTable,
  FormFooterBar,
  FormPageShell,
  TransactionFormModal,
  toFooterTotals,
  useDocForm,
  useTransactionFormPage,
  type TransactionItemsColumn,
} from "../../../components/form";

interface FormItem {
  _id: string | null;
  skuId: string;
  quantity: string;
  details: string;
}

function createFormItem(): FormItem {
  return { _id: null, skuId: "", quantity: "1", details: "" };
}

type FormValues = {
  documentNumber: string;
  date: DateValue | null;
  supplierId: string;
  originalReceivingId: string;
  returnReason: string;
  reference: string;
  notes: string;
  warehouseId: string;
  items: FormItem[];
};

/** Unwrap a tRPC vanilla-client query/procedure into its resolved wire type. */
type DetailOf<Q> = Q extends (...args: never[]) => Promise<infer R> ? R : never;

/** Client-side shape of `returnToSupplier.detail`. */
type ReturnToSupplierDetail = DetailOf<
  typeof trpcClient.returnToSupplier.detail.query
>;

const defaultFormValues = (): FormValues => ({
  documentNumber: "",
  date: today(getLocalTimeZone()),
  supplierId: "",
  originalReceivingId: "",
  returnReason: "",
  reference: "",
  notes: "",
  warehouseId: "",
  items: [createFormItem()],
});

const transformDetailToFormValues = (d: ReturnToSupplierDetail): FormValues => {
  const items: FormItem[] =
    (d.items?.length ?? 0) > 0
      ? d.items.map((item) => ({
          _id: (item as { _id?: string | null })._id ?? null,
          skuId: String(item.skuId ?? ""),
          quantity: String(item.quantity ?? "1"),
          details: String(item.details ?? ""),
        }))
      : [createFormItem()];
  return {
    documentNumber: d.documentNumber ?? "",
    date: d.date
      ? fromDateToLocal(new Date(d.date))
      : today(getLocalTimeZone()),
    supplierId: d.supplierId ?? "",
    originalReceivingId: d.originalReceivingId ?? "",
    returnReason: d.returnReason ?? "",
    reference: d.reference ?? "",
    notes: d.notes ?? "",
    warehouseId: d.warehouseId ?? "",
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

const ReturnToSupplierForm = ({
  id,
  isEdit,
  initialValues,
  isLoading = false,
  guard,
}: Props) => {
  const t = useMessage();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = isEdit
    ? hasPermission("return-to-supplier@update")
    : hasPermission("return-to-supplier@create");

  const modalMessages = {
    saving: t("return_to_supplier.form_saving", "Saving…"),
    successTitle: t("return_to_supplier.form_success_title", "Saved"),
    errorTitle: t("return_to_supplier.form_error_title", "Error"),
    confirmPropose: t(
      "return_to_supplier.form_confirm_propose",
      "Confirm Propose",
    ),
    confirmDraft: t(
      "return_to_supplier.form_confirm_draft",
      "Confirm Save Draft",
    ),
    confirmProposeDesc: t(
      "return_to_supplier.form_confirm_propose_desc",
      "Propose this return?",
    ),
    confirmDraftDesc: t(
      "return_to_supplier.form_confirm_draft_desc",
      "Save as draft?",
    ),
    messageLabel: t("return_to_supplier.form_message_label", "Message"),
    messagePlaceholder: t(
      "return_to_supplier.form_message_placeholder",
      "Add a note (optional)",
    ),
    cancel: t("return_to_supplier.form_cancel", "Cancel"),
    confirm: t("return_to_supplier.form_confirm", "Confirm"),
    close: t("return_to_supplier.form_close", "Close"),
    viewDetail: t("return_to_supplier.form_view_detail", "View Detail"),
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
    formId: "return-to-supplier-form",
    isEdit,
    id,
    initialValues,
    defaultValues: defaultFormValues,
    schema: returnToSupplierFormSchema,
    toPayload: (parsed, intent, approvalMessage) => {
      const dateJs = parsed.date?.toDate
        ? parsed.date.toDate(getLocalTimeZone())
        : new Date();
      const items = (parsed.items as FormItem[]).map((item) => ({
        skuId: item.skuId,
        quantity: Number(item.quantity),
        details: item.details || undefined,
      }));
      return {
        documentNumber: parsed.documentNumber || undefined,
        date: dateJs,
        supplierId: parsed.supplierId,
        originalReceivingId: parsed.originalReceivingId || undefined,
        returnReason: parsed.returnReason || undefined,
        reference: parsed.reference || undefined,
        notes: parsed.notes || undefined,
        warehouseId: parsed.warehouseId,
        approvalStatus: intent,
        message: approvalMessage || undefined,
        items,
      };
    },
    createCaller: (payload) =>
      trpcClient.returnToSupplier.create.mutate(payload),
    updateCaller: (payload) =>
      trpcClient.returnToSupplier.update.mutate(payload),
    listQueryKey: "returnToSupplierList",
    detailQueryKey: "returnToSupplierDetail",
    redirectOnSuccess: (savedId) =>
      `/outbound-transaction/return-to-supplier/${savedId ?? id}`,
    modalMessages,
    successMessageCreate: t(
      "return_to_supplier.form_create_success",
      "Return to supplier created.",
    ),
    successMessageUpdate: t(
      "return_to_supplier.form_update_success",
      "Return to supplier updated.",
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

  useAiFillForm({
    documentNumber: (v) =>
      docForm.form.setFieldValue("documentNumber", String(v)),
    supplierId: (v) => docForm.form.setFieldValue("supplierId", String(v)),
    originalReceivingId: (v) =>
      docForm.form.setFieldValue("originalReceivingId", String(v)),
    returnReason: (v) => docForm.form.setFieldValue("returnReason", String(v)),
    reference: (v) => docForm.form.setFieldValue("reference", String(v)),
    notes: (v) => docForm.form.setFieldValue("notes", String(v)),
    warehouseId: (v) => docForm.form.setFieldValue("warehouseId", String(v)),
    items: (v) => {
      if (!Array.isArray(v)) return;
      const items: FormItem[] = v.map((item: Record<string, unknown>) => ({
        _id: (item._id as string | null) ?? null,
        skuId: String(item.skuId ?? ""),
        quantity: String(item.quantity ?? "1"),
        details: String(item.details ?? ""),
      }));
      docForm.form.setFieldValue(
        "items",
        items.length > 0 ? items : [createFormItem()],
      );
    },
  });

  const values = docForm.formValues;
  const formItems = values.items ?? [];
  const itemCount = formItems.length;
  const totalQuantity = formItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0,
  );
  const warehouseName = warehouses.find(
    (w) => w.id === values.warehouseId,
  )?.name;
  const supplierName = suppliers.find((s) => s.id === values.supplierId)?.name;

  const columns: TransactionItemsColumn<FormItem>[] = [
    {
      key: "skuId",
      cell: "skuSelect",
      header: t("return_to_supplier.col_sku", "SKU"),
      ariaLabel: t("return_to_supplier.col_sku", "SKU"),
      placeholder: t("return_to_supplier.form_sku_placeholder", "Select SKU"),
      searchPlaceholder: t(
        "return_to_supplier.form_sku_search",
        "Search SKU...",
      ),
      emptyLabel: t("return_to_supplier.form_sku_empty", "No SKU found"),
      requiredMessage: t(
        "return_to_supplier.form_sku_required",
        "SKU is required",
      ),
    },
    {
      key: "details",
      cell: "text",
      header: t("return_to_supplier.col_details", "Details"),
      label: t("return_to_supplier.col_details", "Details"),
      placeholder: t(
        "return_to_supplier.form_details_placeholder",
        "Item notes",
      ),
    },
    {
      key: "quantity",
      cell: "number",
      header: t("return_to_supplier.col_quantity", "Qty"),
      label: t("return_to_supplier.col_quantity", "Qty"),
      min: 1,
      ruleMessage: t("return_to_supplier.form_qty_rule", "Must be at least 1"),
    },
  ];

  return (
    <FormPageShell
      formId="return-to-supplier-form"
      mode={isEdit ? "edit" : "create"}
      entityId={id}
      title={
        isEdit
          ? t("return_to_supplier.form_edit_title", "Edit Return to Supplier")
          : t("return_to_supplier.form_new_title", "New Return to Supplier")
      }
      backTo="/outbound-transaction"
      validationErrors={docForm.validationErrors}
      aiFields={[
        "documentNumber",
        "date",
        "supplierId",
        "originalReceivingId",
        "returnReason",
        "reference",
        "notes",
        "warehouseId",
        "items",
      ]}
      header={
        <DocHeaderCard
          title={t(
            "return_to_supplier.form_section_general",
            "General Information",
          )}
          description={t(
            "return_to_supplier.form_section_general_desc",
            "Which supplier takes it back and which receipt it came from.",
          )}
          icon="document"
        >
          <form.Field name="documentNumber">
            {(field) => (
              <TextField
                isDisabled={docForm.isSubmitting}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              >
                <Label>
                  {t(
                    "return_to_supplier.form_document_number",
                    "Document Number",
                  )}
                </Label>
                <Input
                  variant="secondary"
                  placeholder={t(
                    "return_to_supplier.form_document_number_placeholder",
                    "Auto-generated if blank",
                  )}
                />
              </TextField>
            )}
          </form.Field>
          <form.Field name="date">
            {(field) => (
              <FormDatePicker
                label={t("return_to_supplier.form_date", "Date")}
                value={field.state.value}
                onChange={field.handleChange}
                isDisabled={docForm.isSubmitting}
              />
            )}
          </form.Field>
          <form.Field
            name="warehouseId"
            validators={{
              onChange: ({ value }) =>
                !value
                  ? t(
                      "return_to_supplier.form_warehouse_required",
                      "Warehouse is required",
                    )
                  : undefined,
            }}
          >
            {(field) => (
              <WarehouseSelectSearch
                queryKeyBase="return-to-supplier-warehouse"
                value={field.state.value || ""}
                onChange={(v) => field.handleChange(String(v ?? ""))}
                label={t("return_to_supplier.form_warehouse", "Warehouse")}
                ariaLabel={t("return_to_supplier.form_warehouse", "Warehouse")}
                placeholder={t(
                  "return_to_supplier.form_warehouse_placeholder",
                  "Select warehouse",
                )}
                searchPlaceholder={t(
                  "return_to_supplier.form_warehouse_search",
                  "Search warehouse...",
                )}
                emptyLabel={t(
                  "return_to_supplier.form_warehouse_empty",
                  "No warehouse found",
                )}
                isDisabled={docForm.isSubmitting}
                isInvalid={field.state.meta.errors.length > 0}
                errorMessage={field.state.meta.errors.join(", ")}
              />
            )}
          </form.Field>
          <form.Field
            name="supplierId"
            validators={{
              onChange: ({ value }) =>
                !value
                  ? t(
                      "return_to_supplier.form_supplier_required",
                      "Supplier is required",
                    )
                  : undefined,
            }}
          >
            {(field) => (
              <SupplierSelectSearch
                queryKeyBase="return-to-supplier-supplier"
                value={field.state.value || ""}
                onChange={(v) => field.handleChange(String(v ?? ""))}
                label={t("return_to_supplier.form_supplier", "Supplier")}
                ariaLabel={t("return_to_supplier.form_supplier", "Supplier")}
                placeholder={t(
                  "return_to_supplier.form_supplier_placeholder",
                  "Select supplier",
                )}
                searchPlaceholder={t(
                  "return_to_supplier.form_supplier_search",
                  "Search supplier...",
                )}
                emptyLabel={t(
                  "return_to_supplier.form_supplier_empty",
                  "No supplier found",
                )}
                isDisabled={docForm.isSubmitting}
                isInvalid={field.state.meta.errors.length > 0}
                errorMessage={field.state.meta.errors.join(", ")}
              />
            )}
          </form.Field>
          <form.Field name="originalReceivingId">
            {(field) => (
              <TextField
                isDisabled={docForm.isSubmitting}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              >
                <Label>
                  {t(
                    "return_to_supplier.form_original_receiving_id",
                    "Original Receiving ID",
                  )}
                </Label>
                <Input
                  variant="secondary"
                  placeholder={t(
                    "return_to_supplier.form_original_receiving_id_placeholder",
                    "Original receiving ID",
                  )}
                />
              </TextField>
            )}
          </form.Field>
          <form.Field name="returnReason">
            {(field) => (
              <TextField
                isDisabled={docForm.isSubmitting}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              >
                <Label>
                  {t("return_to_supplier.form_return_reason", "Return Reason")}
                </Label>
                <Input
                  variant="secondary"
                  placeholder={t(
                    "return_to_supplier.form_return_reason_placeholder",
                    "Reason for return",
                  )}
                />
              </TextField>
            )}
          </form.Field>
          <form.Field name="reference">
            {(field) => (
              <TextField
                isDisabled={docForm.isSubmitting}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              >
                <Label>
                  {t("return_to_supplier.form_reference", "Reference")}
                </Label>
                <Input
                  variant="secondary"
                  placeholder={t(
                    "return_to_supplier.form_reference_placeholder",
                    "Reference number",
                  )}
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
                <Label>{t("return_to_supplier.form_notes", "Notes")}</Label>
                <TextArea
                  rows={4}
                  variant="secondary"
                  placeholder={t(
                    "return_to_supplier.form_notes_placeholder",
                    "Add notes",
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
            <Card.Title>
              {t("return_to_supplier.preview_title", "Return Preview")}
            </Card.Title>
            <Card.Description>
              {t(
                "return_to_supplier.preview_desc",
                "Live summary of the stock you are sending back.",
              )}
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <dl className="space-y-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">
                  {t(
                    "return_to_supplier.form_document_number",
                    "Document Number",
                  )}
                </dt>
                <dd className="font-mono text-foreground">
                  {values.documentNumber ||
                    t("return_to_supplier.form_auto", "Auto")}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">
                  {t("return_to_supplier.form_warehouse", "Warehouse")}
                </dt>
                <dd className="text-right font-medium text-foreground">
                  {warehouseName ?? "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">
                  {t("return_to_supplier.form_supplier", "Supplier")}
                </dt>
                <dd className="text-right font-medium text-foreground">
                  {supplierName ?? "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">
                  {t(
                    "return_to_supplier.form_original_receiving_id",
                    "Original Receiving ID",
                  )}
                </dt>
                <dd className="text-right font-medium text-foreground">
                  {values.originalReceivingId || "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">
                  {t("return_to_supplier.preview_items", "Items")}
                </dt>
                <dd className="font-semibold text-foreground">
                  {itemCount > 0
                    ? `${itemCount} · ${totalQuantity} ${t("return_to_supplier.preview_qty_suffix", "qty")}`
                    : "—"}
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
              createItem={createFormItem}
              isDisabled={docForm.isSubmitting}
              title={t("return_to_supplier.form_items_title", "Items")}
              description={t(
                "return_to_supplier.form_items_desc",
                "SKUs going back to the supplier.",
              )}
              labels={{
                add: t("return_to_supplier.form_add_item", "Add Item"),
                empty: t(
                  "return_to_supplier.form_no_items",
                  'No items. Click "Add Item" to start.',
                ),
                aria: t("return_to_supplier.form_items_aria", "Return items"),
              }}
            />
          )}
        </form.Field>
      }
      footer={
        <FormFooterBar
          canSave={canSave}
          canSubmit={docForm.canSubmit}
          isSubmitting={docForm.isSubmitting}
          isDirty={docForm.isDirty}
          isEdit={isEdit}
          totals={toFooterTotals(docForm.totals)}
          labels={{
            saveDraft: t("return_to_supplier.form_save_draft", "Save Draft"),
            propose: t("return_to_supplier.form_propose", "Propose"),
          }}
          onSaveDraft={() => docForm.handleActionConfirm("DRAFT")}
          onPropose={() => docForm.handleActionConfirm("PROPOSED")}
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

const ReturnToSupplierFormPage = () => {
  const {
    id,
    isEdit,
    detail,
    isLoading,
    isError,
    error,
    initialValues,
    canEdit,
  } = useTransactionFormPage<ReturnToSupplierDetail, FormValues>({
    queryKey: "returnToSupplierDetail",
    detailQuery: (input) => trpcClient.returnToSupplier.detail.query(input),
    transform: transformDetailToFormValues,
  });

  let guard: ReactNode = null;
  if (isEdit && isError) {
    guard = (
      <p className="text-sm text-danger">
        {(error as Error | null)?.message ?? "Failed to load transaction."}
      </p>
    );
  } else if (isEdit && !detail) {
    guard = <p className="text-sm text-danger">Transaction not found.</p>;
  } else if (isEdit && !canEdit) {
    guard = (
      <p className="text-sm text-warning">
        This transaction cannot be edited in its current state.
      </p>
    );
  }

  return (
    <ReturnToSupplierForm
      id={id}
      isEdit={isEdit}
      initialValues={initialValues}
      isLoading={isEdit && isLoading}
      guard={guard}
    />
  );
};

export { ReturnToSupplierFormPage };
