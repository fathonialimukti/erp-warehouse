import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, FieldError, Input, Label, TextField } from '@heroui/react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ImageUploadField from '../../components/ImageUploadField';
import { PageHeader } from '../../components/PageHeader';
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
  const hasRequiredFieldError = Boolean(errorMessage) && (!warehouseId.trim() || !warehouseName.trim() || !address.trim());
  const isWarehouseIdInvalid = hasRequiredFieldError && !warehouseId.trim();
  const isWarehouseNameInvalid = hasRequiredFieldError && !warehouseName.trim();
  const isAddressInvalid = hasRequiredFieldError && !address.trim();
  const isCapacityInvalid = Boolean(totalCapacity.trim()) && Number.isNaN(Number(totalCapacity));

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
      setErrorMessage(intl.formatMessage({ id: 'warehouseform_errors_requiredfields', defaultMessage: 'Warehouse code, name, and address are required.' }));
      return;
    }

    const capacity = totalCapacity.trim() ? Number(totalCapacity) : undefined;
    if (totalCapacity.trim() && Number.isNaN(capacity)) {
      setErrorMessage(intl.formatMessage({ id: 'warehouseform_errors_capacitynumber', defaultMessage: 'Total capacity must be a number.' }));
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
      setErrorMessage(error instanceof Error ? error.message : intl.formatMessage({ id: 'warehouseform_errors_savefailed', defaultMessage: 'Failed to save warehouse.' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEdit && isLoadingDetail) {
    return <p className="text-sm text-muted">{intl.formatMessage({ id: 'warehouseform_loadingdetail', defaultMessage: 'Loading warehouse details...' })}</p>;
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={isEdit
          ? intl.formatMessage({ id: 'warehouseform_titleedit', defaultMessage: 'Edit Warehouse' })
          : intl.formatMessage({ id: 'warehouseform_titlecreate', defaultMessage: 'Create Warehouse' })}
        onBack={() => navigate('/warehouse')}
      />

      <p className="text-sm text-muted">
        {isEdit
          ? intl.formatMessage({ id: 'warehouseform_descriptionedit', defaultMessage: 'Update warehouse details.' })
          : intl.formatMessage({ id: 'warehouseform_descriptioncreate', defaultMessage: 'Enter details for a new warehouse.' })}
      </p>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <Card>
          <Card.Header>
            <div>
              <Card.Title>{intl.formatMessage({ id: 'warehouseform_sectiontitle', defaultMessage: 'Warehouse Information' })}</Card.Title>
              <Card.Description>
                {isEdit
                  ? intl.formatMessage({ id: 'warehouseform_descriptionedit', defaultMessage: 'Update warehouse details.' })
                  : intl.formatMessage({ id: 'warehouseform_descriptioncreate', defaultMessage: 'Enter details for a new warehouse.' })}
              </Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="space-y-6">
              <div className="rounded-2xl border border-default-200 bg-default-50/60 p-4">
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-foreground">
                    {intl.formatMessage({ id: 'warehouseform_photolabel', defaultMessage: 'Warehouse Photo' })}
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    {intl.formatMessage({ id: 'warehouse_form.photo_description', defaultMessage: 'Use a recognizable warehouse image so teams can identify this facility quickly.' })}
                  </p>
                </div>
                <ImageUploadField value={photo} onChange={setPhoto} disabled={isSubmitting} />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField
                  fullWidth
                  isRequired
                  isDisabled={isSubmitting}
                  isInvalid={isWarehouseIdInvalid}
                  isReadOnly={isEdit}
                  name="warehouseId"
                  value={warehouseId}
                  onChange={setWarehouseId}
                >
                  <Label>{intl.formatMessage({ id: 'warehouseform_codelabel', defaultMessage: 'Warehouse Code' })}</Label>
                  <Input placeholder={intl.formatMessage({ id: 'warehouseform_codeplaceholder', defaultMessage: 'Warehouse code (e.g. WH001)' })} variant="secondary" />
                  {isWarehouseIdInvalid ? (
                    <FieldError>
                      {intl.formatMessage({ id: 'warehouse_form.errors.code_required', defaultMessage: 'Warehouse code is required.' })}
                    </FieldError>
                  ) : null}
                </TextField>

                <TextField
                  fullWidth
                  isRequired
                  isDisabled={isSubmitting}
                  isInvalid={isWarehouseNameInvalid}
                  name="warehouseName"
                  value={warehouseName}
                  onChange={setWarehouseName}
                >
                  <Label>{intl.formatMessage({ id: 'warehouseform_namelabel', defaultMessage: 'Warehouse Name' })}</Label>
                  <Input placeholder={intl.formatMessage({ id: 'warehouseform_nameplaceholder', defaultMessage: 'Warehouse name' })} variant="secondary" />
                  {isWarehouseNameInvalid ? (
                    <FieldError>
                      {intl.formatMessage({ id: 'warehouse_form.errors.name_required', defaultMessage: 'Warehouse name is required.' })}
                    </FieldError>
                  ) : null}
                </TextField>

                <TextField
                  fullWidth
                  isRequired
                  isDisabled={isSubmitting}
                  isInvalid={isAddressInvalid}
                  name="address"
                  value={address}
                  onChange={setAddress}
                >
                  <Label>{intl.formatMessage({ id: 'warehouseform_addresslabel', defaultMessage: 'Address' })}</Label>
                  <Input placeholder={intl.formatMessage({ id: 'warehouseform_addressplaceholder', defaultMessage: 'Warehouse address' })} variant="secondary" />
                  {isAddressInvalid ? (
                    <FieldError>
                      {intl.formatMessage({ id: 'warehouse_form.errors.address_required', defaultMessage: 'Warehouse address is required.' })}
                    </FieldError>
                  ) : null}
                </TextField>

                <TextField
                  fullWidth
                  isDisabled={isSubmitting}
                  isInvalid={isCapacityInvalid}
                  name="totalCapacity"
                  type="number"
                  value={totalCapacity}
                  onChange={setTotalCapacity}
                >
                  <Label>{intl.formatMessage({ id: 'warehouseform_capacitylabel', defaultMessage: 'Total Capacity' })}</Label>
                  <Input placeholder={intl.formatMessage({ id: 'warehouseform_capacityplaceholder', defaultMessage: 'e.g. 1000' })} variant="secondary" />
                  {isCapacityInvalid ? (
                    <FieldError>
                      {intl.formatMessage({ id: 'warehouseform_errors_capacitynumber', defaultMessage: 'Total capacity must be a number.' })}
                    </FieldError>
                  ) : null}
                </TextField>
              </div>

              {isEdit ? (
                <p className="text-xs text-muted">
                  {intl.formatMessage({ id: 'warehouseform_readonlyidhint', defaultMessage: 'Warehouse code cannot be changed after creation.' })}
                </p>
              ) : null}

              {errorMessage ? (
                <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{errorMessage}</p>
              ) : null}
            </div>
          </Card.Content>
          <Card.Footer>
            <div className="flex w-full justify-end gap-2">
              <Button variant="secondary" type="button" onPress={() => navigate('/warehouse')} isDisabled={isSubmitting}>
                {intl.formatMessage({ id: 'warehouseform_back', defaultMessage: 'Back' })}
              </Button>
              <Button variant="primary" type="submit" isDisabled={isSubmitting || isCapacityInvalid}>
                {isEdit
                  ? intl.formatMessage({ id: 'warehouseform_submitupdate', defaultMessage: 'Save Changes' })
                  : intl.formatMessage({ id: 'warehouseform_submitcreate', defaultMessage: 'Create Warehouse' })}
              </Button>
            </div>
          </Card.Footer>
        </Card>
      </form>
    </section>
  );
}
