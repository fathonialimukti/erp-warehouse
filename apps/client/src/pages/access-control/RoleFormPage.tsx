import { useEffect, useState } from 'react';
import { Button, Card, Checkbox, FieldError, Input, Label, TextField } from '@heroui/react';
import { useForm } from '@tanstack/react-form';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../components/PageHeader';
import { trpcClient } from '../../lib/trpc';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../lib/trpc';

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

const PERMISSION_GROUPS: PermGroup[] = [
  { prefix: 'user', label: 'User Management', actions: ['create', 'read', 'update', 'delete'] },
  { prefix: 'role', label: 'Role Management', actions: ['create', 'read', 'update', 'delete'] },
  { prefix: 'permission', label: 'Permission Management', actions: ['create', 'read', 'update', 'delete'] },
  { prefix: 'warehouse', label: 'Warehouse', actions: ['create', 'read', 'update', 'delete'] },
  { prefix: 'sku', label: 'SKU', actions: ['create', 'read', 'update', 'delete'] },
  { prefix: 'pallet_type', label: 'Pallet Type', actions: ['create', 'read', 'update', 'delete'] },
  {
    prefix: 'storage_location',
    label: 'Storage Location',
    actions: ['create', 'read', 'update', 'delete'],
  },
  { prefix: 'pallet', label: 'Pallet', actions: ['create', 'read', 'update', 'delete'] },
  {
    prefix: 'warehouse_transaction',
    label: 'Warehouse Transaction',
    actions: ['create', 'read', 'update', 'delete'],
  },
  { prefix: 'approval', label: 'Approval', actions: ['read', 'approve', 'reject'] },
];

const ALL_PERMS = PERMISSION_GROUPS.flatMap((g) => g.actions.map((a) => `${g.prefix}_${a}`));

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
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(initialSelectedPerms);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedPerms(initialSelectedPerms);
  }, [initialSelectedPerms]);

  const createMutation = useMutation<unknown, unknown, inferProcedureInput<AppRouter['role']['create']>>({
    mutationFn: (payload) => trpcClient.role.create.mutate(payload),
  });

  const updateMutation = useMutation<unknown, unknown, inferProcedureInput<AppRouter['role']['update']>>({
    mutationFn: (payload) => trpcClient.role.update.mutate(payload),
  });

  const form = useForm<RoleFormValues>({
    defaultValues: initialValues,
    onSubmit: async ({ value }) => {
      setFormError(null);

      if (!value.name.trim()) {
        setFormError('Role name is required.');
        return;
      }

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

      await queryClient.invalidateQueries({ queryKey: ['roleList'] });
      navigate('/access-control/roles');
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const isGroupAll = (group: PermGroup) =>
    group.actions.every((action) => selectedPerms.has(`${group.prefix}_${action}`));

  const isGroupIndeterminate = (group: PermGroup) =>
    group.actions.some((action) => selectedPerms.has(`${group.prefix}_${action}`)) && !isGroupAll(group);

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
        const perm = `${group.prefix}_${action}`;
        if (isSelected) next.add(perm);
        else next.delete(perm);
      });
      return next;
    });
  };

  const setAllPermissions = (isSelected: boolean) => {
    setSelectedPerms(isSelected ? new Set(ALL_PERMS) : new Set());
  };

  const currentName = form.getState().values.name.trim();

  return (
    <section className="space-y-6">
      <PageHeader
        title={isEdit ? 'Edit Role' : 'Create Role'}
        onBack={() => navigate('/access-control/roles')}
      />

      <p className="text-sm text-muted">Set role details and assign permissions by module.</p>

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <Card>
          <Card.Header>
            <div>
              <Card.Title>Role Information</Card.Title>
              <Card.Description>Set the role name and short description used throughout the ERP.</Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <form.Field name="name">
                {(field) => (
                  <TextField fullWidth isRequired name="role-name" value={field.state.value} onChange={field.handleChange}>
                    <Label>Name</Label>
                    <Input placeholder="e.g. Warehouse Operator" variant="secondary" />
                    {field.state.value.trim().length === 0 ? <FieldError>Name is required.</FieldError> : null}
                  </TextField>
                )}
              </form.Field>
              <form.Field name="description">
                {(field) => (
                  <TextField fullWidth name="role-description" value={field.state.value} onChange={field.handleChange}>
                    <Label>Description</Label>
                    <Input placeholder="Short description of this role" variant="secondary" />
                  </TextField>
                )}
              </form.Field>
            </div>
            {formError ? <p className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p> : null}
          </Card.Content>
        </Card>

        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Permissions</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {selectedPerms.size} / {ALL_PERMS.length} selected
            </span>
          </div>

          <div className="p-1">
            <Checkbox
              id="select-all-permissions"
              isSelected={selectedPerms.size === ALL_PERMS.length}
              isIndeterminate={selectedPerms.size > 0 && selectedPerms.size < ALL_PERMS.length}
              onChange={(value) => setAllPermissions(resolveSelected(value))}
            >
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Content>
                <div className="flex flex-col">
                  <Label htmlFor="select-all-permissions">Select all permissions</Label>
                  <span className="text-sm text-muted">Apply every available permission in one action.</span>
                </div>
              </Checkbox.Content>
            </Checkbox>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {PERMISSION_GROUPS.map((group) => (
              <Card key={group.prefix}>
                <Card.Header>
                  {(() => {
                    const groupId = `group-${group.prefix}`;
                    return (
                      <Checkbox
                        id={groupId}
                        isSelected={isGroupAll(group)}
                        isIndeterminate={isGroupIndeterminate(group)}
                        onChange={(value) => setGroupSelected(group, resolveSelected(value))}
                      >
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <Checkbox.Content>
                          <div className="flex flex-col">
                            <Label htmlFor={groupId}>{group.label}</Label>
                            <span className="text-sm text-muted">{group.actions.length} permission actions</span>
                          </div>
                        </Checkbox.Content>
                      </Checkbox>
                    );
                  })()}
                </Card.Header>

                <Card.Content>
                  <div className="space-y-3">
                    {group.actions.map((action) => {
                      const perm = `${group.prefix}_${action}`;
                      const permId = `perm-${group.prefix}-${action}`;
                      return (
                        <Checkbox
                          key={perm}
                          id={permId}
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
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="primary" type="submit" isDisabled={isSubmitting || currentName.length === 0}>
            {isEdit ? 'Save Changes' : 'Create Role'}
          </Button>
        </div>
      </form>
    </section>
  );
}

export default function RoleFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);

  const { data: allPermissions = [], isLoading: isLoadingPermissions } = useQuery({
    queryKey: ['permissionListAll'],
    queryFn: () => trpcClient.permission.listAll.query(),
  });

  const { data: roleDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['roleDetail', id],
    enabled: isEdit,
    queryFn: () => trpcClient.role.detail.query({ id: id ?? '' }),
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
