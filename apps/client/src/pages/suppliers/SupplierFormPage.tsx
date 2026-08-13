import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, FieldError, Input, Label, TextArea, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { PageHeader } from '../../components/PageHeader';
import { hasPermissionAtom } from '../../lib/atoms';
import { useAiFillForm } from '../../components/AiAssistant/useAiFillForm';
import { AiFillBar } from '../../components/AiFill/AiFillBar';
import { trpcClient } from '../../lib/trpc';
import { supplierFormSchema, type SupplierFormValues } from '@repo/schemas/supplier';

const defaultFormValues = (): SupplierFormValues => ({
  code: '',
  name: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
});

function SupplierFormContent({
  initialValues,
  isEdit,
  canSave,
  supplierId,
}: {
  initialValues: SupplierFormValues;
  isEdit: boolean;
  canSave: boolean;
  supplierId?: string;
}) {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (payload: SupplierFormValues) => trpcClient.supplier.create.mutate({
      code: payload.code?.trim() || undefined,
      name: payload.name?.trim() || '',
      email: payload.email?.trim() || undefined,
      phone: payload.phone?.trim() || undefined,
      address: payload.address?.trim() || undefined,
      notes: payload.notes?.trim() || undefined,
    }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['supplierList'] });
      queryClient.removeQueries({ queryKey: ['supplierDetail', created.id] });
      navigate(`/suppliers/${created.id}`);
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : intl.formatMessage({ id: 'supplier.form.errors.save_failed', defaultMessage: 'Failed to save supplier.' }));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: SupplierFormValues) => trpcClient.supplier.update.mutate({
      id: supplierId!,
      code: payload.code?.trim() || undefined,
      name: payload.name?.trim() || '',
      email: payload.email?.trim() || undefined,
      phone: payload.phone?.trim() || undefined,
      address: payload.address?.trim() || undefined,
      notes: payload.notes?.trim() || undefined,
    }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['supplierList'] });
      queryClient.removeQueries({ queryKey: ['supplierDetail', supplierId] });
      queryClient.removeQueries({ queryKey: ['supplierDetail', updated.id] });
      navigate(`/suppliers/${updated.id}`);
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : intl.formatMessage({ id: 'supplier.form.errors.save_failed', defaultMessage: 'Failed to save supplier.' }));
    },
  });

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onChange: supplierFormSchema,
    },
    onSubmit: async ({ value }) => {
      setFormError(null);

      if (!canSave) {
        setFormError(intl.formatMessage({ id: 'supplier.form.errors.no_permission', defaultMessage: 'You do not have permission to save this supplier.' }));
        return;
      }

      if (isEdit) {
        updateMutation.mutate(value);
      } else {
        createMutation.mutate(value);
      }
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  useAiFillForm({
    code: (v) => form.setFieldValue('code', String(v)),
    name: (v) => form.setFieldValue('name', String(v)),
    email: (v) => form.setFieldValue('email', String(v)),
    phone: (v) => form.setFieldValue('phone', String(v)),
    address: (v) => form.setFieldValue('address', String(v)),
    notes: (v) => form.setFieldValue('notes', String(v)),
  });

  return (
    <section
      className="space-y-6"
      data-ai-context={JSON.stringify({
        section: 'supplier-form',
        mode: isEdit ? 'edit' : 'create',
        supplierId: supplierId ?? undefined,
        fields: ['code', 'name', 'email', 'phone', 'address', 'notes'],
      })}
    >
      <PageHeader
        title={isEdit ? intl.formatMessage({ id: 'supplier.form.title_edit', defaultMessage: 'Edit Supplier' }) : intl.formatMessage({ id: 'supplier.form.title_create', defaultMessage: 'Add Supplier' })}
        onBack={() => navigate('/suppliers')}
      />

      <AiFillBar />

      <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); void form.handleSubmit(); }}>
        <Card>
          <Card.Header>
            <div>
              <Card.Title>{intl.formatMessage({ id: 'supplier.form.section_title', defaultMessage: 'Supplier Information' })}</Card.Title>
              <Card.Description>
                {isEdit
                  ? intl.formatMessage({ id: 'supplier.form.section_description_edit', defaultMessage: 'Update supplier details.' })
                  : intl.formatMessage({ id: 'supplier.form.section_description_create', defaultMessage: 'Enter details for a new supplier.' })}
              </Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <form.Field name="code">
                  {(field) => (
                    <TextField fullWidth isDisabled={isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="code" value={field.state.value} onChange={field.handleChange}>
                      <Label>{intl.formatMessage({ id: 'supplier.form.code_label', defaultMessage: 'Code' })}</Label>
                      <Input placeholder={intl.formatMessage({ id: 'supplier.form.code_placeholder', defaultMessage: 'e.g. SUP-001' })} variant="secondary" />
                      {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="name">
                  {(field) => (
                    <TextField fullWidth isRequired isDisabled={isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="name" value={field.state.value} onChange={field.handleChange}>
                      <Label>{intl.formatMessage({ id: 'supplier.form.name_label', defaultMessage: 'Name' })}</Label>
                      <Input placeholder={intl.formatMessage({ id: 'supplier.form.name_placeholder', defaultMessage: 'Supplier name' })} variant="secondary" />
                      {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="email">
                  {(field) => (
                    <TextField fullWidth isDisabled={isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="email" value={field.state.value} onChange={field.handleChange}>
                      <Label>{intl.formatMessage({ id: 'supplier.form.email_label', defaultMessage: 'Email' })}</Label>
                      <Input placeholder={intl.formatMessage({ id: 'supplier.form.email_placeholder', defaultMessage: 'email@example.com' })} variant="secondary" />
                      {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="phone">
                  {(field) => (
                    <TextField fullWidth isDisabled={isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="phone" value={field.state.value} onChange={field.handleChange}>
                      <Label>{intl.formatMessage({ id: 'supplier.form.phone_label', defaultMessage: 'Phone' })}</Label>
                      <Input placeholder={intl.formatMessage({ id: 'supplier.form.phone_placeholder', defaultMessage: '+62 xxx xxxx xxxx' })} variant="secondary" />
                      {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="address">
                  {(field) => (
                    <TextField fullWidth isDisabled={isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="address" value={field.state.value} onChange={field.handleChange}>
                      <Label>{intl.formatMessage({ id: 'supplier.form.address_label', defaultMessage: 'Address' })}</Label>
                      <Input placeholder={intl.formatMessage({ id: 'supplier.form.address_placeholder', defaultMessage: 'Supplier address' })} variant="secondary" />
                      {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                    </TextField>
                  )}
                </form.Field>
              </div>

              <form.Field name="notes">
                {(field) => (
                  <TextField fullWidth isDisabled={isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="notes" value={field.state.value} onChange={field.handleChange}>
                    <Label>{intl.formatMessage({ id: 'supplier.form.notes_label', defaultMessage: 'Notes' })}</Label>
                    <TextArea
                      placeholder={intl.formatMessage({ id: 'supplier.form.notes_placeholder', defaultMessage: 'Additional notes about this supplier' })}
                      rows={4}
                      variant="secondary"
                    />
                    {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                  </TextField>
                )}
              </form.Field>

              {formError ? (
                <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                  <div className="flex items-start gap-2">
                    <Icon icon="solar:danger-triangle-linear" className="mt-0.5 size-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                </div>
              ) : null}
            </div>
          </Card.Content>
          <Card.Footer>
            <div className="flex w-full justify-end gap-2">
              <Button variant="secondary" type="button" onPress={() => navigate('/suppliers')} isDisabled={isSubmitting}>
                {intl.formatMessage({ id: 'supplier.form.back', defaultMessage: 'Back' })}
              </Button>
              <Button variant="primary" type="submit" isPending={isSubmitting} isDisabled={!canSave}>
                {({ isPending }) => (
                  <>
                    <Icon icon={isPending ? 'solar:refresh-linear' : 'solar:diskette-linear'} className={`size-4 ${isPending ? 'animate-spin' : ''}`} />
                    {isEdit
                      ? intl.formatMessage({ id: 'supplier.form.submit_update', defaultMessage: 'Save Changes' })
                      : intl.formatMessage({ id: 'supplier.form.submit_create', defaultMessage: 'Create Supplier' })}
                  </>
                )}
              </Button>
            </div>
          </Card.Footer>
        </Card>
      </form>
    </section>
  );
}

function SupplierFormPage() {
  const intl = useIntl();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canCreate = hasPermission('supplier@create');
  const canUpdate = hasPermission('supplier@update');
  const canSave = isEdit ? canUpdate : canCreate;

  const { data: detailData, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['supplierDetail', id],
    enabled: isEdit,
    queryFn: () => trpcClient.supplier.detail.query({ id: id ?? '' }),
  });

  if (isEdit && isLoadingDetail) {
    return <p className="text-sm text-muted">{intl.formatMessage({ id: 'supplier.form.loading_detail', defaultMessage: 'Loading supplier details...' })}</p>;
  }

  const initialValues: SupplierFormValues = detailData
    ? {
        code: detailData.code ?? '',
        name: detailData.name,
        email: detailData.email ?? '',
        phone: detailData.phone ?? '',
        address: detailData.address ?? '',
        notes: detailData.notes ?? '',
      }
    : defaultFormValues();

  return (
    <SupplierFormContent
      initialValues={initialValues}
      isEdit={isEdit}
      canSave={canSave}
      supplierId={id ?? undefined}
    />
  );
}

export { SupplierFormPage };
