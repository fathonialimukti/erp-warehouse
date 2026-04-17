import { useMemo, useState } from 'react';
import { Button, Card, Checkbox, FieldError, Input, Label, TextField } from '@heroui/react';
import { useForm } from '@tanstack/react-form';
import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '../../components/PageHeader';

// ─── Permission group definitions (mirrors seeder) ───────────────────────────

type PermGroup = { prefix: string; label: string; actions: string[] };

const PERMISSION_GROUPS: PermGroup[] = [
  { prefix: 'user', label: 'User Management', actions: ['create', 'read', 'update', 'delete'] },
  { prefix: 'role', label: 'Role Management', actions: ['create', 'read', 'update', 'delete'] },
  { prefix: 'permission', label: 'Permission Management', actions: ['create', 'read', 'update', 'delete'] },
  { prefix: 'gudang', label: 'Gudang', actions: ['create', 'read', 'update', 'delete'] },
  { prefix: 'sku', label: 'SKU', actions: ['create', 'read', 'update', 'delete'] },
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
  ['gudang', 'sku', 'jenis_palet', 'lokasi_penyimpanan', 'palet', 'transaksi_gudang', 'approval'].includes(
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
    'sku:read',
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
      navigate('/access-control/roles');
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
      <PageHeader
        title={isEdit ? 'Edit Role' : 'Create Role'}
        onBack={() => navigate('/access-control/roles')}
      />

      <p className="text-sm text-muted">Set role details and assign permissions by module.</p>

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >

        {/* ── Role Info ── */}
        <Card variant="secondary">
          <Card.Header>
            <div>
              <Card.Title>Role Information</Card.Title>
              <Card.Description>Set the role name and short description used throughout the ERP.</Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field
              name="name"
            >
              {(field) => (
                <TextField fullWidth isRequired name="role-name" value={field.state.value} onChange={field.handleChange}>
                  <Label>Name</Label>
                  <Input placeholder="e.g. Warehouse Operator" variant="secondary" />
                  {field.state.value.trim().length === 0 ? <FieldError>Name is required.</FieldError> : null}
                </TextField>
              )}
            </form.Field>
            <form.Field
              name="description"
            >
              {(field) => (
                <TextField fullWidth name="role-description" value={field.state.value} onChange={field.handleChange}>
                  <Label>Description</Label>
                  <Input placeholder="Short description of this role" variant="secondary" />
                </TextField>
              )}
            </form.Field>
            </div>
          </Card.Content>
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
                <div className="flex flex-col">
                  <Label htmlFor="select-all-permissions">Select all permissions</Label>
                  <span className="text-sm text-muted">Apply every available permission in one action.</span>
                </div>
              </Checkbox.Content>
            </Checkbox>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {PERMISSION_GROUPS.map((group) => (
              <Card key={group.prefix} variant="secondary">
                <Card.Header>
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
