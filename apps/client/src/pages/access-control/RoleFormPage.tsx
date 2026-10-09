import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Card,
  Checkbox,
  Chip,
  FieldError,
  Input,
  Label,
  Switch,
  TextField,
} from "@heroui/react";
import { AppIcon } from "../../components/AppIcon";
import { useQuery } from "@tanstack/react-query";
import { trpcClient } from "../../lib/trpc";
import { useAiFillForm } from "../../components/AiAssistant/useAiFillForm";
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
import { roleFormSchema } from "@repo/schemas/role-permission";

// ─── Permission group definitions (mirrors seeder) ───────────────────────────

type PermGroup = { prefix: string; label: string; actions: string[] };

type RoleFormValues = {
  name: string;
  description: string;
};

/** Unwrap a tRPC vanilla-client query/procedure into its resolved wire type. */
type DetailOf<Q> = Q extends (...args: never[]) => Promise<infer R> ? R : never;

/**
 * `useTransactionFormPage` keys its editability gate on `approvalStatus` —
 * roles have no approval flow. The member exists only to satisfy the generic
 * constraint; the page derives guards from `isError` / `detail` and never
 * from `canEdit`.
 */
type RoleDetail = DetailOf<
  typeof trpcClient.accessControl.role.detail.query
> & { approvalStatus: string };

const computePermissionGroups = (
  permissions: Array<{ id: string; name: string }>,
): PermGroup[] => {
  const groups: Record<string, { actions: Set<string>; label: string }> = {};
  for (const perm of permissions) {
    const parts = perm.name.split("@");
    if (parts.length !== 2) continue;
    const [prefix, action] = parts;
    if (!groups[prefix]) {
      groups[prefix] = {
        actions: new Set(),
        label: prefix
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()),
      };
    }
    groups[prefix].actions.add(action);
  }
  return Object.entries(groups).map(([prefix, { actions, label }]) => ({
    prefix,
    label,
    actions: Array.from(actions).sort(),
  }));
};

const defaultFormValues = (): RoleFormValues => ({
  name: "",
  description: "",
});

const transformRoleDetailToFormValues = (
  detail: RoleDetail,
): RoleFormValues => ({
  name: detail.name ?? "",
  description: detail.description ?? "",
});

interface RoleFormProps {
  id?: string;
  isEdit: boolean;
  initialValues: RoleFormValues | null;
  /** Detail still loading on edit pages — shell shows the spinner. */
  isLoading?: boolean;
  /** Not-found / error message on edit pages — shell shows the guard. */
  guard?: ReactNode;
  allPermissions: Array<{ id: string; name: string }>;
  initialSelectedPerms: Set<string>;
}

