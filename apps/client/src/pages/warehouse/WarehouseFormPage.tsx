import { useAtomValue } from 'jotai';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, FieldError, Input, Label, Modal, Spinner, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useStore } from '@tanstack/react-form';
import type { inferProcedureInput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../lib/trpc';
import { ImageUploadField } from '../../components/ImageUploadField';
import { hasPermissionAtom } from '../../lib/atoms';
import { computeMissingRequired, useRegisterPageForm } from '../../lib/ai/usePageContext';
import { useAiFillForm } from '../../components/AiAssistant/useAiFillForm';
import { AiFillButton } from '../../components/AiFill/AiFillButton';
import { AiFillPanel } from '../../components/AiFill/AiFillPanel';
import { trpcClient } from '../../lib/trpc';
import { createWarehouseFormSchema } from '@repo/schemas/warehouse';
import { FormCanvas, FormMain, FormRail } from '../../components/form/FormCanvas';
import { FormHero } from '../../components/form/FormHero';
import { FormSection } from '../../components/form/FormSection';
import { FormPreviewCard } from '../../components/form/FormPreviewCard';
import { FormActionBar } from '../../components/form/FormActionBar';
import { FormAiTip } from '../../components/form/FormAiTip';

type WarehouseFormValues = {
  warehouseId: string;
  objectId: string;
  warehouseName: string;
  address: string;
  totalCapacity: string;
};

type WarehouseDetail = {
  id: string;
  code?: string | null;
  objectId?: string | null;
  name: string;
  address: string;
  totalCapacity: number | null;
  photo?: string | null;
};

const defaultFormValues = (): WarehouseFormValues => ({
  warehouseId: '',
  objectId: '',
  warehouseName: '',
  address: '',
  totalCapacity: '',
});

const transformDetailToFormValues = (detail: WarehouseDetail): WarehouseFormValues => ({
  warehouseId: detail.code ?? detail.id,
  objectId: detail.objectId ?? '',
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
  const [modalStage, setModalStage] = useState<'idle' | 'confirm-save' | 'loading' | 'success' | 'error'>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const successRedirectIdRef = useRef<string | null>(null);
  const resultTimerRef = useRef<number | null>(null);

  const clearResultTimer = () => {
    if (resultTimerRef.current !== null) {
      window.clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
  };

  const handleModalClose = () => {
    if (modalStage === 'loading') return;

    clearResultTimer();
    const redirectId = successRedirectIdRef.current;
    successRedirectIdRef.current = null;
    setModalStage('idle');

    if (redirectId) {
      navigate(`/warehouse/${redirectId}`);
    }
  };

  const handleActionConfirm = async () => {
    setFormError(null);
    setResultMessage('');

    if (!canSave) {
      const message = intl.formatMessage({ id: 'warehouse.form.errors.no_permission', defaultMessage: 'You do not have permission to save this warehouse.' });
      setFormError(message);
      setResultMessage(message);
      setModalStage('error');
      return;
    }

    await form.validateAllFields('change');
    if (!form.state.isFieldsValid) return;

    setModalStage('confirm-save');
  };

  const handleConfirmSubmit = () => {
    setModalStage('loading');
    void form.handleSubmit();
  };

  useEffect(() => () => clearResultTimer(), []);

  useEffect(() => {
    setPhoto(initialPhoto);
  }, [initialPhoto]);

  const createMutation = useMutation<{ id: string }, unknown, inferProcedureInput<AppRouter['warehouse']['warehouse']['create']>>({
    mutationFn: (payload) => trpcClient.warehouse.warehouse.create.mutate(payload),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['warehouseList'] });
      queryClient.removeQueries({ queryKey: ['warehouseDetail', created.id] });
      successRedirectIdRef.current = created.id;
      setResultMessage(intl.formatMessage({ id: 'warehouse.form.success.created', defaultMessage: 'Warehouse created successfully.' }));
      setModalStage('success');
      clearResultTimer();
      resultTimerRef.current = window.setTimeout(() => {
        setModalStage('idle');
        navigate(`/warehouse/${created.id}`);
      }, 1500);
    },
    onError: (err) => {
      setResultMessage(err instanceof Error ? err.message : intl.formatMessage({ id: 'warehouse.form.errors.save_failed', defaultMessage: 'Failed to save warehouse.' }));
      setModalStage('error');
    },
  });

  const updateMutation = useMutation<{ id: string }, unknown, inferProcedureInput<AppRouter['warehouse']['warehouse']['update']>>({
    mutationFn: (payload) => trpcClient.warehouse.warehouse.update.mutate(payload),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ['warehouseList'] });
      if (warehouseId) {
        queryClient.removeQueries({ queryKey: ['warehouseDetail', warehouseId] });
      }
      queryClient.removeQueries({ queryKey: ['warehouseDetail', updated.id] });
      successRedirectIdRef.current = updated.id;
      setResultMessage(intl.formatMessage({ id: 'warehouse.form.success.updated', defaultMessage: 'Warehouse updated successfully.' }));
      setModalStage('success');
      clearResultTimer();
      resultTimerRef.current = window.setTimeout(() => {
        setModalStage('idle');
        navigate(`/warehouse/${updated.id}`);
      }, 1500);
    },
    onError: (err) => {
      setResultMessage(err instanceof Error ? err.message : intl.formatMessage({ id: 'warehouse.form.errors.save_failed', defaultMessage: 'Failed to save warehouse.' }));
      setModalStage('error');
    },
  });

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onChange: createWarehouseFormSchema,
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      setResultMessage('');

      if (!canSave) {
        const message = intl.formatMessage({ id: 'warehouse.form.errors.no_permission', defaultMessage: 'You do not have permission to save this warehouse.' });
        setFormError(message);
        setResultMessage(message);
        setModalStage('error');
        return;
      }

      const capacity = value.totalCapacity.trim() ? Number(value.totalCapacity) : undefined;

      try {
        if (isEdit && warehouseId) {
          await updateMutation.mutateAsync({
            currentId: warehouseId,
            code: value.warehouseId.trim(),
            objectId: value.objectId.trim() || undefined,
            name: value.warehouseName.trim(),
            address: value.address.trim(),
            totalCapacity: capacity,
            photo,
          });
        } else {
          await createMutation.mutateAsync({
            code: value.warehouseId.trim(),
            objectId: value.objectId.trim() || undefined,
            name: value.warehouseName.trim(),
            address: value.address.trim(),
            totalCapacity: capacity,
            photo,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : intl.formatMessage({ id: 'warehouse.form.errors.save_failed', defaultMessage: 'Failed to save warehouse.' });
        setFormError(message);
        setResultMessage(message);
        setModalStage('error');
      }
    },
  });

  const isSubmitting = modalStage === 'loading' || createMutation.isPending || updateMutation.isPending;

  const values = useStore(form.store, (state) => state.values);
  const hasCode = Boolean(values.warehouseId?.trim());
  const hasName = Boolean(values.warehouseName?.trim());
  const hasAddress = Boolean(values.address?.trim());

  // Photo lives in useState outside the TanStack form (base64 payload must
  // never reach the assistant) — publish only a presence flag.
  const pageFormValues = useMemo(() => ({ ...values, hasPhoto: Boolean(photo) }), [values, photo]);
  const missingRequired = useMemo(
    () => computeMissingRequired(pageFormValues, ['warehouseId', 'warehouseName', 'address']),
    [pageFormValues],
  );
  useRegisterPageForm('warehouse-form', pageFormValues, missingRequired);

  useAiFillForm({
    warehouseId:    (v) => form.setFieldValue('warehouseId', String(v)),
    objectId:       (v) => form.setFieldValue('objectId', String(v)),
    warehouseName:  (v) => form.setFieldValue('warehouseName', String(v)),
    address:        (v) => form.setFieldValue('address', String(v)),
    totalCapacity:  (v) => form.setFieldValue('totalCapacity', String(v)),
  }, {
    aliases: {
      warehouseCode: 'warehouseId',
      warehouse_code: 'warehouseId',
      code: 'warehouseId',
      name: 'warehouseName',
      capacity: 'totalCapacity',
    },
  });

  return (
    <section
      className="space-y-6"
      data-ai-context={JSON.stringify({
        section: 'warehouse-form',
        mode: isEdit ? 'edit' : 'create',
        warehouseId: isEdit ? warehouseId : undefined,
        fields: ['warehouseId', 'objectId', 'warehouseName', 'address', 'totalCapacity'],
      })}
    >
      <FormHero
        icon="solar:buildings-linear"
        title={isEdit
          ? intl.formatMessage({ id: 'warehouseform_titleedit', defaultMessage: 'Edit Warehouse' })
          : intl.formatMessage({ id: 'warehouseform_titlecreate', defaultMessage: 'Create Warehouse' })}
        description={isEdit
          ? intl.formatMessage({ id: 'warehouseform_descriptionedit', defaultMessage: 'Update warehouse details.' })
          : intl.formatMessage({ id: 'warehouseform_descriptioncreate', defaultMessage: 'Enter details for a new warehouse.' })}
        mode={isEdit ? 'edit' : 'create'}
        modeLabel={intl.formatMessage({ id: isEdit ? 'form.mode_edit' : 'form.mode_create', defaultMessage: isEdit ? 'Edit' : 'Create' })}
        onBack={() => navigate('/warehouse')}
        backLabel={intl.formatMessage({ id: 'warehouseform_back', defaultMessage: 'Back' })}
        chips={isEdit && values.warehouseId?.trim() ? [{ icon: 'solar:database-linear', label: values.warehouseId.trim() }] : []}
        actions={<AiFillButton />}
      />

      <AiFillPanel />

      <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); handleActionConfirm(); }}>
        <FormCanvas>
          <FormMain>
            <FormSection
              step={1}
              icon="solar:camera-linear"
              title={intl.formatMessage({ id: 'warehouseform_sectiontitle', defaultMessage: 'Warehouse Information' })}
              description={intl.formatMessage({ id: 'warehouse.form.section_identity_desc', defaultMessage: 'A recognizable photo plus the code and name teams use every day.' })}
              filled={hasCode && hasName}
            >
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
                      <TextField fullWidth isRequired isDisabled={isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="warehouseId" value={field.state.value} onChange={field.handleChange}>
                        <Label>{intl.formatMessage({ id: 'warehouseform_codelabel', defaultMessage: 'Warehouse Code' })}</Label>
                        <Input placeholder={intl.formatMessage({ id: 'warehouseform_codeplaceholder', defaultMessage: 'Warehouse code (e.g. WH001)' })} variant="secondary" />
                        {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                      </TextField>
                    )}
                  </form.Field>

                  <form.Field name="warehouseName">
                    {(field) => (
                      <TextField fullWidth isRequired isDisabled={isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="warehouseName" value={field.state.value} onChange={field.handleChange}>
                        <Label>{intl.formatMessage({ id: 'warehouseform_namelabel', defaultMessage: 'Warehouse Name' })}</Label>
                        <Input placeholder={intl.formatMessage({ id: 'warehouseform_nameplaceholder', defaultMessage: 'Warehouse name' })} variant="secondary" />
                        {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                      </TextField>
                    )}
                  </form.Field>
                </div>
              </div>
            </FormSection>

            <FormSection
              step={2}
              icon="solar:map-point-linear"
              title={intl.formatMessage({ id: 'warehouse.form.section_location_title', defaultMessage: 'Location & Capacity' })}
              description={intl.formatMessage({ id: 'warehouse.form.section_location_desc', defaultMessage: 'Where the facility is and how much it can hold.' })}
              filled={hasAddress}
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <form.Field name="objectId">
                  {(field) => (
                    <TextField fullWidth isDisabled={isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="objectId" value={field.state.value} onChange={field.handleChange}>
                      <Label>{intl.formatMessage({ id: 'warehouseform_objectidlabel', defaultMessage: 'Object ID' })}</Label>
                      <Input placeholder={intl.formatMessage({ id: 'warehouseform_objectidplaceholder', defaultMessage: 'External object ID' })} variant="secondary" />
                      {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="address">
                  {(field) => (
                    <TextField fullWidth isRequired isDisabled={isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="address" value={field.state.value} onChange={field.handleChange}>
                      <Label>{intl.formatMessage({ id: 'warehouseform_addresslabel', defaultMessage: 'Address' })}</Label>
                      <Input placeholder={intl.formatMessage({ id: 'warehouseform_addressplaceholder', defaultMessage: 'Warehouse address' })} variant="secondary" />
                      {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="totalCapacity">
                  {(field) => (
                    <TextField fullWidth isDisabled={isSubmitting} isInvalid={field.state.meta.errors.length > 0} name="totalCapacity" type="number" value={field.state.value} onChange={field.handleChange}>
                      <Label>{intl.formatMessage({ id: 'warehouseform_capacitylabel', defaultMessage: 'Total Capacity' })}</Label>
                      <Input placeholder={intl.formatMessage({ id: 'warehouseform_capacityplaceholder', defaultMessage: 'e.g. 1000' })} variant="secondary" />
                      {field.state.meta.errors.length > 0 ? <FieldError>{field.state.meta.errors.join(', ')}</FieldError> : null}
                    </TextField>
                  )}
                </form.Field>
              </div>
            </FormSection>

            {formError ? (
              <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p>
            ) : null}
          </FormMain>

          <FormRail>
            <FormPreviewCard
              title={intl.formatMessage({ id: 'warehouse.form.preview_title', defaultMessage: 'Warehouse Preview' })}
              icon="solar:buildings-linear"
              description={intl.formatMessage({ id: 'warehouse.form.preview_desc', defaultMessage: 'Live summary of the facility you are building.' })}
              fillLabel={intl.formatMessage({ id: 'form.preview_fill', defaultMessage: 'Completed' })}
              rows={[
                { label: intl.formatMessage({ id: 'warehouseform_codelabel', defaultMessage: 'Warehouse Code' }), value: values.warehouseId, icon: 'solar:database-linear' },
                { label: intl.formatMessage({ id: 'warehouseform_namelabel', defaultMessage: 'Warehouse Name' }), value: values.warehouseName, icon: 'solar:buildings-linear', tone: 'accent' },
                { label: intl.formatMessage({ id: 'warehouseform_objectidlabel', defaultMessage: 'Object ID' }), value: values.objectId, icon: 'solar:code-bold' },
                { label: intl.formatMessage({ id: 'warehouseform_addresslabel', defaultMessage: 'Address' }), value: values.address, icon: 'solar:map-point-linear' },
                { label: intl.formatMessage({ id: 'warehouseform_capacitylabel', defaultMessage: 'Total Capacity' }), value: values.totalCapacity, icon: 'solar:layers-linear' },
                { label: intl.formatMessage({ id: 'warehouse_form.photo_preview', defaultMessage: 'Photo' }), value: photo ? intl.formatMessage({ id: 'warehouse_form.photo_attached', defaultMessage: 'Attached' }) : null, icon: 'solar:camera-linear', tone: 'success' },
              ]}
              footer={<FormAiTip />}
            />
          </FormRail>
        </FormCanvas>

        <FormActionBar
          onCancel={() => navigate('/warehouse')}
          cancelLabel={intl.formatMessage({ id: 'warehouseform_back', defaultMessage: 'Back' })}
          submitLabel={isEdit
            ? intl.formatMessage({ id: 'warehouseform_submitupdate', defaultMessage: 'Save Changes' })
            : intl.formatMessage({ id: 'warehouseform_submitcreate', defaultMessage: 'Create Warehouse' })}
          submitIcon="solar:save-linear"
          isPending={isSubmitting}
          isDisabled={!canSave}
          isDirty={isEdit && form.state.isDirty}
          showSavedState={isEdit}
        />
      </form>

      <Modal onOpenChange={(open) => { if (!open) handleModalClose(); }}>
        <Modal.Backdrop
          isOpen={modalStage !== 'idle'}
          isDismissable={modalStage !== 'loading'}
          isKeyboardDismissDisabled={modalStage === 'loading'}
          aria-label={intl.formatMessage({ id: 'modal_close', defaultMessage: 'Close modal' })}
        >
          <Modal.Container size="sm">
            <Modal.Dialog>
              {modalStage === 'loading' ? (
                <>
                  <Modal.Header>
                    <Modal.Heading>{intl.formatMessage({ id: 'warehouse.form.modal.saving_title', defaultMessage: 'Saving warehouse' })}</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body className="flex flex-col items-center gap-4 py-8">
                    <Spinner size="lg" />
                    <p className="text-sm text-muted">{intl.formatMessage({ id: 'warehouse.form.modal.please_wait', defaultMessage: 'Please wait…' })}</p>
                  </Modal.Body>
                </>
              ) : modalStage === 'success' ? (
                <>
                  <Modal.Header>
                    <Modal.Icon>
                      <Icon icon="solar:check-circle-bold" className="size-12 text-success" />
                    </Modal.Icon>
                    <Modal.Heading>{intl.formatMessage({ id: 'warehouse.form.modal.success_title', defaultMessage: 'Success' })}</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <p className="text-center text-sm text-muted">{resultMessage}</p>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button onPress={handleModalClose}>{intl.formatMessage({ id: 'warehouse.form.modal.close', defaultMessage: 'Close' })}</Button>
                  </Modal.Footer>
                </>
              ) : modalStage === 'error' ? (
                <>
                  <Modal.Header>
                    <Modal.Icon>
                      <Icon icon="solar:close-circle-bold" className="size-12 text-danger" />
                    </Modal.Icon>
                    <Modal.Heading>{intl.formatMessage({ id: 'warehouse.form.modal.error_title', defaultMessage: 'Unable to save warehouse' })}</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <p className="text-center text-sm text-muted">{resultMessage}</p>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button onPress={handleModalClose}>{intl.formatMessage({ id: 'warehouse.form.modal.close', defaultMessage: 'Close' })}</Button>
                  </Modal.Footer>
                </>
              ) : (
                <>
                  <Modal.Header>
                    <Modal.Icon>
                      <Icon icon="solar:save-linear" className="size-10 text-accent" />
                    </Modal.Icon>
                    <Modal.Heading>{intl.formatMessage({ id: 'warehouse.form.modal.confirm_title', defaultMessage: 'Confirm save' })}</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <p className="text-sm text-muted">{intl.formatMessage({ id: 'warehouse.form.modal.confirm_description', defaultMessage: 'Save this warehouse and return to the warehouse detail page?' })}</p>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="ghost" onPress={handleModalClose}>{intl.formatMessage({ id: 'warehouse.form.modal.cancel', defaultMessage: 'Cancel' })}</Button>
                    <Button onPress={handleConfirmSubmit}>{intl.formatMessage({ id: 'warehouse.form.modal.confirm_button', defaultMessage: 'Confirm' })}</Button>
                  </Modal.Footer>
                </>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}

function WarehouseFormPage() {
  const intl = useIntl();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canCreate = hasPermission('warehouse@create');
  const canUpdate = hasPermission('warehouse@update');
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

export { WarehouseFormPage };
