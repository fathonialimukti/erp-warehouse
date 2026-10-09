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
import {
  fromDateToLocal,
  getLocalTimeZone,
  today,
} from "@internationalized/date";
import type { DateValue } from "@internationalized/date";
import { disposalFormSchema } from "@repo/schemas/disposal";
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
  disposalReason: string;
  reference: string;
  notes: string;
  warehouseId: string;
  items: FormItem[];
};

/** Unwrap a tRPC vanilla-client query/procedure into its resolved wire type. */
type DetailOf<Q> = Q extends (...args: never[]) => Promise<infer R> ? R : never;

/** Client-side shape of `disposal.detail`. */
type DisposalDetail = DetailOf<typeof trpcClient.disposal.detail.query>;

const defaultFormValues = (): FormValues => ({
  documentNumber: "",
  date: today(getLocalTimeZone()),
  disposalReason: "",
  reference: "",
  notes: "",
  warehouseId: "",
  items: [createFormItem()],
});

const transformDetailToFormValues = (d: DisposalDetail): FormValues => {
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
    disposalReason: d.disposalReason ?? "",
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

const DisposalForm = ({
  id,
  isEdit,
  initialValues,
  isLoading = false,
  guard,
}: Props) => {
  const t = useMessage();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = isEdit
    ? hasPermission("disposal@update")
    : hasPermission("disposal@create");

  const modalMessages = {
    saving: t("disposal.form_saving", "Saving…"),
    successTitle: t("disposal.form_success_title", "Saved"),
    errorTitle: t("disposal.form_error_title", "Error"),
    confirmPropose: t("disposal.form_confirm_propose", "Confirm Propose"),
    confirmDraft: t("disposal.form_confirm_draft", "Confirm Save Draft"),
    confirmProposeDesc: t(
      "disposal.form_confirm_propose_desc",
      "Propose this disposal?",
    ),
    confirmDraftDesc: t("disposal.form_confirm_draft_desc", "Save as draft?"),
    messageLabel: t("disposal.form_message_label", "Message"),
    messagePlaceholder: t(
      "disposal.form_message_placeholder",
      "Add a note (optional)",
    ),
    cancel: t("disposal.form_cancel", "Cancel"),
    confirm: t("disposal.form_confirm", "Confirm"),
    close: t("disposal.form_close", "Close"),
    viewDetail: t("disposal.form_view_detail", "View Detail"),
  };

  const { data: warehouseListData } = useQuery({
    queryKey: ["warehouseOptions"],
    queryFn: () =>
      trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 999 }),
  });
  const warehouses = warehouseListData?.data ?? [];

  const docForm = useDocForm<FormValues, any>({
    formId: "disposal-form",
    isEdit,
    id,
    initialValues,
    defaultValues: defaultFormValues,
    schema: disposalFormSchema,
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
        disposalReason: parsed.disposalReason || undefined,
        reference: parsed.reference || undefined,
        notes: parsed.notes || undefined,
        warehouseId: parsed.warehouseId,
        approvalStatus: intent,
        message: approvalMessage || undefined,
        items,
      };
    },
    createCaller: (payload) => trpcClient.disposal.create.mutate(payload),
    updateCaller: (payload) => trpcClient.disposal.update.mutate(payload),
    listQueryKey: "disposalList",
    detailQueryKey: "disposalDetail",
    redirectOnSuccess: (savedId) =>
      `/outbound-transaction/disposal/${savedId ?? id}`,
    modalMessages,
    successMessageCreate: t(
      "disposal.form_create_success",
      "Disposal created.",
    ),
    successMessageUpdate: t(
      "disposal.form_update_success",
      "Disposal updated.",
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

  useAiFillForm({
    documentNumber: (v) =>
      docForm.form.setFieldValue("documentNumber", String(v)),
    disposalReason: (v) =>
      docForm.form.setFieldValue("disposalReason", String(v)),
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

  const columns: TransactionItemsColumn<FormItem>[] = [
    {
      key: "skuId",
      cell: "skuSelect",
      header: t("disposal.col_sku", "SKU"),
      ariaLabel: t("disposal.col_sku", "SKU"),
      placeholder: t("disposal.form_sku_placeholder", "Select SKU"),
      searchPlaceholder: t("disposal.form_sku_search", "Search SKU..."),
      emptyLabel: t("disposal.form_sku_empty", "No SKU found"),
      requiredMessage: t("disposal.form_sku_required", "SKU is required"),
    },
    {
      key: "details",
      cell: "text",
      header: t("disposal.col_details", "Details"),
      label: t("disposal.col_details", "Details"),
      placeholder: t("disposal.form_details_placeholder", "Item notes"),
    },
    {
      key: "quantity",
      cell: "number",
      header: t("disposal.col_quantity", "Qty"),
      label: t("disposal.col_quantity", "Qty"),
      min: 1,
      ruleMessage: t("disposal.form_qty_rule", "Must be at least 1"),
    },
  ];

  return (
    <FormPageShell
      formId="disposal-form"
      mode={isEdit ? "edit" : "create"}
      entityId={id}
      title={
        isEdit
          ? t("disposal.form_edit_title", "Edit Disposal")
          : t("disposal.form_new_title", "New Disposal")
      }
      backTo="/outbound-transaction"
      validationErrors={docForm.validationErrors}
      aiFields={[
        "documentNumber",
        "date",
        "warehouseId",
        "disposalReason",
        "reference",
        "notes",
        "items",
      ]}
      header={
        <DocHeaderCard
          title={t("disposal.form_section_general", "General Information")}
          description={t(
            "disposal.form_section_general_desc",
            "Why the stock is written off and where it happened.",
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
                  {t("disposal.form_document_number", "Document Number")}
                </Label>
                <Input
                  variant="secondary"
                  placeholder={t(
                    "disposal.form_document_number_placeholder",
                    "Auto-generated if blank",
                  )}
                />
              </TextField>
            )}
          </form.Field>
          <form.Field name="date">
            {(field) => (
              <FormDatePicker
                label={t("disposal.form_date", "Date")}
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
                      "disposal.form_warehouse_required",
                      "Warehouse is required",
                    )
                  : undefined,
            }}
          >
            {(field) => (
              <WarehouseSelectSearch
                queryKeyBase="disposal-warehouse"
                value={field.state.value || ""}
                onChange={(v) => field.handleChange(String(v ?? ""))}
                label={t("disposal.form_warehouse", "Warehouse")}
                ariaLabel={t("disposal.form_warehouse", "Warehouse")}
                placeholder={t(
                  "disposal.form_warehouse_placeholder",
                  "Select warehouse",
                )}
                searchPlaceholder={t(
                  "disposal.form_warehouse_search",
                  "Search warehouse...",
                )}
                emptyLabel={t(
                  "disposal.form_warehouse_empty",
                  "No warehouse found",
                )}
                isDisabled={docForm.isSubmitting}
                isInvalid={field.state.meta.errors.length > 0}
                errorMessage={field.state.meta.errors.join(", ")}
              />
            )}
          </form.Field>
          <form.Field name="disposalReason">
            {(field) => (
              <TextField
                isDisabled={docForm.isSubmitting}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              >
                <Label>
                  {t("disposal.form_disposal_reason", "Disposal Reason")}
                </Label>
                <Input
                  variant="secondary"
                  placeholder={t(
                    "disposal.form_disposal_reason_placeholder",
                    "Reason for disposal",
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
                <Label>{t("disposal.form_reference", "Reference")}</Label>
                <Input
                  variant="secondary"
                  placeholder={t(
                    "disposal.form_reference_placeholder",
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
                <Label>{t("disposal.form_notes", "Notes")}</Label>
                <TextArea
                  rows={4}
                  variant="secondary"
                  placeholder={t(
                    "disposal.form_notes_placeholder",
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
              {t("disposal.preview_title", "Disposal Preview")}
            </Card.Title>
            <Card.Description>
              {t(
                "disposal.preview_desc",
                "Live summary of the stock you are writing off.",
              )}
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <dl className="space-y-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">
                  {t("disposal.form_document_number", "Document Number")}
                </dt>
                <dd className="font-mono text-foreground">
                  {values.documentNumber || t("disposal.form_auto", "Auto")}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">
                  {t("disposal.form_warehouse", "Warehouse")}
                </dt>
                <dd className="text-right font-medium text-foreground">
                  {warehouseName ?? "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">
                  {t("disposal.form_disposal_reason", "Disposal Reason")}
                </dt>
                <dd className="text-right font-medium text-foreground">
                  {values.disposalReason || "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">
                  {t("disposal.form_reference", "Reference")}
                </dt>
                <dd className="text-right font-medium text-foreground">
                  {values.reference || "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">
                  {t("disposal.preview_items", "Items")}
                </dt>
                <dd className="font-semibold text-foreground">
                  {itemCount > 0
                    ? `${itemCount} · ${totalQuantity} ${t("disposal.preview_qty_suffix", "qty")}`
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
              title={t("disposal.form_items_title", "Items")}
              description={t(
                "disposal.form_items_desc",
                "SKUs being written off and their quantities.",
              )}
              labels={{
                add: t("disposal.form_add_item", "Add Item"),
                empty: t(
                  "disposal.form_no_items",
                  'No items. Click "Add Item" to start.',
                ),
                aria: t("disposal.form_items_aria", "Disposal items"),
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
            saveDraft: t("disposal.form_save_draft", "Save Draft"),
            propose: t("disposal.form_propose", "Propose"),
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

const DisposalFormPage = () => {
  const {
    id,
    isEdit,
    detail,
    isLoading,
    isError,
    error,
    initialValues,
    canEdit,
  } = useTransactionFormPage<DisposalDetail, FormValues>({
    queryKey: "disposalDetail",
    detailQuery: (input) => trpcClient.disposal.detail.query(input),
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
    <DisposalForm
      id={id}
      isEdit={isEdit}
      initialValues={initialValues}
      isLoading={isEdit && isLoading}
      guard={guard}
    />
  );
};

export { DisposalFormPage };
