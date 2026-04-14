import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Fieldset, Input } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ImageUploadField from '../../components/ImageUploadField';
import { trpcClient } from '../../lib/trpc';

export default function WarehouseFormPage() {
  const intl = useIntl();
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const { data: detailData, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['warehouseDetail', id],
    enabled: isEdit,
    queryFn: () => trpcClient.warehouse.warehouse.detail.query({ id: id ?? '' }),
  });

  const [warehouseName, setWarehouseName] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [address, setAddress] = useState('');
  const [totalCapacity, setTotalCapacity] = useState('');
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!detailData) {
      return;
    }

    setWarehouseId(detailData.id);
    setWarehouseName(detailData.name);
    setAddress(detailData.address);
    setTotalCapacity(detailData.totalCapacity ? String(detailData.totalCapacity) : '');
    setPhoto(detailData.photo ?? undefined);
  }, [detailData]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!warehouseId.trim() || !warehouseName.trim() || !address.trim()) {
      setErrorMessage(intl.formatMessage({ id: 'warehouseForm.errors.requiredFields', defaultMessage: 'Warehouse code, name, and address are required.' }));
      return;
    }

    const capacity = totalCapacity.trim() ? Number(totalCapacity) : undefined;
    if (totalCapacity.trim() && Number.isNaN(capacity)) {
      setErrorMessage(intl.formatMessage({ id: 'warehouseForm.errors.capacityNumber', defaultMessage: 'Total capacity must be a number.' }));
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        const updated = await trpcClient.warehouse.warehouse.update.mutate({
          currentId: id,
          id: warehouseId.trim(),
          name: warehouseName.trim(),
          address: address.trim(),
          totalCapacity: capacity,
          photo: photo,
        });

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['warehouseList'] }),
          queryClient.removeQueries({ queryKey: ['warehouseDetail', id] }),
          queryClient.removeQueries({ queryKey: ['warehouseDetail', updated.id] }),
        ]);

        navigate(`/warehouse/${updated.id}`);
      } else {
        const created = await trpcClient.warehouse.warehouse.create.mutate({
          id: warehouseId.trim(),
          name: warehouseName.trim(),
          address: address.trim(),
          totalCapacity: capacity,
          photo: photo,
        });

        await queryClient.invalidateQueries({ queryKey: ['warehouseList'] });
        queryClient.removeQueries({ queryKey: ['warehouseDetail', created.id] });

        navigate(`/warehouse/${created.id}`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : intl.formatMessage({ id: 'warehouseForm.errors.saveFailed', defaultMessage: 'Failed to save warehouse.' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEdit && isLoadingDetail) {
    return <p className="text-sm text-muted">{intl.formatMessage({ id: 'warehouseForm.loadingDetail', defaultMessage: 'Loading warehouse details...' })}</p>;
  }

  return (
    <section className="space-y-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isEdit
              ? intl.formatMessage({ id: 'warehouseForm.titleEdit', defaultMessage: 'Edit Warehouse' })
              : intl.formatMessage({ id: 'warehouseForm.titleCreate', defaultMessage: 'Create Warehouse' })}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {isEdit
              ? intl.formatMessage({ id: 'warehouseForm.descriptionEdit', defaultMessage: 'Update warehouse details.' })
              : intl.formatMessage({ id: 'warehouseForm.descriptionCreate', defaultMessage: 'Enter details for a new warehouse.' })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" type="button" onPress={() => navigate('/warehouse')}>
            <Icon icon="solar:alt-arrow-left-linear" className="h-4 w-4" />
            {intl.formatMessage({ id: 'warehouseForm.back', defaultMessage: 'Back' })}
          </Button>
        </div>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <Fieldset className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <Fieldset.Legend className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
            {intl.formatMessage({ id: 'warehouseForm.sectionTitle', defaultMessage: 'Warehouse Information' })}
          </Fieldset.Legend>
          <Fieldset.Group className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <label className="form-label">
                {intl.formatMessage({ id: 'warehouseForm.photoLabel', defaultMessage: 'Warehouse Photo' })}
              </label>
              <ImageUploadField value={photo} onChange={setPhoto} />
            </div>
            <div className="space-y-1">
              <label className="form-label" htmlFor="warehouse-id">
                {intl.formatMessage({ id: 'warehouseForm.codeLabel', defaultMessage: 'Warehouse Code' })}
              </label>
              <Input
                id="warehouse-id"
                type="text"
                value={warehouseId}
                onChange={(event) => setWarehouseId(event.target.value)}
                placeholder={intl.formatMessage({ id: 'warehouseForm.codePlaceholder', defaultMessage: 'Warehouse code (e.g. WH001)' })}
                fullWidth
                variant="secondary"
                readOnly={isEdit}
                className={isEdit ? "bg-gray-50 dark:bg-gray-800" : ""}
              />
              {isEdit && (
                <p className="text-xs text-muted">
                  {intl.formatMessage({ id: 'warehouseForm.readOnlyIdHint', defaultMessage: 'Warehouse code cannot be changed after creation.' })}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label className="form-label" htmlFor="warehouse-name">
                {intl.formatMessage({ id: 'warehouseForm.nameLabel', defaultMessage: 'Warehouse Name' })}
              </label>
              <Input
                id="warehouse-name"
                type="text"
                value={warehouseName}
                onChange={(event) => setWarehouseName(event.target.value)}
                placeholder={intl.formatMessage({ id: 'warehouseForm.namePlaceholder', defaultMessage: 'Warehouse name' })}
                fullWidth
                variant="secondary"
              />
            </div>
            <div className="space-y-1">
              <label className="form-label" htmlFor="warehouse-address">
                {intl.formatMessage({ id: 'warehouseForm.addressLabel', defaultMessage: 'Address' })}
              </label>
              <Input
                id="warehouse-address"
                type="text"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder={intl.formatMessage({ id: 'warehouseForm.addressPlaceholder', defaultMessage: 'Warehouse address' })}
                fullWidth
                variant="secondary"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="form-label" htmlFor="warehouse-capacity">
                {intl.formatMessage({ id: 'warehouseForm.capacityLabel', defaultMessage: 'Total Capacity' })}
              </label>
              <Input
                id="warehouse-capacity"
                type="number"
                value={totalCapacity}
                onChange={(event) => setTotalCapacity(event.target.value)}
                placeholder={intl.formatMessage({ id: 'warehouseForm.capacityPlaceholder', defaultMessage: 'e.g. 1000' })}
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
                ? intl.formatMessage({ id: 'warehouseForm.submitUpdate', defaultMessage: 'Save Changes' })
                : intl.formatMessage({ id: 'warehouseForm.submitCreate', defaultMessage: 'Create Warehouse' })}
            </Button>
          </Fieldset.Actions>
        </Fieldset>
      </form>
    </section>
  );
}
