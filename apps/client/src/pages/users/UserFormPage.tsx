import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Fieldset, Input, ListBox, Select, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ImageUploadField from '../../components/ImageUploadField';
import { trpcClient } from '../../lib/trpc';

export default function UserFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const intl = useIntl();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const { data: roles = [], isLoading: isLoadingRoles } = useQuery({
    queryKey: ['roleListAll'],
    queryFn: () => trpcClient.role.listAll.query(),
  });

  const { data: userDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['userDetail', id],
    enabled: isEdit,
    queryFn: () => trpcClient.user.detail.query({ id: id ?? '' }),
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [photo, setFoto] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!userDetail) {
      return;
    }

    setName(userDetail.name ?? '');
    setEmail(userDetail.email);
    setPassword('');
    setRoleId(userDetail.roleId ?? '');
    setFoto(userDetail.photo ?? undefined);
  }, [userDetail]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !email.trim() || !roleId.trim()) {
      setErrorMessage(intl.formatMessage({ id: 'users.form.errors.requiredFields', defaultMessage: 'Name, email, and role are required.' }));
      return;
    }

    if (!isEdit && password.trim().length < 6) {
      setErrorMessage(intl.formatMessage({ id: 'users.form.errors.passwordLength', defaultMessage: 'Password must be at least 6 characters.' }));
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        const updated = await trpcClient.user.update.mutate({
          id,
          name: name.trim(),
          email: email.trim(),
          password: password.trim() || undefined,
          roleId: roleId.trim(),
          photo,
        });

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['userList'] }),
          queryClient.removeQueries({ queryKey: ['userDetail', id] }),
        ]);

        navigate(`/users/${updated.id}`);
      } else {
        const created = await trpcClient.user.create.mutate({
          name: name.trim(),
          email: email.trim(),
          password: password.trim(),
          roleId: roleId.trim(),
          photo,
        });

        await queryClient.invalidateQueries({ queryKey: ['userList'] });
        queryClient.removeQueries({ queryKey: ['userDetail', created.id] });

        navigate(`/users/${created.id}`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : intl.formatMessage({ id: 'users.form.errors.saveFailed', defaultMessage: 'Failed to save user.' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if ((isEdit && isLoadingDetail) || isLoadingRoles) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Spinner size="sm" />
        {intl.formatMessage({ id: 'users.form.loading', defaultMessage: 'Loading user data...' })}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isEdit ? intl.formatMessage({ id: 'users.form.titleEdit', defaultMessage: 'Edit User' }) : intl.formatMessage({ id: 'users.form.titleCreate', defaultMessage: 'Create User' })}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {isEdit ? intl.formatMessage({ id: 'users.form.descriptionEdit', defaultMessage: 'Update user details. Leave password blank to keep existing.' }) : intl.formatMessage({ id: 'users.form.descriptionCreate', defaultMessage: 'Fill in user details and assign a role.' })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" type="button" onPress={() => navigate('/users')}>
            <Icon icon="solar:alt-arrow-left-linear" className="h-4 w-4" />
            {intl.formatMessage({ id: 'users.form.backButton', defaultMessage: 'Back' })}
          </Button>
        </div>
      </div>

      <form className="space-y-6" onSubmit={(event) => void handleSubmit(event)}>
        <Fieldset className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <Fieldset.Legend className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
            User Information
          </Fieldset.Legend>
          <Fieldset.Group className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <label className="form-label">Foto</label>
              <ImageUploadField value={photo} onChange={setFoto} />
            </div>
            <div className="space-y-1">
              <label className="form-label" htmlFor="user-name">Name</label>
              <Input
                id="user-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Full name"
                fullWidth
                variant="secondary"
              />
            </div>
            <div className="space-y-1">
              <label className="form-label" htmlFor="user-email">Email</label>
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="user@company.com"
                fullWidth
                variant="secondary"
              />
            </div>
            <div className="space-y-1">
              <label className="form-label" htmlFor="user-password">
                Password{isEdit && <span className="ml-1 text-gray-400">(optional)</span>}
              </label>
              <Input
                id="user-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isEdit ? 'Leave blank to keep current' : 'Set password'}
                fullWidth
                variant="secondary"
              />
            </div>
            <div className="space-y-1">
              <label className="form-label" htmlFor="user-role">Role</label>
              <Select
                selectedKey={roleId || null}
                onSelectionChange={(key) => setRoleId(String(key ?? ''))}
                fullWidth
                variant="secondary"
              >
                <Select.Trigger id="user-role">
                  <Select.Value>
                    {({ isPlaceholder }: { isPlaceholder: boolean }) =>
                      isPlaceholder ? <span className="text-gray-400">Select a role</span> : undefined
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
          </Fieldset.Group>

          {errorMessage && (
            <p className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{errorMessage}</p>
          )}

          <Fieldset.Actions className="mt-6 flex justify-end gap-2">
            <Button variant="primary" type="submit" isDisabled={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Create User'}
            </Button>
          </Fieldset.Actions>
        </Fieldset>
      </form>
    </section>
  );
}
