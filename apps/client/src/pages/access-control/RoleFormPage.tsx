import { useMemo, useState } from 'react';
import { Button, Card, Checkbox, Input, Label } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useForm } from '@tanstack/react-form';
import { useNavigate, useParams } from 'react-router';

// ─── Permission group definitions (mirrors seeder) ───────────────────────────

type PermGroup = { prefix: string; label: string; actions: string[] };

const PERMISSION_GROUPS: PermGroup[] = [
  { prefix: 'user', label: 'User Management', actions: ['create', 'read', 'update', 'delete'] },
  { prefix: 'role', label: 'Role Management', actions: ['create', 'read', 'update', 'delete'] },
  { prefix: 'permission', label: 'Permission Management', actions: ['create', 'read', 'update', 'delete'] },
  { prefix: 'gudang', label: 'Gudang', actions: ['create', 'read', 'update', 'delete'] },
  { prefix: 'jenis_palet', label: 'Jenis Palet', actions: ['create', 'read', 'update', 'delete'] },
  {
    prefix: 'lokasi_penyimpanan',
    label: 'Lokasi Penyimpanan',
    actions: ['create', 'read', 'update', 'delete'],
  },
  { prefix: 'palet', label: 'Palet', actions: ['create', 'read', 'update', 'delete'] },
  {
    prefix: 'transaksi_gudang',
    label: 'Transaksi Gudang',
    actions: ['create', 'read', 'update', 'delete', 'approve'],
  },
  { prefix: 'approval', label: 'Approval', actions: ['read', 'approve', 'reject'] },
];

const ALL_PERMS = PERMISSION_GROUPS.flatMap((g) => g.actions.map((a) => `${g.prefix}:${a}`));

const WAREHOUSE_MANAGER_PERMS = PERMISSION_GROUPS.filter((g) =>
  ['gudang', 'jenis_palet', 'lokasi_penyimpanan', 'palet', 'transaksi_gudang', 'approval'].includes(
    g.prefix,
  ),
).flatMap((g) => g.actions.map((a) => `${g.prefix}:${a}`));

const SAMPLE_ROLES = [
  { id: 'ROL-001', name: 'System Admin', description: 'Full system access' },
  { id: 'ROL-002', name: 'Warehouse Manager', description: 'Manage warehouse operations and approvals' },
  { id: 'ROL-003', name: 'Warehouse Operator', description: 'Perform warehouse daily operations' },
  { id: 'ROL-004', name: 'Approver', description: 'Approve warehouse transactions' },
];

