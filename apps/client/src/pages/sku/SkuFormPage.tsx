import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { AlertDialog, Button, Card, FieldError, Input, Label, TextArea, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ImageUploadField from '../../components/ImageUploadField';
import { trpcClient } from '../../lib/trpc';

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

  const handleDeleteSkuModalOpenChange = (open: boolean) => {
    setDeleteSkuModalOpen(open);
  };

  const deleteSku = async () => {
    if (!id) {
      return;
    }

    setIsDeletingSku(true);
    setErrorMessage(null);

    try {
      await trpcClient.sku.delete.mutate({ id });
      await queryClient.invalidateQueries({ queryKey: ['skuList'] });
      queryClient.removeQueries({ queryKey: ['skuDetail', id] });
      navigate('/skus');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : intl.formatMessage({ id: 'skuForm.errors.deleteFailed', defaultMessage: 'Failed to delete SKU.' }));
    } finally {
      setIsDeletingSku(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!skuCode.trim() || !skuName.trim()) {
      setErrorMessage(intl.formatMessage({ id: 'skuForm.errors.requiredCodeName', defaultMessage: 'SKU code and name are required.' }));
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
        });

        await queryClient.invalidateQueries({ queryKey: ['skuList'] });
        queryClient.removeQueries({ queryKey: ['skuDetail', created.id] });

        navigate(`/skus/${created.id}`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : intl.formatMessage({ id: 'skuForm.errors.saveFailed', defaultMessage: 'Failed to save SKU.' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEdit && isLoadingDetail) {
    return <p className="text-sm text-muted">{intl.formatMessage({ id: 'skuForm.loadingDetail', defaultMessage: 'Loading SKU details...' })}</p>;
  }

  return (
    <section className="space-y-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isEdit
              ? intl.formatMessage({ id: 'skuForm.titleEdit', defaultMessage: 'Edit SKU' })
              : intl.formatMessage({ id: 'skuForm.titleCreate', defaultMessage: 'Create SKU' })}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {isEdit
              ? intl.formatMessage({ id: 'skuForm.descriptionEdit', defaultMessage: 'Update SKU details.' })
              : intl.formatMessage({ id: 'skuForm.descriptionCreate', defaultMessage: 'Enter details for a new SKU.' })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" type="button" onPress={() => navigate('/skus')}>
            <Icon icon="solar:alt-arrow-left-linear" className="h-4 w-4" />
            {intl.formatMessage({ id: 'skuForm.back', defaultMessage: 'Back' })}
          </Button>
        </div>
      </div>

      <form className="space-y-6" aria-labelledby="sku-form-title" onSubmit={handleSubmit}>
        <Card variant="secondary">
          <Card.Header>
            <div>
              <Card.Title>{intl.formatMessage({ id: 'skuForm.sectionTitle', defaultMessage: 'SKU Information' })}</Card.Title>
              <Card.Description id="sku-form-title">
                {isEdit
                  ? intl.formatMessage({ id: 'skuForm.sectionDescriptionEdit', defaultMessage: 'Refine identification, naming, and catalog details for this SKU.' })
                  : intl.formatMessage({ id: 'skuForm.sectionDescriptionCreate', defaultMessage: 'Capture the core catalog information needed before this SKU is used in operations.' })}
              </Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="space-y-6">
              <div className="rounded-2xl border border-default-200 bg-default-50/60 p-4">
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-foreground">
                    {intl.formatMessage({ id: 'skuForm.photoLabel', defaultMessage: 'SKU Photo' })}
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    {intl.formatMessage({ id: 'skuForm.photoDescription', defaultMessage: 'Use a clear product image so operators can identify the SKU quickly.' })}
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
                  <Label>{intl.formatMessage({ id: 'skuForm.codeLabel', defaultMessage: 'SKU Code' })}</Label>
                  <Input placeholder={intl.formatMessage({ id: 'skuForm.codePlaceholder', defaultMessage: 'e.g. SKU-001' })} variant="secondary" />
                  {isSkuCodeInvalid ? (
                    <FieldError>
                      {intl.formatMessage({ id: 'skuForm.errors.codeRequired', defaultMessage: 'SKU code is required.' })}
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
                  <Label>{intl.formatMessage({ id: 'skuForm.nameLabel', defaultMessage: 'SKU Name' })}</Label>
                  <Input placeholder={intl.formatMessage({ id: 'skuForm.namePlaceholder', defaultMessage: 'Product name' })} variant="secondary" />
                  {isSkuNameInvalid ? (
                    <FieldError>
                      {intl.formatMessage({ id: 'skuForm.errors.nameRequired', defaultMessage: 'SKU name is required.' })}
                    </FieldError>
                  ) : null}
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
                    <Label>{intl.formatMessage({ id: 'skuForm.descriptionLabel', defaultMessage: 'Description' })}</Label>
                    <TextArea
                      placeholder={intl.formatMessage({ id: 'skuForm.descriptionPlaceholder', defaultMessage: 'Short SKU description' })}
                      rows={4}
                      variant="secondary"
                    />
                    {isDescriptionTooLong ? (
                      <FieldError>
                        {intl.formatMessage({ id: 'skuForm.errors.descriptionTooLong', defaultMessage: 'Description must be 500 characters or fewer.' })}
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
                {intl.formatMessage({ id: 'skuForm.footerHint', defaultMessage: 'Required fields: SKU code and SKU name.' })}
              </p>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
                <Button variant="secondary" type="button" onPress={() => navigate('/skus')} isDisabled={isSubmitting || isDeletingSku}>
                  {intl.formatMessage({ id: 'skuForm.back', defaultMessage: 'Back' })}
                </Button>
                {isEdit ? (
                  <Button variant="danger" type="button" onPress={openDeleteSkuModal} isDisabled={isSubmitting || isDeletingSku}>
                    <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                    {intl.formatMessage({ id: 'skuForm.deleteSku', defaultMessage: 'Delete SKU' })}
                  </Button>
                ) : null}
                <Button variant="primary" type="submit" isPending={isSubmitting || isDescriptionTooLong} isDisabled={isDescriptionTooLong}>
                  {({ isPending }) => (
                    <>
                      <Icon icon={isPending ? 'solar:refresh-linear' : 'solar:diskette-linear'} className={`size-4 ${isPending ? 'animate-spin' : ''}`} />
                      {isEdit
                        ? intl.formatMessage({ id: 'skuForm.submitUpdate', defaultMessage: 'Save Changes' })
                        : intl.formatMessage({ id: 'skuForm.submitCreate', defaultMessage: 'Create SKU' })}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card.Footer>
        </Card>
      </form>

      <AlertDialog>
        <AlertDialog.Backdrop isOpen={deleteSkuModalOpen} onOpenChange={handleDeleteSkuModalOpenChange}>
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-md">
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>
                  {intl.formatMessage({ id: 'skuForm.deleteSkuTitle', defaultMessage: 'Delete SKU' })}
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <div className="space-y-3 text-sm leading-6 text-muted">
                  <p>
                    {intl.formatMessage(
                      {
                        id: 'skuForm.deleteSkuDescription',
                        defaultMessage: 'SKU {name} will be permanently removed from the catalog and all associated packaging references.',
                      },
                      { name: detailData?.name ?? (skuCode || '-') }
                    )}
                  </p>
                  <div className="rounded-2xl border border-danger-soft-hover bg-danger/8 p-4 text-danger">
                    {intl.formatMessage({
                      id: 'skuForm.deleteSkuWarning',
                      defaultMessage: 'Make sure this SKU is no longer required by inventory or warehouse operations.',
                    })}
                  </div>
                </div>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="primary" onPress={() => handleDeleteSkuModalOpenChange(false)} isDisabled={isDeletingSku}>
                  {intl.formatMessage({ id: 'skuForm.deleteSkuCancel', defaultMessage: 'Cancel' })}
                </Button>
                <Button variant="danger" onPress={() => void deleteSku()} isPending={isDeletingSku}>
                  {({ isPending }) => (
                    <>
                      <Icon icon={isPending ? 'solar:refresh-linear' : 'solar:trash-bin-trash-linear'} className={`size-4 ${isPending ? 'animate-spin' : ''}`} />
                      {isPending
                        ? intl.formatMessage({ id: 'skuForm.deleteSkuDeleting', defaultMessage: 'Deleting SKU...' })
                        : intl.formatMessage({ id: 'skuForm.deleteSkuConfirm', defaultMessage: 'Delete SKU' })}
                    </>
                  )}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </section>
  );
}
