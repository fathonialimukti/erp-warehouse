import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Fieldset, Input } from '@heroui/react';
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

  useEffect(() => {
    if (!detailData) {
      return;
    }

    setSkuCode(detailData.id);
    setSkuName(detailData.nama);
    setDescription(detailData.deskripsi ?? '');
    setPhoto(detailData.foto ?? undefined);
  }, [detailData]);

  const intl = useIntl();

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
          kode: skuCode.trim(),
          nama: skuName.trim(),
          deskripsi: description.trim() || undefined,
          foto: photo,
        });

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['skuList'] }),
          queryClient.removeQueries({ queryKey: ['skuDetail', id] }),
          queryClient.removeQueries({ queryKey: ['skuDetail', updated.id] }),
        ]);

        navigate(`/skus/${updated.id}`);
      } else {
        const created = await trpcClient.sku.create.mutate({
          kode: skuCode.trim(),
          nama: skuName.trim(),
          deskripsi: description.trim() || undefined,
          foto: photo,
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

      <form className="space-y-6" onSubmit={handleSubmit}>
        <Fieldset className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <Fieldset.Legend className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
            {intl.formatMessage({ id: 'skuForm.sectionTitle', defaultMessage: 'SKU Information' })}
          </Fieldset.Legend>
          <Fieldset.Group className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <label className="form-label">
                {intl.formatMessage({ id: 'skuForm.photoLabel', defaultMessage: 'SKU Photo' })}
              </label>
              <ImageUploadField value={photo} onChange={setPhoto} />
            </div>
            <div className="space-y-1">
              <label className="form-label" htmlFor="sku-code">
                {intl.formatMessage({ id: 'skuForm.codeLabel', defaultMessage: 'SKU Code' })}
              </label>
              <Input
                id="sku-code"
                type="text"
                value={skuCode}
                onChange={(event) => setSkuCode(event.target.value)}
                placeholder={intl.formatMessage({ id: 'skuForm.codePlaceholder', defaultMessage: 'e.g. SKU-001' })}
                fullWidth
                variant="secondary"
              />
            </div>
            <div className="space-y-1">
              <label className="form-label" htmlFor="sku-name">
                {intl.formatMessage({ id: 'skuForm.nameLabel', defaultMessage: 'SKU Name' })}
              </label>
              <Input
                id="sku-name"
                type="text"
                value={skuName}
                onChange={(event) => setSkuName(event.target.value)}
                placeholder={intl.formatMessage({ id: 'skuForm.namePlaceholder', defaultMessage: 'Product name' })}
                fullWidth
                variant="secondary"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="form-label" htmlFor="sku-description">
                {intl.formatMessage({ id: 'skuForm.descriptionLabel', defaultMessage: 'Description' })}
              </label>
              <Input
                id="sku-description"
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={intl.formatMessage({ id: 'skuForm.descriptionPlaceholder', defaultMessage: 'Short SKU description' })}
                fullWidth
                variant="secondary"
              />
            </div>
          </Fieldset.Group>

          {errorMessage && (
            <p className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{errorMessage}</p>
          )}

          <Fieldset.Actions className="mt-6 flex justify-end gap-2">
            <Button variant="primary" type="submit" isDisabled={isSubmitting}>
              {isEdit
                ? intl.formatMessage({ id: 'skuForm.submitUpdate', defaultMessage: 'Save Changes' })
                : intl.formatMessage({ id: 'skuForm.submitCreate', defaultMessage: 'Create SKU' })}
            </Button>
          </Fieldset.Actions>
        </Fieldset>
      </form>
    </section>
  );
}
