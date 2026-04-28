import { useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useIntl } from 'react-intl';
import { useForm } from '@tanstack/react-form';
import {
  Button,
  Calendar,
  Card,
  Checkbox,
  DateField,
  DatePicker,
  EmptyState,
  FieldGroup,
  Fieldset,
  FieldsetLegend,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  SearchField,
  Select,
  Spinner,
  Table,
  TextArea,
  TextField,
  type Selection,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferProcedureInput } from '@trpc/server';
import { fromDateToLocal, getLocalTimeZone, today } from '@internationalized/date';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';
import { PageHeader } from '../../../components/PageHeader';
import { hasPermissionAtom } from '../../../lib/atoms';

type OutboundTransactionCreateInput = inferProcedureInput<AppRouter['outboundTransaction']['create']>;
type OutboundTransactionUpdateInput = inferProcedureInput<AppRouter['outboundTransaction']['update']>;

type ModalStage = 'idle' | 'confirm-draft' | 'confirm-propose' | 'loading' | 'success' | 'error';

interface OutboundTransactionDetailItem {
  id: string;
  skuId: string;
  palletTypeId: string | null;
  details?: string | null;
  pallets?: Array<{ id: string; status: string }>;
}

interface OutboundTransactionDetail {
  id: string;
  recipient?: string | null;
  reference?: string | null;
  notes?: string | null;
  date: string;
  approvalStatus: string;
  approvalHistory?: unknown;
  items?: OutboundTransactionDetailItem[];
}

interface AvailablePallet {
  id: string;
  status: string;
  palletType?: {
    id: string;
    name?: string | null;
    sku?: { id: string; name?: string | null };
  };
}

interface SkuOption {
  id: string;
  name?: string | null;
  palletTypes: Array<{
    id: string;
    name?: string | null;
    skuId: string;
  }>;
}

interface OutboundFormItem {
  id: string;
  skuId: string;
  palletTypeId: string;
  details: string;
  palletIds: string[];
}

type OutboundFormValues = {
  id: string;
  date: any;
  recipient: string;
  reference: string;
  notes: string;
  items: OutboundFormItem[];
};

interface OutboundItemBlockProps {
  item: OutboundFormItem;
  rowId: string;
  index: number;
  skuOptions: SkuOption[];
  isSubmitting: boolean;
  reservedPalletIds: string[];
  onChangeSkuId: (skuId: string) => void;
  onChangePalletTypeId: (palletTypeId: string) => void;
  onChangeDetails: (details: string) => void;
  onChangePalletIds: (palletIds: string[]) => void;
  onRemoveItem: () => void;
}

interface OutboundTransactionFormProps {
  id: string | undefined;
  isEdit: boolean;
  initialValues: OutboundFormValues | null;
  skuOptions: SkuOption[];
  detailApprovalHistory?: unknown;
}

const createFormItem = (): OutboundFormItem => ({
  id: crypto.randomUUID(),
  skuId: '',
  palletTypeId: '',
  details: '',
  palletIds: [],
});

const defaultFormValues = (): OutboundFormValues => ({
  id: '',
  date: today(getLocalTimeZone()) as any,
  recipient: '',
  reference: '',
  notes: '',
  items: [createFormItem()],
});

const transformDetailToFormValues = (detail: OutboundTransactionDetail): OutboundFormValues => ({
  id: detail.id,
  date: detail.date ? fromDateToLocal(new Date(detail.date)) : today(getLocalTimeZone()),
  recipient: detail.recipient ?? '',
  reference: detail.reference ?? '',
  notes: detail.notes ?? '',
  items: (detail.items?.length ?? 0) > 0
    ? (detail.items ?? []).map((item) => ({
        id: item.id ?? crypto.randomUUID(),
        skuId: item.skuId,
        palletTypeId: item.palletTypeId ?? '',
        details: item.details ?? '',
        palletIds: item.pallets?.map((pallet) => pallet.id) ?? [],
      }))
    : [createFormItem()],
});

