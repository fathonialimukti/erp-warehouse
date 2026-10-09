import type { ReactNode } from "react";
import { useAtomValue } from "jotai";
import { useMessage } from "../../../lib/useMessage";
import {
  Card,
  Chip,
  FieldGroup,
  Fieldset,
  FieldsetLegend,
  Input,
  Label,
  Separator,
  TextArea,
  TextField,
} from "@heroui/react";
import { AppIcon } from "../../../components/AppIcon";
import { trpcClient } from "../../../lib/trpc";
import { hasPermissionAtom } from "../../../lib/atoms";
import { useAiFillForm } from "../../../components/AiAssistant/useAiFillForm";
import { FormDatePicker } from "../../../components/FormDatePicker";
import { SelectSearch } from "../../../components/SelectSearch";
import {
  fromDateToLocal,
  getLocalTimeZone,
  today,
} from "@internationalized/date";
import { rmaReceiptFormSchema } from "@repo/schemas/rma-receipt";
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

type WarehouseOption = {
  id: string;
  code?: string | null;
  name?: string | null;
};

type FormValues = {
  documentNumber: string;
  date: any;
  originalShipmentId: string;
  salesOrderRef: string;
  returnReason: string;
  reference: string;
  notes: string;
  warehouseId: string;
  items: FormItem[];
};

/** Unwrap a tRPC vanilla-client query/procedure into its resolved wire type. */
type DetailOf<Q> = Q extends (...args: never[]) => Promise<infer R> ? R : never;

/** Client-side shape of `rmaReceipt.detail`. */
type RmaReceiptDetail = DetailOf<typeof trpcClient.rmaReceipt.detail.query>;

const defaultFormValues = (): FormValues => ({
  documentNumber: "",
  date: today(getLocalTimeZone()) as any,
  originalShipmentId: "",
  salesOrderRef: "",
  returnReason: "",
  reference: "",
  notes: "",
  warehouseId: "",
  items: [createFormItem()],
});

