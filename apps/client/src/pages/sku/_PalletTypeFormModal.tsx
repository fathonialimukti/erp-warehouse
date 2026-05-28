import { useEffect, useState, type FormEvent } from 'react';
import { useIntl } from 'react-intl';
import { Button, Chip, Fieldset, Form, Input, Label, Modal, TextArea, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';

type PalletTypeModalMode = 'create' | 'edit' | 'view';

type PalletTypeValue = {
  id: string;
  code?: string | null;
  objectId?: string | null;
  name: string;
  description: string | null;
  packageName: string;
  packagesPerPallet: number;
  quantityPerPackage: number | string;
  packageUnit: string;
  length: number | null;
  width: number | null;
  height: number | null;
  maxWeight: number | string | null;
};

interface PalletTypeFormModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  mode: PalletTypeModalMode;
  palletType: PalletTypeValue | null;
  onSubmit: (data: {
    code: string;
    objectId?: string;
    name: string;
    description: string;
    packageName: string;
    packagesPerPallet: number;
    quantityPerPackage: number;
    packageUnit: string;
    length: number | null;
    width: number | null;
    height: number | null;
    maxWeight: number | null;
  }) => Promise<void>;
  isSubmitting: boolean;
  feedbackMessage: string | null;
  feedbackTone: 'success' | 'danger';
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function PalletTypeFormModal({
  isOpen,
  onOpenChange,
  mode,
  palletType,
  onSubmit,
  isSubmitting,
  feedbackMessage,
  feedbackTone,
}: PalletTypeFormModalProps) {
  const intl = useIntl();

  const [code, setCode] = useState('');
  const [objectId, setObjectId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [packageName, setPackageName] = useState('carton');
  const [packagesPerPallet, setPackagesPerPallet] = useState('1');
  const [quantityPerPackage, setQuantityPerPackage] = useState('1');
  const [packageUnit, setPackageUnit] = useState('kg');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [maxWeight, setMaxWeight] = useState('');

  useEffect(() => {
    if (palletType) {
      setCode(palletType.code ?? palletType.id);
      setObjectId(palletType.objectId ?? '');
      setName(palletType.name);
      setDescription(palletType.description ?? '');
      setPackageName(palletType.packageName);
      setPackagesPerPallet(String(palletType.packagesPerPallet));
      setQuantityPerPackage(String(toNumber(palletType.quantityPerPackage) ?? 0));
      setPackageUnit(palletType.packageUnit);
      setLength(palletType.length ? String(palletType.length) : '');
      setWidth(palletType.width ? String(palletType.width) : '');
      setHeight(palletType.height ? String(palletType.height) : '');
      setMaxWeight(toNumber(palletType.maxWeight) ? String(palletType.maxWeight) : '');
    } else {
      setCode('');
      setObjectId('');
      setName('');
      setDescription('');
      setPackageName('carton');
      setPackagesPerPallet('1');
      setQuantityPerPackage('1');
      setPackageUnit('kg');
      setLength('');
      setWidth('');
      setHeight('');
      setMaxWeight('');
    }
  }, [palletType]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (mode === 'view') {
      return;
    }

    const parsedPackagesPerPallet = Number(packagesPerPallet);
    const parsedQuantityPerPackage = Number(quantityPerPackage);

    if (!code.trim() || !name.trim()) {
      return;
    }

    if (!Number.isInteger(parsedPackagesPerPallet) || parsedPackagesPerPallet <= 0) {
      return;
    }

    if (Number.isNaN(parsedQuantityPerPackage) || parsedQuantityPerPackage < 0) {
      return;
    }

    const parsedLength = length.trim() ? Number(length) : undefined;
    const parsedWidth = width.trim() ? Number(width) : undefined;
    const parsedHeight = height.trim() ? Number(height) : undefined;
    const parsedMaxWeight = maxWeight.trim() ? Number(maxWeight) : undefined;

    if (parsedLength !== undefined && (!Number.isInteger(parsedLength) || parsedLength < 0)) {
      return;
    }

    if (parsedWidth !== undefined && (!Number.isInteger(parsedWidth) || parsedWidth < 0)) {
      return;
    }

    if (parsedHeight !== undefined && (!Number.isInteger(parsedHeight) || parsedHeight < 0)) {
      return;
    }

    if (parsedMaxWeight !== undefined && (Number.isNaN(parsedMaxWeight) || parsedMaxWeight < 0)) {
      return;
    }

    await onSubmit({
      code: code.trim(),
      objectId: objectId.trim() || undefined,
      name: name.trim(),
      description: description.trim(),
      packageName: packageName.trim() || 'carton',
      packagesPerPallet: parsedPackagesPerPallet,
      quantityPerPackage: parsedQuantityPerPackage,
      packageUnit: packageUnit.trim() || 'kg',
      length: parsedLength ?? null,
      width: parsedWidth ?? null,
      height: parsedHeight ?? null,
      maxWeight: parsedMaxWeight ?? null,
    });
  };

  const isView = mode === 'view';
  const isEdit = mode === 'edit';
  const isDisabled = isSubmitting || isView;
  const modeChipIcon = isView ? 'solar:eye-linear' : isEdit ? 'solar:pen-linear' : 'solar:add-circle-linear';
  const modeChipLabel = isView
    ? intl.formatMessage({ id: 'sku.detail.modal_mode_view', defaultMessage: 'View Mode' })
    : isEdit
      ? intl.formatMessage({ id: 'sku.detail.modal_mode_edit', defaultMessage: 'Edit Mode' })
      : intl.formatMessage({ id: 'sku.detail.modal_mode_create', defaultMessage: 'Create Mode' });
  const dialogTitle = isView
    ? intl.formatMessage({ id: 'sku.detail.modal_title_view', defaultMessage: 'View Pallet Type' })
    : isEdit
      ? intl.formatMessage({ id: 'sku.detail.modal_title_edit', defaultMessage: 'Edit Pallet Type' })
      : intl.formatMessage({ id: 'sku.detail.modal_title_create', defaultMessage: 'Add Pallet Type' });
  const dialogDescription = isView
    ? intl.formatMessage({
      id: 'sku.detail.modal_description_view',
      defaultMessage: 'Review pallet type details used by operations, storage planning, and handling workflows.',
    })
    : isEdit
      ? intl.formatMessage({
        id: 'sku.detail.modal_description_edit',
        defaultMessage: 'Update the pallet profile used by operations, storage planning, and handling workflows.',
      })
      : intl.formatMessage({
        id: 'sku.detail.modal_description_create',
        defaultMessage: 'Create a pallet profile with packaging conversion and physical handling limits.',
      });

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <Modal.Container scroll="outside">
          <Modal.Dialog className="sm:max-w-3xl">
            <Modal.Header>
              <div className="flex w-full flex-col gap-4 border-b border-border/60 pb-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <Chip size="sm" variant="soft" color="accent" className="w-fit">
                    <Icon icon={modeChipIcon} className="size-4" />
                    {modeChipLabel}
                  </Chip>
                  <div>
                    <Modal.Heading>{dialogTitle}</Modal.Heading>
                    <p className="mt-1 text-sm leading-6 text-muted">{dialogDescription}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Chip size="sm" variant="secondary" color="accent">
                    {intl.formatMessage({ id: 'sku.detail.modal_code_chip', defaultMessage: 'Code {code}' }, { code: code || '-' })}
                  </Chip>
                </div>
              </div>
            </Modal.Header>

            <Modal.Body className="space-y-4 pt-1">
              <Form className="space-y-4" onSubmit={handleSubmit}>
                <Fieldset className="rounded-2xl border border-border/60 bg-surface px-4 py-4 sm:px-5">
                  <Fieldset.Legend className="text-sm font-semibold text-foreground">
                    {intl.formatMessage({ id: 'sku.detail.modal.section_identity', defaultMessage: 'Identity & Notes' })}
                  </Fieldset.Legend>
                  <p className="text-sm leading-6 text-muted">
                    {intl.formatMessage({
                      id: 'sku.detail.modal.section_identity_description',
                      defaultMessage: 'Maintain the pallet code, working name, and internal note used by operators and master data teams.',
                    })}
                  </p>
                  <Fieldset.Group className="grid gap-4 md:grid-cols-2">
                    <TextField isRequired>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.label_code', defaultMessage: 'Pallet Type Code' })}</Label>
                      <Input
                        placeholder={intl.formatMessage({ id: 'sku.detail.modal.placeholder_code', defaultMessage: 'Example: PT-A' })}
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        variant="secondary"
                        disabled={isDisabled}
                      />
                    </TextField>
                    <TextField>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.label_object_id', defaultMessage: 'Object ID' })}</Label>
                      <Input
                        placeholder={intl.formatMessage({ id: 'sku.detail.modal.placeholder_object_id', defaultMessage: 'External object ID' })}
                        value={objectId}
                        onChange={(event) => setObjectId(event.target.value)}
                        variant="secondary"
                        disabled={isDisabled}
                      />
                    </TextField>
                    <TextField isRequired>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.label_name', defaultMessage: 'Pallet Type Name' })}</Label>
                      <Input
                        placeholder={intl.formatMessage({ id: 'sku.detail.modal.placeholder_name', defaultMessage: 'Example: Pallet A' })}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        variant="secondary"
                        disabled={isDisabled}
                      />
                    </TextField>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="pallet-type-description">{intl.formatMessage({ id: 'sku.detail.modal.label_description', defaultMessage: 'Description' })}</Label>
                      <TextArea
                        id="pallet-type-description"
                        placeholder={intl.formatMessage({ id: 'sku.detail.modal.placeholder_description', defaultMessage: 'Example: For 6 cartons, 25 kg per carton' })}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        variant="secondary"
                        rows={3}
                        fullWidth
                        disabled={isDisabled}
                      />
                    </div>
                  </Fieldset.Group>
                </Fieldset>

                <Fieldset className="rounded-2xl border border-border/60 bg-surface px-4 py-4 sm:px-5">
                  <Fieldset.Legend className="text-sm font-semibold text-foreground">
                    {intl.formatMessage({ id: 'sku.detail.modal.section_packaging', defaultMessage: 'Packaging Rules' })}
                  </Fieldset.Legend>
                  <p className="text-sm leading-6 text-muted">
                    {intl.formatMessage({
                      id: 'sku.detail.modal.section_packaging_description',
                      defaultMessage: 'Define the package naming and numeric conversion used to calculate the pallet total.',
                    })}
                  </p>
                  <Fieldset.Group className="grid gap-4 md:grid-cols-2">
                    <TextField>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.label_package_name', defaultMessage: 'Package Name' })}</Label>
                      <Input
                        placeholder={intl.formatMessage({ id: 'sku.detail.modal.placeholder_package_name', defaultMessage: 'carton' })}
                        value={packageName}
                        onChange={(event) => setPackageName(event.target.value)}
                        variant="secondary"
                        disabled={isDisabled}
                      />
                    </TextField>
                    <TextField>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.label_package_unit', defaultMessage: 'Package Unit' })}</Label>
                      <Input
                        placeholder={intl.formatMessage({ id: 'sku.detail.modal.placeholder_package_unit', defaultMessage: 'kg' })}
                        value={packageUnit}
                        onChange={(event) => setPackageUnit(event.target.value)}
                        variant="secondary"
                        disabled={isDisabled}
                      />
                    </TextField>
                    <TextField isRequired>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.label_packages_per_pallet', defaultMessage: 'Packages per Pallet' })}</Label>
                      <Input
                        type="number"
                        value={packagesPerPallet}
                        onChange={(event) => setPackagesPerPallet(event.target.value)}
                        variant="secondary"
                        disabled={isDisabled}
                      />
                    </TextField>
                    <TextField isRequired>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.label_quantity_per_package', defaultMessage: 'Quantity per Package' })}</Label>
                      <Input
                        type="number"
                        value={quantityPerPackage}
                        onChange={(event) => setQuantityPerPackage(event.target.value)}
                        variant="secondary"
                        disabled={isDisabled}
                      />
                    </TextField>
                  </Fieldset.Group>
                </Fieldset>

                <Fieldset className="rounded-2xl border border-border/60 bg-surface px-4 py-4 sm:px-5">
                  <Fieldset.Legend className="text-sm font-semibold text-foreground">
                    {intl.formatMessage({ id: 'sku.detail.modal.section_dimensions', defaultMessage: 'Physical Limits' })}
                  </Fieldset.Legend>
                  <p className="text-sm leading-6 text-muted">
                    {intl.formatMessage({
                      id: 'sku.detail.modal.section_dimensions_description',
                      defaultMessage: 'Optional limits for footprint and safe handling. Leave blank when not yet defined.',
                    })}
                  </p>
                  <Fieldset.Group className="grid gap-4 md:grid-cols-2">
                    <TextField>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.label_length', defaultMessage: 'Length' })}</Label>
                      <Input
                        type="number"
                        value={length}
                        onChange={(event) => setLength(event.target.value)}
                        variant="secondary"
                        disabled={isDisabled}
                      />
                    </TextField>
                    <TextField>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.label_width', defaultMessage: 'Width' })}</Label>
                      <Input
                        type="number"
                        value={width}
                        onChange={(event) => setWidth(event.target.value)}
                        variant="secondary"
                        disabled={isDisabled}
                      />
                    </TextField>
                    <TextField>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.label_height', defaultMessage: 'Height' })}</Label>
                      <Input
                        type="number"
                        value={height}
                        onChange={(event) => setHeight(event.target.value)}
                        variant="secondary"
                        disabled={isDisabled}
                      />
                    </TextField>
                    <TextField>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.label_max_weight', defaultMessage: 'Max Weight' })}</Label>
                      <Input
                        type="number"
                        value={maxWeight}
                        onChange={(event) => setMaxWeight(event.target.value)}
                        variant="secondary"
                        disabled={isDisabled}
                      />
                    </TextField>
                  </Fieldset.Group>
                </Fieldset>

                {feedbackMessage && (
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm ${feedbackTone === 'success'
                        ? 'border-success/30 bg-success/10 text-success'
                        : 'border-danger/30 bg-danger/10 text-danger'
                      }`}
                  >
                    <div className="flex items-start gap-2">
                      <Icon icon={feedbackTone === 'success' ? 'solar:check-circle-linear' : 'solar:danger-triangle-linear'} className="mt-0.5 size-4 shrink-0" />
                      <span>{feedbackMessage}</span>
                    </div>
                  </div>
                )}
               <div className="flex justify-end gap-2">
                 <Button type="button" variant="ghost" onPress={() => onOpenChange(false)} isDisabled={isSubmitting}>
                  {isView
                    ? intl.formatMessage({ id: 'sku.detail.modal.close', defaultMessage: 'Close' })
                    : intl.formatMessage({ id: 'sku.detail.modal.cancel', defaultMessage: 'Cancel' })}
                </Button>
                {!isView ? (
                  <Button type="submit" variant="secondary" isPending={isSubmitting}>
                    {({ isPending }) => (
                      <>
                        <Icon icon={isPending ? 'solar:refresh-linear' : isEdit ? 'solar:diskette-linear' : 'solar:add-circle-linear'} className={`size-4 ${isPending ? 'animate-spin' : ''}`} />
                        {isPending
                          ? intl.formatMessage({ id: 'sku.detail.modal.saving', defaultMessage: 'Saving...' })
                          : isEdit
                            ? intl.formatMessage({ id: 'sku.detail.modal.submit_update', defaultMessage: 'Save Changes' })
                            : intl.formatMessage({ id: 'sku.detail.modal.submit_create', defaultMessage: 'Add Pallet Type' })}
                      </>
                    )}
                  </Button>
                ) : null}
                </div>
              </Form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export { PalletTypeFormModal };
