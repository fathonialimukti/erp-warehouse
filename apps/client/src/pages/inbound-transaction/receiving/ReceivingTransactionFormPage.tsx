import { useState, type ReactNode } from "react";
import { useAtomValue } from "jotai";
import { useMessage } from "../../../lib/useMessage";
import {
  Button,
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
  Tooltip,
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
import { receivingTransactionFormSchema } from "@repo/schemas/receiving-transaction";
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

type SupplierOption = {
  id: string;
  code?: string | null;
  name?: string | null;
};

type WarehouseOption = {
  id: string;
  code?: string | null;
  name?: string | null;
};

interface InboundAttachment {
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  url?: string;
  storedName?: string;
}

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

type FormValues = {
  documentNumber: string;
  date: any;
  supplierId: string;
  purchaseOrderRef: string;
  deliveryNoteRef: string;
  carrier: string;
  trackingNumber: string;
  driverName: string;
  driverContact: string;
  vehiclePlate: string;
  notes: string;
  warehouseId: string;
  files: InboundAttachment[];
  items: FormItem[];
};

/**
 * Structural view of `receivingTransaction.detail` — the tRPC-inferred return
 * type nests deep relations that exceed tsc's instantiation depth when
 * unwrapped (`DetailOf` blows up). The transform only reads these fields.
 */
type ReceivingDetail = {
  approvalStatus: string;
  documentNumber: string | null;
  date: Date | string | null;
  supplierId: string | null;
  purchaseOrderRef: string | null;
  deliveryNoteRef: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  driverName: string | null;
  driverContact: string | null;
  vehiclePlate: string | null;
  notes: string | null;
  warehouseId: string | null;
  files?: Array<{
    name?: string | null;
    type?: string | null;
    size?: number | null;
    url?: string | null;
    storedName?: string | null;
  }>;
  items?: Array<{
    _id?: string | null;
    skuId?: string | null;
    quantity?: string | number | null;
    details?: string | null;
  }>;
};

const defaultFormValues = (): FormValues => ({
  documentNumber: "",
  date: today(getLocalTimeZone()) as any,
  supplierId: "",
  purchaseOrderRef: "",
  deliveryNoteRef: "",
  carrier: "",
  trackingNumber: "",
  driverName: "",
  driverContact: "",
  vehiclePlate: "",
  notes: "",
  warehouseId: "",
  files: [],
  items: [createFormItem()],
});

const transformDetailToFormValues = (d: ReceivingDetail): FormValues => {
  const files: InboundAttachment[] = Array.isArray(d.files)
    ? d.files.map((f: any) => ({
        name: String(f?.name ?? ""),
        type: String(f?.type ?? ""),
        size: Number(f?.size ?? 0),
        url: f?.url ? String(f.url) : undefined,
        storedName: f?.storedName ? String(f.storedName) : undefined,
      }))
    : [];
  const detailItems = d.items ?? [];
  const items: FormItem[] =
    detailItems.length > 0
      ? detailItems.map((item) => ({
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
    purchaseOrderRef: d.purchaseOrderRef ?? "",
    deliveryNoteRef: d.deliveryNoteRef ?? "",
    carrier: d.carrier ?? "",
    trackingNumber: d.trackingNumber ?? "",
    driverName: d.driverName ?? "",
    driverContact: d.driverContact ?? "",
    vehiclePlate: d.vehiclePlate ?? "",
    notes: d.notes ?? "",
    warehouseId: d.warehouseId ?? "",
    files,
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

const ReceivingTransactionForm = ({
  id,
  isEdit,
  initialValues,
  isLoading = false,
  guard,
}: Props) => {
  const t = useMessage();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = isEdit
    ? hasPermission("receiving@update")
    : hasPermission("receiving@create");
  const [isReadingFiles, setIsReadingFiles] = useState(false);

  const modalMessages = {
    saving: t("receiving_transaction.form_saving", "Saving…"),
    pleaseWait: t("receiving_transaction.form_please_wait", "Please wait…"),
    successTitle: t("receiving_transaction.form_success_title", "Saved"),
    errorTitle: t("receiving_transaction.form_error_title", "Error"),
    confirmPropose: t(
      "receiving_transaction.form_confirm_propose_title",
      "Confirm Propose",
    ),
    confirmDraft: t(
      "receiving_transaction.form_confirm_draft_title",
      "Confirm Save Draft",
    ),
    confirmProposeDesc: t(
      "receiving_transaction.form_confirm_propose_desc",
      "Propose this transaction for approval?",
    ),
    confirmDraftDesc: t(
      "receiving_transaction.form_confirm_draft_desc",
      "Save this transaction as a draft?",
    ),
    messageLabel: t("receiving_transaction.form_message_label", "Message"),
    messagePlaceholder: t(
      "receiving_transaction.form_message_placeholder",
      "Add a note (optional)",
    ),
    cancel: t("receiving_transaction.form_cancel", "Cancel"),
    confirm: t("receiving_transaction.form_confirm", "Confirm"),
    close: t("receiving_transaction.form_close", "Close"),
    viewDetail: t("receiving_transaction.form_view_detail", "View Detail"),
  };

  const docForm = useDocForm<FormValues, any>({
    formId: "receiving-transaction-form",
    isEdit,
    id,
    initialValues,
    defaultValues: defaultFormValues,
    schema: receivingTransactionFormSchema,
    toPayload: (parsed, intent, approvalMessage) => {
      const dateValue = parsed.date;
      const dateJs = dateValue?.toDate
        ? dateValue.toDate(getLocalTimeZone())
        : new Date();
      const items = (parsed.items as FormItem[]).map((item) => ({
        skuId: item.skuId,
        quantity: Number(item.quantity),
        details: item.details || undefined,
      }));
      const files = (parsed.files as InboundAttachment[]).map((f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
        dataUrl: f.dataUrl,
        url: f.url,
        storedName: f.storedName,
      }));
      return {
        documentNumber: parsed.documentNumber || undefined,
        date: dateJs,
        supplierId: parsed.supplierId,
        purchaseOrderRef: parsed.purchaseOrderRef || undefined,
        deliveryNoteRef: parsed.deliveryNoteRef || undefined,
        carrier: parsed.carrier || undefined,
        trackingNumber: parsed.trackingNumber || undefined,
        driverName: parsed.driverName || undefined,
        driverContact: parsed.driverContact || undefined,
        vehiclePlate: parsed.vehiclePlate || undefined,
        notes: parsed.notes || undefined,
        warehouseId: parsed.warehouseId,
        approvalStatus: intent,
        message: approvalMessage || undefined,
        files,
        items,
        approvalHistory: [],
      };
    },
    createCaller: (payload) =>
      trpcClient.receivingTransaction.create.mutate(payload),
    updateCaller: (payload) =>
      trpcClient.receivingTransaction.update.mutate(payload),
    listQueryKey: "receivingTransactionList",
    detailQueryKey: "receivingTransactionDetail",
    redirectOnSuccess: (savedId) =>
      `/inbound-transaction/receiving/${savedId ?? id}`,
    modalMessages,
    successMessageCreate: t(
      "receiving_transaction.form_create_success",
      "Receiving transaction created successfully.",
    ),
    successMessageUpdate: t(
      "receiving_transaction.form_update_success",
      "Receiving transaction updated successfully.",
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
    purchaseOrderRef: (v) =>
      docForm.form.setFieldValue("purchaseOrderRef", String(v)),
    deliveryNoteRef: (v) =>
      docForm.form.setFieldValue("deliveryNoteRef", String(v)),
    carrier: (v) => docForm.form.setFieldValue("carrier", String(v)),
    trackingNumber: (v) =>
      docForm.form.setFieldValue("trackingNumber", String(v)),
    driverName: (v) => docForm.form.setFieldValue("driverName", String(v)),
    driverContact: (v) =>
      docForm.form.setFieldValue("driverContact", String(v)),
    vehiclePlate: (v) => docForm.form.setFieldValue("vehiclePlate", String(v)),
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

  const formValues = docForm.formValues;
  const totalItems = formValues.items?.length ?? 0;
  const totalQuantity = (formValues.items ?? []).reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0,
  );

  const columns: TransactionItemsColumn<FormItem>[] = [
    {
      key: "skuId",
      cell: "skuSelect",
      header: t("receiving_transaction.col_sku", "SKU"),
      ariaLabel: t("receiving_transaction.col_sku", "SKU"),
      placeholder: t(
        "receiving_transaction.form_sku_placeholder",
        "Select SKU",
      ),
      searchPlaceholder: t(
        "receiving_transaction.form_sku_search",
        "Search SKU...",
      ),
      emptyLabel: t("receiving_transaction.form_sku_empty", "No SKU found"),
      requiredMessage: t(
        "receiving_transaction.form_sku_required",
        "SKU is required",
      ),
    },
    {
      key: "details",
      cell: "text",
      header: t("receiving_transaction.col_details", "Details"),
      label: t("receiving_transaction.col_details", "Details"),
      placeholder: t(
        "receiving_transaction.form_details_placeholder",
        "Item notes",
      ),
    },
    {
      key: "quantity",
      cell: "number",
      header: t("receiving_transaction.col_quantity", "Qty"),
      label: t("receiving_transaction.col_quantity", "Qty"),
      min: 1,
      ruleMessage: t(
        "receiving_transaction.form_qty_rule",
        "Must be at least 1",
      ),
    },
  ];

  return (
    <FormPageShell
      formId="receiving-transaction-form"
      mode={isEdit ? "edit" : "create"}
      entityId={id}
      title={
        isEdit
          ? t(
              "receiving_transaction.form_edit_title",
              "Edit Receiving Transaction",
            )
          : t(
              "receiving_transaction.form_new_title",
              "New Receiving Transaction",
            )
      }
      backTo="/inbound-transaction"
      validationErrors={docForm.validationErrors}
      aiFields={[
        "documentNumber",
        "date",
        "supplierId",
        "warehouseId",
        "purchaseOrderRef",
        "deliveryNoteRef",
        "carrier",
        "trackingNumber",
        "driverName",
        "driverContact",
        "vehiclePlate",
        "notes",
        "files",
        "items",
      ]}
      header={
        <>
          <DocHeaderCard
            title={t(
              "receiving_transaction.form_section_general",
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
                    <span className="inline-flex items-center gap-1">
                      {t(
                        "receiving_transaction.form_document_number",
                        "Document Number",
                      )}
                      <Tooltip delay={200}>
                        <Tooltip.Trigger>
                          <Icon
                            icon="solar:info-circle-linear"
                            className="size-3.5 text-muted"
                          />
                        </Tooltip.Trigger>
                        <Tooltip.Content showArrow placement="top">
                          {t(
                            "receiving_transaction.form_document_number_hint",
                            "Leave blank to auto-generate (RCV/WH01/MM/YYYY/NNNN)",
                          )}
                        </Tooltip.Content>
                      </Tooltip>
                    </span>
                  </Label>
                  <Input
                    variant="secondary"
                    placeholder={t(
                      "receiving_transaction.form_document_number_placeholder",
                      "Auto-generated if blank",
                    )}
                  />
                </TextField>
              )}
            </form.Field>
            <form.Field name="date">
              {(field) => (
                <FormDatePicker
                  label={t("receiving_transaction.form_date", "Date")}
                  value={field.state.value}
                  onChange={field.handleChange}
                  isDisabled={docForm.isSubmitting}
                />
              )}
            </form.Field>
            <form.Field
              name="supplierId"
              validators={{
                onChange: ({ value }) =>
                  !value
                    ? t(
                        "receiving_transaction.form_supplier_required",
                        "Supplier is required",
                      )
                    : undefined,
              }}
            >
              {(field) => (
                <SelectSearch<SupplierOption>
                  queryKeyBase="supplier-form-search"
                  sourceData={async ({ search, limit }) => {
                    const result = await trpcClient.supplier.list.query({
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
                  label={t("receiving_transaction.form_supplier", "Supplier")}
                  placeholder={t(
                    "receiving_transaction.form_supplier_placeholder",
                    "Select supplier",
                  )}
                  searchPlaceholder={t(
                    "receiving_transaction.form_supplier_search",
                    "Search supplier...",
                  )}
                  emptyLabel={t(
                    "receiving_transaction.form_supplier_empty",
                    "No supplier found",
                  )}
                  loadingLabel={t(
                    "receiving_transaction.form_supplier_loading",
                    "Loading suppliers...",
                  )}
                  ariaLabel={t(
                    "receiving_transaction.form_supplier",
                    "Supplier",
                  )}
                  getOptionLabel={(s) => s.name ?? s.code ?? s.id}
                  getOptionTextValue={(s) =>
                    `${s.name ?? ""} ${s.code ?? ""}`.trim()
                  }
                />
              )}
            </form.Field>
            <form.Field
              name="warehouseId"
              validators={{
                onChange: ({ value }) =>
                  !value
                    ? t(
                        "receiving_transaction.form_warehouse_required",
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
                  label={t("receiving_transaction.form_warehouse", "Warehouse")}
                  placeholder={t(
                    "receiving_transaction.form_warehouse_placeholder",
                    "Select warehouse",
                  )}
                  searchPlaceholder={t(
                    "receiving_transaction.form_warehouse_search",
                    "Search warehouse...",
                  )}
                  emptyLabel={t(
                    "receiving_transaction.form_warehouse_empty",
                    "No warehouse found",
                  )}
                  loadingLabel={t(
                    "receiving_transaction.form_warehouse_loading",
                    "Loading warehouses...",
                  )}
                  ariaLabel={t(
                    "receiving_transaction.form_warehouse",
                    "Warehouse",
                  )}
                  getOptionLabel={(w) => w.name ?? w.code ?? w.id}
                  getOptionTextValue={(w) =>
                    `${w.name ?? ""} ${w.code ?? ""}`.trim()
                  }
                />
              )}
            </form.Field>
            <form.Field name="purchaseOrderRef">
              {(field) => (
                <TextField
                  isDisabled={docForm.isSubmitting}
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                >
                  <Label>
                    <span className="inline-flex items-center gap-1">
                      {t(
                        "receiving_transaction.form_po_ref",
                        "Purchase Order Ref",
                      )}
                      <Tooltip delay={200}>
                        <Tooltip.Trigger>
                          <Icon
                            icon="solar:info-circle-linear"
                            className="size-3.5 text-muted"
                          />
                        </Tooltip.Trigger>
                        <Tooltip.Content showArrow placement="top">
                          {t(
                            "receiving_transaction.form_po_ref_hint",
                            "Optional — link to the originating PO",
                          )}
                        </Tooltip.Content>
                      </Tooltip>
                    </span>
                  </Label>
                  <Input
                    variant="secondary"
                    placeholder={t(
                      "receiving_transaction.form_po_ref_placeholder",
                      "PO reference",
                    )}
                  />
                </TextField>
              )}
            </form.Field>
            <form.Field name="deliveryNoteRef">
              {(field) => (
                <TextField
                  isDisabled={docForm.isSubmitting}
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                >
                  <Label>
                    <span className="inline-flex items-center gap-1">
                      {t(
                        "receiving_transaction.form_dn_ref",
                        "Delivery Note Ref",
                      )}
                      <Tooltip delay={200}>
                        <Tooltip.Trigger>
                          <Icon
                            icon="solar:info-circle-linear"
                            className="size-3.5 text-muted"
                          />
                        </Tooltip.Trigger>
                        <Tooltip.Content showArrow placement="top">
                          {t(
                            "receiving_transaction.form_dn_ref_hint",
                            "Optional — supplier delivery note number",
                          )}
                        </Tooltip.Content>
                      </Tooltip>
                    </span>
                  </Label>
                  <Input
                    variant="secondary"
                    placeholder={t(
                      "receiving_transaction.form_dn_ref_placeholder",
                      "DN reference",
                    )}
                  />
                </TextField>
              )}
            </form.Field>
          </DocHeaderCard>

          <DocHeaderCard
            title={t(
              "receiving_transaction.form_section_shipment",
              "Shipment & Driver",
            )}
            icon="solar:truck-linear"
          >
            <form.Field name="carrier">
              {(field) => (
                <TextField
                  isDisabled={docForm.isSubmitting}
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                >
                  <Label>
                    {t("receiving_transaction.form_carrier", "Carrier")}
                  </Label>
                  <Input
                    variant="secondary"
                    placeholder={t(
                      "receiving_transaction.form_carrier_placeholder",
                      "Carrier name",
                    )}
                  />
                </TextField>
              )}
            </form.Field>
            <form.Field name="trackingNumber">
              {(field) => (
                <TextField
                  isDisabled={docForm.isSubmitting}
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                >
                  <Label>
                    {t(
                      "receiving_transaction.form_tracking",
                      "Tracking Number",
                    )}
                  </Label>
                  <Input
                    variant="secondary"
                    placeholder={t(
                      "receiving_transaction.form_tracking_placeholder",
                      "Tracking number",
                    )}
                  />
                </TextField>
              )}
            </form.Field>
            <form.Field name="driverName">
              {(field) => (
                <TextField
                  isDisabled={docForm.isSubmitting}
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                >
                  <Label>
                    {t("receiving_transaction.form_driver_name", "Driver Name")}
                  </Label>
                  <Input
                    variant="secondary"
                    placeholder={t(
                      "receiving_transaction.form_driver_name_placeholder",
                      "Driver full name",
                    )}
                  />
                </TextField>
              )}
            </form.Field>
            <form.Field name="driverContact">
              {(field) => (
                <TextField
                  isDisabled={docForm.isSubmitting}
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                >
                  <Label>
                    {t(
                      "receiving_transaction.form_driver_contact",
                      "Driver Contact",
                    )}
                  </Label>
                  <Input
                    variant="secondary"
                    placeholder={t(
                      "receiving_transaction.form_driver_contact_placeholder",
                      "Phone or email",
                    )}
                  />
                </TextField>
              )}
            </form.Field>
            <form.Field name="vehiclePlate">
              {(field) => (
                <TextField
                  isDisabled={docForm.isSubmitting}
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                >
                  <Label>
                    {t(
                      "receiving_transaction.form_vehicle_plate",
                      "Vehicle Plate",
                    )}
                  </Label>
                  <Input
                    variant="secondary"
                    placeholder={t(
                      "receiving_transaction.form_vehicle_plate_placeholder",
                      "Plate number",
                    )}
                  />
                </TextField>
              )}
            </form.Field>
          </DocHeaderCard>
        </>
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
                  {t("receiving_transaction.form_summary_title", "Summary")}
                </Card.Title>
              </div>
              <Card.Description>
                {t(
                  "receiving_transaction.form_summary_desc",
                  "Review your transaction before saving.",
                )}
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <dl className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-muted">
                    {t(
                      "receiving_transaction.form_document_number",
                      "Document Number",
                    )}
                  </dt>
                  <dd className="font-mono text-foreground">
                    {formValues.documentNumber ||
                      t("receiving_transaction.form_auto", "Auto")}
                  </dd>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-muted">
                    {t("receiving_transaction.form_supplier", "Supplier")}
                  </dt>
                  <dd className="text-foreground">
                    {formValues.supplierId ? "✓" : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-muted">
                    {t("receiving_transaction.form_warehouse", "Warehouse")}
                  </dt>
                  <dd className="text-foreground">
                    {formValues.warehouseId ? "✓" : "—"}
                  </dd>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <dt className="flex items-center gap-1.5 text-muted">
                    <Icon icon="solar:layers-linear" className="size-3.5" />
                    {t("receiving_transaction.form_total_items", "Total Items")}
                  </dt>
                  <dd className="font-semibold text-foreground">
                    {totalItems}
                  </dd>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <dt className="flex items-center gap-1.5 text-muted">
                    <Icon icon="solar:box-linear" className="size-3.5" />
                    {t(
                      "receiving_transaction.form_total_quantity",
                      "Total Quantity",
                    )}
                  </dt>
                  <dd className="font-semibold text-foreground">
                    {totalQuantity}
                  </dd>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <dt className="text-xs font-medium text-muted">
                    {t("receiving_transaction.form_ready", "Ready to save")}
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
                {t(
                  "receiving_transaction.form_section_notes",
                  "Notes & Attachments",
                )}
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
                      <Label>
                        {t("receiving_transaction.form_notes", "Notes")}
                      </Label>
                      <TextArea
                        rows={4}
                        variant="secondary"
                        placeholder={t(
                          "receiving_transaction.form_notes_placeholder",
                          "Add notes or remarks",
                        )}
                      />
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="files">
                  {(field) => (
                    <div className="space-y-2">
                      <Label>
                        {t(
                          "receiving_transaction.form_attachments",
                          "Attachments",
                        )}
                      </Label>
                      {(field.state.value as InboundAttachment[]).length >
                        0 && (
                        <ul className="space-y-1">
                          {(field.state.value as InboundAttachment[]).map(
                            (f, i) => (
                              <li
                                key={i}
                                className="flex items-center gap-2 text-sm"
                              >
                                <Icon
                                  icon="solar:document-text-linear"
                                  className="size-3.5 shrink-0 text-muted"
                                />
                                <span className="flex-1 truncate">
                                  {f.name}
                                </span>
                                <span className="shrink-0 text-xs text-muted">
                                  {Math.round(f.size / 1024)} KB
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  isIconOnly
                                  isDisabled={docForm.isSubmitting}
                                  onPress={() => {
                                    const next = [
                                      ...(field.state
                                        .value as InboundAttachment[]),
                                    ];
                                    next.splice(i, 1);
                                    field.handleChange(next);
                                  }}
                                >
                                  <Icon
                                    icon="solar:trash-bin-trash-linear"
                                    className="size-3.5 text-danger"
                                  />
                                </Button>
                              </li>
                            ),
                          )}
                        </ul>
                      )}
                      <Button
                        variant="ghost"
                        isDisabled={docForm.isSubmitting || isReadingFiles}
                        onPress={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.multiple = true;
                          input.onchange = async (e) => {
                            const target = e.target as HTMLInputElement;
                            if (!target.files?.length) return;
                            setIsReadingFiles(true);
                            const newFiles: InboundAttachment[] = [];
                            for (const file of Array.from(target.files)) {
                              const dataUrl = await readFileAsDataUrl(file);
                              newFiles.push({
                                name: file.name,
                                type: file.type,
                                size: file.size,
                                dataUrl,
                              });
                            }
                            field.handleChange([
                              ...(field.state.value as InboundAttachment[]),
                              ...newFiles,
                            ]);
                            setIsReadingFiles(false);
                          };
                          input.click();
                        }}
                      >
                        <Icon
                          icon="solar:add-circle-linear"
                          className="size-4"
                        />
                        {t(
                          "receiving_transaction.form_add_attachment",
                          "Add Attachment",
                        )}
                      </Button>
                    </div>
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
              title={t("receiving_transaction.form_items_title", "Items")}
              description={t(
                "receiving_transaction.form_items_desc",
                "Add items for this receiving transaction.",
              )}
              labels={{
                add: t("receiving_transaction.form_add_item", "Add Item"),
                empty: t(
                  "receiving_transaction.form_no_items",
                  'No items. Click "Add Item" to start.',
                ),
                aria: t(
                  "receiving_transaction.form_items_aria",
                  "Transaction items",
                ),
                moveUp: t("receiving_transaction.form_move_up", "Move up"),
                moveDown: t(
                  "receiving_transaction.form_move_down",
                  "Move down",
                ),
                remove: t("receiving_transaction.form_remove_item", "Remove"),
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
            saveDraft: t("receiving_transaction.form_save_draft", "Save Draft"),
            propose: t("receiving_transaction.form_propose", "Propose"),
            incomplete: t(
              "receiving_transaction.form_incomplete",
              "Supplier, warehouse & items required",
            ),
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

// ─── Outer component ──────────────────────────────────────────────────────────
const ReceivingTransactionFormPage = () => {
  const {
    id,
    isEdit,
    detail,
    isLoading,
    isError,
    error,
    initialValues,
    canEdit,
  } = useTransactionFormPage<ReceivingDetail, FormValues>({
    queryKey: "receivingTransactionDetail",
    // The tRPC-inferred return type of this procedure exceeds tsc's
    // instantiation depth (deep relations), so the result is narrowed to the
    // structural view above — same fields, no runtime cast.
    detailQuery: (input) =>
      trpcClient.receivingTransaction.detail.query(
        input,
      ) as unknown as Promise<ReceivingDetail>,
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
    <ReceivingTransactionForm
      id={id}
      isEdit={isEdit}
      initialValues={initialValues}
      isLoading={isEdit && isLoading}
      guard={guard}
    />
  );
};

export { ReceivingTransactionFormPage };