const transformDetailToFormValues = (d: RmaReceiptDetail): FormValues => {
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
    originalShipmentId: d.originalShipmentId ?? "",
    salesOrderRef: d.salesOrderRef ?? "",
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

const RmaReceiptForm = ({
  id,
  isEdit,
  initialValues,
  isLoading = false,
  guard,
}: Props) => {
  const t = useMessage();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = isEdit
    ? hasPermission("rma-receipt@update")
    : hasPermission("rma-receipt@create");

  const modalMessages = {
    saving: t("rma_receipt.form_saving", "Saving…"),
    successTitle: t("rma_receipt.form_success_title", "Saved"),
    errorTitle: t("rma_receipt.form_error_title", "Error"),
    confirmPropose: t("rma_receipt.form_confirm_propose", "Confirm Propose"),
    confirmDraft: t("rma_receipt.form_confirm_draft", "Confirm Save Draft"),
    confirmProposeDesc: t(
      "rma_receipt.form_confirm_propose_desc",
      "Propose this transaction?",
    ),
    confirmDraftDesc: t(
      "rma_receipt.form_confirm_draft_desc",
      "Save as draft?",
    ),
    messageLabel: t("rma_receipt.form_message_label", "Message"),
    messagePlaceholder: t(
      "rma_receipt.form_message_placeholder",
      "Add a note (optional)",
    ),
    cancel: t("rma_receipt.form_cancel", "Cancel"),
    confirm: t("rma_receipt.form_confirm", "Confirm"),
    close: t("rma_receipt.form_close", "Close"),
    viewDetail: t("rma_receipt.form_view_detail", "View Detail"),
  };

  const docForm = useDocForm<FormValues, any>({
    formId: "rma-receipt-form",
    isEdit,
    id,
    initialValues,
    defaultValues: defaultFormValues,
    schema: rmaReceiptFormSchema,
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
        originalShipmentId: parsed.originalShipmentId || undefined,
        salesOrderRef: parsed.salesOrderRef || undefined,
        returnReason: parsed.returnReason || undefined,
        reference: parsed.reference || undefined,
        notes: parsed.notes || undefined,
        warehouseId: parsed.warehouseId,
        approvalStatus: intent,
        message: approvalMessage || undefined,
        items,
        approvalHistory: [],
      };
    },
    createCaller: (payload) => trpcClient.rmaReceipt.create.mutate(payload),
    updateCaller: (payload) => trpcClient.rmaReceipt.update.mutate(payload),
    listQueryKey: "rmaReceiptList",
    detailQueryKey: "rmaReceiptDetail",
    redirectOnSuccess: (savedId) =>
      `/inbound-transaction/rma-receipt/${savedId ?? id}`,
    modalMessages,
    successMessageCreate: t(
      "rma_receipt.form_create_success",
      "RMA receipt created.",
    ),
    successMessageUpdate: t(
      "rma_receipt.form_update_success",
      "RMA receipt updated.",
    ),
    errorFallback: t("error_generic", "An unexpected error occurred."),
    missingRequired: (values) => {
      const missing: string[] = [];
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
        Boolean(values.warehouseId) &&
        rows.length > 0 &&
        rows.every((item) => item.skuId && Number(item.quantity) > 0)
      );
    },
  });

  // The JSX below binds via `<form.Field>` — same form instance the hook owns.
  const form = docForm.form;

  const formValues = docForm.formValues;
  const totalItems = formValues.items?.length ?? 0;
  const totalQuantity = (formValues.items ?? []).reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0,
  );

  useAiFillForm({
    documentNumber: (v) =>
      docForm.form.setFieldValue("documentNumber", String(v)),
    originalShipmentId: (v) =>
      docForm.form.setFieldValue("originalShipmentId", String(v)),
    salesOrderRef: (v) =>
      docForm.form.setFieldValue("salesOrderRef", String(v)),
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

  const columns: TransactionItemsColumn<FormItem>[] = [
    {
      key: "skuId",
      cell: "skuSelect",
      header: t("rma_receipt.col_sku", "SKU"),
      ariaLabel: t("rma_receipt.col_sku", "SKU"),
      placeholder: t("rma_receipt.form_sku_placeholder", "Select SKU"),
      searchPlaceholder: t("rma_receipt.form_sku_search", "Search SKU..."),
      emptyLabel: t("rma_receipt.form_sku_empty", "No SKU found"),
      requiredMessage: t("rma_receipt.form_sku_required", "SKU is required"),
    },
    {
      key: "details",
      cell: "text",
      header: t("rma_receipt.col_details", "Details"),
      label: t("rma_receipt.col_details", "Details"),
      placeholder: t("rma_receipt.form_details_placeholder", "Item notes"),
    },
    {
      key: "quantity",
      cell: "number",
      header: t("rma_receipt.col_quantity", "Qty"),
      label: t("rma_receipt.col_quantity", "Qty"),
      min: 1,
      ruleMessage: t("rma_receipt.form_qty_rule", "Must be at least 1"),
    },
  ];

  return (
    <FormPageShell
      formId="rma-receipt-form"
      mode={isEdit ? "edit" : "create"}
      entityId={id}
      title={
        isEdit
          ? t("rma_receipt.form_edit_title", "Edit RMA Receipt")
          : t("rma_receipt.form_new_title", "New RMA Receipt")
      }
      backTo="/inbound-transaction"
      validationErrors={docForm.validationErrors}
      aiFields={[
        "documentNumber",
        "date",
        "warehouseId",
        "originalShipmentId",
        "salesOrderRef",
        "returnReason",
        "reference",
        "notes",
        "items",
      ]}
      header={
        <DocHeaderCard
          title={t("rma_receipt.form_section_general", "General Information")}
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
                  {t("rma_receipt.form_document_number", "Document Number")}
                </Label>
                <Input
                  variant="secondary"
                  placeholder={t(
                    "rma_receipt.form_document_number_placeholder",
                    "Auto-generated if blank",
                  )}
                />
              </TextField>
            )}
          </form.Field>
          <form.Field name="date">
            {(field) => (
              <FormDatePicker
                label={t("rma_receipt.form_date", "Date")}
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
                      "rma_receipt.form_warehouse_required",
                      "Warehouse is required",
                    )
                  : undefined,
            }}
          >
            {(field) => (
              <SelectSearch<WarehouseOption>
                queryKeyBase="warehouse-form-search"
                sourceData={async ({ search, limit }) => {
                  const result =
                    await trpcClient.warehouse.warehouse.list.query({
                      page: 1,
                      limit,
                      search: search.trim() || undefined,
                    });
                  return { options: result.data };
                }}
                optionsKey="id"
                value={field.state.value || ""}
                onChange={(v) => field.handleChange(String(v ?? ""))}
                isDisabled={docForm.isSubmitting}
                isInvalid={field.state.meta.errors.length > 0}
                errorMessage={field.state.meta.errors.join(", ")}
                label={t("rma_receipt.form_warehouse", "Warehouse")}
                placeholder={t(
                  "rma_receipt.form_warehouse_placeholder",
                  "Select warehouse",
                )}
                searchPlaceholder={t(
                  "rma_receipt.form_warehouse_search",
                  "Search warehouse...",
                )}
                emptyLabel={t(
                  "rma_receipt.form_warehouse_empty",
                  "No warehouse found",
                )}
                loadingLabel={t(
                  "rma_receipt.form_warehouse_loading",
                  "Loading warehouses...",
                )}
                ariaLabel={t("rma_receipt.form_warehouse", "Warehouse")}
                getOptionLabel={(w) => w.name ?? w.code ?? w.id}
                getOptionTextValue={(w) =>
                  `${w.name ?? ""} ${w.code ?? ""}`.trim()
                }
              />
            )}
          </form.Field>
          <form.Field name="originalShipmentId">
            {(field) => (
              <TextField
                isDisabled={docForm.isSubmitting}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              >
                <Label>
                  {t(
                    "rma_receipt.form_original_shipment",
                    "Original Shipment ID",
                  )}
                </Label>
                <Input
                  variant="secondary"
                  placeholder={t(
                    "rma_receipt.form_original_shipment_placeholder",
                    "Original shipment reference",
                  )}
                />
              </TextField>
            )}
          </form.Field>
          <form.Field name="salesOrderRef">
            {(field) => (
              <TextField
                isDisabled={docForm.isSubmitting}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              >
                <Label>
                  {t("rma_receipt.form_sales_order_ref", "Sales Order Ref")}
                </Label>
                <Input
                  variant="secondary"
                  placeholder={t(
                    "rma_receipt.form_sales_order_ref_placeholder",
                    "SO reference",
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
                  {t("rma_receipt.form_return_reason", "Return Reason")}
                </Label>
                <Input
                  variant="secondary"
                  placeholder={t(
                    "rma_receipt.form_return_reason_placeholder",
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
                <Label>{t("rma_receipt.form_reference", "Reference")}</Label>
                <Input
                  variant="secondary"
                  placeholder={t(
                    "rma_receipt.form_reference_placeholder",
                    "Reference number",
                  )}
                />
              </TextField>
            )}
          </form.Field>
        </DocHeaderCard>
      }
      aside={
        <>
          <Card>
            <Card.Header>
              <div className="flex items-center gap-2">
                <AppIcon name="clipboard" className="size-4.5 text-accent" />
                <Card.Title>
                  {t("rma_receipt.form_summary_title", "Summary")}
                </Card.Title>
              </div>
              <Card.Description>
                {t(
                  "rma_receipt.form_summary_desc",
                  "Review your transaction before saving.",
                )}
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <dl className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-muted">
                    {t("rma_receipt.form_document_number", "Document Number")}
                  </dt>
                  <dd className="font-mono text-foreground">
                    {formValues.documentNumber ||
                      t("rma_receipt.form_auto", "Auto")}
                  </dd>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-muted">
                    {t(
                      "rma_receipt.form_original_shipment",
                      "Original Shipment ID",
                    )}
                  </dt>
                  <dd className="text-foreground">
                    {formValues.originalShipmentId ? (
                      <AppIcon
                        name="check-circle"
                        className="size-4 text-success"
                      />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-muted">
                    {t("rma_receipt.form_sales_order_ref", "Sales Order Ref")}
                  </dt>
                  <dd className="text-foreground">
                    {formValues.salesOrderRef ? (
                      <AppIcon
                        name="check-circle"
                        className="size-4 text-success"
                      />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </dd>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <dt className="flex items-center gap-1.5 text-muted">
                    <AppIcon name="layers" className="size-3.5" />
                    {t("rma_receipt.form_total_items", "Total Items")}
                  </dt>
                  <dd className="font-semibold text-foreground">
                    {totalItems}
                  </dd>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <dt className="flex items-center gap-1.5 text-muted">
                    <AppIcon name="box" className="size-3.5" />
                    {t("rma_receipt.form_total_quantity", "Total Quantity")}
                  </dt>
                  <dd className="font-semibold text-foreground">
                    {totalQuantity}
                  </dd>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <dt className="text-xs font-medium text-muted">
                    {t("rma_receipt.form_ready", "Ready to save")}
                  </dt>
                  <dd>
                    <Chip
                      color={docForm.canSubmit ? "success" : "default"}
                      size="sm"
                      variant="soft"
                    >
                      {docForm.canSubmit ? (
                        <AppIcon
                          name="check-circle"
                          className="size-4 text-success"
                        />
                      ) : (
                        <span className="text-muted">…</span>
                      )}
                    </Chip>
                  </dd>
                </div>
              </dl>
            </Card.Content>
          </Card>

          <Fieldset>
            <FieldsetLegend>
              <div className="flex items-center gap-2">
                <AppIcon name="document" className="size-4.5 text-accent" />
                {t("rma_receipt.form_section_notes", "Notes")}
              </div>
            </FieldsetLegend>
            <FieldGroup>
              <div className="grid grid-cols-1 gap-4">
                <form.Field name="notes">
                  {(field) => (
                    <TextField
                      isDisabled={docForm.isSubmitting}
                      value={field.state.value}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                      fullWidth
                    >
                      <Label>{t("rma_receipt.form_notes", "Notes")}</Label>
                      <TextArea
                        rows={4}
                        variant="secondary"
                        placeholder={t(
                          "rma_receipt.form_notes_placeholder",
                          "Add notes",
                        )}
                      />
                    </TextField>
                  )}
                </form.Field>
              </div>
            </FieldGroup>
          </Fieldset>
        </>
      }
      below={
        <form.Field name="items">
          {(itemsField) => (
            <EditableLinesTable
              field={itemsField}
              columns={columns}
              createItem={createFormItem}
              isDisabled={docForm.isSubmitting}
              title={t("rma_receipt.form_items_title", "Items")}
              icon="box"
              labels={{
                add: t("rma_receipt.form_add_item", "Add Item"),
                empty: t(
                  "rma_receipt.form_no_items",
                  'No items. Click "Add Item" to start.',
                ),
                aria: t("rma_receipt.form_items_aria", "Transaction items"),
                moveUp: t("rma_receipt.form_move_up", "Move up"),
                moveDown: t("rma_receipt.form_move_down", "Move down"),
                remove: t("rma_receipt.form_remove_item", "Remove"),
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
            saveDraft: t("rma_receipt.form_save_draft", "Save Draft"),
            propose: t("rma_receipt.form_propose", "Propose"),
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

const RmaReceiptFormPage = () => {
  const {
    id,
    isEdit,
    detail,
    isLoading,
    isError,
    error,
    initialValues,
    canEdit,
  } = useTransactionFormPage<RmaReceiptDetail, FormValues>({
    queryKey: "rmaReceiptDetail",
    detailQuery: (input) => trpcClient.rmaReceipt.detail.query(input),
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
    <RmaReceiptForm
      id={id}
      isEdit={isEdit}
      initialValues={initialValues}
      isLoading={isEdit && isLoading}
      guard={guard}
    />
  );
};

export { RmaReceiptFormPage };
