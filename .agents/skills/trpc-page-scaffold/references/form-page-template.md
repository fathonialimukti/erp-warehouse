# Form Page Template

File: `apps/client/src/pages/{domain}/{Domain}FormPage.tsx`

The form uses `@tanstack/react-form` with a confirm-modal flow (idle → confirm-save → loading → success/error).

```tsx
import { useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, FieldError, Input, Label, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../lib/trpc';
import { PageHeader } from '../../components/PageHeader';
import { hasPermissionAtom } from '../../lib/atoms';
import { trpcClient } from '../../lib/trpc';

type {Domain}FormValues = {
  id: string;
  name: string;
  // Add domain-specific fields
};

type {Domain}Detail = {
  id: string;
  name: string;
  // Match the fields returned by the detail procedure
};

const defaultFormValues = (): {Domain}FormValues => ({
  id: '',
  name: '',
  // Initialize other fields
});

const transformDetailToFormValues = (detail: {Domain}Detail): {Domain}FormValues => ({
  id: detail.id,
  name: detail.name,
  // Map other fields
});

function {Domain}FormContent({
  initialValues,
  isEdit,
  canSave,
  {domain}Id,
}: {
  initialValues: {Domain}FormValues;
  isEdit: boolean;
  canSave: boolean;
  {domain}Id?: string;
}) {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [modalStage, setModalStage] = useState<'idle' | 'confirm-save' | 'loading' | 'success' | 'error'>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const successRedirectIdRef = useRef<string | null>(null);
  const resultTimerRef = useRef<number | null>(null);

  const clearResultTimer = () => {
    if (resultTimerRef.current !== null) {
      window.clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
  };

  useEffect(() => () => clearResultTimer(), []);

  const handleModalClose = () => {
    if (modalStage === 'loading') return;
    clearResultTimer();
    const redirectId = successRedirectIdRef.current;
    successRedirectIdRef.current = null;
    setModalStage('idle');
    if (redirectId) navigate(`/{domain}/${redirectId}`);
  };

  const createMutation = useMutation<{ id: string }, unknown, inferProcedureInput<AppRouter['{namespace}']['create']>>({
    mutationFn: (payload) => trpcClient.{namespace}.create.mutate(payload),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['{domain}List'] });
      queryClient.removeQueries({ queryKey: ['{domain}Detail', created.id] });
      successRedirectIdRef.current = created.id;
      setResultMessage(intl.formatMessage({ id: '{domain}.form.success.created', defaultMessage: '{Domain} created successfully.' }));
      setModalStage('success');
      resultTimerRef.current = window.setTimeout(handleModalClose, 1500);
    },
    onError: () => {
      setResultMessage(intl.formatMessage({ id: '{domain}.form.error.create_failed', defaultMessage: 'Failed to create {domain}.' }));
      setModalStage('error');
    },
  });

  const updateMutation = useMutation<{ id: string }, unknown, inferProcedureInput<AppRouter['{namespace}']['update']>>({
    mutationFn: (payload) => trpcClient.{namespace}.update.mutate(payload),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ['{domain}List'] });
      queryClient.removeQueries({ queryKey: ['{domain}Detail', {domain}Id] });
      successRedirectIdRef.current = updated.id;
      setResultMessage(intl.formatMessage({ id: '{domain}.form.success.updated', defaultMessage: '{Domain} updated successfully.' }));
      setModalStage('success');
      resultTimerRef.current = window.setTimeout(handleModalClose, 1500);
    },
    onError: () => {
      setResultMessage(intl.formatMessage({ id: '{domain}.form.error.update_failed', defaultMessage: 'Failed to update {domain}.' }));
      setModalStage('error');
    },
  });

  const form = useForm({
    defaultValues: initialValues,
    onSubmit: async ({ value }) => {
      if (isEdit && {domain}Id) {
        updateMutation.mutate({ currentId: {domain}Id, ...value });
      } else {
        createMutation.mutate(value);
      }
    },
  });

  const handleActionConfirm = () => {
    setFormError(null);
    if (!canSave) {
      const message = intl.formatMessage({ id: '{domain}.form.errors.no_permission', defaultMessage: 'You do not have permission to save.' });
      setFormError(message);
      setModalStage('error');
      setResultMessage(message);
      return;
    }
    setModalStage('confirm-save');
  };

  return (
    <>
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className="grid gap-4 p-6 md:grid-cols-2">
            <form.Field name="id">
              {(field) => (
                <TextField
                  label={intl.formatMessage({ id: '{domain}.form.field_id', defaultMessage: 'ID' })}
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  isInvalid={field.state.meta.errors.length > 0}
                  isDisabled={isEdit}
                >
                  <Label />
                  <Input />
                  <FieldError />
                </TextField>
              )}
            </form.Field>

            <form.Field name="name">
              {(field) => (
                <TextField
                  label={intl.formatMessage({ id: '{domain}.form.field_name', defaultMessage: 'Name' })}
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  isInvalid={field.state.meta.errors.length > 0}
                >
                  <Label />
                  <Input />
                  <FieldError />
                </TextField>
              )}
            </form.Field>

            {/* Add more form.Field entries for domain-specific fields */}
          </div>

          {formError && <p className="px-6 pb-4 text-sm text-danger">{formError}</p>}

          <div className="flex justify-end gap-3 border-t border-divider px-6 py-4">
            <Button variant="ghost" onPress={() => navigate(`/{domain}`)}>
              {intl.formatMessage({ id: 'common.action.cancel', defaultMessage: 'Cancel' })}
            </Button>
            <Button color="primary" onPress={handleActionConfirm}>
              {intl.formatMessage({ id: isEdit ? 'common.action.save_changes' : 'common.action.create', defaultMessage: isEdit ? 'Save Changes' : 'Create' })}
            </Button>
          </div>
        </form>
      </Card>

      {/* Confirm / Loading / Result Modal */}
      <Modal isOpen={modalStage !== 'idle'} onClose={handleModalClose} isDismissable={modalStage !== 'loading'}>
        <ModalContent>
          <ModalHeader>
            {modalStage === 'confirm-save' &&
              intl.formatMessage({ id: '{domain}.form.modal.confirm_title', defaultMessage: 'Confirm Save' })}
            {modalStage === 'loading' &&
              intl.formatMessage({ id: 'common.modal.processing', defaultMessage: 'Processing...' })}
            {modalStage === 'success' &&
              intl.formatMessage({ id: 'common.modal.success', defaultMessage: 'Success' })}
            {modalStage === 'error' &&
              intl.formatMessage({ id: 'common.modal.error', defaultMessage: 'Error' })}
          </ModalHeader>
          <ModalBody>
            {modalStage === 'confirm-save' &&
              intl.formatMessage({ id: '{domain}.form.modal.confirm_body', defaultMessage: 'Save changes to this {domain}?' })}
            {modalStage === 'loading' && <Spinner />}
            {(modalStage === 'success' || modalStage === 'error') && <p>{resultMessage}</p>}
          </ModalBody>
          <ModalFooter>
            {modalStage === 'confirm-save' && (
              <>
                <Button variant="ghost" onPress={handleModalClose}>
                  {intl.formatMessage({ id: 'common.action.cancel', defaultMessage: 'Cancel' })}
                </Button>
                <Button
                  color="primary"
                  onPress={() => {
                    setModalStage('loading');
                    void form.handleSubmit();
                  }}
                >
                  {intl.formatMessage({ id: 'common.action.confirm', defaultMessage: 'Confirm' })}
                </Button>
              </>
            )}
            {(modalStage === 'success' || modalStage === 'error') && (
              <Button onPress={handleModalClose}>
                {intl.formatMessage({ id: 'common.action.close', defaultMessage: 'Close' })}
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

export function {Domain}FormPage() {
  const { id } = useParams();
  const intl = useIntl();
  const navigate = useNavigate();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const isEdit = Boolean(id);
  const canSave = isEdit ? hasPermission('{domain}@update') : hasPermission('{domain}@create');

  const { data, isLoading } = useQuery({
    queryKey: ['{domain}Detail', id],
    enabled: isEdit,
    queryFn: () => trpcClient.{namespace}.detail.query({ id: id ?? '' }),
  });

  const initialValues = data
    ? transformDetailToFormValues(data as {Domain}Detail)
    : defaultFormValues();

  if (isEdit && isLoading) {
    return <Spinner />;
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={intl.formatMessage({
          id: isEdit ? '{domain}.form.title_edit' : '{domain}.form.title_create',
          defaultMessage: isEdit ? 'Edit {Domain}' : 'New {Domain}',
        })}
        onBack={() => navigate(isEdit && id ? `/{domain}/${id}` : '/{domain}')}
      />
      <{Domain}FormContent
        key={id ?? 'create'}
        initialValues={initialValues}
        isEdit={isEdit}
        canSave={canSave}
        {domain}Id={id}
      />
    </section>
  );
}

export default {Domain}FormPage;
```

## Notes

- The `key={id ?? 'create'}` on `{Domain}FormContent` ensures the form reinitialises when navigating from create to edit.
- Replace `AppRouter['{namespace}']['create']` with the correct router path for `inferProcedureInput`. For nested routers: `AppRouter['warehouse']['warehouse']['create']`.
- Add `<ImageUploadField>` for photo upload when the domain has a `photo` field; see `WarehouseFormPage.tsx` for the full photo pattern.
- `isDisabled={isEdit}` on the ID field prevents changing the ID during update — remove if IDs are auto-generated.
