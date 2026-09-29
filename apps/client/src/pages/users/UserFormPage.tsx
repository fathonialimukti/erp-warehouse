import type { ReactNode } from "react";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useState } from "react";
import {
  Chip,
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQuery } from "@tanstack/react-query";
import { trpcClient } from "../../lib/trpc";
import { hasPermissionAtom } from "../../lib/atoms";
import { useAiFillForm } from "../../components/AiAssistant/useAiFillForm";
import { ImageUploadField } from "../../components/ImageUploadField";
import {
  DocHeaderCard,
  FormAiTip,
  FormFooterBar,
  FormPageShell,
  FormPreviewCard,
  TransactionFormModal,
  useDocForm,
  useTransactionFormPage,
} from "../../components/form";
import {
  computeMissingRequired,
  useRegisterPageForm,
} from "../../lib/ai/usePageContext";
import { useMessage } from "../../lib/useMessage";
import {
  createUserFormSchema,
  type CreateUserFormValues,
  updateUserFormSchema,
} from "@repo/schemas/user";

type UserFormValues = CreateUserFormValues;

/** Unwrap a tRPC vanilla-client query/procedure into its resolved wire type. */
type DetailOf<Q> = Q extends (...args: never[]) => Promise<infer R> ? R : never;

/**
 * `useTransactionFormPage` keys its editability gate on `approvalStatus` —
 * users have no approval flow. The member exists only to satisfy the generic
 * constraint; the page derives guards from `isError` / `detail` and never
 * from `canEdit`.
 */
type UserDetail = DetailOf<typeof trpcClient.user.detail.query> & {
  approvalStatus: string;
};

const defaultFormValues = (): UserFormValues => ({
  name: "",
  email: "",
  password: "",
  roleId: "",
});

const transformDetailToFormValues = (detail: UserDetail): UserFormValues => ({
  name: detail.name ?? "",
  email: detail.email ?? "",
  password: "",
  roleId: detail.roleId ?? "",
});

interface UserFormProps {
  id?: string;
  isEdit: boolean;
  initialValues: UserFormValues | null;
  /** Detail still loading on edit pages — shell shows the spinner. */
  isLoading?: boolean;
  /** Not-found / error message on edit pages — shell shows the guard. */
  guard?: ReactNode;
  roles: Array<{ id: string; name: string }>;
  initialPhoto: string | undefined;
}

