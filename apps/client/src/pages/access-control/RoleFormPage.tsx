import { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Checkbox, FieldError, Input, Label, Modal, Spinner, Switch, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useForm } from '@tanstack/react-form';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../components/PageHeader';
import { trpcClient } from '../../lib/trpc';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../lib/trpc';
import { roleFormSchema } from '@repo/schemas/role-permission';
import { useAiFillForm } from '../../components/AiAssistant/useAiFillForm';
import { AiFillBar } from '../../components/AiFill/AiFillBar';

// ─── Permission group definitions (mirrors seeder) ───────────────────────────

type PermGroup = { prefix: string; label: string; actions: string[] };

type RoleFormValues = {
  name: string;
  description: string;
};

type RoleDetail = {
  id: string;
  name: string;
  description?: string | null;
  permissions: Array<{ permission: { name: string } }>;
};

type ModalStage = 'idle' | 'confirm-save' | 'loading' | 'success' | 'error';

const computePermissionGroups = (permissions: Array<{ id: string; name: string }>): PermGroup[] => {
  const groups: Record<string, { actions: Set<string>; label: string }> = {};
  for (const perm of permissions) {
    const parts = perm.name.split('@');
    if (parts.length !== 2) continue;
    const [prefix, action] = parts;
    if (!groups[prefix]) {
      groups[prefix] = {
        actions: new Set(),
        label: prefix.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
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
  name: '',
  description: '',
});

const transformRoleDetailToFormValues = (detail: RoleDetail): RoleFormValues => ({
  name: detail.name ?? '',
  description: detail.description ?? '',
});

function RoleFormContent({
  allPermissions,
  initialValues,
  initialSelectedPerms,
  isEdit,
  roleId,
}: {
  allPermissions: Array<{ id: string; name: string }>;
  initialValues: RoleFormValues;
  initialSelectedPerms: Set<string>;
  isEdit: boolean;
  roleId?: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const intl = useIntl();
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(initialSelectedPerms);
  const [formError, setFormError] = useState<string | null>(null);
  const [modalStage, setModalStage] = useState<ModalStage>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const resultTimerRef = useRef<number | null>(null);

  const PERMISSION_GROUPS = computePermissionGroups(allPermissions);
  const ALL_PERMS = allPermissions.map(p => p.name);

  const clearResultTimer = () => {
    if (resultTimerRef.current !== null) {
      window.clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
  };

  const handleModalClose = () => {
    if (modalStage === 'loading') return;

    clearResultTimer();
    const wasSuccess = modalStage === 'success';
    setModalStage('idle');

    if (wasSuccess) {
      navigate('/access-control/roles');
    }
  };

  const handleActionConfirm = async () => {
    setFormError(null);
    setResultMessage('');

    await form.validateAllFields('change');
    if (!form.state.isFieldsValid) return;

    setModalStage('confirm-save');
  };

  const handleConfirmSubmit = () => {
    setModalStage('loading');
    void form.handleSubmit();
  };

  useEffect(() => () => clearResultTimer(), []);

  useEffect(() => {
    setSelectedPerms(initialSelectedPerms);
  }, [initialSelectedPerms]);

  const createMutation = useMutation<unknown, unknown, inferProcedureInput<AppRouter['accessControl']['role']['create']>>({
    mutationFn: (payload) => trpcClient.accessControl.role.create.mutate(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['roleList'] });
      setResultMessage('Role created successfully.');
      setModalStage('success');
      clearResultTimer();
      resultTimerRef.current = window.setTimeout(() => {
        setModalStage('idle');
        navigate('/access-control/roles');
      }, 1500);
    },
    onError: (err) => {
      setResultMessage(err instanceof Error ? err.message : 'Failed to save role.');
      setModalStage('error');
    },
  });

  const updateMutation = useMutation<unknown, unknown, inferProcedureInput<AppRouter['accessControl']['role']['update']>>({
    mutationFn: (payload) => trpcClient.accessControl.role.update.mutate(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['roleList'] });
      setResultMessage('Role updated successfully.');
      setModalStage('success');
      clearResultTimer();
      resultTimerRef.current = window.setTimeout(() => {
        setModalStage('idle');
        navigate('/access-control/roles');
      }, 1500);
    },
    onError: (err) => {
      setResultMessage(err instanceof Error ? err.message : 'Failed to save role.');
      setModalStage('error');
    },
  });

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onChange: roleFormSchema,
    },
    onSubmit: async ({ value }) => {
      setFormError(null);

      const selectedPermissionIds = Array.from(selectedPerms)
        .map((name) => allPermissions.find((permission) => permission.name === name)?.id)
        .filter(Boolean) as string[];

      if (isEdit) {
        await updateMutation.mutateAsync({
          id: roleId!,
          name: value.name.trim(),
          description: value.description.trim() || undefined,
          permissions: selectedPermissionIds,
        });
      } else {
        await createMutation.mutateAsync({
          name: value.name.trim(),
          description: value.description.trim() || undefined,
          permissions: selectedPermissionIds,
        });
      }
    },
  });

  const isSubmitting = modalStage === 'loading' || createMutation.isPending || updateMutation.isPending;

  useAiFillForm({
    name:        (v) => form.setFieldValue('name', String(v)),
    description: (v) => form.setFieldValue('description', String(v)),
  });

  const isGroupAll = (group: PermGroup) =>
    group.actions.every((action) => selectedPerms.has(`${group.prefix}@${action}`));

  const resolveSelected = (value: boolean | { target: { checked: boolean } }) =>
    typeof value === 'boolean' ? value : Boolean(value.target?.checked);

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

  const currentName = form.state.values.name.trim();

  return (
    <section
      className="space-y-6"
      data-ai-context={JSON.stringify({
        section: 'role-form',
        mode: isEdit ? 'edit' : 'create',
        roleId: isEdit ? roleId : undefined,
        fields: ['name', 'description', 'permissions'],
      })}
    >
      <PageHeader
        title={isEdit ? intl.formatMessage({ id: 'roles.form.title_edit', defaultMessage: 'Edit Role' }) : intl.formatMessage({ id: 'roles.form.title_create', defaultMessage: 'Create Role' })}
        onBack={() => navigate('/access-control/roles')}
      />

      <AiFillBar />

      <p className="text-sm text-muted">{intl.formatMessage({ id: 'roles.form.description_intro', defaultMessage: 'Set role details and assign permissions by module.' })}</p>

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void handleActionConfirm();
        }}
      >
        <Card>
          <Card.Header>
            <div>
              <Card.Title>{intl.formatMessage({ id: 'roles.form.section_info_title', defaultMessage: 'Role Information' })}</Card.Title>
              <Card.Description>{intl.formatMessage({ id: 'roles.form.section_info_desc', defaultMessage: 'Set the role name and short description used throughout the ERP.' })}</Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <form.Field name="name">
                {(field) => (
                  <TextField fullWidth isRequired name="role-name" value={field.state.value} onChange={field.handleChange}>
                    <Label>{intl.formatMessage({ id: 'roles.form.name_label', defaultMessage: 'Name' })}</Label>
                    <Input placeholder={intl.formatMessage({ id: 'roles.form.name_placeholder', defaultMessage: 'e.g. Warehouse Operator' })} variant="secondary" />
                    {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                  </TextField>
                )}
              </form.Field>
              <form.Field name="description">
                {(field) => (
                  <TextField fullWidth name="role-description" value={field.state.value} onChange={field.handleChange}>
                    <Label>{intl.formatMessage({ id: 'roles.form.description_label', defaultMessage: 'Description' })}</Label>
                    <Input placeholder={intl.formatMessage({ id: 'roles.form.description_placeholder', defaultMessage: 'Briefly describe the role’s operational scope' })} variant="secondary" />
                  </TextField>
                )}
              </form.Field>
            </div>
            {formError ? <p className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p> : null}
          </Card.Content>
        </Card>

        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{intl.formatMessage({ id: 'roles.form.permissions_title', defaultMessage: 'Permissions' })}</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {selectedPerms.size} / {ALL_PERMS.length} selected
            </span>
          </div>

          <div className="flex flex-row items-center justify-between gap-3 p-1">
            <div className="flex flex-col">
              <Label htmlFor="select-all-permissions">{intl.formatMessage({ id: 'roles.form.select_all_label', defaultMessage: 'Select all permissions' })}</Label>
              <span className="text-sm text-muted">{intl.formatMessage({ id: 'roles.form.select_all_desc', defaultMessage: 'Apply every available permission in one action.' })}</span>
            </div>
            <Switch
              isSelected={selectedPerms.size === ALL_PERMS.length}
              onChange={(value) => setAllPermissions(resolveSelected(value))}
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
                    <span className="text-sm text-muted">{group.actions.length} permission actions</span>
                  </div>
                  <Switch
                    id={groupId}
                    isSelected={isGroupAll(group)}
                    onChange={(value) => setGroupSelected(group, resolveSelected(value))}
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
                          onChange={(value) => setPermSelected(perm, resolveSelected(value))}
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

        <div className="flex justify-end gap-2">
          <Button variant="primary" type="submit" isDisabled={isSubmitting || currentName.length === 0}>
            {isEdit ? 'Save Changes' : 'Create Role'}
          </Button>
        </div>
      </form>

      <Modal onOpenChange={(open) => { if (!open) handleModalClose(); }}>
        <Modal.Backdrop
          isOpen={modalStage !== 'idle'}
          isDismissable={modalStage !== 'loading'}
          isKeyboardDismissDisabled={modalStage === 'loading'}
          aria-label="Close modal"
        >
          <Modal.Container size="sm">
            <Modal.Dialog>
              {modalStage === 'loading' ? (
                <>
                  <Modal.Header>
                    <Modal.Heading>Saving role</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body className="flex flex-col items-center gap-4 py-8">
                    <Spinner size="lg" />
                    <p className="text-sm text-muted">Please wait…</p>
                  </Modal.Body>
                </>
              ) : modalStage === 'success' ? (
                <>
                  <Modal.Header>
                    <Modal.Icon>
                      <Icon icon="solar:check-circle-bold" className="size-12 text-success" />
                    </Modal.Icon>
                    <Modal.Heading>Success</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <p className="text-center text-sm text-muted">{resultMessage}</p>
                    <p className="mt-2 text-center text-sm text-muted">Returning to roles…</p>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button onPress={handleModalClose}>Close</Button>
                  </Modal.Footer>
                </>
              ) : modalStage === 'error' ? (
                <>
                  <Modal.Header>
                    <Modal.Icon>
                      <Icon icon="solar:close-circle-bold" className="size-12 text-danger" />
                    </Modal.Icon>
                    <Modal.Heading>Unable to save role</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <p className="text-center text-sm text-muted">{resultMessage}</p>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button onPress={handleModalClose}>Close</Button>
                  </Modal.Footer>
                </>
              ) : (
                <>
                  <Modal.Header>
                    <Modal.Icon>
                      <Icon icon="solar:save-linear" className="size-10 text-accent" />
                    </Modal.Icon>
                    <Modal.Heading>Confirm save</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <p className="text-sm text-muted">Save this role and return to the role list?</p>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="ghost" onPress={handleModalClose}>Cancel</Button>
                    <Button onPress={handleConfirmSubmit}>Confirm</Button>
                  </Modal.Footer>
                </>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}

function RoleFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);

  const { data: allPermissions = [], isLoading: isLoadingPermissions } = useQuery({
    queryKey: ['permissionListAll'],
    queryFn: () => trpcClient.accessControl.permission.listAll.query(),
  });

  const { data: roleDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['roleDetail', id],
    enabled: isEdit,
    queryFn: () => trpcClient.accessControl.role.detail.query({ id: id ?? '' }),
  });

  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (roleDetail) {
      setSelectedPerms(new Set(roleDetail.permissions.map((rp) => rp.permission.name)));
    } else {
      setSelectedPerms(new Set());
    }
  }, [roleDetail]);

  const initialValues = roleDetail ? transformRoleDetailToFormValues(roleDetail) : defaultFormValues();

  if (isLoadingPermissions || (isEdit && isLoadingDetail)) {
    return <div>Loading...</div>;
  }

  return (
    <RoleFormContent
      allPermissions={allPermissions}
      initialValues={initialValues}
      initialSelectedPerms={selectedPerms}
      isEdit={isEdit}
      roleId={id}
    />
  );
}

export { RoleFormPage };
