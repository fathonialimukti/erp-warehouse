import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAtomValue } from "jotai";
import { useMessage } from "../../lib/useMessage";
import {
  Button,
  Chip,
  FieldError,
  Input,
  Label,
  NumberField,
  TextArea,
  TextField,
} from "@heroui/react";
import { AppIcon } from "../../components/AppIcon";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { hasPermissionAtom } from "../../lib/atoms";
import { useRegisterPageForm } from "../../lib/ai/usePageContext";
import { trpcClient } from "../../lib/trpc";
import { ImageUploadField } from "../../components/ImageUploadField";
import {
  productFormSchema,
  type ProductFormValues,
} from "@repo/schemas/product";
import { useAiFillForm } from "../../components/AiAssistant/useAiFillForm";
import {
  DocHeaderCard,
  FormAiTip,
  FormFooterBar,
  FormPageShell,
  FormPreviewCard,
  TransactionFormModal,
  useDocForm,
} from "../../components/form";

/** Unwrap a tRPC vanilla-client query/procedure into its resolved wire type. */
type DetailOf<Q> = Q extends (...args: never[]) => Promise<infer R> ? R : never;

/** Client-side shape of `product.detail` (the FINISHED_GOOD Sku record). */
type ProductDetail = DetailOf<typeof trpcClient.product.detail.query>;

const defaultFormValues = (): ProductFormValues => ({
  code: "",
  name: "",
  description: "",
  baseUnit: "pcs",
  packageName: "carton",
  packagesPerPallet: 1,
  quantityPerPackage: 1,
  packageUnit: "pcs",
  length: undefined,
  width: undefined,
  height: undefined,
  maxWeight: undefined,
});

const transformDetailToFormValues = (d: ProductDetail): ProductFormValues => ({
  code: d.code ?? "",
  name: d.name,
  description: d.description ?? "",
  baseUnit: d.baseUnit,
  packageName: d.packageName,
  packagesPerPallet: d.packagesPerPallet,
  quantityPerPackage: Number(d.quantityPerPackage),
  packageUnit: d.packageUnit,
  length: d.length ?? undefined,
  width: d.width ?? undefined,
  height: d.height ?? undefined,
  maxWeight: d.maxWeight != null ? Number(d.maxWeight) : undefined,
});

interface Props {
  id?: string;
  isEdit: boolean;
  initialValues: ProductFormValues | null;
  /** Existing photo on edit pages — lives outside the form (base64 payload). */
  initialPhoto?: string;
  /** Detail still loading on edit pages — shell shows the spinner. */
  isLoading?: boolean;
  /** Not-found / error message on edit pages — shell shows the guard. */
  guard?: ReactNode;
}