const RoleForm = ({
  id,
  isEdit,
  initialValues,
  isLoading = false,
  guard,
  allPermissions,
  initialSelectedPerms,
}: RoleFormProps) => {
  const t = useMessage();
  const [selectedPerms, setSelectedPerms] =
    useState<Set<string>>(initialSelectedPerms);

  useEffect(() => {
    setSelectedPerms(initialSelectedPerms);
  }, [initialSelectedPerms]);

  const PERMISSION_GROUPS = computePermissionGroups(allPermissions);
  const ALL_PERMS = allPermissions.map((p) => p.name);

  // No `hasPermissionAtom` gate today — the route guard covers authorization.
  // Keep as-is; do not add permission gates here.
  const canSave = true;

  const modalMessages = {
    saving: t("roles.form.modal.saving_title", "Saving role"),
    pleaseWait: t("roles.form.modal.please_wait", "Please wait…"),
    successTitle: t("roles.form.modal.success_title", "Success"),
    errorTitle: t("roles.form.modal.error_title", "Unable to save role"),
    confirmPropose: t("roles.form.modal.confirm_title", "Confirm save"),
    confirmDraft: t("roles.form.modal.confirm_title", "Confirm save"),
    confirmProposeDesc: t(
      "roles.form.modal.confirm_description",
      "Save this role and return to the role list?",
    ),
    confirmDraftDesc: t(
      "roles.form.modal.confirm_description",
      "Save this role and return to the role list?",
    ),
    confirmSave: t("roles.form.modal.confirm_title", "Confirm save"),
    confirmSaveDesc: t(
      "roles.form.modal.confirm_description",
      "Save this role and return to the role list?",
    ),
    messageLabel: t("roles.form.modal.message_label", "Message"),
    messagePlaceholder: t(
      "roles.form.modal.message_placeholder",
      "Add a note (optional)",
    ),
    cancel: t("roles.form.modal.cancel", "Cancel"),
    confirm: t("roles.form.modal.confirm_button", "Confirm"),
    close: t("roles.form.modal.close", "Close"),
    viewDetail: t("roles.form.modal.view_detail", "View Detail"),
  };

  const selectedPermissionIds = () =>
    Array.from(selectedPerms)
      .map(
        (name) =>
          allPermissions.find((permission) => permission.name === name)?.id,
      )
      .filter(Boolean) as string[];

  const docForm = useDocForm<RoleFormValues, any>({
    formId: "role-form",
    isEdit,
    id,
    initialValues,
    defaultValues: defaultFormValues,
    schema: roleFormSchema,
    toPayload: (parsed) => ({
      name: parsed.name.trim(),
      description: parsed.description.trim() || undefined,
      permissions: selectedPermissionIds(),
    }),
    createCaller: (payload) =>
      trpcClient.accessControl.role.create.mutate(payload),
    updateCaller: (payload) =>
      trpcClient.accessControl.role.update.mutate(payload),
    listQueryKey: "roleList",
    detailQueryKey: "roleDetail",
    redirectOnSuccess: () => "/access-control/roles",
    intentMode: "single-save",
    modalMessages,
    successMessageCreate: t(
      "roles.form.success.created",
      "Role created successfully.",
    ),
    successMessageUpdate: t(
      "roles.form.success.updated",
      "Role updated successfully.",
    ),
    errorFallback: t("error_generic", "An unexpected error occurred."),
    missingRequired: (values) => computeMissingRequired(values, ["name"]),
    computeCanSubmit: (values) => Boolean(values.name?.trim()),
  });

  // The JSX below binds via `<form.Field>` — same form instance the hook owns.
  const form = docForm.form;

  useAiFillForm({
    name: (v) => form.setFieldValue("name", String(v)),
    description: (v) => form.setFieldValue("description", String(v)),
  });

  const isGroupAll = (group: PermGroup) =>
    group.actions.every((action) =>
      selectedPerms.has(`${group.prefix}@${action}`),
    );

  const resolveSelected = (
    value: boolean | { target: { checked: boolean } },
  ) => (typeof value === "boolean" ? value : Boolean(value.target?.checked));

  const setPermSelected = (perm: string, isSelected: boolean) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (isSelected) next.add(perm);
      else next.delete(perm);
      return next;
    });
  };

  const setGroupSelected = (group: PermGroup, isSelected: boolean) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      group.actions.forEach((action) => {
        const perm = `${group.prefix}@${action}`;
        if (isSelected) next.add(perm);
        else next.delete(perm);
      });
      return next;
    });
  };

  const setAllPermissions = (isSelected: boolean) => {
    setSelectedPerms(isSelected ? new Set(ALL_PERMS) : new Set());
  };

  // T13e page context: merge the outside-form selectedPerms Set as a plain
  // permissions array (Set is not JSON-safe) so the assistant sees the full
  // live permission selection, not just name/description. Re-registered after
  // the kit's registration so the enriched values win.
  const values = docForm.formValues;
  const hasName = Boolean(values.name?.trim());
  const permCount = selectedPerms.size;

  const pageFormValues = useMemo(
    () => ({ ...values, permissions: [...selectedPerms] }),
    [values, selectedPerms],
  );
  const missingRequired = useMemo(
    () => computeMissingRequired(pageFormValues, ["name", "permissions"]),
    [pageFormValues],
  );
  useRegisterPageForm("role-form", pageFormValues, missingRequired);

  return (
    <FormPageShell
      formId="role-form"
      mode={isEdit ? "edit" : "create"}
      entityId={id}
      title={
        isEdit
          ? t("roles.form.title_edit", "Edit Role")
          : t("roles.form.title_create", "Create Role")
      }
      backTo="/access-control/roles"
      validationErrors={docForm.validationErrors}
      aiFields={["name", "description", "permissions"]}
      extraContext={{ roleId: isEdit ? id : undefined }}
      statusChip={
        hasName ? (
          <Chip color="success" variant="soft" size="sm">
            <AppIcon name="shield-check" className="size-3.5" />
            {`${permCount} ${t("roles.form.perms_chip", "permissions")}`}
          </Chip>
        ) : undefined
      }
      header={
        <>
          <DocHeaderCard
            title={t("roles.form.section_info_title", "Role Information")}
            description={t(
              "roles.form.section_info_desc",
              "Set the role name and short description used throughout the ERP.",
            )}
            icon="shield-user"
          >
            <form.Field name="name">
              {(field) => (
                <TextField
                  fullWidth
                  isRequired
                  name="role-name"
                  value={field.state.value}
                  onChange={field.handleChange}
                >
                  <Label>{t("roles.form.name_label", "Name")}</Label>
                  <Input
                    placeholder={t(
                      "roles.form.name_placeholder",
                      "e.g. Warehouse Operator",
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
            <form.Field name="description">
              {(field) => (
                <TextField
                  fullWidth
                  name="role-description"
                  value={field.state.value}
                  onChange={field.handleChange}
                >
                  <Label>
                    {t("roles.form.description_label", "Description")}
                  </Label>
                  <Input
                    placeholder={t(
                      "roles.form.description_placeholder",
                      "Briefly describe the role’s operational scope",
                    )}
                    variant="secondary"
                  />
                </TextField>
              )}
            </form.Field>
          </DocHeaderCard>

          <DocHeaderCard
            title={t("roles.form.permissions_title", "Permissions")}
            description={t(
              "roles.form.permissions_desc",
              "Toggle modules and actions this role may perform.",
            )}
            icon="lock-keyhole"
            columns={false}
          >
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  {t("roles.form.permissions_title", "Permissions")}
                </h2>
                <span className="text-sm text-muted">
                  {permCount} / {ALL_PERMS.length}{" "}
                  {t("roles.form.selected_suffix", "selected")}
                </span>
              </div>

              <div className="flex flex-row items-center justify-between gap-3 p-1">
                <div className="flex flex-col">
                  <Label htmlFor="select-all-permissions">
                    {t("roles.form.select_all_label", "Select all permissions")}
                  </Label>
                  <span className="text-sm text-muted">
                    {t(
                      "roles.form.select_all_desc",
                      "Apply every available permission in one action.",
                    )}
                  </span>
                </div>
                <Switch
                  isSelected={permCount === ALL_PERMS.length}
                  onChange={(value) =>
                    setAllPermissions(resolveSelected(value))
                  }
                >
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Content>
                </Switch>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {PERMISSION_GROUPS.map((group) => {
                  const groupId = `group-${group.prefix}`;
                  return (
                    <Card key={group.prefix}>
                      <Card.Header className="flex flex-row items-center justify-between gap-3 border-b border-default-200 pb-3">
                        <div className="flex flex-col">
                          <Label htmlFor={groupId}>{group.label}</Label>
                          <span className="text-sm text-muted">
                            {group.actions.length}{" "}
                            {t(
                              "roles.form.actions_suffix",
                              "permission actions",
                            )}
                          </span>
                        </div>
                        <Switch
                          id={groupId}
                          isSelected={isGroupAll(group)}
                          onChange={(value) =>
                            setGroupSelected(group, resolveSelected(value))
                          }
                        >
                          <Switch.Content>
                            <Switch.Control>
                              <Switch.Thumb />
                            </Switch.Control>
                          </Switch.Content>
                        </Switch>
                      </Card.Header>

                      <Card.Content>
                        <div className="space-y-3">
                          {group.actions.map((action) => {
                            const perm = `${group.prefix}@${action}`;
                            const permId = `perm-${group.prefix}-${action}`;
                            return (
                              <Checkbox
                                key={perm}
                                id={permId}
                                className="flex-row items-center gap-2"
                                isSelected={selectedPerms.has(perm)}
                                onChange={(value) =>
                                  setPermSelected(perm, resolveSelected(value))
                                }
                              >
                                <Checkbox.Control>
                                  <Checkbox.Indicator />
                                </Checkbox.Control>
                                <Checkbox.Content>
                                  <Label htmlFor={permId}>{action}</Label>
                                </Checkbox.Content>
                              </Checkbox>
                            );
                          })}
                        </div>
                      </Card.Content>
                    </Card>
                  );
                })}
              </div>
            </div>
          </DocHeaderCard>
        </>
      }
      aside={
        <FormPreviewCard
          title={t("roles.form.preview_title", "Role Preview")}
          icon="shield-user"
          description={t(
            "roles.form.preview_desc",
            "Live summary of the access profile you are building.",
          )}
          fillLabel={t("form.preview_fill", "Completed")}
          rows={[
            {
              label: t("roles.form.name_label", "Name"),
              value: values.name,
              icon: "shield-user",
              tone: "accent",
            },
            {
              label: t("roles.form.description_label", "Description"),
              value: values.description,
              icon: "document",
            },
            {
              label: t("roles.form.permissions_title", "Permissions"),
              value: permCount > 0 ? `${permCount}/${ALL_PERMS.length}` : null,
              icon: "lock-keyhole",
              tone: permCount === ALL_PERMS.length ? "success" : "accent",
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
              ? t("roles.form.save_changes", "Save Changes")
              : t("roles.form.create_role", "Create Role"),
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

const RoleFormPage = () => {
  const t = useMessage();
  const { id, isEdit, detail, isLoading, isError, error, initialValues } =
    useTransactionFormPage<RoleDetail, RoleFormValues>({
      queryKey: "roleDetail",
      detailQuery: (input) =>
        trpcClient.accessControl.role.detail.query(
          input,
        ) as Promise<RoleDetail>,
      transform: transformRoleDetailToFormValues,
    });

  const { data: allPermissions = [], isLoading: isLoadingPermissions } =
    useQuery({
      queryKey: ["permissionListAll"],
      queryFn: () => trpcClient.accessControl.permission.listAll.query(),
    });

  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (detail) {
      setSelectedPerms(
        new Set(detail.permissions.map((rp) => rp.permission.name)),
      );
    } else {
      setSelectedPerms(new Set());
    }
  }, [detail]);

  // Roles have no approval status, so the hook's `canEdit` (status-gated) is
  // ignored — the form is editable whenever the detail loads without error.
  let guard: ReactNode = null;
  if (isEdit && isError) {
    guard = (
      <p className="text-sm text-danger">
        {(error as Error | null)?.message ??
          t("roles.form.load_error", "Failed to load role.")}
      </p>
    );
  } else if (isEdit && !detail) {
    guard = (
      <p className="text-sm text-danger">
        {t("roles.form.not_found", "Role not found.")}
      </p>
    );
  }

  return (
    <RoleForm
      id={id}
      isEdit={isEdit}
      initialValues={initialValues}
      isLoading={isLoading || isLoadingPermissions}
      guard={guard}
      allPermissions={allPermissions}
      initialSelectedPerms={selectedPerms}
    />
  );
};

export { RoleFormPage };
