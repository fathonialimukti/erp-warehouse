import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Button, Checkbox, FieldError, Input, Label, ListBox, Modal, NumberField, Select, TextArea, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { trpcClient } from '../../lib/trpc';
import { materialFormSchema, type MaterialFormValues } from '@repo/schemas/supplier';

type MaterialSku = {
  supplierId: string;
  skuId: string;
  supplierItemCode: string | null;
  unitPrice: number | null;
  leadTimeDays: number | null;
  minimumOrderQty: number | null;
  isPreferred: boolean;
  sku: {
    id: string;
    code: string | null;
    name: string;
    type: 'RAW_MATERIAL' | 'PACKAGING_MATERIAL';
    baseUnit: string;
    packageName: string;
    packagesPerPallet: number;
    quantityPerPackage: number;
    packageUnit: string;
  };
};

interface MaterialDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  supplierId: string;
  editingMaterial: MaterialSku | null;
}

const defaultFormValues = (): MaterialFormValues => ({
  code: '',
  name: '',
  type: 'RAW_MATERIAL',
  description: '',
  baseUnit: 'kg',
  packageName: 'carton',
  packagesPerPallet: 1,
  quantityPerPackage: 0,
  packageUnit: 'kg',
  length: undefined,
  width: undefined,
  height: undefined,
  maxWeight: undefined,
  supplierItemCode: '',
  unitPrice: undefined,
  leadTimeDays: undefined,
  minimumOrderQty: undefined,
  isPreferred: false,
});

const transformMaterialToFormValues = (material: MaterialSku): MaterialFormValues => ({
  code: material.sku.code ?? '',
  name: material.sku.name,
  type: material.sku.type,
  description: '',
  baseUnit: material.sku.baseUnit,
  packageName: material.sku.packageName,
  packagesPerPallet: material.sku.packagesPerPallet,
  quantityPerPackage: material.sku.quantityPerPackage,
  packageUnit: material.sku.packageUnit,
  length: undefined,
  width: undefined,
  height: undefined,
  maxWeight: undefined,
  supplierItemCode: material.supplierItemCode ?? '',
  unitPrice: material.unitPrice ?? undefined,
  leadTimeDays: material.leadTimeDays ?? undefined,
  minimumOrderQty: material.minimumOrderQty ?? undefined,
  isPreferred: material.isPreferred,
});

