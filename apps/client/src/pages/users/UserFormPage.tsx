import { useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, FieldError, Input, Label, ListBox, Modal, Select, Spinner, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { ImageUploadField } from '../../components/ImageUploadField';
import { PageHeader } from '../../components/PageHeader';
import { hasPermissionAtom } from '../../lib/atoms';
import { useAiFillForm } from '../../components/AiAssistant/useAiFillForm';
import { AiFillBar } from '../../components/AiFill/AiFillBar';
import { trpcClient } from '../../lib/trpc';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../lib/trpc';
import { createUserFormSchema, CreateUserFormValues, updateUserFormSchema } from '@repo/schemas/user';

type UserFormValues = CreateUserFormValues;

type UserDetail = {
  id: string;
  name: string | null;
  email: string;
  roleId?: string | null;
  photo?: string | null;
  createdAt: string;
  updatedAt: string;
  role: { name: string; id: string } | null;
};

type ModalStage = 'idle' | 'confirm-save' | 'loading' | 'success' | 'error';

const defaultFormValues = (): UserFormValues => ({
  name: '',
  email: '',
  password: '',
  roleId: '',
});

const transformDetailToFormValues = (detail: UserDetail): UserFormValues => ({
  name: detail.name ?? '',
  email: detail.email ?? '',
  password: '',
  roleId: detail.roleId ?? '',
});

function UserFormContent({
  initialValues,
  initialPhoto,
  roles,
  isEdit,
  canSave,
  userId,
}: {
  initialValues: UserFormValues;
  initialPhoto: string | undefined;
  roles: Array<{ id: string; name: string }>;
  isEdit: boolean;
  canSave: boolean;
  userId?: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const intl = useIntl();
  const [photo, setPhoto] = useState<string | undefined>(initialPhoto);
  const [formError, setFormError] = useState<string | null>(null);
  const [modalStage, setModalStage] = useState<ModalStage>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const successRedirectIdRef = useRef<string | null>(null);
  const resultTimerRef = useRef<number | null>(null);

  const clearResultTimer = () => {
    if (resultTimerRef.current !== null) {
      window.clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
  };

  const handleModalClose = () => {
    if (modalStage === 'loading') return;

    clearResultTimer();
    const redirectId = successRedirectIdRef.current;
    successRedirectIdRef.current = null;
    setModalStage('idle');

    if (redirectId) {
      navigate(`/users/${redirectId}`);
    }
  };

  const handleActionConfirm = async () => {
    setFormError(null);
    setResultMessage('');

    if (!canSave) {
      const message = intl.formatMessage({ id: 'users.form.errors.no_permission', defaultMessage: 'You do not have permission to save this user.' });
      setFormError(message);
      setResultMessage(message);
      setModalStage('error');
      return;
    }

    await form.validateAllFields('change');
    const schema = isEdit ? updateUserFormSchema : createUserFormSchema;
    const result = schema.safeParse(form.state.values);
    if (!result.success) return;

    setModalStage('confirm-save');
  };

  const handleConfirmSubmit = () => {
    setModalStage('loading');
    void form.handleSubmit();
  };

  useEffect(() => () => clearResultTimer(), []);

  useEffect(() => {
    setPhoto(initialPhoto);
  }, [initialPhoto]);

  const createMutation = useMutation<{ id: string }, unknown, inferProcedureInput<AppRouter['user']['create']>>({
    mutationFn: (payload) => trpcClient.user.create.mutate(payload),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['userList'] });
      queryClient.removeQueries({ queryKey: ['userDetail', created.id] });
      successRedirectIdRef.current = created.id;
      setResultMessage(intl.formatMessage({ id: 'users.form.success.created', defaultMessage: 'User created successfully.' }));
      setModalStage('success');
      clearResultTimer();
      resultTimerRef.current = window.setTimeout(() => {
        setModalStage('idle');
        navigate(`/users/${created.id}`);
      }, 1500);
    },
    onError: (err) => {
      setResultMessage(err instanceof Error ? err.message : intl.formatMessage({ id: 'users.form.errors.save_failed', defaultMessage: 'Failed to save user.' }));
      setModalStage('error');
    },
  });

  const updateMutation = useMutation<{ id: string }, unknown, inferProcedureInput<AppRouter['user']['update']>>({
    mutationFn: (payload) => trpcClient.user.update.mutate(payload),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ['userList'] });
      if (userId) {
        queryClient.removeQueries({ queryKey: ['userDetail', userId] });
      }
      queryClient.removeQueries({ queryKey: ['userDetail', updated.id] });
      successRedirectIdRef.current = updated.id;
      setResultMessage(intl.formatMessage({ id: 'users.form.success.updated', defaultMessage: 'User updated successfully.' }));
      setModalStage('success');
      clearResultTimer();
      resultTimerRef.current = window.setTimeout(() => {
        setModalStage('idle');
        navigate(`/users/${updated.id}`);
      }, 1500);
    },
    onError: (err) => {
      setResultMessage(err instanceof Error ? err.message : intl.formatMessage({ id: 'users.form.errors.save_failed', defaultMessage: 'Failed to save user.' }));
      setModalStage('error');
    },
  });

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onChange: isEdit ? updateUserFormSchema : createUserFormSchema,
    },
    onSubmit: async ({ value }) => {
      setFormError(null);

      if (!canSave) {
        const message = intl.formatMessage({ id: 'users.form.errors.no_permission', defaultMessage: 'You do not have permission to save this user.' });
        setFormError(message);
        setResultMessage(message);
        setModalStage('error');
        return;
      }

      try {
        if (isEdit && userId) {
          await updateMutation.mutateAsync({
            id: userId,
            name: value.name.trim(),
            email: value.email.trim(),
            password: value.password.trim() || undefined,
            roleId: value.roleId.trim(),
            photo,
          });
        } else {
          await createMutation.mutateAsync({
            name: value.name.trim(),
            email: value.email.trim(),
            password: value.password.trim(),
            roleId: value.roleId.trim(),
            photo,
          });
        }
      } catch (error) {
        setFormError(error instanceof Error ? error.message : intl.formatMessage({ id: 'users.form.errors.save_failed', defaultMessage: 'Failed to save user.' }));
      }
    },
  });

  const isSubmitting = modalStage === 'loading' || createMutation.isPending || updateMutation.isPending;

  useAiFillForm({
    name:     (v) => form.setFieldValue('name', String(v)),
    email:    (v) => form.setFieldValue('email', String(v)),
    password: (v) => form.setFieldValue('password', String(v)),
    roleId:   (v) => form.setFieldValue('roleId', String(v)),
  });

  return (
    <section
      className="space-y-6"
      data-ai-context={JSON.stringify({
        section: 'user-form',
        mode: isEdit ? 'edit' : 'create',
        userId: isEdit ? userId : null,
        availableRoles: roles.map((role) => ({ id: role.id, name: role.name })),
      })}
    >
      <PageHeader
        title={isEdit ? intl.formatMessage({ id: 'users.form.title_edit', defaultMessage: 'Edit User' }) : intl.formatMessage({ id: 'users.form.title_create', defaultMessage: 'Create User' })}
        onBack={() => navigate('/users')}
      />

      <AiFillBar />

      <p className="text-sm text-muted">
        {isEdit
          ? intl.formatMessage({ id: 'users.form.description_edit', defaultMessage: 'Update user details. Leave password blank to keep existing.' })
          : intl.formatMessage({ id: 'users.form.description_create', defaultMessage: 'Fill in user details and assign a role.' })}
      </p>

      <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); handleActionConfirm(); }}>
        <Card>
          <Card.Header>
            <div>
              <Card.Title>{intl.formatMessage({ id: 'users.form.section_profile_title', defaultMessage: 'User Information' })}</Card.Title>
              <Card.Description>{intl.formatMessage({ id: 'users.form.section_profile_desc', defaultMessage: 'Manage profile details, credentials, and access role for this user.' })}</Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1 md:col-span-2">
                <label className="form-label">{intl.formatMessage({ id: 'users.form.photo_label', defaultMessage: 'Photo' })}</label>
                <ImageUploadField value={photo} onChange={setPhoto} />
              </div>

              <form.Field name="name">
                {(field) => (
                  <TextField fullWidth isRequired isDisabled={isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="user-name" value={field.state.value} onChange={field.handleChange}>
                    <Label>{intl.formatMessage({ id: 'users.form.name_label', defaultMessage: 'Name' })}</Label>
                    <Input placeholder={intl.formatMessage({ id: 'users.form.name_placeholder', defaultMessage: 'Full name of the user' })} variant="secondary" />
                    {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                  </TextField>
                )}
              </form.Field>

              <form.Field name="email">
                {(field) => (
                  <TextField fullWidth isRequired isDisabled={isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="user-email" type="email" value={field.state.value} onChange={field.handleChange}>
                    <Label>{intl.formatMessage({ id: 'users.form.email_label', defaultMessage: 'Email' })}</Label>
                    <Input placeholder={intl.formatMessage({ id: 'users.form.email_placeholder', defaultMessage: 'user@company.com' })} variant="secondary" />
                    {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                  </TextField>
                )}
              </form.Field>

              <form.Field name="password">
                {(field) => (
                  <TextField fullWidth isRequired={!isEdit} isDisabled={isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="user-password" type="password" value={field.state.value} onChange={field.handleChange}>
                    <Label>{intl.formatMessage({ id: 'users.form.password_label', defaultMessage: 'Password' })}{isEdit ? intl.formatMessage({ id: 'users.form.password_optional_suffix', defaultMessage: ' (optional)' }) : ''}</Label>
                    <Input placeholder={isEdit ? intl.formatMessage({ id: 'users.form.password_placeholder_edit', defaultMessage: 'Leave blank to keep the current password' }) : intl.formatMessage({ id: 'users.form.password_placeholder_create', defaultMessage: 'Set an initial password for sign-in' })} variant="secondary" />
                    {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                  </TextField>
                )}
              </form.Field>

              <form.Field name="roleId">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="user-role">{intl.formatMessage({ id: 'users.form.role_label', defaultMessage: 'Role' })}</Label>
                    <Select
                      selectedKey={field.state.value || null}
                      onSelectionChange={(key) => field.handleChange(String(key ?? ''))}
                      fullWidth
                      variant="secondary"
                      isInvalid={field.state.meta.errors.length > 0}
                    >
                      <Select.Trigger id="user-role">
                        <Select.Value>
                          {({ isPlaceholder }: { isPlaceholder: boolean }) =>
                            isPlaceholder ? <span className="text-muted">{intl.formatMessage({ id: 'users.form.role_placeholder', defaultMessage: 'Select a role' })}</span> : undefined
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
                    {field.state.meta.errors.length > 0 ? <p className="text-sm text-danger">{field.state.meta.errors.join(', ')}</p> : null}
                  </div>
                )}
              </form.Field>
            </div>

            {formError && (
              <p className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p>
            )}
          </Card.Content>

          <Card.Footer>
            <div className="flex w-full justify-end gap-2">
              <Button variant="primary" type="submit" isDisabled={isSubmitting || !canSave}>
                {isEdit ? intl.formatMessage({ id: 'users.form.button_save', defaultMessage: 'Save Changes' }) : intl.formatMessage({ id: 'users.form.button_create', defaultMessage: 'Create User' })}
              </Button>
            </div>
          </Card.Footer>
        </Card>
      </form>

      <Modal onOpenChange={(open) => { if (!open) handleModalClose(); }}>
        <Modal.Backdrop
          isOpen={modalStage !== 'idle'}
          isDismissable={modalStage !== 'loading'}
          isKeyboardDismissDisabled={modalStage === 'loading'}
          aria-label={intl.formatMessage({ id: 'modal_close', defaultMessage: 'Close modal' })}
        >
          <Modal.Container size="sm">
            <Modal.Dialog>
              {modalStage === 'loading' ? (
                <>
                  <Modal.Header>
                    <Modal.Heading>{intl.formatMessage({ id: 'users.form.modal.saving_title', defaultMessage: 'Saving user' })}</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body className="flex flex-col items-center gap-4 py-8">
                    <Spinner size="lg" />
                    <p className="text-sm text-muted">{intl.formatMessage({ id: 'users.form.modal.please_wait', defaultMessage: 'Please wait…' })}</p>
                  </Modal.Body>
                </>
              ) : modalStage === 'success' ? (
                <>
                  <Modal.Header>
                    <Modal.Icon>
                      <Icon icon="solar:check-circle-bold" className="size-12 text-success" />
                    </Modal.Icon>
                    <Modal.Heading>{intl.formatMessage({ id: 'users.form.modal.success_title', defaultMessage: 'Success' })}</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <p className="text-center text-sm text-muted">{resultMessage}</p>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button onPress={handleModalClose}>{intl.formatMessage({ id: 'users.form.modal.close', defaultMessage: 'Close' })}</Button>
                  </Modal.Footer>
                </>
              ) : modalStage === 'error' ? (
                <>
                  <Modal.Header>
                    <Modal.Icon>
                      <Icon icon="solar:close-circle-bold" className="size-12 text-danger" />
                    </Modal.Icon>
                    <Modal.Heading>{intl.formatMessage({ id: 'users.form.modal.error_title', defaultMessage: 'Unable to save user' })}</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <p className="text-center text-sm text-muted">{resultMessage}</p>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button onPress={handleModalClose}>{intl.formatMessage({ id: 'users.form.modal.close', defaultMessage: 'Close' })}</Button>
                  </Modal.Footer>
                </>
              ) : (
                <>
                  <Modal.Header>
                    <Modal.Icon>
                      <Icon icon="solar:save-linear" className="size-10 text-accent" />
                    </Modal.Icon>
                    <Modal.Heading>{intl.formatMessage({ id: 'users.form.modal.confirm_title', defaultMessage: 'Confirm save' })}</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <p className="text-sm text-muted">{intl.formatMessage({ id: 'users.form.modal.confirm_description', defaultMessage: 'Save this user and return to the user detail page?' })}</p>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="ghost" onPress={handleModalClose}>{intl.formatMessage({ id: 'users.form.modal.cancel', defaultMessage: 'Cancel' })}</Button>
                    <Button onPress={handleConfirmSubmit}>{intl.formatMessage({ id: 'users.form.modal.confirm_button', defaultMessage: 'Confirm' })}</Button>
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

function UserFormPage() {
  const { id } = useParams();
  const intl = useIntl();
  const isEdit = Boolean(id);
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canCreate = hasPermission('user@create');
  const canUpdate = hasPermission('user@update');
  const canSave = isEdit ? canUpdate : canCreate;

  const { data: roles = [], isLoading: isLoadingRoles } = useQuery({
    queryKey: ['roleListAll'],
    queryFn: () => trpcClient.accessControl.role.listAll.query(),
  });

  const { data: userDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['userDetail', id],
    enabled: isEdit,
    queryFn: () => trpcClient.user.detail.query({ id: id ?? '' }),
  });

  if ((isEdit && isLoadingDetail) || isLoadingRoles) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Spinner size="sm" />
        {intl.formatMessage({ id: 'users.form.loading', defaultMessage: 'Loading user data...' })}
      </div>
    );
  }

  const initialValues = userDetail ? transformDetailToFormValues(userDetail) : defaultFormValues();
  const initialPhoto = userDetail?.photo ?? undefined;

  return (
    <UserFormContent
      initialValues={initialValues}
      initialPhoto={initialPhoto}
      roles={roles}
      isEdit={isEdit}
      canSave={canSave}
      userId={id ?? undefined}
    />
  );
}

export { UserFormPage };
