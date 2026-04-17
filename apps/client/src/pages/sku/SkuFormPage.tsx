import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, FieldError, Input, Label, TextArea, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ImageUploadField from '../../components/ImageUploadField';
import DeleteSkuDialog from './_DeleteSku.tsx';
import { trpcClient } from '../../lib/trpc';
import { PageHeader } from '../../components/PageHeader.tsx';

export default function SkuFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const { data: detailData, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['skuDetail', id],
    enabled: isEdit,
    queryFn: () => trpcClient.sku.detail.query({ id: id ?? '' }),
  });

  const [skuCode, setSkuCode] = useState('');
  const [skuName, setSkuName] = useState('');
  const [description, setDescription] = useState('');
  const [baseUnit, setBaseUnit] = useState('kg');
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteSkuModalOpen, setDeleteSkuModalOpen] = useState(false);
  const [isDeletingSku, setIsDeletingSku] = useState(false);

  useEffect(() => {
    if (!detailData) {
      return;
    }

    setSkuCode(detailData.id);
    setSkuName(detailData.name);
    setDescription(detailData.description ?? '');
    setBaseUnit(detailData.baseUnit ?? 'kg');
    setPhoto(detailData.photo ?? undefined);
  }, [detailData]);

  const intl = useIntl();
  const hasRequiredFieldError = Boolean(errorMessage) && (!skuCode.trim() || !skuName.trim());
  const isSkuCodeInvalid = hasRequiredFieldError && !skuCode.trim();
  const isSkuNameInvalid = hasRequiredFieldError && !skuName.trim();
  const isDescriptionTooLong = description.length > 500;

  const openDeleteSkuModal = () => {
    setDeleteSkuModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!skuCode.trim() || !skuName.trim()) {
      setErrorMessage(intl.formatMessage({ id: 'sku.form.errors.required_code_name', defaultMessage: 'SKU code and name are required.' }));
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        const updated = await trpcClient.sku.update.mutate({
          id,
          newId: skuCode.trim(),
          name: skuName.trim(),
          description: description.trim() || undefined,
          photo: photo,
          baseUnit: baseUnit.trim() || 'kg',
        });

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['skuList'] }),
          queryClient.removeQueries({ queryKey: ['skuDetail', id] }),
          queryClient.removeQueries({ queryKey: ['skuDetail', updated.id] }),
        ]);

        navigate(`/skus/${updated.id}`);
      } else {
        const created = await trpcClient.sku.create.mutate({
          id: skuCode.trim(),
          name: skuName.trim(),
          description: description.trim() || undefined,
          photo: photo,
          baseUnit: baseUnit.trim() || 'kg',
        });

        await queryClient.invalidateQueries({ queryKey: ['skuList'] });
        queryClient.removeQueries({ queryKey: ['skuDetail', created.id] });

        navigate(`/skus/${created.id}`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : intl.formatMessage({ id: 'sku.form.errors.save_failed', defaultMessage: 'Failed to save SKU.' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEdit && isLoadingDetail) {
    return <p className="text-sm text-muted">{intl.formatMessage({ id: 'sku.form.loading_detail', defaultMessage: 'Loading SKU details...' })}</p>;
  }

  const detailSkuId = id ?? detailData?.id;

  return (
    <section className="space-y-6">
      <PageHeader
        title={isEdit ? intl.formatMessage({ id: 'sku.form.page_title', defaultMessage: 'Edit SKU' }) : intl.formatMessage({ id: 'sku.form.title_create', defaultMessage: 'Create SKU' })}
        onDetail={isEdit && detailSkuId ? () => navigate(`/skus/${detailSkuId}`) : undefined}
        onDelete={isEdit && detailSkuId ? openDeleteSkuModal : undefined}
        onBack={() => navigate('/skus')}
        isDisabled={isDeletingSku}
      />

      <form className="space-y-6" aria-labelledby="sku-form-title" onSubmit={handleSubmit}>
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
                <TextField
                  fullWidth
                  isRequired
                  isDisabled={isSubmitting}
                  isInvalid={isSkuCodeInvalid}
                  name="skuCode"
                  value={skuCode}
                  onChange={setSkuCode}
                >
                  <Label>{intl.formatMessage({ id: 'sku.form.code_label', defaultMessage: 'SKU Code' })}</Label>
                  <Input placeholder={intl.formatMessage({ id: 'sku.form.code_placeholder', defaultMessage: 'e.g. SKU-001' })} variant="secondary" />
                  {isSkuCodeInvalid ? (
                    <FieldError>
                      {intl.formatMessage({ id: 'sku.form.errors.code_required', defaultMessage: 'SKU code is required.' })}
                    </FieldError>
                  ) : null}
                </TextField>

                <TextField
                  fullWidth
                  isRequired
                  isDisabled={isSubmitting}
                  isInvalid={isSkuNameInvalid}
                  name="skuName"
                  value={skuName}
                  onChange={setSkuName}
                >
                  <Label>{intl.formatMessage({ id: 'sku.form.name_label', defaultMessage: 'SKU Name' })}</Label>
                  <Input placeholder={intl.formatMessage({ id: 'sku.form.name_placeholder', defaultMessage: 'Product name' })} variant="secondary" />
                  {isSkuNameInvalid ? (
                    <FieldError>
                      {intl.formatMessage({ id: 'sku.form.errors.name_required', defaultMessage: 'SKU name is required.' })}
                    </FieldError>
                  ) : null}
                </TextField>

                <TextField
                  fullWidth
                  isDisabled={isSubmitting}
                  name="baseUnit"
                  value={baseUnit}
                  onChange={setBaseUnit}
                >
                  <Label>{intl.formatMessage({ id: 'sku.form.base_unit_label', defaultMessage: 'Base Unit' })}</Label>
                  <Input placeholder={intl.formatMessage({ id: 'sku.form.base_unit_placeholder', defaultMessage: 'e.g. kg, pcs, liter' })} variant="secondary" />
                </TextField>

                <div className="md:col-span-2">
                  <TextField
                    fullWidth
                    isDisabled={isSubmitting}
                    isInvalid={isDescriptionTooLong}
                    name="description"
                    value={description}
                    onChange={setDescription}
                  >
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
                </div>
              </div>

              {errorMessage ? (
                <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                  <div className="flex items-start gap-2">
                    <Icon icon="solar:danger-triangle-linear" className="mt-0.5 size-4 shrink-0" />
                    <span>{errorMessage}</span>
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
                {isEdit ? (
                  <Button variant="danger" type="button" onPress={openDeleteSkuModal} isDisabled={isSubmitting || isDeletingSku}>
                    <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                    {intl.formatMessage({ id: 'sku.form.delete_sku', defaultMessage: 'Delete SKU' })}
                  </Button>
                ) : null}
                <Button variant="primary" type="submit" isPending={isSubmitting || isDescriptionTooLong} isDisabled={isDescriptionTooLong}>
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
        id={id ?? ''}
        name={detailData?.name}
        isOpen={deleteSkuModalOpen}
        onOpenChange={setDeleteSkuModalOpen}
        onDeletingChange={setIsDeletingSku}
        onError={(message) => setErrorMessage(message)}
        onDeleted={async () => {
          await queryClient.invalidateQueries({ queryKey: ['skuList'] });
          queryClient.removeQueries({ queryKey: ['skuDetail', id] });
          navigate('/skus');
        }}
      />
    </section>
  );
}
