import type { ReactNode } from 'react';
import { useAtomValue } from 'jotai';
import { useEffect, useMemo, useState } from 'react';
import { Chip, FieldError, Input, Label, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { trpcClient } from '../../lib/trpc';
import { hasPermissionAtom } from '../../lib/atoms';
import { useAiFillForm } from '../../components/AiAssistant/useAiFillForm';
import { ImageUploadField } from '../../components/ImageUploadField';
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
import { computeMissingRequired, useRegisterPageForm } from '../../lib/ai/usePageContext';
import { useMessage } from '../../lib/useMessage';
import { createWarehouseFormSchema } from '@repo/schemas/warehouse';

type WarehouseFormValues = {
  warehouseId: string;
  objectId: string;
  warehouseName: string;
  address: string;
  totalCapacity: string;
};

/** Unwrap a tRPC vanilla-client query/procedure into its resolved wire type. */
type DetailOf<Q> = Q extends (...args: never[]) => Promise<infer R> ? R : never;

/**
 * `useTransactionFormPage` keys its editability gate on `approvalStatus` —
 * warehouses have no approval flow. The member exists only to satisfy the
 * generic constraint; the page derives guards from `isError` / `detail` and
 * never from `canEdit`.
 */
type WarehouseDetail = DetailOf<typeof trpcClient.warehouse.warehouse.detail.query> & { approvalStatus: string };

const defaultFormValues = (): WarehouseFormValues => ({
  warehouseId: '',
  objectId: '',
  warehouseName: '',
  address: '',
  totalCapacity: '',
});

const transformDetailToFormValues = (detail: WarehouseDetail): WarehouseFormValues => ({
  warehouseId: detail.code ?? detail.id,
  objectId: detail.objectId ?? '',
  warehouseName: detail.name,
  address: detail.address,
  totalCapacity: detail.totalCapacity != null ? String(detail.totalCapacity) : '',
});

interface WarehouseFormProps {
  id?: string;
  isEdit: boolean;
  initialValues: WarehouseFormValues | null;
  /** Detail still loading on edit pages — shell shows the spinner. */
  isLoading?: boolean;
  /** Not-found / error message on edit pages — shell shows the guard. */
  guard?: ReactNode;
  initialPhoto: string | undefined;
}

const WarehouseForm = ({
  id,
  isEdit,
  initialValues,
  isLoading = false,
  guard,
  initialPhoto,
}: WarehouseFormProps) => {
  const t = useMessage();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = isEdit ? hasPermission('warehouse@update') : hasPermission('warehouse@create');

  // Photo lives in useState outside the TanStack form (base64 payload must
  // never reach the assistant) — resynced when the detail lands on edit pages.
  const [photo, setPhoto] = useState<string | undefined>(initialPhoto);
  useEffect(() => {
    setPhoto(initialPhoto);
  }, [initialPhoto]);

  const modalMessages = {
    saving: t('warehouse.form.modal.saving_title', 'Saving warehouse'),
    pleaseWait: t('warehouse.form.modal.please_wait', 'Please wait…'),
    successTitle: t('warehouse.form.modal.success_title', 'Success'),
    errorTitle: t('warehouse.form.modal.error_title', 'Unable to save warehouse'),
    confirmPropose: t('warehouse.form.modal.confirm_title', 'Confirm save'),
    confirmDraft: t('warehouse.form.modal.confirm_title', 'Confirm save'),
    confirmProposeDesc: t('warehouse.form.modal.confirm_description', 'Save this warehouse and return to the warehouse detail page?'),
    confirmDraftDesc: t('warehouse.form.modal.confirm_description', 'Save this warehouse and return to the warehouse detail page?'),
    confirmSave: t('warehouse.form.modal.confirm_title', 'Confirm save'),
    confirmSaveDesc: t('warehouse.form.modal.confirm_description', 'Save this warehouse and return to the warehouse detail page?'),
    messageLabel: t('warehouse.form.modal.message_label', 'Message'),
    messagePlaceholder: t('warehouse.form.modal.message_placeholder', 'Add a note (optional)'),
    cancel: t('warehouse.form.modal.cancel', 'Cancel'),
    confirm: t('warehouse.form.modal.confirm_button', 'Confirm'),
    close: t('warehouse.form.modal.close', 'Close'),
    viewDetail: t('warehouse.form.modal.view_detail', 'View Detail'),
  };

  const docForm = useDocForm<WarehouseFormValues, any>({
    formId: 'warehouse-form',
    isEdit,
    id,
    initialValues,
    defaultValues: defaultFormValues,
    schema: createWarehouseFormSchema,
    toPayload: (parsed) => {
      const capacity = parsed.totalCapacity.trim() ? Number(parsed.totalCapacity) : undefined;
      return {
        code: parsed.warehouseId.trim(),
        objectId: parsed.objectId.trim() || undefined,
        name: parsed.warehouseName.trim(),
        address: parsed.address.trim(),
        totalCapacity: capacity,
        photo,
      };
    },
    createCaller: (payload) => trpcClient.warehouse.warehouse.create.mutate(payload),
    // The update procedure keys on `currentId`, not `id` — map the kit's id.
    updateCaller: (payload) =>
      trpcClient.warehouse.warehouse.update.mutate({
        currentId: payload.id,
        code: payload.code,
        objectId: payload.objectId,
        name: payload.name,
        address: payload.address,
        totalCapacity: payload.totalCapacity,
        photo: payload.photo,
      }),
    listQueryKey: 'warehouseList',
    detailQueryKey: 'warehouseDetail',
    redirectOnSuccess: (savedId) => `/warehouse/${savedId ?? id}`,
    intentMode: 'single-save',
    modalMessages,
    successMessageCreate: t('warehouse.form.success.created', 'Warehouse created successfully.'),
    successMessageUpdate: t('warehouse.form.success.updated', 'Warehouse updated successfully.'),
    errorFallback: t('error_generic', 'An unexpected error occurred.'),
    missingRequired: (values) => computeMissingRequired(values, ['warehouseId', 'warehouseName', 'address']),
    computeCanSubmit: (values) =>
      Boolean(values.warehouseId?.trim()) &&
      Boolean(values.warehouseName?.trim()) &&
      Boolean(values.address?.trim()),
  });

  // The JSX below binds via `<form.Field>` — same form instance the hook owns.
  const form = docForm.form;

  useAiFillForm({
    warehouseId: (v) => form.setFieldValue('warehouseId', String(v)),
    objectId: (v) => form.setFieldValue('objectId', String(v)),
    warehouseName: (v) => form.setFieldValue('warehouseName', String(v)),
    address: (v) => form.setFieldValue('address', String(v)),
    totalCapacity: (v) => form.setFieldValue('totalCapacity', String(v)),
  }, {
    aliases: {
      warehouseCode: 'warehouseId',
      warehouse_code: 'warehouseId',
      code: 'warehouseId',
      name: 'warehouseName',
      capacity: 'totalCapacity',
    },
  });

  // Photo lives in useState outside the TanStack form (base64 payload must
  // never reach the assistant) — publish only a presence flag. Re-registered
  // after the kit's registration so the enriched values win.
  const values = docForm.formValues;
  const hasCode = Boolean(values.warehouseId?.trim());

  const pageFormValues = useMemo(() => ({ ...values, hasPhoto: Boolean(photo) }), [values, photo]);
  const missingRequired = useMemo(
    () => computeMissingRequired(pageFormValues, ['warehouseId', 'warehouseName', 'address']),
    [pageFormValues],
  );
  useRegisterPageForm('warehouse-form', pageFormValues, missingRequired);

  return (
    <FormPageShell
      formId="warehouse-form"
      mode={isEdit ? 'edit' : 'create'}
      entityId={id}
      title={isEdit
        ? t('warehouseform_titleedit', 'Edit Warehouse')
        : t('warehouseform_titlecreate', 'Create Warehouse')}
      backTo="/warehouse"
      validationErrors={docForm.validationErrors}
      aiFields={['warehouseId', 'objectId', 'warehouseName', 'address', 'totalCapacity']}
      extraContext={{ warehouseId: isEdit ? id : undefined }}
      statusChip={
        isEdit && hasCode ? (
          <Chip variant="soft" size="sm">
            <Icon icon="solar:database-linear" className="size-3.5" />
            {values.warehouseId.trim()}
          </Chip>
        ) : undefined
      }
      header={
        <>
          <DocHeaderCard
            title={t('warehouseform_sectiontitle', 'Warehouse Information')}
            description={t('warehouse.form.section_identity_desc', 'A recognizable photo plus the code and name teams use every day.')}
            icon="solar:camera-linear"
            columns={false}
          >
            <div className="space-y-6">
              <div className="rounded-2xl border border-default-200 bg-default-50/60 p-4">
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-foreground">
                    {t('warehouseform_photolabel', 'Warehouse Photo')}
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    {t('warehouse_form.photo_description', 'Use a recognizable warehouse image so teams can identify this facility quickly.')}
                  </p>
                </div>
                <ImageUploadField value={photo} onChange={setPhoto} disabled={docForm.isSubmitting} />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <form.Field name="warehouseId">
                  {(field) => (
                    <TextField fullWidth isRequired isDisabled={docForm.isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="warehouseId" value={field.state.value} onChange={field.handleChange}>
                      <Label>{t('warehouseform_codelabel', 'Warehouse Code')}</Label>
                      <Input placeholder={t('warehouseform_codeplaceholder', 'Warehouse code (e.g. WH001)')} variant="secondary" />
                      {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="warehouseName">
                  {(field) => (
                    <TextField fullWidth isRequired isDisabled={docForm.isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="warehouseName" value={field.state.value} onChange={field.handleChange}>
                      <Label>{t('warehouseform_namelabel', 'Warehouse Name')}</Label>
                      <Input placeholder={t('warehouseform_nameplaceholder', 'Warehouse name')} variant="secondary" />
                      {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                    </TextField>
                  )}
                </form.Field>
              </div>
            </div>
          </DocHeaderCard>

          <DocHeaderCard
            title={t('warehouse.form.section_location_title', 'Location & Capacity')}
            description={t('warehouse.form.section_location_desc', 'Where the facility is and how much it can hold.')}
            icon="solar:map-point-linear"
          >
            <form.Field name="objectId">
              {(field) => (
                <TextField fullWidth isDisabled={docForm.isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="objectId" value={field.state.value} onChange={field.handleChange}>
                  <Label>{t('warehouseform_objectidlabel', 'Object ID')}</Label>
                  <Input placeholder={t('warehouseform_objectidplaceholder', 'External object ID')} variant="secondary" />
                  {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                </TextField>
              )}
            </form.Field>

            <form.Field name="address">
              {(field) => (
                <TextField fullWidth isRequired isDisabled={docForm.isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="address" value={field.state.value} onChange={field.handleChange}>
                  <Label>{t('warehouseform_addresslabel', 'Address')}</Label>
                  <Input placeholder={t('warehouseform_addressplaceholder', 'Warehouse address')} variant="secondary" />
                  {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                </TextField>
              )}
            </form.Field>

            <form.Field name="totalCapacity">
              {(field) => (
                <TextField fullWidth isDisabled={docForm.isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="totalCapacity" type="number" value={field.state.value} onChange={field.handleChange}>
                  <Label>{t('warehouseform_capacitylabel', 'Total Capacity')}</Label>
                  <Input placeholder={t('warehouseform_capacityplaceholder', 'e.g. 1000')} variant="secondary" />
                  {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                </TextField>
              )}
            </form.Field>
          </DocHeaderCard>
        </>
      }
      aside={
        <FormPreviewCard
          title={t('warehouse.form.preview_title', 'Warehouse Preview')}
          icon="solar:buildings-linear"
          description={t('warehouse.form.preview_desc', 'Live summary of the facility you are building.')}
          fillLabel={t('form.preview_fill', 'Completed')}
          rows={[
            { label: t('warehouseform_codelabel', 'Warehouse Code'), value: values.warehouseId, icon: 'solar:database-linear' },
            { label: t('warehouseform_namelabel', 'Warehouse Name'), value: values.warehouseName, icon: 'solar:buildings-linear', tone: 'accent' },
            { label: t('warehouseform_objectidlabel', 'Object ID'), value: values.objectId, icon: 'solar:code-bold' },
            { label: t('warehouseform_addresslabel', 'Address'), value: values.address, icon: 'solar:map-point-linear' },
            { label: t('warehouseform_capacitylabel', 'Total Capacity'), value: values.totalCapacity, icon: 'solar:layers-linear' },
            { label: t('warehouse_form.photo_preview', 'Photo'), value: photo ? t('warehouse_form.photo_attached', 'Attached') : null, icon: 'solar:camera-linear', tone: 'success' },
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
          labels={{ save: isEdit ? t('warehouseform_submitupdate', 'Save Changes') : t('warehouseform_submitcreate', 'Create Warehouse') }}
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
      loadingLabel={t('warehouseform_loadingdetail', 'Loading warehouse details...')}
      guard={guard}
      isDisabled={docForm.isSubmitting}
    />
  );
};

const WarehouseFormPage = () => {
  const t = useMessage();
  const { id, isEdit, detail, isLoading, isError, error, initialValues } =
    useTransactionFormPage<WarehouseDetail, WarehouseFormValues>({
      queryKey: 'warehouseDetail',
      detailQuery: (input) => trpcClient.warehouse.warehouse.detail.query(input) as Promise<WarehouseDetail>,
      transform: transformDetailToFormValues,
    });

  // Warehouses have no approval status, so the hook's `canEdit` (status-gated)
  // is ignored — the form is editable whenever the detail loads without error.
  let guard: ReactNode = null;
  if (isEdit && isError) {
    guard = (
      <p className="text-sm text-danger">
        {(error as Error | null)?.message ?? t('warehouse.form.load_error', 'Failed to load warehouse.')}
      </p>
    );
  } else if (isEdit && !detail) {
    guard = <p className="text-sm text-danger">{t('warehouse.form.not_found', 'Warehouse not found.')}</p>;
  }

  return (
    <WarehouseForm
      id={id}
      isEdit={isEdit}
      initialValues={initialValues}
      isLoading={isLoading}
      guard={guard}
      initialPhoto={detail?.photo ?? undefined}
    />
  );
};

export { WarehouseFormPage };