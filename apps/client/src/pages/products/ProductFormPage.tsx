import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router';
import { useAtomValue } from 'jotai';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { Button, Card, FieldError, Input, Label, NumberField, TextArea, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { PageHeader } from '../../components/PageHeader';
import { hasPermissionAtom } from '../../lib/atoms';
import { trpcClient } from '../../lib/trpc';
import { ImageUploadField } from '../../components/ImageUploadField';
import { productFormSchema } from '@repo/schemas/product';
import { useAiFillForm } from '../../components/AiAssistant/useAiFillForm';
import { AiFillButton } from '../../components/AiFill/AiFillButton';
import { AiFillPanel } from '../../components/AiFill/AiFillPanel';
import type { ProductFormValues } from '@repo/schemas/product';

function ProductFormPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canCreate = hasPermission('product@create');
  const canUpdate = hasPermission('product@update');
  const canSave = isEdit ? canUpdate : canCreate;

  const [photo, setPhoto] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);

  const defaultValues: ProductFormValues = {
    code: '',
    name: '',
    description: '',
    baseUnit: 'pcs',
    packageName: 'carton',
    packagesPerPallet: 1,
    quantityPerPackage: 1,
    packageUnit: 'pcs',
    length: undefined,
    width: undefined,
    height: undefined,
    maxWeight: undefined,
  };

  const { data: product, isLoading } = useQuery({
    queryKey: ['productDetail', id],
    enabled: isEdit,
    queryFn: () => trpcClient.product.detail.query({ id: id! }),
  });

  const form = useForm({
    defaultValues: isEdit && product
      ? {
          code: product.code ?? '',
          name: product.name,
          description: product.description ?? '',
          baseUnit: product.baseUnit,
          packageName: product.packageName,
          packagesPerPallet: product.packagesPerPallet,
          quantityPerPackage: Number(product.quantityPerPackage),
          packageUnit: product.packageUnit,
          length: product.length ?? undefined,
          width: product.width ?? undefined,
          height: product.height ?? undefined,
          maxWeight: product.maxWeight != null ? Number(product.maxWeight) : undefined,
        }
      : defaultValues,
    validators: {
      onChange: productFormSchema,
    },
    onSubmit: async ({ value }) => {
      setFormError(null);

      if (!canSave) {
        setFormError(intl.formatMessage({ id: 'product.form.errors.no_permission', defaultMessage: 'You do not have permission to save this product.' }));
        return;
      }

      try {
        if (isEdit && product) {
          await trpcClient.product.update.mutate({
            currentId: product.id,
            code: value.code,
            name: value.name,
            description: value.description || undefined,
            baseUnit: value.baseUnit,
            packageName: value.packageName,
            packagesPerPallet: Number(value.packagesPerPallet),
            quantityPerPackage: Number(value.quantityPerPackage),
            packageUnit: value.packageUnit,
            length: value.length,
            width: value.width,
            height: value.height,
            maxWeight: value.maxWeight,
            photo: photo ?? product.photo ?? undefined,
          });
          queryClient.invalidateQueries({ queryKey: ['productList'] });
          queryClient.invalidateQueries({ queryKey: ['productDetail', product.id] });
          navigate(`/products/${product.id}`);
        } else {
          const result = await trpcClient.product.create.mutate({
            code: value.code,
            name: value.name,
            description: value.description || undefined,
            baseUnit: value.baseUnit,
            packageName: value.packageName,
            packagesPerPallet: Number(value.packagesPerPallet),
            quantityPerPackage: Number(value.quantityPerPackage),
            packageUnit: value.packageUnit,
            length: value.length,
            width: value.width,
            height: value.height,
            maxWeight: value.maxWeight,
            photo: photo ?? undefined,
          });
          queryClient.invalidateQueries({ queryKey: ['productList'] });
          navigate(`/products/${result.id}`);
        }
      } catch (error) {
        setFormError(
          error instanceof Error
            ? error.message
            : intl.formatMessage({ id: 'product.form.errors.save_failed', defaultMessage: 'Failed to save product.' })
        );
      }
    },
  });

  useAiFillForm({
    code: (v) => form.setFieldValue('code', String(v)),
    name: (v) => form.setFieldValue('name', String(v)),
    description: (v) => form.setFieldValue('description', String(v)),
    baseUnit: (v) => form.setFieldValue('baseUnit', String(v)),
  });

  if (isEdit && isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted">{intl.formatMessage({ id: 'common.loading', defaultMessage: 'Loading...' })}</p>
      </div>
    );
  }

  if (isEdit && !product) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-danger">{intl.formatMessage({ id: 'product.form.not_found', defaultMessage: 'Product not found.' })}</p>
        <Button onPress={() => navigate('/products')}>
          {intl.formatMessage({ id: 'product.form.back_to_list', defaultMessage: 'Back to Products' })}
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={intl.formatMessage({
          id: isEdit ? 'product.form.title_edit' : 'product.form.title_create',
          defaultMessage: isEdit ? 'Edit Product' : 'Add Product',
        })}
        onBack={() => navigate('/products')}
      >
        <AiFillButton />
      </PageHeader>

      <AiFillPanel />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="space-y-6"
      >
        <Card>
          <Card.Header>
            <div>
              <Card.Title>{intl.formatMessage({ id: 'product.form.section_info', defaultMessage: 'Product Information' })}</Card.Title>
              <Card.Description>
                {intl.formatMessage({ id: 'product.form.section_info_desc', defaultMessage: 'Basic product details and identification.' })}
              </Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="space-y-6">
              {/* Photo Upload */}
              <div className="space-y-2">
                <Label>{intl.formatMessage({ id: 'product.form.photo', defaultMessage: 'Product Photo' })}</Label>
                <ImageUploadField
                  value={photo ?? product?.photo ?? undefined}
                  onChange={(v) => setPhoto(v)}
                />
              </div>

              {/* Basic Info Grid */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <form.Field name="code">
                  {(field) => (
                    <TextField
                      isRequired
                      isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
                      value={field.state.value}
                      onChange={(v) => field.handleChange(v)}
                      onBlur={field.handleBlur}
                    >
                      <Label>{intl.formatMessage({ id: 'product.form.code', defaultMessage: 'Code' })}</Label>
                      <Input placeholder={intl.formatMessage({ id: 'product.form.code_placeholder', defaultMessage: 'e.g. PROD-001' })} />
                      {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                        <FieldError>{String(field.state.meta.errors[0]?.message ?? field.state.meta.errors[0])}</FieldError>
                      ) : null}
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="name">
                  {(field) => (
                    <TextField
                      isRequired
                      isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
                      value={field.state.value}
                      onChange={(v) => field.handleChange(v)}
                      onBlur={field.handleBlur}
                    >
                      <Label>{intl.formatMessage({ id: 'product.form.name', defaultMessage: 'Name' })}</Label>
                      <Input placeholder={intl.formatMessage({ id: 'product.form.name_placeholder', defaultMessage: 'Product name or SKU label' })} />
                      {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                        <FieldError>{String(field.state.meta.errors[0]?.message ?? field.state.meta.errors[0])}</FieldError>
                      ) : null}
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="description">
                  {(field) => (
                    <TextField
                      isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
                      value={field.state.value}
                      onChange={(v) => field.handleChange(v)}
                      onBlur={field.handleBlur}
                    >
                      <Label>{intl.formatMessage({ id: 'product.form.description', defaultMessage: 'Description' })}</Label>
                      <TextArea placeholder={intl.formatMessage({ id: 'product.form.description_placeholder', defaultMessage: 'Describe the product, usage, or handling note (optional)' })} />
                      {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                        <FieldError>{String(field.state.meta.errors[0]?.message ?? field.state.meta.errors[0])}</FieldError>
                      ) : null}
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="baseUnit">
                  {(field) => (
                    <TextField
                      isRequired
                      isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
                      value={field.state.value}
                      onChange={(v) => field.handleChange(v)}
                      onBlur={field.handleBlur}
                    >
                      <Label>{intl.formatMessage({ id: 'product.form.base_unit', defaultMessage: 'Base Unit' })}</Label>
                      <Input placeholder={intl.formatMessage({ id: 'product.form.base_unit_placeholder', defaultMessage: 'e.g. pcs, kg, liter' })} />
                      {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                        <FieldError>{String(field.state.meta.errors[0]?.message ?? field.state.meta.errors[0])}</FieldError>
                      ) : null}
                    </TextField>
                  )}
                </form.Field>
              </div>
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <div>
              <Card.Title>{intl.formatMessage({ id: 'product.form.section_packaging', defaultMessage: 'Packaging Configuration' })}</Card.Title>
              <Card.Description>
                {intl.formatMessage({ id: 'product.form.section_packaging_desc', defaultMessage: 'Define how this product is packaged and stored.' })}
              </Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <form.Field name="packageName">
                {(field) => (
                  <TextField
                    isRequired
                    isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
                    value={field.state.value}
                    onChange={(v) => field.handleChange(v)}
                    onBlur={field.handleBlur}
                  >
                    <Label>{intl.formatMessage({ id: 'product.form.package_name', defaultMessage: 'Package Name' })}</Label>
                    <Input placeholder={intl.formatMessage({ id: 'product.form.package_name_placeholder', defaultMessage: 'e.g. carton, box, pallet' })} />
                    {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                      <FieldError>{String(field.state.meta.errors[0]?.message ?? field.state.meta.errors[0])}</FieldError>
                    ) : null}
                  </TextField>
                )}
              </form.Field>

              <form.Field name="packagesPerPallet">
                {(field) => (
                  <NumberField
                    isRequired
                    isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
                    value={field.state.value}
                    onChange={(v) => field.handleChange(v)}
                    onBlur={field.handleBlur}
                    minValue={1}
                  >
                    <Label>{intl.formatMessage({ id: 'product.form.packages_per_pallet', defaultMessage: 'Packages per Pallet' })}</Label>
                    <Input />
                    {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                      <FieldError>{String(field.state.meta.errors[0]?.message ?? field.state.meta.errors[0])}</FieldError>
                    ) : null}
                  </NumberField>
                )}
              </form.Field>

              <form.Field name="quantityPerPackage">
                {(field) => (
                  <NumberField
                    isRequired
                    isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
                    value={field.state.value}
                    onChange={(v) => field.handleChange(v)}
                    onBlur={field.handleBlur}
                    minValue={1}
                  >
                    <Label>{intl.formatMessage({ id: 'product.form.quantity_per_package', defaultMessage: 'Quantity per Package' })}</Label>
                    <Input />
                    {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                      <FieldError>{String(field.state.meta.errors[0]?.message ?? field.state.meta.errors[0])}</FieldError>
                    ) : null}
                  </NumberField>
                )}
              </form.Field>

              <form.Field name="packageUnit">
                {(field) => (
                  <TextField
                    isRequired
                    isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
                    value={field.state.value}
                    onChange={(v) => field.handleChange(v)}
                    onBlur={field.handleBlur}
                  >
                    <Label>{intl.formatMessage({ id: 'product.form.package_unit', defaultMessage: 'Package Unit' })}</Label>
                    <Input placeholder="e.g. pcs, kg" />
                    {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                      <FieldError>{String(field.state.meta.errors[0]?.message ?? field.state.meta.errors[0])}</FieldError>
                    ) : null}
                  </TextField>
                )}
              </form.Field>
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <div>
              <Card.Title>{intl.formatMessage({ id: 'product.form.section_dimensions', defaultMessage: 'Dimensions & Weight' })}</Card.Title>
              <Card.Description>
                {intl.formatMessage({ id: 'product.form.section_dimensions_desc', defaultMessage: 'Physical dimensions for warehouse storage planning.' })}
              </Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <form.Field name="length">
                {(field) => (
                  <NumberField
                    isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
                    value={field.state.value ?? undefined}
                    onChange={(v) => field.handleChange(v)}
                    onBlur={field.handleBlur}
                    minValue={0}
                  >
                    <Label>{intl.formatMessage({ id: 'product.form.length', defaultMessage: 'Length (cm)' })}</Label>
                    <Input />
                    {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                      <FieldError>{String(field.state.meta.errors[0]?.message ?? field.state.meta.errors[0])}</FieldError>
                    ) : null}
                  </NumberField>
                )}
              </form.Field>

              <form.Field name="width">
                {(field) => (
                  <NumberField
                    isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
                    value={field.state.value ?? undefined}
                    onChange={(v) => field.handleChange(v)}
                    onBlur={field.handleBlur}
                    minValue={0}
                  >
                    <Label>{intl.formatMessage({ id: 'product.form.width', defaultMessage: 'Width (cm)' })}</Label>
                    <Input />
                    {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                      <FieldError>{String(field.state.meta.errors[0]?.message ?? field.state.meta.errors[0])}</FieldError>
                    ) : null}
                  </NumberField>
                )}
              </form.Field>

              <form.Field name="height">
                {(field) => (
                  <NumberField
                    isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
                    value={field.state.value ?? undefined}
                    onChange={(v) => field.handleChange(v)}
                    onBlur={field.handleBlur}
                    minValue={0}
                  >
                    <Label>{intl.formatMessage({ id: 'product.form.height', defaultMessage: 'Height (cm)' })}</Label>
                    <Input />
                    {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                      <FieldError>{String(field.state.meta.errors[0]?.message ?? field.state.meta.errors[0])}</FieldError>
                    ) : null}
                  </NumberField>
                )}
              </form.Field>

              <form.Field name="maxWeight">
                {(field) => (
                  <NumberField
                    isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
                    value={field.state.value ?? undefined}
                    onChange={(v) => field.handleChange(v)}
                    onBlur={field.handleBlur}
                    minValue={0}
                  >
                    <Label>{intl.formatMessage({ id: 'product.form.max_weight', defaultMessage: 'Max Weight (kg)' })}</Label>
                    <Input />
                    {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                      <FieldError>{String(field.state.meta.errors[0]?.message ?? field.state.meta.errors[0])}</FieldError>
                    ) : null}
                  </NumberField>
                )}
              </form.Field>
            </div>
          </Card.Content>
        </Card>

        {formError && (
          <Card className="border-danger bg-danger/10">
            <Card.Content>
              <div className="flex items-center gap-2 text-danger">
                <Icon icon="solar:danger-triangle-linear" className="size-5" />
                <p>{formError}</p>
              </div>
            </Card.Content>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onPress={() => navigate('/products')}>
            {intl.formatMessage({ id: 'product.form.cancel', defaultMessage: 'Cancel' })}
          </Button>
          <Button type="submit" isDisabled={!canSave || !form.state.isValid}>
            <Icon icon="solar:diskette-linear" className="size-4" />
            {intl.formatMessage({
              id: isEdit ? 'product.form.save_changes' : 'product.form.create_product',
              defaultMessage: isEdit ? 'Save Changes' : 'Create Product',
            })}
          </Button>
        </div>
      </form>
    </section>
  );
}

export { ProductFormPage };
