import type { ReactNode } from 'react';
import { useAtomValue } from 'jotai';
import { Chip, FieldError, Input, Label, TextArea, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { trpcClient } from '../../lib/trpc';
import { hasPermissionAtom } from '../../lib/atoms';
import { useAiFillForm } from '../../components/AiAssistant/useAiFillForm';
import {
  DocHeaderCard,
  FormAiTip,
  FormFooterBar,
  FormPageShell,
  FormPreviewCard,
  TransactionFormModal,
  useDocForm,
  useTransactionFormPage,
} from '../../components/form';
import { computeMissingRequired } from '../../lib/ai/usePageContext';
import { useMessage } from '../../lib/useMessage';
import { supplierFormSchema, type SupplierFormValues } from '@repo/schemas/supplier';

/** Unwrap a tRPC vanilla-client query/procedure into its resolved wire type. */
type DetailOf<Q> = Q extends (...args: never[]) => Promise<infer R> ? R : never;

/**
 * `useTransactionFormPage` keys its editability gate on `approvalStatus` —
 * suppliers have no approval flow. The member exists only to satisfy the
 * generic constraint; the page derives guards from `isError` / `detail` and
 * never from `canEdit`.
 */
type SupplierDetail = DetailOf<typeof trpcClient.supplier.detail.query> & { approvalStatus: string };

const defaultFormValues = (): SupplierFormValues => ({
  code: '',
  name: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
});

const transformDetailToFormValues = (detail: SupplierDetail): SupplierFormValues => ({
  code: detail.code ?? '',
  name: detail.name,
  email: detail.email ?? '',
  phone: detail.phone ?? '',
  address: detail.address ?? '',
  notes: detail.notes ?? '',
});

interface SupplierFormProps {
  id?: string;
  isEdit: boolean;
  initialValues: SupplierFormValues | null;
  /** Detail still loading on edit pages — shell shows the spinner. */
  isLoading?: boolean;
  /** Not-found / error message on edit pages — shell shows the guard. */
  guard?: ReactNode;
}

const SupplierForm = ({ id, isEdit, initialValues, isLoading = false, guard }: SupplierFormProps) => {
  const t = useMessage();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = isEdit ? hasPermission('supplier@update') : hasPermission('supplier@create');

  const modalMessages = {
    saving: t('supplier.form.modal.saving_title', 'Saving supplier'),
    pleaseWait: t('supplier.form.modal.please_wait', 'Please wait…'),
    successTitle: t('supplier.form.modal.success_title', 'Success'),
    errorTitle: t('supplier.form.modal.error_title', 'Unable to save supplier'),
    confirmPropose: t('supplier.form.modal.confirm_title', 'Confirm save'),
    confirmDraft: t('supplier.form.modal.confirm_title', 'Confirm save'),
    confirmProposeDesc: t('supplier.form.modal.confirm_description', 'Save this supplier and return to the supplier detail page?'),
    confirmDraftDesc: t('supplier.form.modal.confirm_description', 'Save this supplier and return to the supplier detail page?'),
    confirmSave: t('supplier.form.modal.confirm_title', 'Confirm save'),
    confirmSaveDesc: t('supplier.form.modal.confirm_description', 'Save this supplier and return to the supplier detail page?'),
    messageLabel: t('supplier.form.modal.message_label', 'Message'),
    messagePlaceholder: t('supplier.form.modal.message_placeholder', 'Add a note (optional)'),
    cancel: t('supplier.form.modal.cancel', 'Cancel'),
    confirm: t('supplier.form.modal.confirm_button', 'Confirm'),
    close: t('supplier.form.modal.close', 'Close'),
    viewDetail: t('supplier.form.modal.view_detail', 'View Detail'),
  };

  const docForm = useDocForm<SupplierFormValues, any>({
    formId: 'supplier-form',
    isEdit,
    id,
    initialValues,
    defaultValues: defaultFormValues,
    schema: supplierFormSchema,
    toPayload: (parsed) => ({
      code: parsed.code?.trim() || undefined,
      name: parsed.name?.trim() || '',
      email: parsed.email?.trim() || undefined,
      phone: parsed.phone?.trim() || undefined,
      address: parsed.address?.trim() || undefined,
      notes: parsed.notes?.trim() || undefined,
    }),
    createCaller: (payload) => trpcClient.supplier.create.mutate(payload),
    updateCaller: (payload) => trpcClient.supplier.update.mutate(payload),
    listQueryKey: 'supplierList',
    detailQueryKey: 'supplierDetail',
    redirectOnSuccess: (savedId) => `/suppliers/${savedId ?? id}`,
    intentMode: 'single-save',
    modalMessages,
    successMessageCreate: t('supplier.form.success.created', 'Supplier created successfully.'),
    successMessageUpdate: t('supplier.form.success.updated', 'Supplier updated successfully.'),
    errorFallback: t('error_generic', 'An unexpected error occurred.'),
    missingRequired: (values) => computeMissingRequired(values, ['name']),
    computeCanSubmit: (values) => Boolean(values.name?.trim()),
  });

  // The JSX below binds via `<form.Field>` — same form instance the hook owns.
  const form = docForm.form;

  useAiFillForm({
    code: (v) => form.setFieldValue('code', String(v)),
    name: (v) => form.setFieldValue('name', String(v)),
    email: (v) => form.setFieldValue('email', String(v)),
    phone: (v) => form.setFieldValue('phone', String(v)),
    address: (v) => form.setFieldValue('address', String(v)),
    notes: (v) => form.setFieldValue('notes', String(v)),
  });

  const values = docForm.formValues;
  const hasCode = Boolean(values.code?.trim());

  return (
    <FormPageShell
      formId="supplier-form"
      mode={isEdit ? 'edit' : 'create'}
      entityId={id}
      title={isEdit
        ? t('supplier.form.title_edit', 'Edit Supplier')
        : t('supplier.form.title_create', 'Add Supplier')}
      backTo="/suppliers"
      validationErrors={docForm.validationErrors}
      aiFields={['code', 'name', 'email', 'phone', 'address', 'notes']}
      extraContext={{ supplierId: isEdit ? id : undefined }}
      statusChip={
        isEdit && hasCode ? (
          <Chip variant="soft" size="sm">
            <Icon icon="solar:database-linear" className="size-3.5" />
            {values.code?.trim() ?? ''}
          </Chip>
        ) : undefined
      }
      header={
        <>
          <DocHeaderCard
            title={t('supplier.form.section_title', 'Supplier Information')}
            description={t('supplier.form.section_identity_desc', 'Name and code that identify this supplier.')}
            icon="solar:buildings-2-linear"
          >
            <form.Field name="code">
              {(field) => (
                <TextField fullWidth isDisabled={docForm.isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="code" value={field.state.value} onChange={field.handleChange}>
                  <Label>{t('supplier.form.code_label', 'Code')}</Label>
                  <Input placeholder={t('supplier.form.code_placeholder', 'e.g. SUP-001')} variant="secondary" />
                  {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                </TextField>
              )}
            </form.Field>

            <form.Field name="name">
              {(field) => (
                <TextField fullWidth isRequired isDisabled={docForm.isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="name" value={field.state.value} onChange={field.handleChange}>
                  <Label>{t('supplier.form.name_label', 'Name')}</Label>
                  <Input placeholder={t('supplier.form.name_placeholder', 'Supplier name')} variant="secondary" />
                  {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                </TextField>
              )}
            </form.Field>
          </DocHeaderCard>

          <DocHeaderCard
            title={t('supplier.form.section_contact_title', 'Contact')}
            description={t('supplier.form.section_contact_desc', 'Reach-out details used for orders and invoices.')}
            icon="solar:letter-linear"
          >
            <form.Field name="email">
              {(field) => (
                <TextField fullWidth isDisabled={docForm.isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="email" value={field.state.value} onChange={field.handleChange}>
                  <Label>{t('supplier.form.email_label', 'Email')}</Label>
                  <Input placeholder={t('supplier.form.email_placeholder', 'email@example.com')} variant="secondary" />
                  {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                </TextField>
              )}
            </form.Field>

            <form.Field name="phone">
              {(field) => (
                <TextField fullWidth isDisabled={docForm.isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="phone" value={field.state.value} onChange={field.handleChange}>
                  <Label>{t('supplier.form.phone_label', 'Phone')}</Label>
                  <Input placeholder={t('supplier.form.phone_placeholder', '+62 xxx xxxx xxxx')} variant="secondary" />
                  {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                </TextField>
              )}
            </form.Field>
          </DocHeaderCard>

          <DocHeaderCard
            title={t('supplier.form.section_location_title', 'Location & Notes')}
            description={t('supplier.form.section_location_desc', 'Where the supplier operates and any internal notes.')}
            icon="solar:map-point-linear"
            columns={false}
          >
            <div className="space-y-6">
              <form.Field name="address">
                {(field) => (
                  <TextField fullWidth isDisabled={docForm.isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="address" value={field.state.value} onChange={field.handleChange}>
                    <Label>{t('supplier.form.address_label', 'Address')}</Label>
                    <Input placeholder={t('supplier.form.address_placeholder', 'Supplier address')} variant="secondary" />
                    {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                  </TextField>
                )}
              </form.Field>

              <form.Field name="notes">
                {(field) => (
                  <TextField fullWidth isDisabled={docForm.isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="notes" value={field.state.value} onChange={field.handleChange}>
                    <Label>{t('supplier.form.notes_label', 'Notes')}</Label>
                    <TextArea
                      placeholder={t('supplier.form.notes_placeholder', 'Additional notes about this supplier')}
                      rows={4}
                      variant="secondary"
                    />
                    {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                  </TextField>
                )}
              </form.Field>
            </div>
          </DocHeaderCard>
        </>
      }
      aside={
        <FormPreviewCard
          title={t('supplier.form.preview_title', 'Supplier Preview')}
          icon="solar:buildings-2-linear"
          description={t('supplier.form.preview_desc', 'Live summary of the supplier you are building.')}
          fillLabel={t('form.preview_fill', 'Completed')}
          rows={[
            { label: t('supplier.form.code_label', 'Code'), value: values.code, icon: 'solar:database-linear' },
            { label: t('supplier.form.name_label', 'Name'), value: values.name, icon: 'solar:user-linear', tone: 'accent' },
            { label: t('supplier.form.email_label', 'Email'), value: values.email, icon: 'solar:letter-linear' },
            { label: t('supplier.form.phone_label', 'Phone'), value: values.phone, icon: 'solar:chat-round-dots-linear' },
            { label: t('supplier.form.address_label', 'Address'), value: values.address, icon: 'solar:map-point-linear' },
            { label: t('supplier.form.notes_label', 'Notes'), value: values.notes, icon: 'solar:document-text-linear' },
          ]}
          footer={<FormAiTip />}
        />
      }
      footer={
        <FormFooterBar
          mode="single-save"
          canSave={canSave}
          canSubmit={docForm.canSubmit}
          isSubmitting={docForm.isSubmitting}
          isDirty={docForm.isDirty}
          isEdit={isEdit}
          labels={{ save: isEdit ? t('supplier.form.submit_update', 'Save Changes') : t('supplier.form.submit_create', 'Create Supplier') }}
          onSave={() => docForm.handleActionConfirm('SAVE')}
        />
      }
      modal={
        <TransactionFormModal
          modalStage={docForm.modalStage}
          intent={docForm.intent}
          resultMessage={docForm.resultMessage}
          approvalMessage={docForm.approvalMessage}
          onApprovalMessageChange={docForm.setApprovalMessage}
          messages={modalMessages}
          onModalClose={docForm.handleModalClose}
          onConfirmSubmit={docForm.handleConfirmSubmit}
          onViewDetail={docForm.handleViewDetail}
        />
      }
      isLoading={isLoading}
      loadingLabel={t('supplier.form.loading_detail', 'Loading supplier details...')}
      guard={guard}
      isDisabled={docForm.isSubmitting}
    />
  );
};

const SupplierFormPage = () => {
  const t = useMessage();
  const { id, isEdit, detail, isLoading, isError, error, initialValues } =
    useTransactionFormPage<SupplierDetail, SupplierFormValues>({
      queryKey: 'supplierDetail',
      detailQuery: (input) => trpcClient.supplier.detail.query(input) as Promise<SupplierDetail>,
      transform: transformDetailToFormValues,
    });

  // Suppliers have no approval status, so the hook's `canEdit` (status-gated)
  // is ignored — the form is editable whenever the detail loads without error.
  let guard: ReactNode = null;
  if (isEdit && isError) {
    guard = (
      <p className="text-sm text-danger">
        {(error as Error | null)?.message ?? t('supplier.form.load_error', 'Failed to load supplier.')}
      </p>
    );
  } else if (isEdit && !detail) {
    guard = <p className="text-sm text-danger">{t('supplier.form.not_found', 'Supplier not found.')}</p>;
  }

  return (
    <SupplierForm
      id={id}
      isEdit={isEdit}
      initialValues={initialValues}
      isLoading={isLoading}
      guard={guard}
    />
  );
};

export { SupplierFormPage };