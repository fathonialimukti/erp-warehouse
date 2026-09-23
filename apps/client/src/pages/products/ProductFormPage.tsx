import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router';
import { useAtomValue } from 'jotai';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useStore } from '@tanstack/react-form';
import { Button, FieldError, Input, Label, NumberField, TextArea, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { hasPermissionAtom } from '../../lib/atoms';
import { computeMissingRequired, useRegisterPageForm } from '../../lib/ai/usePageContext';
import { trpcClient } from '../../lib/trpc';
import { ImageUploadField } from '../../components/ImageUploadField';
import { productFormSchema } from '@repo/schemas/product';
import { useAiFillForm } from '../../components/AiAssistant/useAiFillForm';
import { AiFillButton } from '../../components/AiFill/AiFillButton';
import { AiFillPanel } from '../../components/AiFill/AiFillPanel';
import type { ProductFormValues } from '@repo/schemas/product';
import { FormCanvas, FormMain, FormRail } from '../../components/form/FormCanvas';
import { FormHero } from '../../components/form/FormHero';
import { FormSection } from '../../components/form/FormSection';
import { FormPreviewCard } from '../../components/form/FormPreviewCard';
import { FormActionBar } from '../../components/form/FormActionBar';
import { FormAiTip } from '../../components/form/FormAiTip';

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

  const values = useStore(form.store, (state) => state.values);
  const hasCode = Boolean(values.code?.trim());
  const hasName = Boolean(values.name?.trim());
  const hasPackage = Boolean(values.packageName?.trim()) && Number(values.packagesPerPallet) > 0 && Number(values.quantityPerPackage) > 0 && Boolean(values.packageUnit?.trim());
  const dims = [values.length, values.width, values.height].filter((v) => v !== undefined && Number(v) > 0);

  // Photo lives in useState outside the TanStack form (base64 payload must
  // never reach the assistant) — publish only a presence flag.
  const pageFormValues = useMemo(() => ({ ...values, hasPhoto: Boolean(photo) }), [values, photo]);
  const missingRequired = useMemo(
    () => computeMissingRequired(pageFormValues, ['code', 'name', 'packageName', 'packagesPerPallet', 'quantityPerPackage', 'packageUnit']),
    [pageFormValues],
  );
  useRegisterPageForm('product-form', pageFormValues, missingRequired);

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
    <section
      className="space-y-6"
      data-ai-context={JSON.stringify({
        section: 'product-form',
        mode: isEdit ? 'edit' : 'create',
        productId: isEdit ? id : undefined,
        fields: ['code', 'name', 'description', 'baseUnit', 'packageName', 'packagesPerPallet', 'quantityPerPackage', 'packageUnit', 'length', 'width', 'height', 'maxWeight'],
      })}
    >
      <FormHero
        icon="solar:box-linear"
        title={intl.formatMessage({
          id: isEdit ? 'product.form.title_edit' : 'product.form.title_create',
          defaultMessage: isEdit ? 'Edit Product' : 'Add Product',
        })}
        description={intl.formatMessage({
          id: isEdit ? 'product.form.hero_edit_desc' : 'product.form.hero_create_desc',
          defaultMessage: isEdit ? 'Refine product identity, packaging, and storage dimensions.' : 'Define the product, how it is packaged, and how it stores on a pallet.',
        })}
        mode={isEdit ? 'edit' : 'create'}
        modeLabel={intl.formatMessage({ id: isEdit ? 'form.mode_edit' : 'form.mode_create', defaultMessage: isEdit ? 'Edit' : 'Create' })}
        onBack={() => navigate('/products')}
        backLabel={intl.formatMessage({ id: 'product.form.back_to_list', defaultMessage: 'Back to Products' })}
        chips={hasCode ? [{ icon: 'solar:database-linear', label: values.code }] : []}
        actions={<AiFillButton />}
      />

      <AiFillPanel />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="space-y-6"
      >
        <FormCanvas>
          <FormMain>
            <FormSection
              step={1}
              icon="solar:box-linear"
              title={intl.formatMessage({ id: 'product.form.section_info', defaultMessage: 'Product Information' })}
              description={intl.formatMessage({ id: 'product.form.section_info_desc', defaultMessage: 'Basic product details and identification.' })}
              filled={hasCode && hasName}
            >
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>{intl.formatMessage({ id: 'product.form.photo', defaultMessage: 'Product Photo' })}</Label>
                  <ImageUploadField
                    value={photo ?? product?.photo ?? undefined}
                    onChange={(v) => setPhoto(v)}
                  />
                </div>

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
            </FormSection>

            <FormSection
              step={2}
              icon="solar:package-linear"
              title={intl.formatMessage({ id: 'product.form.section_packaging', defaultMessage: 'Packaging Configuration' })}
              description={intl.formatMessage({ id: 'product.form.section_packaging_desc', defaultMessage: 'Define how this product is packaged and stored.' })}
              filled={hasPackage}
            >
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
            </FormSection>

            <FormSection
              step={3}
              icon="solar:layers-linear"
              title={intl.formatMessage({ id: 'product.form.section_dimensions', defaultMessage: 'Dimensions & Weight' })}
              description={intl.formatMessage({ id: 'product.form.section_dimensions_desc', defaultMessage: 'Physical dimensions for warehouse storage planning.' })}
              filled={dims.length > 0 || Number(values.maxWeight) > 0}
            >
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
            </FormSection>

            {formError && (
              <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:danger-triangle-linear" className="size-5" />
                  <p>{formError}</p>
                </div>
              </div>
            )}
          </FormMain>

          <FormRail>
            <FormPreviewCard
              title={intl.formatMessage({ id: 'product.form.preview_title', defaultMessage: 'Product Preview' })}
              icon="solar:box-linear"
              description={intl.formatMessage({ id: 'product.form.preview_desc', defaultMessage: 'Live summary of the product you are configuring.' })}
              fillLabel={intl.formatMessage({ id: 'form.preview_fill', defaultMessage: 'Completed' })}
              rows={[
                { label: intl.formatMessage({ id: 'product.form.code', defaultMessage: 'Code' }), value: values.code, icon: 'solar:database-linear' },
                { label: intl.formatMessage({ id: 'product.form.name', defaultMessage: 'Name' }), value: values.name, icon: 'solar:box-linear', tone: 'accent' },
                { label: intl.formatMessage({ id: 'product.form.base_unit', defaultMessage: 'Base Unit' }), value: values.baseUnit, icon: 'solar:layers-linear' },
                { label: intl.formatMessage({ id: 'product.form.preview_package', defaultMessage: 'Package' }), value: values.packageName?.trim() ? `${values.packageName} × ${values.quantityPerPackage} ${values.packageUnit}` : null, icon: 'solar:package-linear' },
                { label: intl.formatMessage({ id: 'product.form.preview_dimensions', defaultMessage: 'Dimensions' }), value: dims.length === 3 ? `${values.length}×${values.width}×${values.height} cm` : null, icon: 'solar:chart-2-linear' },
                { label: intl.formatMessage({ id: 'product.form.max_weight', defaultMessage: 'Max Weight (kg)' }), value: Number(values.maxWeight) > 0 ? values.maxWeight : null, icon: 'solar:graph-up-linear' },
              ]}
              footer={<FormAiTip />}
            />
          </FormRail>
        </FormCanvas>

        <FormActionBar
          onCancel={() => navigate('/products')}
          cancelLabel={intl.formatMessage({ id: 'product.form.cancel', defaultMessage: 'Cancel' })}
          submitLabel={intl.formatMessage({
            id: isEdit ? 'product.form.save_changes' : 'product.form.create_product',
            defaultMessage: isEdit ? 'Save Changes' : 'Create Product',
          })}
          submitIcon="solar:diskette-linear"
          isPending={form.state.isSubmitting}
          isDisabled={!canSave || !form.state.isValid}
          isDirty={isEdit && form.state.isDirty}
          showSavedState={isEdit}
        />
      </form>
    </section>
  );
}

export { ProductFormPage };
