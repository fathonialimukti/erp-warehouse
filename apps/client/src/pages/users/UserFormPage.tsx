import { useEffect, useMemo, useState } from 'react';
import { Button, Fieldset, Input, ListBox, Select } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useForm } from '@tanstack/react-form';
import { useNavigate, useParams } from 'react-router';
import { trpcClient } from '../../lib/trpc';

const SAMPLE_USERS = [
  { id: 'USR-001', name: 'Admin', email: 'admin@mail.com', roleId: 'ROL-001' },
  { id: 'USR-002', name: 'Warehouse Manager', email: 'manager@mail.com', roleId: 'ROL-002' },
  { id: 'USR-003', name: 'Operator One', email: 'operator@mail.com', roleId: 'ROL-003' },
  { id: 'USR-004', name: 'Approver One', email: 'approver@mail.com', roleId: 'ROL-004' },
];

export default function UserFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const sample = useMemo(() => SAMPLE_USERS.find((u) => u.id === id), [id]);

  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    trpcClient.role.listAll.query().then(setRoles).catch(console.error);
  }, []);

  const form = useForm({
    defaultValues: {
      name: sample?.name ?? '',
      email: sample?.email ?? '',
      password: '',
      roleId: sample?.roleId ?? '',
    },
    onSubmit: async () => {
      navigate('/users');
    },
  });

  return (
    <section className="space-y-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isEdit ? 'Edit User' : 'Create User'}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {isEdit
              ? 'Update user details. Leave password blank to keep existing.'
              : 'Fill in user details and assign a role.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" type="button" onPress={() => navigate('/users')}>
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
        <Fieldset className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <Fieldset.Legend className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
            User Information
          </Fieldset.Legend>
          <Fieldset.Group className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field
              name="name"
              children={(field) => (
                <div className="space-y-1">
                  <label className="form-label" htmlFor="user-name">Name</label>
                  <Input
                    id="user-name"
                    type="text"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Full name"
                    fullWidth
                    variant="secondary"
                  />
                </div>
              )}
            />
            <form.Field
              name="email"
              children={(field) => (
                <div className="space-y-1">
                  <label className="form-label" htmlFor="user-email">Email</label>
                  <Input
                    id="user-email"
                    type="email"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="user@company.com"
                    fullWidth
                    variant="secondary"
                  />
                </div>
              )}
            />
            <form.Field
              name="password"
              children={(field) => (
                <div className="space-y-1">
                  <label className="form-label" htmlFor="user-password">
                    Password{isEdit && <span className="ml-1 text-gray-400">(optional)</span>}
                  </label>
                  <Input
                    id="user-password"
                    type="password"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={isEdit ? 'Leave blank to keep current' : 'Set password'}
                    fullWidth
                    variant="secondary"
                  />
                </div>
              )}
            />
            <form.Field
              name="roleId"
              children={(field) => (
                <div className="space-y-1">
                  <label className="form-label" htmlFor="user-role">Role</label>
                  <Select
                    selectedKey={field.state.value || null}
                    onSelectionChange={(key) => field.handleChange(key as string)}
                    fullWidth
                    variant="secondary"
                  >
                    <Select.Trigger id="user-role">
                      <Select.Value>
                        {({ isPlaceholder }: { isPlaceholder: boolean }) =>
                          isPlaceholder ? (
                            <span className="text-gray-400">Select a role</span>
                          ) : undefined
                        }
                      </Select.Value>
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {roles.map((role) => (
                          <ListBox.Item key={role.id} id={role.id} textValue={role.name}>
                            {role.name}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
              )}
            />
          </Fieldset.Group>
          <Fieldset.Actions className="mt-6 flex justify-end gap-2">
            <Button variant="primary" type="submit" isDisabled={form.state.isSubmitting}>
              {isEdit ? 'Save Changes' : 'Create User'}
            </Button>
          </Fieldset.Actions>
        </Fieldset>
      </form>
    </section>
  );
}