function MaterialDialog({ isOpen, onClose, onSaved, supplierId, editingMaterial }: MaterialDialogProps) {
  const intl = useIntl();
  const [formError, setFormError] = useState<string | null>(null);
  const isEdit = Boolean(editingMaterial);

  const initialValues = editingMaterial ? transformMaterialToFormValues(editingMaterial) : defaultFormValues();

  const addMutation = useMutation({
    mutationFn: (payload: MaterialFormValues) => trpcClient.supplier.addMaterial.mutate({
      supplierId,
      code: payload.code.trim(),
      name: payload.name.trim(),
      type: payload.type,
      description: payload.description?.trim() || undefined,
      baseUnit: payload.baseUnit?.trim() || 'kg',
      packageName: payload.packageName,
      packagesPerPallet: payload.packagesPerPallet,
      quantityPerPackage: payload.quantityPerPackage,
      packageUnit: payload.packageUnit,
      length: payload.length,
      width: payload.width,
      height: payload.height,
      maxWeight: payload.maxWeight,
      supplierItemCode: payload.supplierItemCode?.trim() || undefined,
      unitPrice: payload.unitPrice,
      leadTimeDays: payload.leadTimeDays,
      minimumOrderQty: payload.minimumOrderQty,
      isPreferred: payload.isPreferred,
    }),
    onSuccess: () => {
      onSaved();
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : intl.formatMessage({ id: 'material.form.errors.save_failed', defaultMessage: 'Failed to save material.' }));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: MaterialFormValues) => trpcClient.supplier.updateMaterial.mutate({
      supplierId,
      skuId: editingMaterial!.skuId,
      code: payload.code.trim(),
      name: payload.name.trim(),
      type: payload.type,
      description: payload.description?.trim() || undefined,
      baseUnit: payload.baseUnit?.trim() || 'kg',
      packageName: payload.packageName,
      packagesPerPallet: payload.packagesPerPallet,
      quantityPerPackage: payload.quantityPerPackage,
      packageUnit: payload.packageUnit,
      length: payload.length,
      width: payload.width,
      height: payload.height,
      maxWeight: payload.maxWeight,
      supplierItemCode: payload.supplierItemCode?.trim() || undefined,
      unitPrice: payload.unitPrice,
      leadTimeDays: payload.leadTimeDays,
      minimumOrderQty: payload.minimumOrderQty,
      isPreferred: payload.isPreferred,
    }),
    onSuccess: () => {
      onSaved();
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : intl.formatMessage({ id: 'material.form.errors.save_failed', defaultMessage: 'Failed to save material.' }));
    },
  });

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onChange: materialFormSchema,
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      if (isEdit) {
        updateMutation.mutate(value);
      } else {
        addMutation.mutate(value);
      }
    },
  });

  const isSubmitting = addMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (isOpen) {
      setFormError(null);
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Backdrop>
        <Modal.Container size="cover">
          <Modal.Dialog>
            <Modal.Header>
              <div className="flex w-full items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Icon icon={isEdit ? 'solar:pen-linear' : 'solar:box-minimalistic-linear'} className="size-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <Modal.Heading className="text-lg">
                    {isEdit
                      ? intl.formatMessage({ id: 'material.dialog.title_edit', defaultMessage: 'Edit Material' })
                      : intl.formatMessage({ id: 'material.dialog.title_add', defaultMessage: 'Add Material' })}
                  </Modal.Heading>
                  <p className="text-sm text-muted">
                    {isEdit
                      ? intl.formatMessage({ id: 'material.dialog.subtitle_edit', defaultMessage: 'Update material information' })
                      : intl.formatMessage({ id: 'material.dialog.subtitle_add', defaultMessage: 'Create a new material SKU' })}
                  </p>
                </div>
                <Modal.CloseTrigger isDisabled={isSubmitting} />
              </div>
            </Modal.Header>
            <Modal.Body>
              <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); void form.handleSubmit(); }}>
                {/* Basic Information Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:info-circle-linear" className="size-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">
                      {intl.formatMessage({ id: 'material.form.section_basic', defaultMessage: 'Basic Information' })}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <form.Field name="code">
                      {(field) => (
                        <TextField fullWidth isRequired isDisabled={isSubmitting} isInvalid={field.state.meta.errors.length > 0} value={field.state.value} onChange={field.handleChange}>
                          <Label>{intl.formatMessage({ id: 'material.form.code', defaultMessage: 'Code' })} <span className="text-danger">*</span></Label>
                          <Input placeholder="e.g. RM-001" variant="secondary" />
                          {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                        </TextField>
                      )}
                    </form.Field>

                    <form.Field name="name">
                      {(field) => (
                        <TextField fullWidth isRequired isDisabled={isSubmitting} isInvalid={field.state.meta.errors.length > 0} value={field.state.value} onChange={field.handleChange}>
                          <Label>{intl.formatMessage({ id: 'material.form.name', defaultMessage: 'Name' })} <span className="text-danger">*</span></Label>
                          <Input placeholder="Material name" variant="secondary" />
                          {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                        </TextField>
                      )}
                    </form.Field>

                    <form.Field name="type">
                      {(field) => (
                        <Select
                          fullWidth
                          isRequired
                          selectedKey={field.state.value}
                          onSelectionChange={(key) => {
                            if (key) {
                              field.handleChange(key as MaterialFormValues['type']);
                            }
                          }}
                        >
                          <Label>{intl.formatMessage({ id: 'material.form.type', defaultMessage: 'Type' })} <span className="text-danger">*</span></Label>
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              <ListBox.Item key="RAW_MATERIAL" id="RAW_MATERIAL" textValue="Raw Material">
                                <div className="flex items-center gap-2">
                                  <Icon icon="solar:box-linear" className="size-4" />
                                  {intl.formatMessage({ id: 'sku.type.raw_material', defaultMessage: 'Raw Material' })}
                                </div>
                              </ListBox.Item>
                              <ListBox.Item key="PACKAGING_MATERIAL" id="PACKAGING_MATERIAL" textValue="Packaging Material">
                                <div className="flex items-center gap-2">
                                  <Icon icon="solar:package-linear" className="size-4" />
                                  {intl.formatMessage({ id: 'sku.type.packaging_material', defaultMessage: 'Packaging Material' })}
                                </div>
                              </ListBox.Item>
                            </ListBox>
                          </Select.Popover>
                        </Select>
                      )}
                    </form.Field>

                    <form.Field name="baseUnit">
                      {(field) => (
                        <TextField fullWidth isRequired isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange}>
                          <Label>{intl.formatMessage({ id: 'material.form.base_unit', defaultMessage: 'Base Unit' })} <span className="text-danger">*</span></Label>
                          <Input placeholder="e.g. kg, pcs" variant="secondary" />
                        </TextField>
                      )}
                    </form.Field>
                  </div>
                </div>

                {/* Packaging Section */}
                <div className="space-y-4 rounded-xl border border-border/50 bg-default-50/50 p-4">
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:box-minimalistic-linear" className="size-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">
                      {intl.formatMessage({ id: 'material.form.section_packaging', defaultMessage: 'Packaging Configuration' })}
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <form.Field name="packageName">
                      {(field) => (
                        <TextField fullWidth isRequired isDisabled={isSubmitting} isInvalid={field.state.meta.errors.length > 0} value={field.state.value} onChange={field.handleChange}>
                          <Label>{intl.formatMessage({ id: 'material.form.package_name', defaultMessage: 'Package Name' })} <span className="text-danger">*</span></Label>
                          <Input placeholder="carton" variant="secondary" />
                          {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                        </TextField>
                      )}
                    </form.Field>

                    <form.Field name="packagesPerPallet">
                      {(field) => (
                        <NumberField fullWidth isRequired isDisabled={isSubmitting} isInvalid={field.state.meta.errors.length > 0} value={field.state.value} onChange={(v) => field.handleChange(v)} minValue={1}>
                          <Label>{intl.formatMessage({ id: 'material.form.packages_per_pallet', defaultMessage: 'Packages/Pallet' })} <span className="text-danger">*</span></Label>
                          <Input variant="secondary" />
                          {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                        </NumberField>
                      )}
                    </form.Field>

                    <form.Field name="quantityPerPackage">
                      {(field) => (
                        <NumberField fullWidth isRequired isDisabled={isSubmitting} isInvalid={field.state.meta.errors.length > 0} value={field.state.value} onChange={(v) => field.handleChange(v)} minValue={0}>
                          <Label>{intl.formatMessage({ id: 'material.form.quantity_per_package', defaultMessage: 'Qty/Package' })} <span className="text-danger">*</span></Label>
                          <Input variant="secondary" />
                          {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                        </NumberField>
                      )}
                    </form.Field>

                    <form.Field name="packageUnit">
                      {(field) => (
                        <TextField fullWidth isRequired isDisabled={isSubmitting} isInvalid={field.state.meta.errors.length > 0} value={field.state.value} onChange={field.handleChange}>
                          <Label>{intl.formatMessage({ id: 'material.form.package_unit', defaultMessage: 'Package Unit' })} <span className="text-danger">*</span></Label>
                          <Input placeholder="kg" variant="secondary" />
                          {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                        </TextField>
                      )}
                    </form.Field>
                  </div>
                </div>

                {/* Supplier Pricing Section */}
                <div className="space-y-4 rounded-xl border border-border/50 bg-default-50/50 p-4">
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:dollar-linear" className="size-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">
                      {intl.formatMessage({ id: 'material.form.pricing_section', defaultMessage: 'Supplier Pricing' })}
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <form.Field name="supplierItemCode">
                      {(field) => (
                        <TextField fullWidth isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange}>
                          <Label>{intl.formatMessage({ id: 'material.form.supplier_item_code', defaultMessage: 'Supplier Item Code' })}</Label>
                          <Input placeholder="e.g. ITEM-001" variant="secondary" />
                        </TextField>
                      )}
                    </form.Field>

                    <form.Field name="unitPrice">
                      {(field) => (
                        <NumberField fullWidth isDisabled={isSubmitting} value={field.state.value ?? undefined} onChange={(v) => field.handleChange(v)} minValue={0} formatOptions={{ style: 'currency', currency: 'IDR' }}>
                          <Label>{intl.formatMessage({ id: 'material.form.unit_price', defaultMessage: 'Unit Price' })}</Label>
                          <Input variant="secondary" />
                        </NumberField>
                      )}
                    </form.Field>

                    <form.Field name="leadTimeDays">
                      {(field) => (
                        <NumberField fullWidth isDisabled={isSubmitting} value={field.state.value ?? undefined} onChange={(v) => field.handleChange(v)} minValue={0}>
                          <Label>{intl.formatMessage({ id: 'material.form.lead_time_days', defaultMessage: 'Lead Time (days)' })}</Label>
                          <Input variant="secondary" />
                        </NumberField>
                      )}
                    </form.Field>

                    <form.Field name="minimumOrderQty">
                      {(field) => (
                        <NumberField fullWidth isDisabled={isSubmitting} value={field.state.value ?? undefined} onChange={(v) => field.handleChange(v)} minValue={0}>
                          <Label>{intl.formatMessage({ id: 'material.form.minimum_order_qty', defaultMessage: 'Min Order Qty' })}</Label>
                          <Input variant="secondary" />
                        </NumberField>
                      )}
                    </form.Field>
                  </div>

                  <form.Field name="isPreferred">
                    {(field) => (
                      <Checkbox
                        isSelected={field.state.value}
                        onChange={(value) => field.handleChange(value)}
                        isDisabled={isSubmitting}
                      >
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <Checkbox.Content>
                          <div className="flex items-center gap-2">
                            <Icon icon="solar:star-bold" className="size-4 text-warning" />
                            <Label className="font-medium">{intl.formatMessage({ id: 'material.form.is_preferred', defaultMessage: 'Mark as preferred supplier' })}</Label>
                          </div>
                        </Checkbox.Content>
                      </Checkbox>
                    )}
                  </form.Field>
                </div>

                {/* Description Section */}
                <form.Field name="description">
                  {(field) => (
                    <TextField fullWidth isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange}>
                      <Label>{intl.formatMessage({ id: 'material.form.description', defaultMessage: 'Description' })}</Label>
                      <TextArea placeholder="Add material description and notes" rows={3} variant="secondary" />
                    </TextField>
                  )}
                </form.Field>

                {formError ? (
                  <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                    <div className="flex items-start gap-2">
                      <Icon icon="solar:danger-triangle-linear" className="mt-0.5 size-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  </div>
                ) : null}
              </form>
            </Modal.Body>
            <Modal.Footer className="">
              <Button variant="secondary" onPress={onClose} isDisabled={isSubmitting}>
                <Icon icon="solar:close-circle-linear" className="size-4" />
                {intl.formatMessage({ id: 'material.form.cancel', defaultMessage: 'Cancel' })}
              </Button>
              <Button variant="primary" onPress={() => void form.handleSubmit()} isPending={isSubmitting}>
                {({ isPending }) => (
                  <>
                    <Icon icon={isPending ? 'solar:refresh-linear' : 'solar:diskette-linear'} className={`size-4 ${isPending ? 'animate-spin' : ''}`} />
                    {isEdit
                      ? intl.formatMessage({ id: 'material.form.submit_update', defaultMessage: 'Save Changes' })
                      : intl.formatMessage({ id: 'material.form.submit_add', defaultMessage: 'Add Material' })}
                  </>
                )}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export { MaterialDialog };
