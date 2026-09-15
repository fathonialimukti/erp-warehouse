import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { useIntl } from 'react-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Input, Label, ListBox, Select, TextArea, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { SkuSelectSearch } from '../../components/SkuSelectSearch';
import { SupplierSelectSearch } from '../../components/SupplierSelectSearch';
import { hasPermissionAtom } from '../../lib/atoms';
import { trpcClient } from '../../lib/trpc';
import { FormCanvas, FormMain, FormRail } from '../../components/form/FormCanvas';
import { FormHero } from '../../components/form/FormHero';
import { FormSection } from '../../components/form/FormSection';
import { FormPreviewCard } from '../../components/form/FormPreviewCard';
import { FormActionBar } from '../../components/form/FormActionBar';
import { FormAiTip } from '../../components/form/FormAiTip';

interface ItemRow {
  skuId: string;
  quantity: string;
  unitPrice: string;
  details: string;
}

const emptyItem = (): ItemRow => ({ skuId: '', quantity: '1', unitPrice: '', details: '' });

export function PurchaseOrderFormPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canSave = hasPermission(isEdit ? 'purchase_order@update' : 'purchase_order@create');
  const [error, setError] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemRow[]>([emptyItem()]);

  const { data: detail } = useQuery({
    queryKey: ['purchaseOrderDetail', id],
    enabled: isEdit,
    queryFn: () => trpcClient.purchaseOrder.detail.query({ id: id ?? '' }),
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouseListForFilter'],
    queryFn: () => trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const effectiveWarehouseId = isEdit ? detail?.warehouse.id ?? '' : warehouseId;

  const createMutation = useMutation({
    mutationFn: () =>
      trpcClient.purchaseOrder.create.mutate({
        supplierId,
        warehouseId,
        expectedDate: expectedDate || undefined,
        notes: notes.trim() || undefined,
        items: items.map((item) => ({
          skuId: item.skuId,
          quantity: Number(item.quantity) || 0,
          unitPrice: item.unitPrice === '' ? undefined : Number(item.unitPrice),
          details: item.details.trim() || undefined,
        })),
      }),
    onSuccess: (created) => navigate(`/purchase-order/${created.id}`),
    onError: (err) => setError(err instanceof Error ? err.message : intl.formatMessage({ id: 'po.form_error_create', defaultMessage: 'Failed to create purchase order' })),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      trpcClient.purchaseOrder.update.mutate({
        id: id!,
        supplierId,
        warehouseId: effectiveWarehouseId,
        expectedDate: expectedDate || undefined,
        notes: notes.trim() || undefined,
        approvalStatus: 'DRAFT',
        items: items.map((item) => ({
          skuId: item.skuId,
          quantity: Number(item.quantity) || 0,
          unitPrice: item.unitPrice === '' ? undefined : Number(item.unitPrice),
          details: item.details.trim() || undefined,
        })),
      }),
    onSuccess: (updated) => navigate(`/purchase-order/${(updated as { id: string }).id}`),
    onError: (err) => setError(err instanceof Error ? err.message : intl.formatMessage({ id: 'po.form_error_update', defaultMessage: 'Failed to update purchase order' })),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const canSubmit = canSave && supplierId && effectiveWarehouseId && items.every((item) => item.skuId && Number(item.quantity) > 0);

  const currentSupplierId = supplierId || detail?.supplier.id || '';
  const currentExpected = expectedDate || (detail?.expectedDate ? String(detail.expectedDate).slice(0, 10) : '');
  const currentNotes = notes || detail?.notes || '';

  const supplierName = detail?.supplier?.name ?? null;
  const warehouseName = isEdit ? detail?.warehouse?.name : warehouses?.data.find((w) => w.id === warehouseId)?.name;
  const totalQty = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const totalValue = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
  const itemsReady = items.length > 0 && items.every((item) => item.skuId && Number(item.quantity) > 0);

  return (
    <section
      className="space-y-6"
      data-ai-context={JSON.stringify({
        section: 'purchase-order-form',
        mode: isEdit ? 'edit' : 'create',
        orderId: isEdit ? id : undefined,
        fields: ['supplierId', 'warehouseId', 'expectedDate', 'notes', 'items'],
      })}
    >
      <FormHero
        icon="solar:cart-linear"
        title={isEdit
          ? intl.formatMessage({ id: 'po.form_title_edit', defaultMessage: 'Edit Purchase Order' })
          : intl.formatMessage({ id: 'po.form_title_create', defaultMessage: 'New Purchase Order' })}
        description={isEdit
          ? intl.formatMessage({
              id: 'po.form_hero_desc_edit',
              defaultMessage: 'Adjust the supplier, delivery window, and line items of this order.',
            })
          : intl.formatMessage({
              id: 'po.form_hero_desc_create',
              defaultMessage: 'Build an order line by line — supplier, delivery, and pallets to expect.',
            })}
        mode={isEdit ? 'edit' : 'create'}
        modeLabel={intl.formatMessage({ id: isEdit ? 'form.mode_edit' : 'form.mode_create', defaultMessage: isEdit ? 'Edit' : 'Create' })}
        onBack={() => navigate('/purchase-order')}
        backLabel={intl.formatMessage({ id: 'action_cancel', defaultMessage: 'Cancel' })}
        chips={supplierName ? [{ icon: 'solar:buildings-2-linear', label: supplierName, tone: 'accent' }] : []}
      />

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setError(null);
          if (isEdit) updateMutation.mutate();
          else createMutation.mutate();
        }}
      >
        <FormCanvas>
          <FormMain>
            <FormSection
              step={1}
              icon="solar:cart-linear"
              title={intl.formatMessage({ id: 'po.section_parties_title', defaultMessage: 'Supplier & Delivery' })}
              description={intl.formatMessage({ id: 'po.section_parties_desc', defaultMessage: 'Who supplies the order and where the pallets should land.' })}
              filled={Boolean(currentSupplierId) && Boolean(effectiveWarehouseId)}
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SupplierSelectSearch
                  queryKeyBase="poSupplier"
                  value={currentSupplierId}
                  onChange={setSupplierId}
                  label={intl.formatMessage({ id: 'po.field_supplier', defaultMessage: 'Supplier' })}
                />
                {isEdit ? (
                  <TextField fullWidth name="warehouse" value={detail?.warehouse.name ?? ''} onChange={() => undefined}>
                    <Label>{intl.formatMessage({ id: 'po.field_warehouse', defaultMessage: 'Warehouse' })}</Label>
                    <Input value={detail?.warehouse.name ?? ''} variant="secondary" disabled aria-label={intl.formatMessage({ id: 'po.field_warehouse', defaultMessage: 'Warehouse' })} />
                  </TextField>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="po-warehouse">{intl.formatMessage({ id: 'po.field_warehouse', defaultMessage: 'Warehouse' })}</Label>
                    <Select
                      id="po-warehouse"
                      selectedKey={warehouseId || null}
                      onSelectionChange={(key) => setWarehouseId(typeof key === 'string' ? key : '')}
                      variant="secondary"
                      fullWidth
                      aria-label={intl.formatMessage({ id: 'po.field_warehouse', defaultMessage: 'Warehouse' })}
                    >
                      <Select.Trigger>
                        <Select.Value>
                          {warehouseName ?? intl.formatMessage({ id: 'common.select_placeholder', defaultMessage: 'Select…' })}
                        </Select.Value>
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {(warehouses?.data ?? []).map((w) => (
                            <ListBox.Item key={w.id} id={w.id} textValue={w.name}>
                              <Label>{w.name}</Label>
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                )}
                <TextField fullWidth name="expectedDate" value={currentExpected} onChange={setExpectedDate}>
                  <Label>{intl.formatMessage({ id: 'po.field_expected', defaultMessage: 'Expected date' })}</Label>
                  <Input type="date" variant="secondary" aria-label={intl.formatMessage({ id: 'po.field_expected', defaultMessage: 'Expected date' })} />
                </TextField>
              </div>
            </FormSection>

            <FormSection
              step={2}
              icon="solar:document-text-linear"
              title={intl.formatMessage({ id: 'po.field_notes', defaultMessage: 'Notes' })}
              description={intl.formatMessage({ id: 'po.section_notes_desc', defaultMessage: 'Handling instructions or context for the receiving team.' })}
              filled={Boolean(currentNotes.trim())}
            >
              <TextArea
                aria-label={intl.formatMessage({ id: 'po.field_notes', defaultMessage: 'Notes' })}
                placeholder={intl.formatMessage({ id: 'po.notes_placeholder', defaultMessage: 'e.g. Split delivery — first drop arrives Friday' })}
                value={currentNotes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                fullWidth
                variant="secondary"
              />
            </FormSection>

            <FormSection
              step={3}
              icon="solar:box-linear"
              title={intl.formatMessage({ id: 'po.items_section', defaultMessage: 'Items' })}
              description={intl.formatMessage({ id: 'po.section_items_desc', defaultMessage: 'The SKUs, pallet quantities, and agreed unit prices.' })}
              filled={itemsReady}
            >
              <div className="flex justify-end">
                <Button variant="secondary" size="sm" onPress={() => setItems((prev) => [...prev, emptyItem()])}>
                  <Icon icon="mdi:plus" />
                  {intl.formatMessage({ id: 'po.add_item', defaultMessage: 'Add item' })}
                </Button>
              </div>
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 items-end gap-3 rounded-2xl border border-border/70 bg-surface p-3 md:grid-cols-[2fr_1fr_1fr_auto]">
                    <SkuSelectSearch
                      queryKeyBase={`poItemSku${index}`}
                      value={item.skuId}
                      onChange={(value) =>
                        setItems((prev) => prev.map((row, i) => (i === index ? { ...row, skuId: value } : row)))
                      }
                      ariaLabel={intl.formatMessage({ id: 'po.field_sku', defaultMessage: 'SKU' })}
                      label={intl.formatMessage({ id: 'po.field_sku', defaultMessage: 'SKU' })}
                    />
                    <TextField fullWidth name={`qty-${index}`} value={item.quantity}
                      onChange={(v) => setItems((prev) => prev.map((row, i) => (i === index ? { ...row, quantity: v } : row)))}>
                      <Label>{intl.formatMessage({ id: 'po.field_quantity', defaultMessage: 'Qty (pallets)' })}</Label>
                      <Input type="number" min={1} variant="secondary" aria-label={intl.formatMessage({ id: 'po.field_quantity', defaultMessage: 'Quantity' })} />
                    </TextField>
                    <TextField fullWidth name={`price-${index}`} value={item.unitPrice}
                      onChange={(v) => setItems((prev) => prev.map((row, i) => (i === index ? { ...row, unitPrice: v } : row)))}>
                      <Label>{intl.formatMessage({ id: 'po.field_unit_price', defaultMessage: 'Unit price' })}</Label>
                      <Input type="number" min={0} step="any" variant="secondary" aria-label={intl.formatMessage({ id: 'po.field_unit_price', defaultMessage: 'Unit price' })} />
                    </TextField>
                    <Button
                      isIconOnly
                      variant="ghost"
                      aria-label={intl.formatMessage({ id: 'action_remove', defaultMessage: 'Remove' })}
                      isDisabled={items.length === 1}
                      onPress={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Icon icon="mdi:delete" className="text-danger" />
                    </Button>
                  </div>
                ))}
              </div>
            </FormSection>

            {error ? (
              <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                <span>{error}</span>
              </div>
            ) : null}
          </FormMain>

          <FormRail>
            <FormPreviewCard
              title={intl.formatMessage({ id: 'po.preview_title', defaultMessage: 'Order Preview' })}
              icon="solar:cart-linear"
              description={intl.formatMessage({ id: 'po.preview_desc', defaultMessage: 'Live summary of the purchase order you are building.' })}
              fillLabel={intl.formatMessage({ id: 'form.preview_fill', defaultMessage: 'Completed' })}
              rows={[
                { label: intl.formatMessage({ id: 'po.field_supplier', defaultMessage: 'Supplier' }), value: supplierName ?? null, icon: 'solar:buildings-2-linear', tone: 'accent' },
                { label: intl.formatMessage({ id: 'po.field_warehouse', defaultMessage: 'Warehouse' }), value: warehouseName ?? null, icon: 'solar:buildings-linear' },
                { label: intl.formatMessage({ id: 'po.field_expected', defaultMessage: 'Expected date' }), value: currentExpected || null, icon: 'solar:calendar-linear' },
                { label: intl.formatMessage({ id: 'po.preview_lines', defaultMessage: 'Line items' }), value: items.length > 1 || items[0]?.skuId ? items.length : null, icon: 'solar:layers-linear' },
                { label: intl.formatMessage({ id: 'po.preview_pallets', defaultMessage: 'Pallets' }), value: totalQty > 0 ? totalQty : null, icon: 'solar:box-linear' },
                { label: intl.formatMessage({ id: 'po.preview_value', defaultMessage: 'Est. value' }), value: totalValue > 0 ? totalValue.toLocaleString() : null, icon: 'solar:dollar-linear', tone: totalValue > 0 ? 'success' : 'default' },
              ]}
              footer={<FormAiTip />}
            />
          </FormRail>
        </FormCanvas>

        <FormActionBar
          onCancel={() => navigate('/purchase-order')}
          cancelLabel={intl.formatMessage({ id: 'action_cancel', defaultMessage: 'Cancel' })}
          submitLabel={isEdit
            ? intl.formatMessage({ id: 'po.submit_update', defaultMessage: 'Save Changes' })
            : intl.formatMessage({ id: 'po.submit_create', defaultMessage: 'Create Order' })}
          submitIcon="solar:diskette-linear"
          isPending={isPending}
          isDisabled={!canSubmit}
        />
      </form>
    </section>
  );
}