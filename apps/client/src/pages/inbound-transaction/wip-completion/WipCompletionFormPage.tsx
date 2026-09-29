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
import { Icon } from "@iconify/react";
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
import { wipCompletionFormSchema } from "@repo/schemas/wip-completion";
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
  workOrderRef: string;
  productionBatchNo: string;
  reference: string;
  notes: string;
  warehouseId: string;
  items: FormItem[];
};

/** Unwrap a tRPC vanilla-client query/procedure into its resolved wire type. */
type DetailOf<Q> = Q extends (...args: never[]) => Promise<infer R> ? R : never;

/** Client-side shape of `wipCompletion.detail`. */
type WipCompletionDetail = DetailOf<
  typeof trpcClient.wipCompletion.detail.query
>;

const defaultFormValues = (): FormValues => ({
  documentNumber: "",
  date: today(getLocalTimeZone()) as any,
  workOrderRef: "",
  productionBatchNo: "",
  reference: "",
  notes: "",
  warehouseId: "",
  items: [createFormItem()],
});

const transformDetailToFormValues = (d: WipCompletionDetail): FormValues => {
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
    workOrderRef: d.workOrderRef ?? "",
    productionBatchNo: d.productionBatchNo ?? "",
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

const WipCompletionForm = ({
  id,
  isEdit,
  initialValues,
  isLoading = false,
  guard,
}: Props) => {
  const t = useMessage();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = isEdit
    ? hasPermission("wip-completion@update")
    : hasPermission("wip-completion@create");

  const modalMessages = {
    saving: t("wip_completion.form_saving", "Saving…"),
    successTitle: t("wip_completion.form_success_title", "Saved"),
    errorTitle: t("wip_completion.form_error_title", "Error"),
    confirmPropose: t("wip_completion.form_confirm_propose", "Confirm Propose"),
    confirmDraft: t("wip_completion.form_confirm_draft", "Confirm Save Draft"),
    confirmProposeDesc: t(
      "wip_completion.form_confirm_propose_desc",
      "Propose this transaction?",
    ),
    confirmDraftDesc: t(
      "wip_completion.form_confirm_draft_desc",
      "Save as draft?",
    ),
    messageLabel: t("wip_completion.form_message_label", "Message"),
    messagePlaceholder: t(
      "wip_completion.form_message_placeholder",
      "Add a note (optional)",
    ),
    cancel: t("wip_completion.form_cancel", "Cancel"),
    confirm: t("wip_completion.form_confirm", "Confirm"),
    close: t("wip_completion.form_close", "Close"),
    viewDetail: t("wip_completion.form_view_detail", "View Detail"),
  };

  const docForm = useDocForm<FormValues, any>({
    formId: "wip-completion-form",
    isEdit,
    id,
    initialValues,
    defaultValues: defaultFormValues,
    schema: wipCompletionFormSchema,
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
        workOrderRef: parsed.workOrderRef || undefined,
        productionBatchNo: parsed.productionBatchNo || undefined,
        reference: parsed.reference || undefined,
        notes: parsed.notes || undefined,
        warehouseId: parsed.warehouseId,
        approvalStatus: intent,
        message: approvalMessage || undefined,
        items,
        approvalHistory: [],
      };
    },
    createCaller: (payload) => trpcClient.wipCompletion.create.mutate(payload),
    updateCaller: (payload) => trpcClient.wipCompletion.update.mutate(payload),
    listQueryKey: "wipCompletionList",
    detailQueryKey: "wipCompletionDetail",
    redirectOnSuccess: (savedId) =>
      `/inbound-transaction/wip-completion/${savedId ?? id}`,
    modalMessages,
    successMessageCreate: t(
      "wip_completion.form_create_success",
      "WIP completion created.",
    ),
    successMessageUpdate: t(
      "wip_completion.form_update_success",
      "WIP completion updated.",
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
    workOrderRef: (v) => docForm.form.setFieldValue("workOrderRef", String(v)),
    productionBatchNo: (v) =>
      docForm.form.setFieldValue("productionBatchNo", String(v)),
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
      header: t("wip_completion.col_sku", "SKU"),
      ariaLabel: t("wip_completion.col_sku", "SKU"),
      placeholder: t("wip_completion.form_sku_placeholder", "Select SKU"),
      searchPlaceholder: t("wip_completion.form_sku_search", "Search SKU..."),
      emptyLabel: t("wip_completion.form_sku_empty", "No SKU found"),
      requiredMessage: t("wip_completion.form_sku_required", "SKU is required"),
    },
    {
      key: "details",
      cell: "text",
      header: t("wip_completion.col_details", "Details"),
      label: t("wip_completion.col_details", "Details"),
      placeholder: t("wip_completion.form_details_placeholder", "Item notes"),
    },
    {
      key: "quantity",
      cell: "number",
      header: t("wip_completion.col_quantity", "Qty"),
      label: t("wip_completion.col_quantity", "Qty"),
      min: 1,
      ruleMessage: t("wip_completion.form_qty_rule", "Must be at least 1"),
    },
  ];

  return (
    <FormPageShell
      formId="wip-completion-form"
      mode={isEdit ? "edit" : "create"}
      entityId={id}
      title={
        isEdit
          ? t("wip_completion.form_edit_title", "Edit WIP Completion")
          : t("wip_completion.form_new_title", "New WIP Completion")
      }
      backTo="/inbound-transaction"
      validationErrors={docForm.validationErrors}
      aiFields={[
        "documentNumber",
        "date",
        "warehouseId",
        "workOrderRef",
        "productionBatchNo",
        "reference",
        "notes",
        "items",
      ]}
      header={
        <DocHeaderCard
          title={t(
            "wip_completion.form_section_general",
            "General Information",
          )}
          icon="solar:document-text-linear"
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
                  {t("wip_completion.form_document_number", "Document Number")}
                </Label>
                <Input
                  variant="secondary"
                  placeholder={t(
                    "wip_completion.form_document_number_placeholder",
                    "Auto-generated if blank",
                  )}
                />
              </TextField>
            )}
          </form.Field>
          <form.Field name="date">
            {(field) => (
              <FormDatePicker
                label={t("wip_completion.form_date", "Date")}
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
                      "wip_completion.form_warehouse_required",
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
                label={t("wip_completion.form_warehouse", "Warehouse")}
                placeholder={t(
                  "wip_completion.form_warehouse_placeholder",
                  "Select warehouse",
                )}
                searchPlaceholder={t(
                  "wip_completion.form_warehouse_search",
                  "Search warehouse...",
                )}
                emptyLabel={t(
                  "wip_completion.form_warehouse_empty",
                  "No warehouse found",
                )}
                loadingLabel={t(
                  "wip_completion.form_warehouse_loading",
                  "Loading warehouses...",
                )}
                ariaLabel={t("wip_completion.form_warehouse", "Warehouse")}
                getOptionLabel={(w) => w.name ?? w.code ?? w.id}
                getOptionTextValue={(w) =>
                  `${w.name ?? ""} ${w.code ?? ""}`.trim()
                }
              />
            )}
          </form.Field>
          <form.Field name="workOrderRef">
            {(field) => (
              <TextField
                isDisabled={docForm.isSubmitting}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              >
                <Label>
                  {t("wip_completion.form_work_order_ref", "Work Order Ref")}
                </Label>
                <Input
                  variant="secondary"
                  placeholder={t(
                    "wip_completion.form_work_order_ref_placeholder",
                    "Work order reference",
                  )}
                />
              </TextField>
            )}
          </form.Field>
          <form.Field name="productionBatchNo">
            {(field) => (
              <TextField
                isDisabled={docForm.isSubmitting}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              >
                <Label>
                  {t(
                    "wip_completion.form_production_batch_no",
                    "Production Batch No",
                  )}
                </Label>
                <Input
                  variant="secondary"
                  placeholder={t(
                    "wip_completion.form_production_batch_no_placeholder",
                    "Batch number",
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
                <Label>{t("wip_completion.form_reference", "Reference")}</Label>
                <Input
                  variant="secondary"
                  placeholder={t(
                    "wip_completion.form_reference_placeholder",
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
                <Icon
                  icon="solar:clipboard-linear"
                  className="size-4.5 text-accent"
                />
                <Card.Title>
                  {t("wip_completion.form_summary_title", "Summary")}
                </Card.Title>
              </div>
              <Card.Description>
                {t(
                  "wip_completion.form_summary_desc",
                  "Review your transaction before saving.",
                )}
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <dl className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-muted">
                    {t(
                      "wip_completion.form_document_number",
                      "Document Number",
                    )}
                  </dt>
                  <dd className="font-mono text-foreground">
                    {formValues.documentNumber ||
                      t("wip_completion.form_auto", "Auto")}
                  </dd>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-muted">
                    {t("wip_completion.form_work_order_ref", "Work Order Ref")}
                  </dt>
                  <dd className="text-foreground">
                    {formValues.workOrderRef ? "✓" : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-muted">
                    {t(
                      "wip_completion.form_production_batch_no",
                      "Production Batch No",
                    )}
                  </dt>
                  <dd className="text-foreground">
                    {formValues.productionBatchNo ? "✓" : "—"}
                  </dd>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <dt className="flex items-center gap-1.5 text-muted">
                    <Icon icon="solar:layers-linear" className="size-3.5" />
                    {t("wip_completion.form_total_items", "Total Items")}
                  </dt>
                  <dd className="font-semibold text-foreground">
                    {totalItems}
                  </dd>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <dt className="flex items-center gap-1.5 text-muted">
                    <Icon icon="solar:box-linear" className="size-3.5" />
                    {t("wip_completion.form_total_quantity", "Total Quantity")}
                  </dt>
                  <dd className="font-semibold text-foreground">
                    {totalQuantity}
                  </dd>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <dt className="text-xs font-medium text-muted">
                    {t("wip_completion.form_ready", "Ready to save")}
                  </dt>
                  <dd>
                    <Chip
                      color={docForm.canSubmit ? "success" : "default"}
                      size="sm"
                      variant="soft"
                    >
                      {docForm.canSubmit ? "✓" : "…"}
                    </Chip>
                  </dd>
                </div>
              </dl>
            </Card.Content>
          </Card>

          <Fieldset>
            <FieldsetLegend>
              <div className="flex items-center gap-2">
                <Icon
                  icon="solar:document-linear"
                  className="size-4.5 text-accent"
                />
                {t("wip_completion.form_section_notes", "Notes")}
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
                      <Label>{t("wip_completion.form_notes", "Notes")}</Label>
                      <TextArea
                        rows={4}
                        variant="secondary"
                        placeholder={t(
                          "wip_completion.form_notes_placeholder",
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
              title={t("wip_completion.form_items_title", "Items")}
              icon="solar:box-linear"
              labels={{
                add: t("wip_completion.form_add_item", "Add Item"),
                empty: t(
                  "wip_completion.form_no_items",
                  'No items. Click "Add Item" to start.',
                ),
                aria: t("wip_completion.form_items_aria", "Transaction items"),
                moveUp: t("wip_completion.form_move_up", "Move up"),
                moveDown: t("wip_completion.form_move_down", "Move down"),
                remove: t("wip_completion.form_remove_item", "Remove"),
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
            saveDraft: t("wip_completion.form_save_draft", "Save Draft"),
            propose: t("wip_completion.form_propose", "Propose"),
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

const WipCompletionFormPage = () => {
  const {
    id,
    isEdit,
    detail,
    isLoading,
    isError,
    error,
    initialValues,
    canEdit,
  } = useTransactionFormPage<WipCompletionDetail, FormValues>({
    queryKey: "wipCompletionDetail",
    detailQuery: (input) => trpcClient.wipCompletion.detail.query(input),
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
    <WipCompletionForm
      id={id}
      isEdit={isEdit}
      initialValues={initialValues}
      isLoading={isEdit && isLoading}
      guard={guard}
    />
  );
};

export { WipCompletionFormPage };