const ProductForm = ({
  id,
  isEdit,
  initialValues,
  initialPhoto,
  isLoading = false,
  guard,
}: Props) => {
  const t = useMessage();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = isEdit
    ? hasPermission("product@update")
    : hasPermission("product@create");

  const [photo, setPhoto] = useState<string | undefined>(initialPhoto);
  useEffect(() => {
    setPhoto(initialPhoto);
  }, [initialPhoto]);

  const modalMessages = {
    saving: t("product.form.saving", "Saving…"),
    successTitle: t("product.form.success_title", "Saved"),
    errorTitle: t("product.form.error_title", "Error"),
    confirmPropose: t("product.form.confirm_propose", "Confirm Propose"),
    confirmDraft: t("product.form.confirm_save", "Confirm Save"),
    confirmSave: t("product.form.confirm_save", "Confirm Save"),
    confirmProposeDesc: t(
      "product.form.confirm_propose_desc",
      "Propose this product?",
    ),
    confirmDraftDesc: t("product.form.confirm_save_desc", "Save this product?"),
    confirmSaveDesc: t("product.form.confirm_save_desc", "Save this product?"),
    messageLabel: t("product.form.message_label", "Message"),
    messagePlaceholder: t(
      "product.form.message_placeholder",
      "Add a note (optional)",
    ),
    cancel: t("product.form.cancel", "Cancel"),
    confirm: t("product.form.confirm", "Confirm"),
    close: t("product.form.close", "Close"),
    viewDetail: t("product.form.view_detail", "View Detail"),
  };

  const docForm = useDocForm<ProductFormValues, any>({
    formId: "product-form",
    isEdit,
    id,
    initialValues,
    defaultValues: defaultFormValues,
    schema: productFormSchema,
    // Products have no approval flow — a single save action; the modal confirm
    // stages the create/update directly (mirrors the purchase-order precedent).
    intentMode: "single-save",
    toPayload: (parsed) => {
      const base = {
        code: parsed.code,
        name: parsed.name,
        description: parsed.description || undefined,
        baseUnit: parsed.baseUnit,
        packageName: parsed.packageName,
        packagesPerPallet: Number(parsed.packagesPerPallet),
        quantityPerPackage: Number(parsed.quantityPerPackage),
        packageUnit: parsed.packageUnit,
        length: parsed.length,
        width: parsed.width,
        height: parsed.height,
        maxWeight: parsed.maxWeight,
        photo: photo ?? initialPhoto ?? undefined,
      };
      return isEdit ? { ...base, currentId: id ?? "" } : base;
    },
    createCaller: (payload) => trpcClient.product.create.mutate(payload),
    updateCaller: (payload) => trpcClient.product.update.mutate(payload),
    listQueryKey: "productList",
    detailQueryKey: "productDetail",
    redirectOnSuccess: (savedId) => `/products/${savedId ?? id}`,
    modalMessages,
    successMessageCreate: t("product.form.create_success", "Product created."),
    successMessageUpdate: t("product.form.update_success", "Product updated."),
    errorFallback: t(
      "product.form.errors.save_failed",
      "Failed to save product.",
    ),
    missingRequired: (values) => {
      const missing: string[] = [];
      if (!values.code?.trim()) missing.push("code");
      if (!values.name?.trim()) missing.push("name");
      if (!values.packageName?.trim()) missing.push("packageName");
      if (!(Number(values.packagesPerPallet) >= 1))
        missing.push("packagesPerPallet");
      if (!(Number(values.quantityPerPackage) >= 0))
        missing.push("quantityPerPackage");
      if (!values.packageUnit?.trim()) missing.push("packageUnit");
      return missing;
    },
    computeCanSubmit: (values) =>
      Boolean(values.code?.trim()) &&
      Boolean(values.name?.trim()) &&
      Boolean(values.packageName?.trim()) &&
      Number(values.packagesPerPallet) >= 1 &&
      Number(values.quantityPerPackage) >= 0 &&
      Boolean(values.packageUnit?.trim()),
  });

  // The JSX below binds via `<form.Field>` — same form instance the hook owns.
  const form = docForm.form;

  const values = docForm.formValues;
  const hasCode = Boolean(values.code?.trim());
  const dims = [values.length, values.width, values.height].filter(
    (v) => v !== undefined && Number(v) > 0,
  );

  // Photo lives in useState outside the TanStack form (base64 payload must
  // never reach the assistant) — publish only a presence flag. `useDocForm`
  // registers the page form; this second registration (same formId, last one
  // wins) augments the values with `hasPhoto`.
  const pageFormValues = useMemo(
    () => ({ ...values, hasPhoto: Boolean(photo) }),
    [values, photo],
  );
  useRegisterPageForm("product-form", pageFormValues, docForm.missingRequired);

  useAiFillForm({
    code: (v) => form.setFieldValue("code", String(v)),
    name: (v) => form.setFieldValue("name", String(v)),
    description: (v) => form.setFieldValue("description", String(v)),
    baseUnit: (v) => form.setFieldValue("baseUnit", String(v)),
  });

  return (
    <FormPageShell
      formId="product-form"
      mode={isEdit ? "edit" : "create"}
      entityId={id}
      title={t(
        isEdit ? "product.form.title_edit" : "product.form.title_create",
        isEdit ? "Edit Product" : "Add Product",
      )}
      backTo="/products"
      validationErrors={docForm.validationErrors}
      aiFields={[
        "code",
        "name",
        "description",
        "baseUnit",
        "packageName",
        "packagesPerPallet",
        "quantityPerPackage",
        "packageUnit",
        "length",
        "width",
        "height",
        "maxWeight",
      ]}
      extraContext={{ productId: isEdit ? id : undefined }}
      statusChip={
        hasCode ? (
          <Chip size="sm" variant="soft" color="accent">
            <span className="inline-flex items-center gap-1">
              <AppIcon name="database" className="size-3.5" />
              {values.code}
            </span>
          </Chip>
        ) : undefined
      }
      header={
        <>
          <DocHeaderCard
            title={t("product.form.section_info", "Product Information")}
            description={t(
              "product.form.section_info_desc",
              "Basic product details and identification.",
            )}
            icon="box"
            columns={false}
          >
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>{t("product.form.photo", "Product Photo")}</Label>
                <ImageUploadField
                  value={photo ?? initialPhoto ?? undefined}
                  onChange={setPhoto}
                  disabled={docForm.isSubmitting}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <form.Field name="code">
                  {(field) => (
                    <TextField
                      isRequired
                      isDisabled={docForm.isSubmitting}
                      isInvalid={field.state.meta.errors.length > 0}
                      value={field.state.value}
                      onChange={(v) => field.handleChange(v)}
                      onBlur={field.handleBlur}
                    >
                      <Label>{t("product.form.code", "Code")}</Label>
                      <Input
                        placeholder={t(
                          "product.form.code_placeholder",
                          "e.g. PROD-001",
                        )}
                      />
                      {field.state.meta.errors.length > 0 ? (
                        <FieldError>{field.state.meta.errors[0]}</FieldError>
                      ) : null}
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="name">
                  {(field) => (
                    <TextField
                      isRequired
                      isDisabled={docForm.isSubmitting}
                      isInvalid={field.state.meta.errors.length > 0}
                      value={field.state.value}
                      onChange={(v) => field.handleChange(v)}
                      onBlur={field.handleBlur}
                    >
                      <Label>{t("product.form.name", "Name")}</Label>
                      <Input
                        placeholder={t(
                          "product.form.name_placeholder",
                          "Product name or SKU label",
                        )}
                      />
                      {field.state.meta.errors.length > 0 ? (
                        <FieldError>{field.state.meta.errors[0]}</FieldError>
                      ) : null}
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="description">
                  {(field) => (
                    <TextField
                      isDisabled={docForm.isSubmitting}
                      isInvalid={field.state.meta.errors.length > 0}
                      value={field.state.value}
                      onChange={(v) => field.handleChange(v)}
                      onBlur={field.handleBlur}
                    >
                      <Label>
                        {t("product.form.description", "Description")}
                      </Label>
                      <TextArea
                        placeholder={t(
                          "product.form.description_placeholder",
                          "Describe the product, usage, or handling note (optional)",
                        )}
                      />
                      {field.state.meta.errors.length > 0 ? (
                        <FieldError>{field.state.meta.errors[0]}</FieldError>
                      ) : null}
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="baseUnit">
                  {(field) => (
                    <TextField
                      isRequired
                      isDisabled={docForm.isSubmitting}
                      isInvalid={field.state.meta.errors.length > 0}
                      value={field.state.value}
                      onChange={(v) => field.handleChange(v)}
                      onBlur={field.handleBlur}
                    >
                      <Label>{t("product.form.base_unit", "Base Unit")}</Label>
                      <Input
                        placeholder={t(
                          "product.form.base_unit_placeholder",
                          "e.g. pcs, kg, liter",
                        )}
                      />
                      {field.state.meta.errors.length > 0 ? (
                        <FieldError>{field.state.meta.errors[0]}</FieldError>
                      ) : null}
                    </TextField>
                  )}
                </form.Field>
              </div>
            </div>
          </DocHeaderCard>

          <DocHeaderCard
            title={t(
              "product.form.section_packaging",
              "Packaging Configuration",
            )}
            description={t(
              "product.form.section_packaging_desc",
              "Define how this product is packaged and stored.",
            )}
            icon="package"
          >
            <form.Field name="packageName">
              {(field) => (
                <TextField
                  isRequired
                  isDisabled={docForm.isSubmitting}
                  isInvalid={field.state.meta.errors.length > 0}
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v)}
                  onBlur={field.handleBlur}
                >
                  <Label>
                    {t("product.form.package_name", "Package Name")}
                  </Label>
                  <Input
                    placeholder={t(
                      "product.form.package_name_placeholder",
                      "e.g. carton, box, pallet",
                    )}
                  />
                  {field.state.meta.errors.length > 0 ? (
                    <FieldError>{field.state.meta.errors[0]}</FieldError>
                  ) : null}
                </TextField>
              )}
            </form.Field>

            <form.Field name="packagesPerPallet">
              {(field) => (
                <NumberField
                  isRequired
                  isDisabled={docForm.isSubmitting}
                  isInvalid={field.state.meta.errors.length > 0}
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v)}
                  onBlur={field.handleBlur}
                  minValue={1}
                >
                  <Label>
                    {t(
                      "product.form.packages_per_pallet",
                      "Packages per Pallet",
                    )}
                  </Label>
                  <Input />
                  {field.state.meta.errors.length > 0 ? (
                    <FieldError>{field.state.meta.errors[0]}</FieldError>
                  ) : null}
                </NumberField>
              )}
            </form.Field>

            <form.Field name="quantityPerPackage">
              {(field) => (
                <NumberField
                  isRequired
                  isDisabled={docForm.isSubmitting}
                  isInvalid={field.state.meta.errors.length > 0}
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v)}
                  onBlur={field.handleBlur}
                  minValue={1}
                >
                  <Label>
                    {t(
                      "product.form.quantity_per_package",
                      "Quantity per Package",
                    )}
                  </Label>
                  <Input />
                  {field.state.meta.errors.length > 0 ? (
                    <FieldError>{field.state.meta.errors[0]}</FieldError>
                  ) : null}
                </NumberField>
              )}
            </form.Field>

            <form.Field name="packageUnit">
              {(field) => (
                <TextField
                  isRequired
                  isDisabled={docForm.isSubmitting}
                  isInvalid={field.state.meta.errors.length > 0}
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v)}
                  onBlur={field.handleBlur}
                >
                  <Label>
                    {t("product.form.package_unit", "Package Unit")}
                  </Label>
                  <Input placeholder="e.g. pcs, kg" />
                  {field.state.meta.errors.length > 0 ? (
                    <FieldError>{field.state.meta.errors[0]}</FieldError>
                  ) : null}
                </TextField>
              )}
            </form.Field>
          </DocHeaderCard>

          <DocHeaderCard
            title={t("product.form.section_dimensions", "Dimensions & Weight")}
            description={t(
              "product.form.section_dimensions_desc",
              "Physical dimensions for warehouse storage planning.",
            )}
            icon="layers"
          >
            <form.Field name="length">
              {(field) => (
                <NumberField
                  isDisabled={docForm.isSubmitting}
                  isInvalid={field.state.meta.errors.length > 0}
                  value={field.state.value ?? undefined}
                  onChange={(v) => field.handleChange(v)}
                  onBlur={field.handleBlur}
                  minValue={0}
                >
                  <Label>{t("product.form.length", "Length (cm)")}</Label>
                  <Input />
                  {field.state.meta.errors.length > 0 ? (
                    <FieldError>{field.state.meta.errors[0]}</FieldError>
                  ) : null}
                </NumberField>
              )}
            </form.Field>

            <form.Field name="width">
              {(field) => (
                <NumberField
                  isDisabled={docForm.isSubmitting}
                  isInvalid={field.state.meta.errors.length > 0}
                  value={field.state.value ?? undefined}
                  onChange={(v) => field.handleChange(v)}
                  onBlur={field.handleBlur}
                  minValue={0}
                >
                  <Label>{t("product.form.width", "Width (cm)")}</Label>
                  <Input />
                  {field.state.meta.errors.length > 0 ? (
                    <FieldError>{field.state.meta.errors[0]}</FieldError>
                  ) : null}
                </NumberField>
              )}
            </form.Field>

            <form.Field name="height">
              {(field) => (
                <NumberField
                  isDisabled={docForm.isSubmitting}
                  isInvalid={field.state.meta.errors.length > 0}
                  value={field.state.value ?? undefined}
                  onChange={(v) => field.handleChange(v)}
                  onBlur={field.handleBlur}
                  minValue={0}
                >
                  <Label>{t("product.form.height", "Height (cm)")}</Label>
                  <Input />
                  {field.state.meta.errors.length > 0 ? (
                    <FieldError>{field.state.meta.errors[0]}</FieldError>
                  ) : null}
                </NumberField>
              )}
            </form.Field>

            <form.Field name="maxWeight">
              {(field) => (
                <NumberField
                  isDisabled={docForm.isSubmitting}
                  isInvalid={field.state.meta.errors.length > 0}
                  value={field.state.value ?? undefined}
                  onChange={(v) => field.handleChange(v)}
                  onBlur={field.handleBlur}
                  minValue={0}
                >
                  <Label>
                    {t("product.form.max_weight", "Max Weight (kg)")}
                  </Label>
                  <Input />
                  {field.state.meta.errors.length > 0 ? (
                    <FieldError>{field.state.meta.errors[0]}</FieldError>
                  ) : null}
                </NumberField>
              )}
            </form.Field>
          </DocHeaderCard>
        </>
      }
      aside={
        <FormPreviewCard
          title={t("product.form.preview_title", "Product Preview")}
          icon="box"
          description={t(
            "product.form.preview_desc",
            "Live summary of the product you are configuring.",
          )}
          fillLabel={t("form.preview_fill", "Completed")}
          rows={[
            {
              label: t("product.form.code", "Code"),
              value: values.code,
              icon: "database",
            },
            {
              label: t("product.form.name", "Name"),
              value: values.name,
              icon: "box",
              tone: "accent",
            },
            {
              label: t("product.form.base_unit", "Base Unit"),
              value: values.baseUnit,
              icon: "layers",
            },
            {
              label: t("product.form.preview_package", "Package"),
              value: values.packageName?.trim()
                ? `${values.packageName} × ${values.quantityPerPackage} ${values.packageUnit}`
                : null,
              icon: "package",
            },
            {
              label: t("product.form.preview_dimensions", "Dimensions"),
              value:
                dims.length === 3
                  ? `${values.length}×${values.width}×${values.height} cm`
                  : null,
              icon: "chart-bar",
            },
            {
              label: t("product.form.max_weight", "Max Weight (kg)"),
              value: Number(values.maxWeight) > 0 ? values.maxWeight : null,
              icon: "trending-up",
            },
          ]}
          footer={<FormAiTip />}
        />
      }
      footer={
        <FormFooterBar
          mode="single-save"
          canSave={canSave}
          canSubmit={docForm.canSubmit}
          isSubmitting={docForm.isSubmitting}
          isDirty={docForm.isDirty}
          isEdit={isEdit}
          labels={{
            save: isEdit
              ? t("product.form.save_changes", "Save Changes")
              : t("product.form.create_product", "Create Product"),
            incomplete: t(
              "product.form.incomplete",
              "Code, name & packaging required",
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
      loadingLabel={t("common.loading", "Loading...")}
      guard={guard}
      isDisabled={docForm.isSubmitting}
    />
  );
};

const ProductFormPage = () => {
  const t = useMessage();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const {
    data: detail,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["productDetail", id],
    queryFn: () => trpcClient.product.detail.query({ id: id ?? "" }),
    enabled: isEdit,
  });

  const initialValues =
    isEdit && detail ? transformDetailToFormValues(detail) : null;
  const initialPhoto = detail?.photo ?? undefined;

  let guard: ReactNode = null;
  if (isEdit && isError) {
    guard = (
      <p className="text-sm text-danger">
        {(error as Error | null)?.message ?? "Failed to load product."}
      </p>
    );
  } else if (isEdit && !detail && !isLoading) {
    guard = (
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-danger">
          {t("product.form.not_found", "Product not found.")}
        </p>
        <Button onPress={() => navigate("/products")}>
          {t("product.form.back_to_list", "Back to Products")}
        </Button>
      </div>
    );
  }

  return (
    <ProductForm
      id={id}
      isEdit={isEdit}
      initialValues={initialValues}
      initialPhoto={initialPhoto}
      isLoading={isEdit && isLoading}
      guard={guard}
    />
  );
};

export { ProductFormPage };
