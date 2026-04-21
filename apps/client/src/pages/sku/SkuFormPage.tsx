import { useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, FieldError, Input, Label, TextArea, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import ImageUploadField from '../../components/ImageUploadField';
import DeleteSkuDialog from './_DeleteSku.tsx';
import { hasPermissionAtom } from '../../lib/atoms';
import { trpcClient } from '../../lib/trpc';
import { PageHeader } from '../../components/PageHeader.tsx';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../lib/trpc';

type SkuFormValues = {
  skuCode: string;
  skuName: string;
  description: string;
  baseUnit: string;
};

type SkuDetail = {
  id: string;
  name: string;
  description?: string | null;
  baseUnit?: string | null;
  photo?: string | null;
};

const defaultFormValues = (): SkuFormValues => ({
  skuCode: '',
  skuName: '',
  description: '',
  baseUnit: 'kg',
});

const transformDetailToFormValues = (detail: SkuDetail): SkuFormValues => ({
  skuCode: detail.id,
  skuName: detail.name,
  description: detail.description ?? '',
  baseUnit: detail.baseUnit ?? 'kg',
});

function SkuFormContent({
  initialValues,
  initialPhoto,
  isEdit,
  canSave,
  canDelete,
  detailSkuId,
}: {
  initialValues: SkuFormValues;
  initialPhoto: string | undefined;
  isEdit: boolean;
  canSave: boolean;
  canDelete: boolean;
  detailSkuId?: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const intl = useIntl();
  const [photo, setPhoto] = useState<string | undefined>(initialPhoto);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteSkuModalOpen, setDeleteSkuModalOpen] = useState(false);
  const [isDeletingSku, setIsDeletingSku] = useState(false);

  useEffect(() => {
    setPhoto(initialPhoto);
  }, [initialPhoto]);

  const createMutation = useMutation({
    mutationFn: (payload: inferProcedureInput<AppRouter['sku']['create']>) => trpcClient.sku.create.mutate(payload),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: inferProcedureInput<AppRouter['sku']['update']>) => trpcClient.sku.update.mutate(payload),
  });

  const form = useForm({
    defaultValues: initialValues,
    onSubmit: async ({ value }) => {
      setFormError(null);

      if (!canSave) {
        setFormError(intl.formatMessage({ id: 'sku.form.errors.no_permission', defaultMessage: 'You do not have permission to save this SKU.' }));
        return;
      }

      if (!value.skuCode.trim() || !value.skuName.trim()) {
        setFormError(intl.formatMessage({ id: 'sku.form.errors.required_code_name', defaultMessage: 'SKU code and name are required.' }));
        return;
      }

      if (value.description.length > 500) {
        setFormError(intl.formatMessage({ id: 'sku.form.errors.description_too_long', defaultMessage: 'Description must be 500 characters or fewer.' }));
        return;
      }

      try {
        if (isEdit && detailSkuId) {
          const updated = await updateMutation.mutateAsync({
            id: detailSkuId,
            newId: value.skuCode.trim(),
            name: value.skuName.trim(),
            description: value.description.trim() || undefined,
            photo,
            baseUnit: value.baseUnit.trim() || 'kg',
          });

          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['skuList'] }),
            queryClient.removeQueries({ queryKey: ['skuDetail', detailSkuId] }),
            queryClient.removeQueries({ queryKey: ['skuDetail', updated.id] }),
          ]);

          navigate(`/skus/${updated.id}`);
        } else {
          const created = await createMutation.mutateAsync({
            id: value.skuCode.trim(),
            name: value.skuName.trim(),
            description: value.description.trim() || undefined,
            photo,
            baseUnit: value.baseUnit.trim() || 'kg',
          });

          await queryClient.invalidateQueries({ queryKey: ['skuList'] });
          queryClient.removeQueries({ queryKey: ['skuDetail', created.id] });

          navigate(`/skus/${created.id}`);
        }
      } catch (error) {
        setFormError(error instanceof Error ? error.message : intl.formatMessage({ id: 'sku.form.errors.save_failed', defaultMessage: 'Failed to save SKU.' }));
      }
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const formValues = form.state.values;
  const hasRequiredFieldError = Boolean(formError) && (!formValues.skuCode.trim() || !formValues.skuName.trim());
  const isSkuCodeInvalid = hasRequiredFieldError && !formValues.skuCode.trim();
  const isSkuNameInvalid = hasRequiredFieldError && !formValues.skuName.trim();
  const isDescriptionTooLong = formValues.description.length > 500;

  const openDeleteSkuModal = () => setDeleteSkuModalOpen(true);

  return (
    <section className="space-y-6">
      <PageHeader
        title={isEdit ? intl.formatMessage({ id: 'sku.form.page_title', defaultMessage: 'Edit SKU' }) : intl.formatMessage({ id: 'sku.form.title_create', defaultMessage: 'Create SKU' })}
        onDetail={isEdit && detailSkuId ? () => navigate(`/skus/${detailSkuId}`) : undefined}
        onDelete={isEdit && detailSkuId && canDelete ? openDeleteSkuModal : undefined}
        onBack={() => navigate('/skus')}
        isDisabled={isDeletingSku}
      />

      <form className="space-y-6" aria-labelledby="sku-form-title" onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); void form.handleSubmit(); }}>
        <Card>
          <Card.Header>
            <div>
              <Card.Title>{intl.formatMessage({ id: 'sku.form.section_title', defaultMessage: 'SKU Information' })}</Card.Title>
              <Card.Description id="sku-form-title">
                {isEdit
                  ? intl.formatMessage({ id: 'sku.form.section_description_edit', defaultMessage: 'Refine identification, naming, and catalog details for this SKU.' })
                  : intl.formatMessage({ id: 'sku.form.section_description_create', defaultMessage: 'Capture the core catalog information needed before this SKU is used in operations.' })}
              </Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="space-y-6">
              <div className="rounded-2xl border border-default-200 bg-default-50/60 p-4">
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-foreground">
                    {intl.formatMessage({ id: 'sku.form.photo_label', defaultMessage: 'SKU Photo' })}
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    {intl.formatMessage({ id: 'sku.form.photo_description', defaultMessage: 'Use a clear product image so operators can identify the SKU quickly.' })}
                  </p>
                </div>
                <ImageUploadField value={photo} onChange={setPhoto} disabled={isSubmitting} />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <form.Field name="skuCode">
                  {(field) => (
                    <TextField
                      fullWidth
                      isRequired
                      isDisabled={isSubmitting}
                      isInvalid={isSkuCodeInvalid}
                      name="sku-code"
                      value={field.state.value}
                      onChange={field.handleChange}
                    >
                      <Label>{intl.formatMessage({ id: 'sku.form.code_label', defaultMessage: 'SKU Code' })}</Label>
                      <Input placeholder={intl.formatMessage({ id: 'sku.form.code_placeholder', defaultMessage: 'e.g. SKU-001' })} variant="secondary" />
                      {isSkuCodeInvalid ? (
                        <FieldError>
                          {intl.formatMessage({ id: 'sku.form.errors.code_required', defaultMessage: 'SKU code is required.' })}
                        </FieldError>
                      ) : null}
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="skuName">
                  {(field) => (
                    <TextField
                      fullWidth
                      isRequired
                      isDisabled={isSubmitting}
                      isInvalid={isSkuNameInvalid}
                      name="sku-name"
                      value={field.state.value}
                      onChange={field.handleChange}
                    >
                      <Label>{intl.formatMessage({ id: 'sku.form.name_label', defaultMessage: 'SKU Name' })}</Label>
                      <Input placeholder={intl.formatMessage({ id: 'sku.form.name_placeholder', defaultMessage: 'Product name' })} variant="secondary" />
                      {isSkuNameInvalid ? (
                        <FieldError>
                          {intl.formatMessage({ id: 'sku.form.errors.name_required', defaultMessage: 'SKU name is required.' })}
                        </FieldError>
                      ) : null}
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="baseUnit">
                  {(field) => (
                    <TextField fullWidth isDisabled={isSubmitting} name="base-unit" value={field.state.value} onChange={field.handleChange}>
                      <Label>{intl.formatMessage({ id: 'sku.form.base_unit_label', defaultMessage: 'Base Unit' })}</Label>
                      <Input placeholder={intl.formatMessage({ id: 'sku.form.base_unit_placeholder', defaultMessage: 'e.g. kg, pcs, liter' })} variant="secondary" />
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="description">
                  {(field) => (
                    <TextField fullWidth isDisabled={isSubmitting} isInvalid={isDescriptionTooLong} name="sku-description" value={field.state.value} onChange={field.handleChange}>
                      <Label>{intl.formatMessage({ id: 'sku.form.description_label', defaultMessage: 'Description' })}</Label>
                      <TextArea
                        placeholder={intl.formatMessage({ id: 'sku.form.description_placeholder', defaultMessage: 'Short SKU description' })}
                        rows={4}
                        variant="secondary"
                      />
                      {isDescriptionTooLong ? (
                        <FieldError>
                          {intl.formatMessage({ id: 'sku.form.errors.description_too_long', defaultMessage: 'Description must be 500 characters or fewer.' })}
                        </FieldError>
                      ) : null}
                    </TextField>
                  )}
                </form.Field>
              </div>

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
            <div className="flex w-full flex-col gap-3 border-t border-default-200/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted">
                {intl.formatMessage({ id: 'sku.form.footer_hint', defaultMessage: 'Required fields: SKU code and SKU name.' })}
              </p>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
                <Button variant="secondary" type="button" onPress={() => navigate('/skus')} isDisabled={isSubmitting || isDeletingSku}>
                  {intl.formatMessage({ id: 'sku.form.back', defaultMessage: 'Back' })}
                </Button>
                {isEdit && canDelete ? (
                  <Button variant="danger" type="button" onPress={openDeleteSkuModal} isDisabled={isSubmitting || isDeletingSku}>
                    <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                    {intl.formatMessage({ id: 'sku.form.delete_sku', defaultMessage: 'Delete SKU' })}
                  </Button>
                ) : null}
                <Button variant="primary" type="submit" isPending={isSubmitting || isDescriptionTooLong} isDisabled={isDescriptionTooLong || !canSave}>
                  {({ isPending }) => (
                    <>
                      <Icon icon={isPending ? 'solar:refresh-linear' : 'solar:diskette-linear'} className={`size-4 ${isPending ? 'animate-spin' : ''}`} />
                      {isEdit
                        ? intl.formatMessage({ id: 'sku.form.submit_update', defaultMessage: 'Save Changes' })
                        : intl.formatMessage({ id: 'sku.form.submit_create', defaultMessage: 'Create SKU' })}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card.Footer>
        </Card>
      </form>

      <DeleteSkuDialog
        id={detailSkuId ?? ''}
        name={initialValues.skuName}
        isOpen={deleteSkuModalOpen}
        onOpenChange={setDeleteSkuModalOpen}
        onDeletingChange={setIsDeletingSku}
        onError={(message) => setFormError(message)}
        onDeleted={async () => {
          await queryClient.invalidateQueries({ queryKey: ['skuList'] });
          queryClient.removeQueries({ queryKey: ['skuDetail', detailSkuId] });
          navigate('/skus');
        }}
      />
    </section>
  );
}

export default function SkuFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canCreate = hasPermission('sku_create');
  const canUpdate = hasPermission('sku_update');
  const canDelete = hasPermission('sku_delete');
  const canSave = isEdit ? canUpdate : canCreate;

  const { data: detailData, isLoading: isLoadingDetail } = useQuery<SkuDetail>({
    queryKey: ['skuDetail', id],
    enabled: isEdit,
    queryFn: () => trpcClient.sku.detail.query({ id: id ?? '' }),
  });

  const intl = useIntl();

  if (isEdit && isLoadingDetail) {
    return <p className="text-sm text-muted">{intl.formatMessage({ id: 'sku.form.loading_detail', defaultMessage: 'Loading SKU details...' })}</p>;
  }

  const initialValues = detailData ? transformDetailToFormValues(detailData) : defaultFormValues();
  const initialPhoto = detailData?.photo ?? undefined;
  const detailSkuId = id ?? detailData?.id;

  return (
    <SkuFormContent
      initialValues={initialValues}
      initialPhoto={initialPhoto}
      isEdit={isEdit}
      canSave={canSave}
      canDelete={canDelete}
      detailSkuId={detailSkuId}
    />
  );
}
