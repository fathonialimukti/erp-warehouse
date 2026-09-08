import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { useIntl } from 'react-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Input, Label, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { SkuSelectSearch } from '../../components/SkuSelectSearch';
import { SupplierSelectSearch } from '../../components/SupplierSelectSearch';
import { hasPermissionAtom } from '../../lib/atoms';
import { trpcClient } from '../../lib/trpc';

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
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to create purchase order'),
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
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to update purchase order'),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const canSubmit = canSave && supplierId && effectiveWarehouseId && items.every((item) => item.skuId && Number(item.quantity) > 0);

  const currentSupplierId = supplierId || detail?.supplier.id || '';
  const currentExpected = expectedDate || (detail?.expectedDate ? String(detail.expectedDate).slice(0, 10) : '');
  const currentNotes = notes || detail?.notes || '';

  return (
    <section className="space-y-6" data-ai-context={JSON.stringify({ section: 'purchase-order-form' })}>
      <PageHeader
        title={isEdit
          ? intl.formatMessage({ id: 'po.form_title_edit', defaultMessage: 'Edit Purchase Order' })
          : intl.formatMessage({ id: 'po.form_title_create', defaultMessage: 'New Purchase Order' })}
        onBack={() => navigate('/purchase-order')}
      />

      <Card>
        <Card.Content>
          <div className="space-y-6">
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
                <TextField fullWidth name="warehouse" value={warehouseId} onChange={setWarehouseId}>
                  <Label>{intl.formatMessage({ id: 'po.field_warehouse', defaultMessage: 'Warehouse' })}</Label>
                  <select
                    className="w-full rounded-xl border bg-content1 px-3 py-2 text-sm"
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    aria-label={intl.formatMessage({ id: 'po.field_warehouse', defaultMessage: 'Warehouse' })}
                  >
                    <option value="">{intl.formatMessage({ id: 'common.select_placeholder', defaultMessage: 'Select…' })}</option>
                    {(warehouses?.data ?? []).map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </TextField>
              )}
              <TextField fullWidth name="expectedDate" value={currentExpected} onChange={setExpectedDate}>
                <Label>{intl.formatMessage({ id: 'po.field_expected', defaultMessage: 'Expected date' })}</Label>
                <Input type="date" variant="secondary" aria-label={intl.formatMessage({ id: 'po.field_expected', defaultMessage: 'Expected date' })} />
              </TextField>
            </div>

            <TextField fullWidth name="notes" value={currentNotes} onChange={setNotes}>
              <Label>{intl.formatMessage({ id: 'po.field_notes', defaultMessage: 'Notes' })}</Label>
              <textarea
                className="min-h-20 w-full rounded-xl border bg-content1 px-3 py-2 text-sm"
                value={currentNotes}
                onChange={(e) => setNotes(e.target.value)}
                aria-label={intl.formatMessage({ id: 'po.field_notes', defaultMessage: 'Notes' })}
              />
            </TextField>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {intl.formatMessage({ id: 'po.items_section', defaultMessage: 'Items' })}
                </p>
                <Button variant="secondary" size="sm" onPress={() => setItems((prev) => [...prev, emptyItem()])}>
                  <Icon icon="mdi:plus" />
                  {intl.formatMessage({ id: 'po.add_item', defaultMessage: 'Add item' })}
                </Button>
              </div>
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 items-end gap-3 rounded-2xl border p-3 md:grid-cols-[2fr_1fr_1fr_auto]">
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
            </div>

            {error ? (
              <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                <span>{error}</span>
              </div>
            ) : null}
          </div>
        </Card.Content>
        <Card.Footer>
          <div className="flex w-full justify-end gap-2">
            <Button variant="secondary" onPress={() => navigate('/purchase-order')} isDisabled={isPending}>
              {intl.formatMessage({ id: 'action_cancel', defaultMessage: 'Cancel' })}
            </Button>
            <Button
              variant="primary"
              isPending={isPending}
              isDisabled={!canSubmit}
              onPress={() => {
                setError(null);
                if (isEdit) updateMutation.mutate();
                else createMutation.mutate();
              }}
            >
              <Icon icon="solar:diskette-linear" className="size-4" />
              {isEdit
                ? intl.formatMessage({ id: 'po.submit_update', defaultMessage: 'Save Changes' })
                : intl.formatMessage({ id: 'po.submit_create', defaultMessage: 'Create Order' })}
            </Button>
          </div>
        </Card.Footer>
      </Card>
    </section>
  );
}