const SAMPLE_ROLE_PERMS: Record<string, string[]> = {
  'ROL-001': ALL_PERMS,
  'ROL-002': WAREHOUSE_MANAGER_PERMS,
  'ROL-003': [
    'palet:read',
    'palet:create',
    'palet:update',
    'transaksi_gudang:read',
    'transaksi_gudang:create',
    'transaksi_gudang:update',
    'lokasi_penyimpanan:read',
    'gudang:read',
    'jenis_palet:read',
  ],
  'ROL-004': ['transaksi_gudang:read', 'approval:read', 'approval:approve', 'approval:reject'],
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RoleFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const sampleRole = useMemo(() => SAMPLE_ROLES.find((r) => r.id === id), [id]);

  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(
    () => new Set<string>(id ? (SAMPLE_ROLE_PERMS[id] ?? []) : []),
  );

  const form = useForm({
    defaultValues: {
      name: sampleRole?.name ?? '',
      description: sampleRole?.description ?? '',
    },
    onSubmit: async () => {
      navigate('/access-control');
    },
  });

  const isGroupAll = (group: PermGroup) =>
    group.actions.every((a) => selectedPerms.has(`${group.prefix}:${a}`));

  const isGroupIndeterminate = (group: PermGroup) =>
    group.actions.some((a) => selectedPerms.has(`${group.prefix}:${a}`)) && !isGroupAll(group);

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
        const perm = `${group.prefix}:${action}`;
        if (isSelected) next.add(perm);
        else next.delete(perm);
      });
      return next;
    });
  };

  const setAllPermissions = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedPerms(new Set(ALL_PERMS));
      return;
    }

    setSelectedPerms(new Set());
  };

  const selectedCount = selectedPerms.size;
  const totalCount = ALL_PERMS.length;
  const isAllPermissionsSelected = totalCount > 0 && selectedCount === totalCount;
  const isAllPermissionsIndeterminate = selectedCount > 0 && selectedCount < totalCount;

  return (
    <section className="space-y-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isEdit ? 'Edit Role' : 'Create Role'}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Set role details and assign permissions by module.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" type="button" onPress={() => navigate('/access-control')}>
            <Icon icon="solar:alt-arrow-left-linear" className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >

        {/* ── Role Info ── */}
        <Card className="">
          <h2 className="mb-4 text-base font-semibold">
            Role Information
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field
              name="name"
              children={(field) => (
                <div className="space-y-1">
                  <label className="form-label" htmlFor="role-name">
                    Name
                  </label>
                  <Input
                    id="role-name"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="e.g. Warehouse Operator"
                    fullWidth
                    variant="secondary"
                  />
                </div>
              )}
            />
            <form.Field
              name="description"
              children={(field) => (
                <div className="space-y-1">
                  <label className="form-label" htmlFor="role-desc">
                    Description
                  </label>
                  <Input
                    id="role-desc"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Short description of this role"
                    fullWidth
                    variant="secondary"
                  />
                </div>
              )}
            />
          </div>
        </Card>

        {/* ── Permission Groups ── */}
        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Permissions</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {selectedCount} / {totalCount} selected
            </span>
          </div>

          <div className="p-1">
            <Checkbox
              id="select-all-permissions"
              isSelected={isAllPermissionsSelected}
              isIndeterminate={isAllPermissionsIndeterminate}
              onChange={(value) => setAllPermissions(resolveSelected(value))}
              variant="secondary"
            >
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Content>
                <Label
                  htmlFor="select-all-permissions"
                  className="font-semibold text-gray-900 dark:text-gray-100"
                >
                  Select all permissions
                </Label>
              </Checkbox.Content>
            </Checkbox>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {PERMISSION_GROUPS.map((group) => (
              <Card key={group.prefix} className="p-4">
                <div className="mb-3 border-b pb-3">
                  {(() => {
                    const groupId = `group-${group.prefix}`;
                    return (
                      <Checkbox
                        id={groupId}
                        isSelected={isGroupAll(group)}
                        isIndeterminate={isGroupIndeterminate(group)}
                        onChange={(value) => setGroupSelected(group, resolveSelected(value))}
                        variant="secondary"
                      >
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <Checkbox.Content>
                          <Label htmlFor={groupId} className="font-semibold text-gray-900 dark:text-gray-100">
                            {group.label}
                          </Label>
                        </Checkbox.Content>
                      </Checkbox>
                    );
                  })()}
                </div>

                <div className="space-y-2">
                  {group.actions.map((action) => {
                    const perm = `${group.prefix}:${action}`;
                    const permId = `perm-${group.prefix}-${action}`;
                    return (
                      <Checkbox
                        key={action}
                        id={permId}
                        isSelected={selectedPerms.has(perm)}
                        onChange={(value) => setPermSelected(perm, resolveSelected(value))}
                        variant="secondary"
                      >
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <Checkbox.Content>
                          <Label htmlFor={permId} className="text-sm capitalize text-gray-700 dark:text-gray-300">
                            {action}
                          </Label>
                        </Checkbox.Content>
                      </Checkbox>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex justify-end gap-2">
          <Button variant="primary" type="submit" isDisabled={form.state.isSubmitting}>
            {isEdit ? 'Save Changes' : 'Create Role'}
          </Button>
        </div>
      </form>
    </section>
  );
}
