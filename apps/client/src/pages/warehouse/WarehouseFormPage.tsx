import { useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, FieldError, Input, Label, TextField } from '@heroui/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../lib/trpc';
import ImageUploadField from '../../components/ImageUploadField';
import { PageHeader } from '../../components/PageHeader';
import { hasPermissionAtom } from '../../lib/atoms';
import { trpcClient } from '../../lib/trpc';

type WarehouseFormValues = {
  warehouseId: string;
  warehouseName: string;
  address: string;
  totalCapacity: string;
};

type WarehouseDetail = {
  id: string;
  name: string;
  address: string;
  totalCapacity: number | null;
  photo?: string | null;
};

const defaultFormValues = (): WarehouseFormValues => ({
  warehouseId: '',
  warehouseName: '',
  address: '',
  totalCapacity: '',
});

const transformDetailToFormValues = (detail: WarehouseDetail): WarehouseFormValues => ({
  warehouseId: detail.id,
  warehouseName: detail.name,
  address: detail.address,
  totalCapacity: detail.totalCapacity != null ? String(detail.totalCapacity) : '',
});

function WarehouseFormContent({
  initialValues,
  initialPhoto,
  isEdit,
  canSave,
  warehouseId,
}: {
  initialValues: WarehouseFormValues;
  initialPhoto: string | undefined;
  isEdit: boolean;
  canSave: boolean;
  warehouseId?: string;
}) {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [photo, setPhoto] = useState<string | undefined>(initialPhoto);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setPhoto(initialPhoto);
  }, [initialPhoto]);

  const createMutation = useMutation<{ id: string }, unknown, inferProcedureInput<AppRouter['warehouse']['warehouse']['create']>>({
    mutationFn: (payload) => trpcClient.warehouse.warehouse.create.mutate(payload),
  });

  const updateMutation = useMutation<{ id: string }, unknown, inferProcedureInput<AppRouter['warehouse']['warehouse']['update']>>({
    mutationFn: (payload) => trpcClient.warehouse.warehouse.update.mutate(payload),
  });

  const form = useForm({
    defaultValues: initialValues,
    onSubmit: async ({ value }) => {
      setFormError(null);

      if (!canSave) {
        setFormError(intl.formatMessage({ id: 'warehouse.form.errors.no_permission', defaultMessage: 'You do not have permission to save this warehouse.' }));
        return;
      }

      if (!value.warehouseId.trim() || !value.warehouseName.trim() || !value.address.trim()) {
        setFormError(intl.formatMessage({ id: 'warehouseform_errors_requiredfields', defaultMessage: 'Warehouse code, name, and address are required.' }));
        return;
      }

      const capacity = value.totalCapacity.trim() ? Number(value.totalCapacity) : undefined;
      if (value.totalCapacity.trim() && Number.isNaN(capacity)) {
        setFormError(intl.formatMessage({ id: 'warehouseform_errors_capacitynumber', defaultMessage: 'Total capacity must be a number.' }));
        return;
      }

      try {
        if (isEdit && warehouseId) {
          const updated = await updateMutation.mutateAsync({
            currentId: warehouseId,
            id: value.warehouseId.trim(),
            name: value.warehouseName.trim(),
            address: value.address.trim(),
            totalCapacity: capacity,
            photo,
          });

          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['warehouseList'] }),
            queryClient.removeQueries({ queryKey: ['warehouseDetail', warehouseId] }),
            queryClient.removeQueries({ queryKey: ['warehouseDetail', updated.id] }),
          ]);

          navigate(`/warehouse/${updated.id}`);
        } else {
          const created = await createMutation.mutateAsync({
            id: value.warehouseId.trim(),
            name: value.warehouseName.trim(),
            address: value.address.trim(),
            totalCapacity: capacity,
            photo,
          });

          await queryClient.invalidateQueries({ queryKey: ['warehouseList'] });
          queryClient.removeQueries({ queryKey: ['warehouseDetail', created.id] });

          navigate(`/warehouse/${created.id}`);
        }
      } catch (error) {
        setFormError(error instanceof Error ? error.message : intl.formatMessage({ id: 'warehouseform_errors_savefailed', defaultMessage: 'Failed to save warehouse.' }));
      }
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const values = form.state.values;
  const hasRequiredFieldError = Boolean(formError) && (!values.warehouseId.trim() || !values.warehouseName.trim() || !values.address.trim());
  const isWarehouseIdInvalid = hasRequiredFieldError && !values.warehouseId.trim();
  const isWarehouseNameInvalid = hasRequiredFieldError && !values.warehouseName.trim();
  const isAddressInvalid = hasRequiredFieldError && !values.address.trim();
  const isCapacityInvalid = Boolean(values.totalCapacity.trim()) && Number.isNaN(Number(values.totalCapacity));

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

      <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); void form.handleSubmit(); }}>
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
                <form.Field name="warehouseId">
                  {(field) => (
                    <TextField fullWidth isRequired isDisabled={isSubmitting} isInvalid={isWarehouseIdInvalid} isReadOnly={isEdit} name="warehouseId" value={field.state.value} onChange={field.handleChange}>
                      <Label>{intl.formatMessage({ id: 'warehouseform_codelabel', defaultMessage: 'Warehouse Code' })}</Label>
                      <Input placeholder={intl.formatMessage({ id: 'warehouseform_codeplaceholder', defaultMessage: 'Warehouse code (e.g. WH001)' })} variant="secondary" />
                      {isWarehouseIdInvalid ? (
                        <FieldError>
                          {intl.formatMessage({ id: 'warehouse_form.errors.code_required', defaultMessage: 'Warehouse code is required.' })}
                        </FieldError>
                      ) : null}
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="warehouseName">
                  {(field) => (
                    <TextField fullWidth isRequired isDisabled={isSubmitting} isInvalid={isWarehouseNameInvalid} name="warehouseName" value={field.state.value} onChange={field.handleChange}>
                      <Label>{intl.formatMessage({ id: 'warehouseform_namelabel', defaultMessage: 'Warehouse Name' })}</Label>
                      <Input placeholder={intl.formatMessage({ id: 'warehouseform_nameplaceholder', defaultMessage: 'Warehouse name' })} variant="secondary" />
                      {isWarehouseNameInvalid ? (
                        <FieldError>
                          {intl.formatMessage({ id: 'warehouse_form.errors.name_required', defaultMessage: 'Warehouse name is required.' })}
                        </FieldError>
                      ) : null}
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="address">
                  {(field) => (
                    <TextField fullWidth isRequired isDisabled={isSubmitting} isInvalid={isAddressInvalid} name="address" value={field.state.value} onChange={field.handleChange}>
                      <Label>{intl.formatMessage({ id: 'warehouseform_addresslabel', defaultMessage: 'Address' })}</Label>
                      <Input placeholder={intl.formatMessage({ id: 'warehouseform_addressplaceholder', defaultMessage: 'Warehouse address' })} variant="secondary" />
                      {isAddressInvalid ? (
                        <FieldError>
                          {intl.formatMessage({ id: 'warehouse_form.errors.address_required', defaultMessage: 'Warehouse address is required.' })}
                        </FieldError>
                      ) : null}
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="totalCapacity">
                  {(field) => (
                    <TextField fullWidth isDisabled={isSubmitting} isInvalid={isCapacityInvalid} name="totalCapacity" type="number" value={field.state.value} onChange={field.handleChange}>
                      <Label>{intl.formatMessage({ id: 'warehouseform_capacitylabel', defaultMessage: 'Total Capacity' })}</Label>
                      <Input placeholder={intl.formatMessage({ id: 'warehouseform_capacityplaceholder', defaultMessage: 'e.g. 1000' })} variant="secondary" />
                      {isCapacityInvalid ? (
                        <FieldError>
                          {intl.formatMessage({ id: 'warehouseform_errors_capacitynumber', defaultMessage: 'Total capacity must be a number.' })}
                        </FieldError>
                      ) : null}
                    </TextField>
                  )}
                </form.Field>
              </div>

              {isEdit ? (
                <p className="text-xs text-muted">
                  {intl.formatMessage({ id: 'warehouseform_readonlyidhint', defaultMessage: 'Warehouse code cannot be changed after creation.' })}
                </p>
              ) : null}

              {formError ? (
                <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p>
              ) : null}
            </div>
          </Card.Content>
          <Card.Footer>
            <div className="flex w-full justify-end gap-2">
              <Button variant="secondary" type="button" onPress={() => navigate('/warehouse')} isDisabled={isSubmitting}>
                {intl.formatMessage({ id: 'warehouseform_back', defaultMessage: 'Back' })}
              </Button>
              <Button variant="primary" type="submit" isDisabled={isSubmitting || isCapacityInvalid || !canSave}>
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

export default function WarehouseFormPage() {
  const intl = useIntl();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canCreate = hasPermission('warehouse_create');
  const canUpdate = hasPermission('warehouse_update');
  const canSave = isEdit ? canUpdate : canCreate;

  const { data: detailData, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['warehouseDetail', id],
    enabled: isEdit,
    queryFn: () => trpcClient.warehouse.warehouse.detail.query({ id: id ?? '' }),
  });

  if (isEdit && isLoadingDetail) {
    return <p className="text-sm text-muted">{intl.formatMessage({ id: 'warehouseform_loadingdetail', defaultMessage: 'Loading warehouse details...' })}</p>;
  }

  const initialValues = detailData ? transformDetailToFormValues(detailData) : defaultFormValues();
  const initialPhoto = detailData?.photo ?? undefined;

  return (
    <WarehouseFormContent
      initialValues={initialValues}
      initialPhoto={initialPhoto}
      isEdit={isEdit}
      canSave={canSave}
      warehouseId={id ?? undefined}
    />
  );
}