const UserForm = ({
  id,
  isEdit,
  initialValues,
  isLoading = false,
  guard,
  roles,
  initialPhoto,
}: UserFormProps) => {
  const t = useMessage();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = isEdit
    ? hasPermission("user@update")
    : hasPermission("user@create");

  // Photo lives in useState outside the TanStack form (base64 payload must
  // never reach the assistant) — resynced when the detail lands on edit pages.
  const [photo, setPhoto] = useState<string | undefined>(initialPhoto);
  useEffect(() => {
    setPhoto(initialPhoto);
  }, [initialPhoto]);

  const modalMessages = {
    saving: t("users.form.modal.saving_title", "Saving user"),
    pleaseWait: t("users.form.modal.please_wait", "Please wait…"),
    successTitle: t("users.form.modal.success_title", "Success"),
    errorTitle: t("users.form.modal.error_title", "Unable to save user"),
    confirmPropose: t("users.form.modal.confirm_title", "Confirm save"),
    confirmDraft: t("users.form.modal.confirm_title", "Confirm save"),
    confirmProposeDesc: t(
      "users.form.modal.confirm_description",
      "Save this user and return to the user detail page?",
    ),
    confirmDraftDesc: t(
      "users.form.modal.confirm_description",
      "Save this user and return to the user detail page?",
    ),
    confirmSave: t("users.form.modal.confirm_title", "Confirm save"),
    confirmSaveDesc: t(
      "users.form.modal.confirm_description",
      "Save this user and return to the user detail page?",
    ),
    messageLabel: t("users.form.modal.message_label", "Message"),
    messagePlaceholder: t(
      "users.form.modal.message_placeholder",
      "Add a note (optional)",
    ),
    cancel: t("users.form.modal.cancel", "Cancel"),
    confirm: t("users.form.modal.confirm_button", "Confirm"),
    close: t("users.form.modal.close", "Close"),
    viewDetail: t("users.form.modal.view_detail", "View Detail"),
  };

  const docForm = useDocForm<UserFormValues, any>({
    formId: "user-form",
    isEdit,
    id,
    initialValues,
    defaultValues: defaultFormValues,
    // Create requires a password; update keeps the existing one when blank.
    schema: isEdit ? updateUserFormSchema : createUserFormSchema,
    toPayload: (parsed) => ({
      name: parsed.name.trim(),
      email: parsed.email.trim(),
      password: isEdit
        ? parsed.password.trim() || undefined
        : parsed.password.trim(),
      roleId: parsed.roleId.trim(),
      photo,
    }),
    createCaller: (payload) => trpcClient.user.create.mutate(payload),
    updateCaller: (payload) => trpcClient.user.update.mutate(payload),
    listQueryKey: "userList",
    detailQueryKey: "userDetail",
    redirectOnSuccess: (savedId) => `/users/${savedId ?? id}`,
    intentMode: "single-save",
    modalMessages,
    successMessageCreate: t(
      "users.form.success.created",
      "User created successfully.",
    ),
    successMessageUpdate: t(
      "users.form.success.updated",
      "User updated successfully.",
    ),
    errorFallback: t("error_generic", "An unexpected error occurred."),
    missingRequired: (values) =>
      computeMissingRequired(
        values,
        isEdit
          ? ["name", "email", "roleId"]
          : ["name", "email", "password", "roleId"],
      ),
    computeCanSubmit: (values) =>
      Boolean(values.name?.trim()) &&
      Boolean(values.email?.trim()) &&
      Boolean(values.roleId) &&
      (isEdit || Boolean(values.password?.trim())),
  });

  // The JSX below binds via `<form.Field>` — same form instance the hook owns.
  const form = docForm.form;

  useAiFillForm({
    name: (v) => form.setFieldValue("name", String(v)),
    email: (v) => form.setFieldValue("email", String(v)),
    password: (v) => form.setFieldValue("password", String(v)),
    roleId: (v) => form.setFieldValue("roleId", String(v)),
  });

  // T13e page context: merge the outside-form photo state as a presence flag
  // (never the raw payload — photo may be a base64 data URL and the
  // sanitizer only strips `dataUrl` keys, not a top-level photo string).
  // Re-registered after the kit's registration so the enriched values win.
  const values = docForm.formValues;
  const pageFormValues = useMemo(
    () => ({ ...values, hasPhoto: Boolean(photo) }),
    [values, photo],
  );
  const missingRequired = useMemo(
    () =>
      computeMissingRequired(
        pageFormValues,
        isEdit
          ? ["name", "email", "roleId"]
          : ["name", "email", "password", "roleId"],
      ),
    [pageFormValues, isEdit],
  );
  useRegisterPageForm("user-form", pageFormValues, missingRequired);

  const roleName = roles.find((role) => role.id === values.roleId)?.name;

  return (
    <FormPageShell
      formId="user-form"
      mode={isEdit ? "edit" : "create"}
      entityId={id}
      title={
        isEdit
          ? t("users.form.title_edit", "Edit User")
          : t("users.form.title_create", "Create User")
      }
      backTo="/users"
      validationErrors={docForm.validationErrors}
      aiFields={["name", "email", "password", "roleId"]}
      extraContext={{
        userId: isEdit ? id : undefined,
        availableRoles: roles.map((role) => ({ id: role.id, name: role.name })),
      }}
      statusChip={
        roleName ? (
          <Chip color="success" variant="soft" size="sm">
            <Icon icon="solar:shield-user-linear" className="size-3.5" />
            {roleName}
          </Chip>
        ) : undefined
      }
      header={
        <>
          <DocHeaderCard
            title={t("users.form.section_profile_title", "User Information")}
            description={t(
              "users.form.section_profile_desc",
              "Manage profile details, credentials, and access role for this user.",
            )}
            icon="solar:user-linear"
            columns={false}
          >
            <div className="space-y-6">
              <div className="space-y-1">
                <label className="form-label">
                  {t("users.form.photo_label", "Photo")}
                </label>
                <ImageUploadField value={photo} onChange={setPhoto} />
              </div>

              <form.Field name="name">
                {(field) => (
                  <TextField
                    fullWidth
                    isRequired
                    isDisabled={docForm.isSubmitting}
                    isInvalid={field.state.meta.errors.length > 0}
                    name="user-name"
                    value={field.state.value}
                    onChange={field.handleChange}
                  >
                    <Label>{t("users.form.name_label", "Name")}</Label>
                    <Input
                      placeholder={t(
                        "users.form.name_placeholder",
                        "Full name of the user",
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
            </div>
          </DocHeaderCard>

          <DocHeaderCard
            title={t("users.form.section_access_title", "Access & Role")}
            description={t(
              "users.form.section_access_desc",
              "Sign-in credentials and the permission set this user works with.",
            )}
            icon="solar:shield-user-linear"
          >
            <form.Field name="email">
              {(field) => (
                <TextField
                  fullWidth
                  isRequired
                  isDisabled={docForm.isSubmitting}
                  isInvalid={field.state.meta.errors.length > 0}
                  name="user-email"
                  type="email"
                  value={field.state.value}
                  onChange={field.handleChange}
                >
                  <Label>{t("users.form.email_label", "Email")}</Label>
                  <Input
                    placeholder={t(
                      "users.form.email_placeholder",
                      "user@company.com",
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

            <form.Field name="password">
              {(field) => (
                <TextField
                  fullWidth
                  isRequired={!isEdit}
                  isDisabled={docForm.isSubmitting}
                  isInvalid={field.state.meta.errors.length > 0}
                  name="user-password"
                  type="password"
                  value={field.state.value}
                  onChange={field.handleChange}
                >
                  <Label>
                    {t("users.form.password_label", "Password")}
                    {isEdit
                      ? t("users.form.password_optional_suffix", " (optional)")
                      : ""}
                  </Label>
                  <Input
                    placeholder={
                      isEdit
                        ? t(
                            "users.form.password_placeholder_edit",
                            "Leave blank to keep the current password",
                          )
                        : t(
                            "users.form.password_placeholder_create",
                            "Set an initial password for sign-in",
                          )
                    }
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

            <form.Field name="roleId">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="user-role">
                    {t("users.form.role_label", "Role")}
                  </Label>
                  <Select
                    selectedKey={field.state.value || null}
                    onSelectionChange={(key) =>
                      field.handleChange(String(key ?? ""))
                    }
                    fullWidth
                    variant="secondary"
                    isInvalid={field.state.meta.errors.length > 0}
                  >
                    <Select.Trigger id="user-role">
                      <Select.Value>
                        {({ isPlaceholder }: { isPlaceholder: boolean }) =>
                          isPlaceholder ? (
                            <span className="text-muted">
                              {t(
                                "users.form.role_placeholder",
                                "Select a role",
                              )}
                            </span>
                          ) : undefined
                        }
                      </Select.Value>
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {roles.map((role) => (
                          <ListBox.Item
                            key={role.id}
                            id={role.id}
                            textValue={role.name}
                          >
                            {role.name}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  {field.state.meta.errors.length > 0 ? (
                    <p className="text-sm text-danger">
                      {field.state.meta.errors.join(", ")}
                    </p>
                  ) : null}
                </div>
              )}
            </form.Field>
          </DocHeaderCard>
        </>
      }
      aside={
        <FormPreviewCard
          title={t("users.form.preview_title", "User Preview")}
          icon="solar:user-linear"
          description={t(
            "users.form.preview_desc",
            "Live summary of the user you are creating.",
          )}
          fillLabel={t("form.preview_fill", "Completed")}
          rows={[
            {
              label: t("users.form.photo_label", "Photo"),
              value: photo ? t("users.form.photo_attached", "Attached") : null,
              icon: "solar:camera-linear",
              tone: "success",
            },
            {
              label: t("users.form.name_label", "Name"),
              value: values.name,
              icon: "solar:user-linear",
              tone: "accent",
            },
            {
              label: t("users.form.email_label", "Email"),
              value: values.email,
              icon: "solar:letter-linear",
            },
            {
              label: t("users.form.password_label", "Password"),
              value: values.password
                ? t("users.form.password_set", "Set")
                : null,
              emptyLabel: isEdit
                ? t("users.form.password_unchanged", "Unchanged")
                : undefined,
              icon: "solar:lock-password-linear",
            },
            {
              label: t("users.form.role_label", "Role"),
              value: roleName,
              icon: "solar:shield-user-linear",
              tone: "accent",
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
              ? t("users.form.button_save", "Save Changes")
              : t("users.form.button_create", "Create User"),
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
      loadingLabel={t("users.form.loading", "Loading user data...")}
      guard={guard}
      isDisabled={docForm.isSubmitting}
    />
  );
};

const UserFormPage = () => {
  const t = useMessage();
  const { id, isEdit, detail, isLoading, isError, error, initialValues } =
    useTransactionFormPage<UserDetail, UserFormValues>({
      queryKey: "userDetail",
      detailQuery: (input) =>
        trpcClient.user.detail.query(input) as Promise<UserDetail>,
      transform: transformDetailToFormValues,
    });

  const { data: roles = [], isLoading: isLoadingRoles } = useQuery({
    queryKey: ["roleListAll"],
    queryFn: () => trpcClient.accessControl.role.listAll.query(),
  });

  // Users have no approval status, so the hook's `canEdit` (status-gated) is
  // ignored — the form is editable whenever the detail loads without error.
  let guard: ReactNode = null;
  if (isEdit && isError) {
    guard = (
      <p className="text-sm text-danger">
        {(error as Error | null)?.message ??
          t("users.form.load_error", "Failed to load user.")}
      </p>
    );
  } else if (isEdit && !detail) {
    guard = (
      <p className="text-sm text-danger">
        {t("users.form.not_found", "User not found.")}
      </p>
    );
  }

  return (
    <UserForm
      id={id}
      isEdit={isEdit}
      initialValues={initialValues}
      isLoading={isLoading || isLoadingRoles}
      guard={guard}
      roles={roles}
      initialPhoto={detail?.photo ?? undefined}
    />
  );
};

export { UserFormPage };
