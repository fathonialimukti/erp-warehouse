import { useAtomValue } from "jotai";
import { useMessage } from "../../lib/useMessage";
import {
  Chip,
  FieldError,
  Input,
  Label,
  Switch,
  TextArea,
  TextField,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import type { ReactNode } from "react";
import { useAiFillForm } from "../../components/AiAssistant/useAiFillForm";
import { trpcClient } from "../../lib/trpc";
import { hasPermissionAtom } from "../../lib/atoms";
import {
  knowledgeFormSchema,
  type KnowledgeFormValues,
} from "@repo/schemas/knowledge";
import {
  DocHeaderCard,
  FormAiTip,
  FormFooterBar,
  FormPageShell,
  FormPreviewCard,
  TransactionFormModal,
  useDocForm,
} from "../../components/form";

const defaultFormValues = (): KnowledgeFormValues => ({
  slug: "",
  title: "",
  content: "",
  isActive: true,
});

/** Unwrap a tRPC vanilla-client query/procedure into its resolved wire type. */
type DetailOf<Q> = Q extends (...args: never[]) => Promise<infer R> ? R : never;

/** Client-side shape of `knowledge.getById`. */
type KnowledgeDetail = DetailOf<typeof trpcClient.knowledge.getById.query>;

const transformDetailToFormValues = (
  d: KnowledgeDetail,
): KnowledgeFormValues => ({
  slug: d.slug,
  title: d.title,
  content: d.content,
  isActive: d.isActive,
});

interface Props {
  id?: string;
  isEdit: boolean;
  initialValues: KnowledgeFormValues | null;
  /** Detail still loading on edit pages — shell shows the spinner. */
  isLoading?: boolean;
  /** Not-found / error message on edit pages — shell shows the guard. */
  guard?: ReactNode;
}

function KnowledgeFormContent({
  id,
  isEdit,
  initialValues,
  isLoading = false,
  guard,
}: Props) {
  const t = useMessage();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = isEdit
    ? hasPermission("knowledge@update")
    : hasPermission("knowledge@create");

  const modalMessages = {
    saving: t("knowledge.form.saving", "Saving…"),
    successTitle: t("knowledge.form.success_title", "Saved"),
    errorTitle: t("knowledge.form.error_title", "Error"),
    confirmPropose: t("knowledge.form.confirm_propose", "Confirm Propose"),
    confirmDraft: t("knowledge.form.confirm_save", "Confirm Save"),
    confirmSave: t("knowledge.form.confirm_save", "Confirm Save"),
    confirmProposeDesc: t(
      "knowledge.form.confirm_propose_desc",
      "Propose this document?",
    ),
    confirmDraftDesc: t(
      "knowledge.form.confirm_save_desc",
      "Save this document?",
    ),
    confirmSaveDesc: t(
      "knowledge.form.confirm_save_desc",
      "Save this document?",
    ),
    messageLabel: t("knowledge.form.message_label", "Message"),
    messagePlaceholder: t(
      "knowledge.form.message_placeholder",
      "Add a note (optional)",
    ),
    cancel: t("knowledge.form.cancel", "Cancel"),
    confirm: t("knowledge.form.confirm", "Confirm"),
    close: t("knowledge.form.close", "Close"),
    viewDetail: t("knowledge.form.view_detail", "View Detail"),
  };

  const docForm = useDocForm<KnowledgeFormValues, any>({
    formId: "knowledge-form",
    isEdit,
    id,
    initialValues,
    defaultValues: defaultFormValues,
    schema: knowledgeFormSchema,
    // Knowledge documents have no approval flow — a single save action
    // (mirrors the purchase-order precedent).
    intentMode: "single-save",
    toPayload: (parsed) => ({
      slug: parsed.slug.trim(),
      title: parsed.title.trim(),
      content: parsed.content,
      isActive: parsed.isActive,
    }),
    createCaller: (payload) => trpcClient.knowledge.create.mutate(payload),
    updateCaller: (payload) => trpcClient.knowledge.update.mutate(payload),
    listQueryKey: "knowledgeList",
    detailQueryKey: "knowledgeDetail",
    redirectOnSuccess: (savedId) => `/knowledge/${savedId ?? id}`,
    modalMessages,
    successMessageCreate: t(
      "knowledge.form.create_success",
      "Document created.",
    ),
    successMessageUpdate: t(
      "knowledge.form.update_success",
      "Document updated.",
    ),
    errorFallback: t(
      "knowledge.form.error.create_failed",
      "Failed to create document.",
    ),
    missingRequired: (values) => {
      const missing: string[] = [];
      if (!values.slug?.trim()) missing.push("slug");
      if (!values.title?.trim()) missing.push("title");
      if (!values.content?.trim()) missing.push("content");
      return missing;
    },
    computeCanSubmit: (values) =>
      Boolean(values.slug?.trim()) && Boolean(values.title?.trim()),
  });

  // The JSX below binds via `<form.Field>` — same form instance the hook owns.
  const form = docForm.form;

  const values = docForm.formValues;
  const wordCount = values.content?.trim()
    ? values.content.trim().split(/\s+/).length
    : 0;

  useAiFillForm({
    slug: (v) => form.setFieldValue("slug", String(v)),
    title: (v) => form.setFieldValue("title", String(v)),
    content: (v) => form.setFieldValue("content", String(v)),
    isActive: (v) => form.setFieldValue("isActive", Boolean(v)),
  });

  return (
    <FormPageShell
      formId="knowledge-form"
      mode={isEdit ? "edit" : "create"}
      entityId={id}
      title={t(
        isEdit ? "knowledge.form.title_edit" : "knowledge.form.title_create",
        isEdit ? "Edit Document" : "Add Document",
      )}
      backTo="/knowledge"
      validationErrors={docForm.validationErrors}
      aiFields={["slug", "title", "content", "isActive"]}
      extraContext={{ documentId: isEdit ? id : undefined }}
      statusChip={
        <div className="flex flex-wrap items-center gap-2">
          {values.slug?.trim() ? (
            <Chip size="sm" variant="soft" color="accent">
              <span className="inline-flex items-center gap-1">
                <Icon icon="solar:link-linear" className="size-3.5" />
                {values.slug.trim()}
              </span>
            </Chip>
          ) : null}
          <Chip
            size="sm"
            variant="soft"
            color={values.isActive ? "success" : "warning"}
          >
            <span className="inline-flex items-center gap-1">
              <Icon
                icon={
                  values.isActive
                    ? "solar:check-circle-linear"
                    : "solar:eye-closed-linear"
                }
                className="size-3.5"
              />
              {values.isActive
                ? t("knowledge.form.active_chip", "Active")
                : t("knowledge.form.draft_chip", "Draft")}
            </span>
          </Chip>
        </div>
      }
      header={
        <>
          <DocHeaderCard
            title={t("knowledge.form.section_title", "Document Information")}
            description={t(
              "knowledge.form.section_header_desc",
              "The title and slug used to find this document.",
            )}
            icon="solar:book-bookmark-linear"
          >
            <form.Field name="title">
              {(field) => (
                <TextField
                  fullWidth
                  isRequired
                  isDisabled={docForm.isSubmitting}
                  isInvalid={field.state.meta.errors.length > 0}
                  name="title"
                  value={field.state.value}
                  onChange={field.handleChange}
                >
                  <Label>{t("knowledge.form.field_title", "Title")}</Label>
                  <Input
                    placeholder={t(
                      "knowledge.form.title_placeholder",
                      "Document title",
                    )}
                    variant="secondary"
                  />
                  {field.state.meta.errors.length > 0 ? (
                    <FieldError>
                      {field.state.meta.errors.join(", ")}
                    </FieldError>
                  ) : null}
                </TextField>
              )}
            </form.Field>

            <form.Field name="slug">
              {(field) => (
                <TextField
                  fullWidth
                  isRequired
                  isDisabled={docForm.isSubmitting}
                  isInvalid={field.state.meta.errors.length > 0}
                  name="slug"
                  value={field.state.value}
                  onChange={field.handleChange}
                >
                  <Label>{t("knowledge.form.field_slug", "Slug")}</Label>
                  <Input
                    placeholder={t(
                      "knowledge.form.slug_placeholder",
                      "e.g. approval-workflow",
                    )}
                    variant="secondary"
                  />
                  {field.state.meta.errors.length > 0 ? (
                    <FieldError>
                      {field.state.meta.errors.join(", ")}
                    </FieldError>
                  ) : null}
                </TextField>
              )}
            </form.Field>
          </DocHeaderCard>

          <DocHeaderCard
            title={t(
              "knowledge.form.section_content_title",
              "Content & Publishing",
            )}
            description={t(
              "knowledge.form.section_content_desc",
              "The body of the document and whether RAG can index it.",
            )}
            icon="solar:document-text-linear"
            columns={false}
          >
            <div className="space-y-6">
              <form.Field name="content">
                {(field) => (
                  <TextField
                    fullWidth
                    isDisabled={docForm.isSubmitting}
                    isInvalid={field.state.meta.errors.length > 0}
                    name="content"
                    value={field.state.value}
                    onChange={field.handleChange}
                  >
                    <Label>
                      {t("knowledge.form.field_content", "Content")}
                    </Label>
                    <TextArea
                      placeholder={t(
                        "knowledge.form.content_placeholder",
                        "Markdown content for RAG indexing",
                      )}
                      rows={16}
                      variant="secondary"
                    />
                    {field.state.meta.errors.length > 0 ? (
                      <FieldError>
                        {field.state.meta.errors.join(", ")}
                      </FieldError>
                    ) : null}
                  </TextField>
                )}
              </form.Field>

              <form.Field name="isActive">
                {(field) => (
                  <div className="flex flex-row items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <Label htmlFor="knowledge-is-active">
                        {t("knowledge.form.field_is_active", "Active")}
                      </Label>
                      <span className="text-sm text-muted">
                        {t(
                          "knowledge.form.is_active_hint",
                          "Inactive documents are excluded from RAG indexing.",
                        )}
                      </span>
                    </div>
                    <Switch
                      id="knowledge-is-active"
                      isSelected={field.state.value}
                      isDisabled={docForm.isSubmitting}
                      onChange={(value) => field.handleChange(Boolean(value))}
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
          </DocHeaderCard>
        </>
      }
      aside={
        <FormPreviewCard
          title={t("knowledge.form.preview_title", "Document Preview")}
          icon="solar:book-bookmark-linear"
          description={t(
            "knowledge.form.preview_desc",
            "Live summary of the knowledge document you are writing.",
          )}
          fillLabel={t("form.preview_fill", "Completed")}
          rows={[
            {
              label: t("knowledge.form.field_title", "Title"),
              value: values.title,
              icon: "solar:book-bookmark-linear",
              tone: "accent",
            },
            {
              label: t("knowledge.form.field_slug", "Slug"),
              value: values.slug,
              icon: "solar:link-linear",
            },
            {
              label: t("knowledge.form.preview_words", "Words"),
              value: wordCount > 0 ? wordCount : null,
              icon: "solar:layers-linear",
            },
            {
              label: t("knowledge.form.field_is_active", "Status"),
              value: values.isActive
                ? t("knowledge.form.active_chip", "Active")
                : t("knowledge.form.draft_chip", "Draft"),
              icon: "solar:eye-linear",
              tone: values.isActive ? "success" : "warning",
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
              ? t("knowledge.form.submit_update", "Save Changes")
              : t("knowledge.form.submit_create", "Create Document"),
            incomplete: t("knowledge.form.incomplete", "Slug & title required"),
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
      loadingLabel={t("knowledge.form.loading_detail", "Loading document...")}
      guard={guard}
      isDisabled={docForm.isSubmitting}
    />
  );
}

function KnowledgeFormPage() {
  const t = useMessage();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const {
    data: detail,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["knowledgeDetail", id],
    enabled: isEdit,
    queryFn: () => trpcClient.knowledge.getById.query({ id: id ?? "" }),
  });

  const initialValues =
    isEdit && detail ? transformDetailToFormValues(detail) : null;

  let guard: ReactNode = null;
  if (isEdit && isError) {
    guard = (
      <p className="text-sm text-danger">
        {(error as Error | null)?.message ?? "Failed to load document."}
      </p>
    );
  } else if (isEdit && !detail && !isLoading) {
    guard = (
      <p className="text-sm text-danger">
        {t("knowledge.form.not_found", "Document not found.")}
      </p>
    );
  }

  return (
    <KnowledgeFormContent
      id={id}
      isEdit={isEdit}
      initialValues={initialValues}
      isLoading={isEdit && isLoading}
      guard={guard}
    />
  );
}

export { KnowledgeFormPage };
