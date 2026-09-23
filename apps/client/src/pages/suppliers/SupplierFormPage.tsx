import { useAtomValue } from 'jotai';
import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { FieldError, Input, Label, TextArea, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useStore } from '@tanstack/react-form';
import { hasPermissionAtom } from '../../lib/atoms';
import { computeMissingRequired, useRegisterPageForm } from '../../lib/ai/usePageContext';
import { useAiFillForm } from '../../components/AiAssistant/useAiFillForm';
import { AiFillButton } from '../../components/AiFill/AiFillButton';
import { AiFillPanel } from '../../components/AiFill/AiFillPanel';
import { trpcClient } from '../../lib/trpc';
import { supplierFormSchema, type SupplierFormValues } from '@repo/schemas/supplier';
import { FormCanvas, FormMain, FormRail } from '../../components/form/FormCanvas';
import { FormHero } from '../../components/form/FormHero';
import { FormSection } from '../../components/form/FormSection';
import { FormPreviewCard } from '../../components/form/FormPreviewCard';
import { FormActionBar } from '../../components/form/FormActionBar';
import { FormAiTip } from '../../components/form/FormAiTip';

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

  const values = useStore(form.store, (state) => state.values);

  useAiFillForm({
    code: (v) => form.setFieldValue('code', String(v)),
    name: (v) => form.setFieldValue('name', String(v)),
    email: (v) => form.setFieldValue('email', String(v)),
    phone: (v) => form.setFieldValue('phone', String(v)),
    address: (v) => form.setFieldValue('address', String(v)),
    notes: (v) => form.setFieldValue('notes', String(v)),
  });

  const hasCode = Boolean(values.code?.trim());
  const hasName = Boolean(values.name?.trim());
  const hasEmail = Boolean(values.email?.trim());
  const hasPhone = Boolean(values.phone?.trim());
  const hasAddress = Boolean(values.address?.trim());
  const hasNotes = Boolean(values.notes?.trim());

  const pageFormValues = useMemo(() => ({ ...values }), [values]);
  const missingRequired = useMemo(() => computeMissingRequired(pageFormValues, ['name']), [pageFormValues]);
  useRegisterPageForm('supplier-form', pageFormValues, missingRequired);

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
      <FormHero
        icon="solar:buildings-2-linear"
        title={isEdit
          ? intl.formatMessage({ id: 'supplier.form.title_edit', defaultMessage: 'Edit Supplier' })
          : intl.formatMessage({ id: 'supplier.form.title_create', defaultMessage: 'Add Supplier' })}
        description={isEdit
          ? intl.formatMessage({ id: 'supplier.form.section_description_edit', defaultMessage: 'Update supplier details.' })
          : intl.formatMessage({ id: 'supplier.form.section_description_create', defaultMessage: 'Enter details for a new supplier.' })}
        mode={isEdit ? 'edit' : 'create'}
        modeLabel={intl.formatMessage({ id: isEdit ? 'form.mode_edit' : 'form.mode_create', defaultMessage: isEdit ? 'Edit' : 'Create' })}
        onBack={() => navigate('/suppliers')}
        backLabel={intl.formatMessage({ id: 'supplier.form.back', defaultMessage: 'Back' })}
        chips={isEdit && values.code?.trim() ? [{ icon: 'solar:database-linear', label: values.code.trim() }] : []}
        actions={<AiFillButton />}
      />

      <AiFillPanel />

      <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); void form.handleSubmit(); }}>
        <FormCanvas>
          <FormMain>
            <FormSection
              step={1}
              icon="solar:buildings-2-linear"
              title={intl.formatMessage({ id: 'supplier.form.section_title', defaultMessage: 'Supplier Information' })}
              description={intl.formatMessage({ id: 'supplier.form.section_identity_desc', defaultMessage: 'Name and code that identify this supplier.' })}
              filled={hasCode && hasName}
            >
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
              </div>
            </FormSection>

            <FormSection
              step={2}
              icon="solar:letter-linear"
              title={intl.formatMessage({ id: 'supplier.form.section_contact_title', defaultMessage: 'Contact' })}
              description={intl.formatMessage({ id: 'supplier.form.section_contact_desc', defaultMessage: 'Reach-out details used for orders and invoices.' })}
              filled={hasEmail || hasPhone}
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              </div>
            </FormSection>

            <FormSection
              step={3}
              icon="solar:map-point-linear"
              title={intl.formatMessage({ id: 'supplier.form.section_location_title', defaultMessage: 'Location & Notes' })}
              description={intl.formatMessage({ id: 'supplier.form.section_location_desc', defaultMessage: 'Where the supplier operates and any internal notes.' })}
              filled={hasAddress || hasNotes}
            >
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              </div>
            </FormSection>

            {formError ? (
              <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                <div className="flex items-start gap-2">
                  <Icon icon="solar:danger-triangle-linear" className="mt-0.5 size-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              </div>
            ) : null}
          </FormMain>

          <FormRail>
            <FormPreviewCard
              title={intl.formatMessage({ id: 'supplier.form.preview_title', defaultMessage: 'Supplier Preview' })}
              icon="solar:buildings-2-linear"
              description={intl.formatMessage({ id: 'supplier.form.preview_desc', defaultMessage: 'Live summary of the supplier you are building.' })}
              fillLabel={intl.formatMessage({ id: 'form.preview_fill', defaultMessage: 'Completed' })}
              rows={[
                { label: intl.formatMessage({ id: 'supplier.form.code_label', defaultMessage: 'Code' }), value: values.code, icon: 'solar:database-linear' },
                { label: intl.formatMessage({ id: 'supplier.form.name_label', defaultMessage: 'Name' }), value: values.name, icon: 'solar:user-linear', tone: 'accent' },
                { label: intl.formatMessage({ id: 'supplier.form.email_label', defaultMessage: 'Email' }), value: values.email, icon: 'solar:letter-linear' },
                { label: intl.formatMessage({ id: 'supplier.form.phone_label', defaultMessage: 'Phone' }), value: values.phone, icon: 'solar:chat-round-dots-linear' },
                { label: intl.formatMessage({ id: 'supplier.form.address_label', defaultMessage: 'Address' }), value: values.address, icon: 'solar:map-point-linear' },
                { label: intl.formatMessage({ id: 'supplier.form.notes_label', defaultMessage: 'Notes' }), value: values.notes, icon: 'solar:document-text-linear' },
              ]}
              footer={<FormAiTip />}
            />
          </FormRail>
        </FormCanvas>

        <FormActionBar
          onCancel={() => navigate('/suppliers')}
          cancelLabel={intl.formatMessage({ id: 'supplier.form.back', defaultMessage: 'Back' })}
          submitLabel={isEdit
            ? intl.formatMessage({ id: 'supplier.form.submit_update', defaultMessage: 'Save Changes' })
            : intl.formatMessage({ id: 'supplier.form.submit_create', defaultMessage: 'Create Supplier' })}
          submitIcon="solar:diskette-linear"
          isPending={isSubmitting}
          isDisabled={!canSave}
          isDirty={isEdit && form.state.isDirty}
          showSavedState={isEdit}
        />
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