const OutboundItemBlock = ({
  item,
  rowId,
  index,
  skuOptions,
  isSubmitting,
  reservedPalletIds,
  onChangeSkuId,
  onChangePalletTypeId,
  onChangeDetails,
  onChangePalletIds,
  onRemoveItem,
}: OutboundItemBlockProps) => {
  const intl = useIntl();
  const [skuSearch, setSkuSearch] = useState('');
  const [palletTypeSearch, setPalletTypeSearch] = useState('');
  const [palletSearch, setPalletSearch] = useState('');

  const selectedSku = skuOptions.find((sku) => sku.id === item.skuId);
  const palletTypeOptions = selectedSku?.palletTypes ?? [];

  const filteredSkuOptions = useMemo(() => {
    const query = skuSearch.trim().toLowerCase();
    if (!query) return skuOptions;
    return skuOptions.filter((sku) => `${sku.id} ${sku.name ?? ''}`.toLowerCase().includes(query));
  }, [skuOptions, skuSearch]);

  const filteredPalletTypeOptions = useMemo(() => {
    const query = palletTypeSearch.trim().toLowerCase();
    if (!query) return palletTypeOptions;
    return palletTypeOptions.filter((palletType) => `${palletType.id} ${palletType.name ?? ''}`.toLowerCase().includes(query));
  }, [palletTypeOptions, palletTypeSearch]);

  const isPalletSelectionLocked = !item.skuId || !item.palletTypeId;

  const { data: palletData, isLoading: isPalletLoading } = useQuery({
    queryKey: ['availablePalletsByItem', rowId, item.skuId, item.palletTypeId, palletSearch],
    queryFn: () => trpcClient.outboundTransaction.availablePallets.query({
      palletTypeId: item.palletTypeId,
      limit: 50,
      search: palletSearch.trim() || undefined,
    }),
    enabled: !isPalletSelectionLocked,
  });

  const availablePallets = (palletData?.data ?? []) as AvailablePallet[];

  const tableRows = useMemo(() => {
    if (isPalletSelectionLocked) return [];

    const visibleRows = availablePallets.filter((pallet) => {
      const matchesPalletType = pallet.palletType?.id === item.palletTypeId;
      const reservedByAnotherItem = reservedPalletIds.includes(pallet.id) && !item.palletIds.includes(pallet.id);
      return matchesPalletType && !reservedByAnotherItem;
    });

    const missingSelectedRows = item.palletIds
      .filter((palletId) => !visibleRows.some((row) => row.id === palletId))
      .map((palletId) => ({
        id: palletId,
        status: 'AVAILABLE',
        palletType: {
          id: item.palletTypeId,
          name: item.palletTypeId,
          sku: {
            id: item.skuId,
            name: item.skuId,
          },
        },
      }));

    return [...visibleRows, ...missingSelectedRows];
  }, [availablePallets, isPalletSelectionLocked, item.palletIds, item.palletTypeId, item.skuId, reservedPalletIds]);

  const selectedKeys = useMemo(() => new Set(item.palletIds), [item.palletIds]);

  const handleTableSelectionChange = (keys: Selection) => {
    if (keys === 'all') {
      onChangePalletIds(tableRows.map((row) => row.id));
      return;
    }

    onChangePalletIds(Array.from(keys).map((key) => String(key)));
  };

  return (
    <Card>
      <Card.Header className="gap-1">
        <Card.Title>
          {intl.formatMessage({ id: 'transaction.outbound_form.item_title', defaultMessage: 'Item {number}' }, { number: index + 1 })}
        </Card.Title>
        <Button variant="danger" size="sm" isIconOnly onPress={onRemoveItem} isDisabled={isSubmitting} className="absolute top-3 right-3">
          <Icon icon="mdi:close" />
        </Button>
      </Card.Header>

      <div className="grid gap-4 md:grid-cols-3">
        <Select
          fullWidth
          value={item.skuId || undefined}
          onChange={(value) => onChangeSkuId(String(value ?? ''))}
          variant="secondary"
          placeholder={intl.formatMessage({ id: 'transaction.outbound_form.sku_select_placeholder', defaultMessage: 'Select SKU' })}
          isDisabled={isSubmitting}
        >
          <Label>{intl.formatMessage({ id: 'transaction.outbound_form.field_sku_id', defaultMessage: 'SKU' })}</Label>
          <Select.Trigger>
            <Select.Value>
              {({ defaultChildren }) => {
                const sku = skuOptions.find((row) => row.id === item.skuId);
                if (!sku) return defaultChildren;
                return `${sku.id} - ${sku.name ?? '-'}`;
              }}
            </Select.Value>
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <SearchField
              name={`${rowId}-sku-search`}
              className="m-3 mb-0"
              value={skuSearch}
              onChange={setSkuSearch}
              variant="secondary"
              autoFocus
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input
                  aria-label={intl.formatMessage({ id: 'transaction.outbound_form.sku_search_aria', defaultMessage: 'Search SKU' })}
                  placeholder={intl.formatMessage({ id: 'transaction.outbound_form.sku_search_placeholder', defaultMessage: 'Search SKU...' })}
                />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <ListBox renderEmptyState={() => <EmptyState>{intl.formatMessage({ id: 'transaction.outbound_form.empty_sku', defaultMessage: 'No SKU found' })}</EmptyState>}>
              {filteredSkuOptions.map((sku) => (
                <ListBox.Item key={sku.id} id={sku.id} textValue={`${sku.id} ${sku.name ?? ''}`}>
                  <div className="flex flex-col">
                    <Label>{sku.id}</Label>
                    <span className="text-xs text-muted">{sku.name ?? '-'}</span>
                  </div>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Select
          fullWidth
          value={item.palletTypeId || undefined}
          onChange={(value) => onChangePalletTypeId(String(value ?? ''))}
          variant="secondary"
          placeholder={intl.formatMessage({ id: 'transaction.outbound_form.pallet_type_select_placeholder', defaultMessage: 'Select pallet type' })}
          isDisabled={isSubmitting || !item.skuId}
        >
          <Label>{intl.formatMessage({ id: 'transaction.outbound_form.field_pallet_type_id', defaultMessage: 'Pallet Type' })}</Label>
          <Select.Trigger>
            <Select.Value>
              {({ defaultChildren }) => {
                const palletType = palletTypeOptions.find((row) => row.id === item.palletTypeId);
                if (!palletType) return defaultChildren;
                return `${palletType.id} - ${palletType.name ?? '-'}`;
              }}
            </Select.Value>
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <SearchField
              name={`${rowId}-pallet-type-search`}
              className="m-3 mb-0"
              value={palletTypeSearch}
              onChange={setPalletTypeSearch}
              variant="secondary"
              autoFocus
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input
                  aria-label={intl.formatMessage({ id: 'transaction.outbound_form.pallet_type_search_aria', defaultMessage: 'Search pallet type' })}
                  placeholder={intl.formatMessage({ id: 'transaction.outbound_form.pallet_type_search_placeholder', defaultMessage: 'Search pallet type...' })}
                />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <ListBox renderEmptyState={() => <EmptyState>{intl.formatMessage({ id: 'transaction.outbound_form.empty_pallet_type', defaultMessage: 'No pallet type found' })}</EmptyState>}>
              {filteredPalletTypeOptions.map((palletType) => (
                <ListBox.Item key={palletType.id} id={palletType.id} textValue={`${palletType.id} ${palletType.name ?? ''}`}>
                  <div className="flex flex-col">
                    <Label>{palletType.id}</Label>
                    <span className="text-xs text-muted">{palletType.name ?? '-'}</span>
                  </div>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <TextField fullWidth value={item.details} onChange={onChangeDetails} name={`${rowId}-details`}>
          <Label>{intl.formatMessage({ id: 'transaction.outbound_form.field_item_details', defaultMessage: 'Details' })}</Label>
          <Input placeholder={intl.formatMessage({ id: 'transaction.outbound_form.field_item_details_placeholder', defaultMessage: 'Optional details' })} variant="secondary" />
        </TextField>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">
            {intl.formatMessage({ id: 'transaction.outbound_form.item_pallet_table_title', defaultMessage: 'Available pallets' })}
          </p>
          <p className="text-xs text-muted">
            {intl.formatMessage({ id: 'transaction.outbound_form.item_pallet_selected_count', defaultMessage: '{count} selected' }, { count: item.palletIds.length })}
          </p>
        </div>

        <TextField fullWidth value={palletSearch} onChange={setPalletSearch} name={`${rowId}-pallet-search`}>
          <Label>{intl.formatMessage({ id: 'transaction.outbound_form.field_search_pallets', defaultMessage: 'Search available pallets' })}</Label>
          <Input
            variant="secondary"
            disabled={isPalletSelectionLocked || isSubmitting}
            placeholder={intl.formatMessage({ id: 'transaction.outbound_form.search_pallets_placeholder', defaultMessage: 'Search pallet by ID or SKU' })}
          />
        </TextField>

        <Table>
          <Table.ScrollContainer>
            <Table.Content
              aria-label={intl.formatMessage({ id: 'transaction.outbound_form.item_pallet_table_aria', defaultMessage: 'Selectable available pallets' })}
              selectionMode="multiple"
              selectedKeys={selectedKeys}
              onSelectionChange={handleTableSelectionChange}
            >
              <Table.Header>
                <Table.Column>
                  <Checkbox aria-label={intl.formatMessage({ id: 'transaction.outbound_form.select_all_pallets', defaultMessage: 'Select all pallets' })} slot="selection">
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                  </Checkbox>
                </Table.Column>
                <Table.Column isRowHeader>{intl.formatMessage({ id: 'transaction.outbound_form.column_pallet_id', defaultMessage: 'Pallet ID' })}</Table.Column>
                <Table.Column>{intl.formatMessage({ id: 'transaction.outbound_form.column_sku', defaultMessage: 'SKU' })}</Table.Column>
                <Table.Column>{intl.formatMessage({ id: 'transaction.outbound_form.column_pallet_type', defaultMessage: 'Pallet Type' })}</Table.Column>
                <Table.Column>{intl.formatMessage({ id: 'transaction.outbound_form.column_status', defaultMessage: 'Status' })}</Table.Column>
              </Table.Header>
              <Table.Body
                renderEmptyState={() => (
                  <div className="flex items-center justify-center py-8 text-sm text-muted">
                    {isPalletSelectionLocked
                      ? intl.formatMessage({ id: 'transaction.outbound_form.blocked_pallet_table', defaultMessage: 'Select SKU and pallet type first to load available pallets.' })
                      : intl.formatMessage({ id: 'transaction.outbound_form.empty_available', defaultMessage: 'No available pallets found.' })}
                  </div>
                )}
              >
                {isPalletLoading ? (
                  <Table.Row id={`${rowId}-loading`}>
                    <Table.Cell colSpan={5}>
                      <div className="flex items-center justify-center py-8 text-sm text-muted">
                        {intl.formatMessage({ id: 'transaction.outbound_form.loading_pallets', defaultMessage: 'Loading pallets...' })}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  tableRows.map((pallet) => (
                    <Table.Row key={pallet.id} id={pallet.id}>
                      <Table.Cell>
                        <Checkbox
                          aria-label={intl.formatMessage({ id: 'transaction.outbound_form.select_pallet', defaultMessage: 'Select pallet' })}
                          slot="selection"
                          variant="secondary"
                        >
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                        </Checkbox>
                      </Table.Cell>
                      <Table.Cell>{pallet.id}</Table.Cell>
                      <Table.Cell>{pallet.palletType?.sku?.name ?? pallet.palletType?.sku?.id ?? '-'}</Table.Cell>
                      <Table.Cell>{pallet.palletType?.name ?? '-'}</Table.Cell>
                      <Table.Cell>{pallet.status}</Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </div>
    </Card>
  );
};

const OutboundTransactionForm = ({ id, isEdit, initialValues, skuOptions, detailApprovalHistory }: OutboundTransactionFormProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = isEdit ? hasPermission('outbound_transaction@update') : hasPermission('outbound_transaction@create');

  const intentRef = useRef<'DRAFT' | 'PROPOSED'>('DRAFT');
  const [modalStage, setModalStage] = useState<ModalStage>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const [approvalMessage, setApprovalMessage] = useState('');
  const [successDetailId, setSuccessDetailId] = useState<string | null>(null);
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
    setApprovalMessage('');
    setModalStage('idle');
  };

  useEffect(() => () => clearResultTimer(), []);

  const createMutation = useMutation<unknown, unknown, OutboundTransactionCreateInput>({
    mutationFn: (payload) => trpcClient.outboundTransaction.create.mutate(payload),
    onSuccess: (created) => {
      const result = created as { id: string };
      const createdId = result.id;

      queryClient.invalidateQueries({ queryKey: ['outboundTransactionList'] });
      setSuccessDetailId(createdId);
      setResultMessage(
        intentRef.current === 'PROPOSED'
          ? intl.formatMessage({ id: 'transaction.outbound_form.success_propose', defaultMessage: 'Outbound transaction proposed successfully.' })
          : intl.formatMessage({ id: 'transaction.outbound_form.success_draft', defaultMessage: 'Outbound transaction saved as draft.' }),
      );
      setModalStage('success');
      clearResultTimer();
      resultTimerRef.current = window.setTimeout(() => {
        setModalStage('idle');
        navigate(intentRef.current === 'DRAFT' ? `/transactions/outbound/${createdId}` : '/transactions');
      }, 1500);
    },
    onError: (error) => {
      setResultMessage(error instanceof Error ? error.message : intl.formatMessage({ id: 'error_generic', defaultMessage: 'An unexpected error occurred.' }));
      setModalStage('error');
    },
  });

  const updateMutation = useMutation<unknown, unknown, OutboundTransactionUpdateInput>({
    mutationFn: (payload) => trpcClient.outboundTransaction.update.mutate(payload),
    onSuccess: (updated) => {
      const result = updated as { id: string };
      const updatedId = result.id;

      queryClient.invalidateQueries({ queryKey: ['outboundTransactionList'] });

      if (updatedId !== id) {
        queryClient.removeQueries({ queryKey: ['outboundTransactionDetail', id] });
        navigate(`/transactions/outbound/form/${updatedId}`, { replace: true });
      } else {
        queryClient.invalidateQueries({ queryKey: ['outboundTransactionDetail', id] });
      }

      setSuccessDetailId(updatedId);
      setResultMessage(
        intentRef.current === 'PROPOSED'
          ? intl.formatMessage({ id: 'transaction.outbound_form.success_propose', defaultMessage: 'Outbound transaction proposed successfully.' })
          : intl.formatMessage({ id: 'transaction.outbound_form.success_draft', defaultMessage: 'Outbound transaction saved as draft.' }),
      );
      setModalStage('success');
      clearResultTimer();
      resultTimerRef.current = window.setTimeout(() => {
        setModalStage('idle');
        navigate(intentRef.current === 'DRAFT' ? `/transactions/outbound/${updatedId}` : '/transactions');
      }, 1500);
    },
    onError: (error) => {
      setResultMessage(error instanceof Error ? error.message : intl.formatMessage({ id: 'error_generic', defaultMessage: 'An unexpected error occurred.' }));
      setModalStage('error');
    },
  });

  const form = useForm({
    defaultValues: initialValues ?? defaultFormValues(),
    onSubmit: async ({ value }) => {
      const approvalStatus = intentRef.current;

      if (!canSave) {
        setResultMessage(intl.formatMessage({ id: 'error_generic', defaultMessage: 'You do not have permission to save this transaction.' }));
        setModalStage('error');
        return;
      }

      if (!value.recipient.trim()) {
        setResultMessage(intl.formatMessage({ id: 'transaction.outbound_form.error_recipient_required', defaultMessage: 'Recipient is required.' }));
        setModalStage('error');
        return;
      }

      if (value.items.length === 0) {
        setResultMessage(intl.formatMessage({ id: 'transaction.outbound_form.error_items_empty', defaultMessage: 'At least one item is required.' }));
        setModalStage('error');
        return;
      }

      if (value.items.some((item) => !item.skuId.trim() || !item.palletTypeId.trim() || item.palletIds.length === 0)) {
        setResultMessage(
          intl.formatMessage({
            id: 'transaction.outbound_form.error_items_invalid',
            defaultMessage: 'Each item must have SKU, pallet type, and at least one selected pallet.',
          }),
        );
        setModalStage('error');
        return;
      }

      const basePayload = {
        id: value.id.trim() || undefined,
        date: value.date ? new Date(value.date.year, value.date.month - 1, value.date.day) : new Date(),
        recipient: value.recipient.trim() || undefined,
        reference: value.reference.trim() || undefined,
        notes: value.notes.trim() || undefined,
        items: value.items.map((item) => ({
          skuId: item.skuId.trim(),
          palletTypeId: item.palletTypeId.trim(),
          details: item.details.trim() || undefined,
          palletIds: item.palletIds,
        })),
        approvalStatus,
        approvalHistory: detailApprovalHistory ?? [],
        message: approvalStatus === 'PROPOSED' ? approvalMessage.trim() || undefined : undefined,
      };

      if (isEdit) {
        await updateMutation.mutateAsync(basePayload as OutboundTransactionUpdateInput);
      } else {
        await createMutation.mutateAsync(basePayload as OutboundTransactionCreateInput);
      }
    },
  });

  const isSubmitting = modalStage === 'loading' || createMutation.isPending || updateMutation.isPending;

  const handleActionConfirm = (approvalStatus: 'DRAFT' | 'PROPOSED') => {
    intentRef.current = approvalStatus;
    setModalStage(approvalStatus === 'DRAFT' ? 'confirm-draft' : 'confirm-propose');
  };

  const handleConfirmSubmit = () => {
    setModalStage('loading');
    void form.handleSubmit();
  };

  const headerTitle = isEdit
    ? intl.formatMessage({ id: 'transaction.outbound_form.edit_title', defaultMessage: 'Edit Outbound Transaction' })
    : intl.formatMessage({ id: 'transaction.outbound_form.create_title', defaultMessage: 'Create Outbound Transaction' });

  return (
    <Form aria-label={headerTitle} validationBehavior="aria" onSubmit={(event) => event.preventDefault()}>
      <section className="space-y-6">
        <PageHeader
          title={headerTitle}
          onBack={() => navigate('/transactions')}
          onDetail={isEdit && id ? () => navigate(`/transactions/outbound/${id}`) : undefined}
          isDisabled={isSubmitting}
        />

        <Fieldset>
          <FieldsetLegend>{intl.formatMessage({ id: 'transaction.outbound_form.section_general_legend', defaultMessage: 'General information' })}</FieldsetLegend>
          <FieldGroup className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <form.Field name="id">
              {(field) => (
                <TextField fullWidth isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}>
                  <Label>{intl.formatMessage({ id: 'transaction.outbound_form.field_id', defaultMessage: 'Transaction ID' })}</Label>
                  <Input variant="secondary" placeholder={intl.formatMessage({ id: 'transaction.outbound_form.field_id_placeholder', defaultMessage: 'Leave empty for auto-generation' })} />
                </TextField>
              )}
            </form.Field>

            <form.Field name="recipient">
              {(field) => (
                <TextField fullWidth isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}>
                  <Label>{intl.formatMessage({ id: 'transaction.outbound_form.field_recipient', defaultMessage: 'Recipient' })}</Label>
                  <Input placeholder={intl.formatMessage({ id: 'transaction.outbound_form.field_recipient_placeholder', defaultMessage: 'Enter recipient name' })} variant="secondary" />
                </TextField>
              )}
            </form.Field>

            <form.Field name="reference">
              {(field) => (
                <TextField fullWidth isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}>
                  <Label>{intl.formatMessage({ id: 'transaction.outbound_form.field_reference', defaultMessage: 'Reference' })}</Label>
                  <Input placeholder={intl.formatMessage({ id: 'transaction.outbound_form.field_reference_placeholder', defaultMessage: 'Enter reference' })} variant="secondary" />
                </TextField>
              )}
            </form.Field>

            <form.Field name="date">
              {(field) => (
                <DatePicker className="w-full" isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange}>
                  <Label>{intl.formatMessage({ id: 'transaction.outbound_form.field_date', defaultMessage: 'Date' })}</Label>
                  <DateField.Group fullWidth variant="secondary">
                    <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
                    <DateField.Suffix>
                      <DatePicker.Trigger>
                        <DatePicker.TriggerIndicator />
                      </DatePicker.Trigger>
                    </DateField.Suffix>
                  </DateField.Group>
                  <DatePicker.Popover>
                    <Calendar aria-label={intl.formatMessage({ id: 'transaction.outbound_form.field_date', defaultMessage: 'Date' })}>
                      <Calendar.Header>
                        <Calendar.YearPickerTrigger>
                          <Calendar.YearPickerTriggerHeading />
                          <Calendar.YearPickerTriggerIndicator />
                        </Calendar.YearPickerTrigger>
                        <Calendar.NavButton slot="previous" />
                        <Calendar.NavButton slot="next" />
                      </Calendar.Header>
                      <Calendar.Grid>
                        <Calendar.GridHeader>
                          {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                        </Calendar.GridHeader>
                        <Calendar.GridBody>{(dateValue) => <Calendar.Cell date={dateValue} />}</Calendar.GridBody>
                      </Calendar.Grid>
                      <Calendar.YearPickerGrid>
                        <Calendar.YearPickerGridBody>
                          {({ year }) => <Calendar.YearPickerCell year={year} />}
                        </Calendar.YearPickerGridBody>
                      </Calendar.YearPickerGrid>
                    </Calendar>
                  </DatePicker.Popover>
                </DatePicker>
              )}
            </form.Field>

            <form.Field name="notes">
              {(field) => (
                <TextField fullWidth isDisabled={isSubmitting} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur}>
                  <Label>{intl.formatMessage({ id: 'transaction.outbound_form.field_notes', defaultMessage: 'Notes' })}</Label>
                  <TextArea variant='secondary' placeholder={intl.formatMessage({ id: 'transaction.outbound_form.field_notes_placeholder', defaultMessage: 'Add transaction notes (optional)' })} />
                </TextField>
              )}
            </form.Field>
          </FieldGroup>
        </Fieldset>

        <form.Field name="items" mode="array">
          {(itemsField: any) => (
            <>
              <p className="text-lg font-semibold">
                {intl.formatMessage({ id: 'transaction.outbound_form.section_items_legend', defaultMessage: 'Transaction items' })}
              </p>
              <div className="space-y-4">
                {(itemsField.state.value as OutboundFormItem[]).map((item, index) => {
                  const rowId = item.id || `new-item-${index}`;

                  return (
                    <form.Field key={rowId} name={`items[${index}].skuId` as any}>
                      {(skuField: any) => (
                        <form.Field name={`items[${index}].palletTypeId` as any}>
                          {(palletTypeField: any) => (
                            <form.Field name={`items[${index}].details` as any}>
                              {(detailsField: any) => (
                                <form.Field name={`items[${index}].palletIds` as any}>
                                  {(palletIdsField: any) => (
                                    <OutboundItemBlock
                                      rowId={rowId}
                                      item={{
                                        ...item,
                                        skuId: String(skuField.state.value ?? ''),
                                        palletTypeId: String(palletTypeField.state.value ?? ''),
                                        details: String(detailsField.state.value ?? ''),
                                        palletIds: Array.isArray(palletIdsField.state.value) ? palletIdsField.state.value : [],
                                      }}
                                      index={index}
                                      skuOptions={skuOptions}
                                      isSubmitting={isSubmitting}
                                      reservedPalletIds={(itemsField.state.value as OutboundFormItem[])
                                        .filter((_, rowIndex) => rowIndex !== index)
                                        .flatMap((row) => row.palletIds)}
                                      onChangeSkuId={(skuId) => {
                                        skuField.handleChange(skuId);
                                        palletTypeField.handleChange('');
                                        palletIdsField.handleChange([]);
                                      }}
                                      onChangePalletTypeId={(palletTypeId) => {
                                        palletTypeField.handleChange(palletTypeId);
                                        palletIdsField.handleChange([]);
                                      }}
                                      onChangeDetails={(details) => {
                                        detailsField.handleChange(details);
                                      }}
                                      onChangePalletIds={(palletIds) => {
                                        palletIdsField.handleChange(palletIds);
                                      }}
                                      onRemoveItem={() => itemsField.removeValue(index)}
                                    />
                                  )}
                                </form.Field>
                              )}
                            </form.Field>
                          )}
                        </form.Field>
                      )}
                    </form.Field>
                  );
                })}

                <Button variant="primary" onPress={() => itemsField.pushValue(createFormItem())} isDisabled={isSubmitting}>
                  <Icon icon="mdi:plus" className="size-4" />
                  {intl.formatMessage({ id: 'transaction.outbound_form.add_item', defaultMessage: 'Add Item' })}
                </Button>
              </div>
            </>
          )}
        </form.Field>

        <div className="flex justify-end gap-2">
          <Button
            isDisabled={isSubmitting}
            onPress={() => navigate('/transactions')}
            className="bg-danger text-danger-foreground"
            aria-label={intl.formatMessage({ id: 'transaction.outbound_form.cancel_button', defaultMessage: 'Cancel' })}
          >
            <Icon icon="solar:close-circle-linear" className="size-4" />
            <span className="hidden md:block">{intl.formatMessage({ id: 'transaction.outbound_form.cancel_button', defaultMessage: 'Cancel' })}</span>
          </Button>
          <Button
            isDisabled={isSubmitting || !canSave}
            onPress={() => handleActionConfirm('DRAFT')}
            className="bg-primary text-primary-foreground"
            aria-label={intl.formatMessage({ id: 'transaction.outbound_form.save_draft_button', defaultMessage: 'Save Draft' })}
          >
            <Icon icon="mdi:content-save" className="size-4" />
            <span className="hidden md:block">{intl.formatMessage({ id: 'transaction.outbound_form.save_draft_button', defaultMessage: 'Save Draft' })}</span>
          </Button>
          <Button
            isDisabled={isSubmitting || !canSave}
            onPress={() => handleActionConfirm('PROPOSED')}
            className="bg-warning text-warning-foreground"
            aria-label={intl.formatMessage({ id: 'transaction.outbound_form.propose_button', defaultMessage: 'Propose' })}
          >
            <Icon icon="mdi:send" className="size-4" />
            <span className="hidden md:block">{intl.formatMessage({ id: 'transaction.outbound_form.propose_button', defaultMessage: 'Propose' })}</span>
          </Button>
        </div>

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
                      <Modal.Heading>
                        {intl.formatMessage({ id: 'transaction.outbound_form.processing_title', defaultMessage: 'Saving transaction' })}
                      </Modal.Heading>
                    </Modal.Header>
                    <Modal.Body className="flex flex-col items-center gap-4 py-8">
                      <Spinner size="lg" />
                      <p className="text-sm text-muted">
                        {intl.formatMessage({ id: 'transaction.outbound_form.processing_description', defaultMessage: 'Please wait...' })}
                      </p>
                    </Modal.Body>
                  </>
                ) : modalStage === 'success' ? (
                  <>
                    <Modal.Header>
                      <Modal.Icon>
                        <Icon icon="solar:check-circle-bold" className="size-12 text-success" />
                      </Modal.Icon>
                      <Modal.Heading>
                        {intl.formatMessage({ id: 'transaction.outbound_form.success_title', defaultMessage: 'Success' })}
                      </Modal.Heading>
                    </Modal.Header>
                    <Modal.Body>
                      <p className="text-center text-sm text-muted">{resultMessage}</p>
                      <p className="mt-2 text-center text-sm text-muted">
                        {intl.formatMessage({ id: 'transaction.outbound_form.result_redirect', defaultMessage: 'Choose below.' })}
                      </p>
                    </Modal.Body>
                    <Modal.Footer className="justify-end gap-2">
                      <Button variant="ghost" onPress={handleModalClose}>
                        {intl.formatMessage({ id: 'transaction.outbound_form.modal_dismiss', defaultMessage: 'Dismiss' })}
                      </Button>
                      <Button variant="secondary" onPress={() => {
                        clearResultTimer();
                        setModalStage('idle');
                        navigate('/transactions');
                      }}>
                        {intl.formatMessage({ id: 'transaction.outbound_form.modal_back_to_table', defaultMessage: 'Back to table' })}
                      </Button>
                      <Button
                        isDisabled={!successDetailId}
                        onPress={() => {
                          if (!successDetailId) return;
                          clearResultTimer();
                          setModalStage('idle');
                          navigate(`/transactions/outbound/${successDetailId}`);
                        }}
                      >
                        {intl.formatMessage({ id: 'transaction.outbound_form.modal_view_detail', defaultMessage: 'View detail' })}
                      </Button>
                    </Modal.Footer>
                  </>
                ) : modalStage === 'error' ? (
                  <>
                    <Modal.Header>
                      <Modal.Icon>
                        <Icon icon="solar:close-circle-bold" className="size-12 text-danger" />
                      </Modal.Icon>
                      <Modal.Heading>
                        {intl.formatMessage({ id: 'transaction.outbound_form.error_title', defaultMessage: 'Something went wrong' })}
                      </Modal.Heading>
                    </Modal.Header>
                    <Modal.Body>
                      <p className="text-center text-sm text-muted">{resultMessage}</p>
                    </Modal.Body>
                    <Modal.Footer>
                      <Button onPress={handleModalClose}>
                        {intl.formatMessage({ id: 'transaction.outbound_form.error_close', defaultMessage: 'Close' })}
                      </Button>
                    </Modal.Footer>
                  </>
                ) : (
                  <>
                    <Modal.Header>
                      <Modal.Icon>
                        <Icon
                          icon={modalStage === 'confirm-propose' ? 'mdi:send' : 'mdi:content-save'}
                          className={`size-10 ${modalStage === 'confirm-propose' ? 'text-warning' : 'text-accent'}`}
                        />
                      </Modal.Icon>
                      <Modal.Heading>
                        {modalStage === 'confirm-propose'
                          ? intl.formatMessage({ id: 'transaction.outbound_form.propose_confirm_title', defaultMessage: 'Confirm propose' })
                          : intl.formatMessage({ id: 'transaction.outbound_form.draft_confirm_title', defaultMessage: 'Confirm save draft' })}
                      </Modal.Heading>
                    </Modal.Header>
                    <Modal.Body>
                      <p className="text-sm text-muted">
                        {modalStage === 'confirm-propose'
                          ? intl.formatMessage({ id: 'transaction.outbound_form.propose_confirm_description', defaultMessage: 'Send this outbound transaction for approval and set its status to proposed?' })
                          : intl.formatMessage({ id: 'transaction.outbound_form.draft_confirm_description', defaultMessage: 'Save this outbound transaction as draft so you can edit it later?' })}
                      </p>
                      {modalStage === 'confirm-propose' && (
                        <TextField fullWidth>
                          <Label>{intl.formatMessage({ id: 'transaction.outbound_form.propose_message_label', defaultMessage: 'Approval message' })}</Label>
                          <TextArea
                            rows={4}
                            value={approvalMessage}
                            onChange={(event) => setApprovalMessage(event.target.value)}
                            placeholder={intl.formatMessage({ id: 'transaction.outbound_form.propose_message_placeholder', defaultMessage: 'Add a message for the approval request (optional)' })}
                          />
                        </TextField>
                      )}
                    </Modal.Body>
                    <Modal.Footer>
                      <Button variant="ghost" onPress={handleModalClose}>
                        {intl.formatMessage({ id: 'transaction.outbound_form.confirm_cancel', defaultMessage: 'Cancel' })}
                      </Button>
                      <Button onPress={handleConfirmSubmit}>
                        {modalStage === 'confirm-propose'
                          ? intl.formatMessage({ id: 'transaction.outbound_form.confirm_send', defaultMessage: 'Send for approval' })
                          : intl.formatMessage({ id: 'transaction.outbound_form.confirm_save', defaultMessage: 'Confirm' })}
                      </Button>
                    </Modal.Footer>
                  </>
                )}
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      </section>
    </Form>
  );
};

function OutboundTransactionFormPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const detailQuery = useQuery({
    queryKey: ['outboundTransactionDetail', id],
    queryFn: () => trpcClient.outboundTransaction.detail.query({ id: id! }),
    enabled: isEdit && Boolean(id),
  });

  const skuListQuery = useQuery({
    queryKey: ['outboundFormSkuList'],
    queryFn: () => trpcClient.outboundTransaction.formSkuOptions.query({ limit: 200 }),
  });

  const detailData = detailQuery.data as OutboundTransactionDetail | undefined;
  const isLoading = (isEdit && detailQuery.isLoading) || skuListQuery.isLoading;
  const isBlockedEdit = isEdit && detailData && !['DRAFT', 'REJECTED'].includes(detailData.approvalStatus);

  useEffect(() => {
    if (!isBlockedEdit || !id) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      navigate(`/transactions/outbound/${id}`);
    }, 1500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [id, isBlockedEdit, navigate]);

  if (isLoading) {
    return (
      <Modal isOpen>
        <Modal.Backdrop isOpen variant="transparent" isDismissable={false}>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{intl.formatMessage({ id: 'transaction.outbound_form.loading_title', defaultMessage: 'Loading transaction' })}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-4 py-6 text-center">
                <div className="flex justify-center">
                  <Spinner size="lg" />
                </div>
                <p className="text-sm text-muted">
                  {intl.formatMessage({ id: 'transaction.outbound_form.loading_description', defaultMessage: 'Waiting for query data...' })}
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onPress={() => navigate('/transactions')}>
                  {intl.formatMessage({ id: 'transaction.outbound_form.loading_back', defaultMessage: 'Back' })}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    );
  }

  if (isEdit && (detailQuery.isError || !detailData)) {
    return (
      <Modal isOpen>
        <Modal.Backdrop isOpen variant="transparent" isDismissable>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{intl.formatMessage({ id: 'transaction.outbound_form.notfound_title', defaultMessage: 'Outbound transaction not found' })}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-4 py-6 text-center">
                <p className="text-sm text-muted">
                  {intl.formatMessage({ id: 'transaction.outbound_form.notfound_description', defaultMessage: 'This transaction could not be loaded. It may have been renamed, moved, or deleted.' })}
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onPress={() => navigate('/transactions')}>
                  {intl.formatMessage({ id: 'transaction.outbound_form.notfound_back', defaultMessage: 'Back to transactions' })}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    );
  }

  if (isBlockedEdit && detailData) {
    return (
      <Modal isOpen>
        <Modal.Backdrop isOpen variant="transparent" isDismissable={false}>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Icon>
                  <Icon icon="solar:lock-bold" className="size-10 text-warning" />
                </Modal.Icon>
                <Modal.Heading>
                  {intl.formatMessage({ id: 'transaction.outbound_form.edit_blocked_title', defaultMessage: 'Transaction not editable' })}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-4 py-6 text-center">
                <p className="text-sm text-muted">
                  {intl.formatMessage({
                    id: 'transaction.outbound_form.edit_blocked_description',
                    defaultMessage: 'This outbound transaction is no longer editable because its approval status is not draft. You will be redirected to the transaction detail page.',
                  })}
                </p>
                <p className="text-sm text-muted">
                  {intl.formatMessage(
                    { id: 'transaction.outbound_form.edit_blocked_status', defaultMessage: 'Current status: {status}' },
                    { status: detailData.approvalStatus },
                  )}
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="primary" onPress={() => navigate(`/transactions/outbound/${id}`)}>
                  {intl.formatMessage({ id: 'transaction.outbound_form.edit_blocked_action', defaultMessage: 'View transaction' })}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    );
  }

  return (
    <OutboundTransactionForm
      id={id}
      isEdit={isEdit}
      initialValues={isEdit && detailData ? transformDetailToFormValues(detailData) : null}
      skuOptions={(skuListQuery.data?.data ?? []) as SkuOption[]}
      detailApprovalHistory={detailData?.approvalHistory}
    />
  );
};

export { OutboundTransactionFormPage };
