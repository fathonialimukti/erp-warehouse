import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Label, ListBox, Select, Switch, TextArea } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router';
import { SkuSelectSearch } from '../../components/SkuSelectSearch';
import { useRegisterPageForm } from '../../lib/ai/usePageContext';
import { trpcClient } from '../../lib/trpc';
import { FormCanvas, FormMain, FormRail } from '../../components/form/FormCanvas';
import { FormHero } from '../../components/form/FormHero';
import { FormSection } from '../../components/form/FormSection';
import { FormPreviewCard } from '../../components/form/FormPreviewCard';
import { FormActionBar } from '../../components/form/FormActionBar';
import { FormAiTip } from '../../components/form/FormAiTip';

export function StockCountFormPage() {
  const intl = useIntl();
  const navigate = useNavigate();

  const [warehouseId, setWarehouseId] = useState('');
  const [isBlindCount, setIsBlindCount] = useState(true);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: warehouses } = useQuery({
    queryKey: ['warehouseListForFilter'],
    queryFn: () => trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const warehouseName = warehouses?.data.find((w) => w.id === warehouseId)?.name;

  // AI page context: assemble full values from the atoms (create-only form),
  // then publish + missing required fields (mirrors receiving pilot).
  const formValues = useMemo(
    () => ({ warehouseId, isBlindCount, notes }),
    [warehouseId, isBlindCount, notes],
  );
  const missingRequired = useMemo(
    () => (warehouseId ? [] : ['warehouseId']),
    [warehouseId],
  );
  useRegisterPageForm('stock-count-form', formValues, missingRequired);

  const createMutation = useMutation({
    mutationFn: () =>
      trpcClient.stockCount.create.mutate({
        warehouseId,
        isBlindCount,
        notes: notes.trim() || undefined,
      }),
    onSuccess: (created) => navigate(`/stock-count/${created.id}`),
    onError: (err) => setError(err instanceof Error ? err.message : intl.formatMessage({ id: 'stock_count.form_error', defaultMessage: 'Failed to create count' })),
  });

  return (
    <section
      className="space-y-6"
      data-ai-context={JSON.stringify({
        section: 'stock-count-form',
        mode: 'create',
        fields: ['warehouseId', 'isBlindCount', 'notes'],
        availableWarehouses: (warehouses?.data ?? []).map((w) => ({ id: w.id, label: w.name })),
      })}
    >
      <FormHero
        icon="solar:clipboard-list-linear"
        title={intl.formatMessage({ id: 'stock_count.form_title', defaultMessage: 'New Cycle Count' })}
        description={intl.formatMessage({
          id: 'stock_count.form_hero_desc',
          defaultMessage: 'Pick a warehouse, choose the counting style, and snapshot every pallet as a count line.',
        })}
        mode="create"
        modeLabel={intl.formatMessage({ id: 'form.mode_create', defaultMessage: 'Create' })}
        onBack={() => navigate('/stock-count')}
        backLabel={intl.formatMessage({ id: 'action_cancel', defaultMessage: 'Cancel' })}
        chips={warehouseName ? [{ icon: 'solar:buildings-linear', label: warehouseName, tone: 'accent' }] : []}
      />

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setError(null);
          createMutation.mutate();
        }}
      >
        <FormCanvas>
          <FormMain>
            <FormSection
              step={1}
              icon="solar:buildings-linear"
              title={intl.formatMessage({ id: 'stock_count.form_section', defaultMessage: 'Count Session' })}
              description={intl.formatMessage({
                id: 'stock_count.form_description',
                defaultMessage: 'All available pallets in the selected warehouse are snapshotted as count lines.',
              })}
              filled={Boolean(warehouseId)}
            >
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="stock-count-warehouse">{intl.formatMessage({ id: 'stock_count.field_warehouse', defaultMessage: 'Warehouse' })}</Label>
                    <Select
                      id="stock-count-warehouse"
                      selectedKey={warehouseId || null}
                      onSelectionChange={(key) => setWarehouseId(typeof key === 'string' ? key : '')}
                      variant="secondary"
                      fullWidth
                      aria-label={intl.formatMessage({ id: 'stock_count.field_warehouse', defaultMessage: 'Warehouse' })}
                    >
                      <Select.Trigger>
                        <Select.Value>
                          {warehouseName ??
                            intl.formatMessage({ id: 'common.select_placeholder', defaultMessage: 'Select…' })}
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

                  <div className="flex flex-row items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <Label htmlFor="blind-count">
                        {intl.formatMessage({ id: 'stock_count.field_blind', defaultMessage: 'Blind count' })}
                      </Label>
                      <span className="text-sm text-muted">
                        {intl.formatMessage({
                          id: 'stock_count.field_blind_hint',
                          defaultMessage: 'Hide system quantities so counters enter what they actually find.',
                        })}
                      </span>
                    </div>
                    <Switch
                      id="blind-count"
                      isSelected={isBlindCount}
                      onChange={(selected) => setIsBlindCount(Boolean(selected))}
                    >
                      <Switch.Content>
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch.Content>
                    </Switch>
                  </div>
                </div>

                <SkuSelectSearch
                  queryKeyBase="stockCountSku"
                  value=""
                  onChange={() => undefined}
                  label={intl.formatMessage({ id: 'stock_count.field_sku_filter_hint', defaultMessage: 'SKU filter (optional — snapshots all SKUs when empty)' })}
                  isDisabled
                />
              </div>
            </FormSection>

            <FormSection
              step={2}
              icon="solar:document-text-linear"
              title={intl.formatMessage({ id: 'stock_count.field_notes', defaultMessage: 'Notes' })}
              description={intl.formatMessage({ id: 'stock_count.form_notes_desc', defaultMessage: 'Anything the counting team should know before they start.' })}
              filled={Boolean(notes.trim())}
            >
              <TextArea
                aria-label={intl.formatMessage({ id: 'stock_count.field_notes', defaultMessage: 'Notes' })}
                placeholder={intl.formatMessage({ id: 'stock_count.notes_placeholder', defaultMessage: 'e.g. Section A is being reorganized — start from Section B' })}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                fullWidth
                variant="secondary"
              />
            </FormSection>

            {error ? (
              <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                <div className="flex items-start gap-2">
                  <Icon icon="solar:danger-triangle-linear" className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              </div>
            ) : null}
          </FormMain>

          <FormRail>
            <FormPreviewCard
              title={intl.formatMessage({ id: 'stock_count.preview_title', defaultMessage: 'Session Preview' })}
              icon="solar:clipboard-list-linear"
              description={intl.formatMessage({ id: 'stock_count.preview_desc', defaultMessage: 'Live summary of the count you are about to start.' })}
              fillLabel={intl.formatMessage({ id: 'form.preview_fill', defaultMessage: 'Completed' })}
              rows={[
                { label: intl.formatMessage({ id: 'stock_count.field_warehouse', defaultMessage: 'Warehouse' }), value: warehouseName, icon: 'solar:buildings-linear', tone: 'accent' },
                { label: intl.formatMessage({ id: 'stock_count.field_blind', defaultMessage: 'Blind count' }), value: isBlindCount ? intl.formatMessage({ id: 'stock_count.preview_on', defaultMessage: 'On' }) : intl.formatMessage({ id: 'stock_count.preview_off', defaultMessage: 'Off' }), icon: isBlindCount ? 'solar:eye-closed-linear' : 'solar:eye-linear', tone: isBlindCount ? 'warning' : 'default' },
                { label: intl.formatMessage({ id: 'stock_count.field_sku_filter_hint', defaultMessage: 'SKU filter' }), value: intl.formatMessage({ id: 'stock_count.preview_all_skus', defaultMessage: 'All SKUs' }), icon: 'solar:box-search-linear' },
                { label: intl.formatMessage({ id: 'stock_count.field_notes', defaultMessage: 'Notes' }), value: notes, icon: 'solar:document-text-linear' },
              ]}
              footer={<FormAiTip />}
            />
          </FormRail>
        </FormCanvas>

        <FormActionBar
          onCancel={() => navigate('/stock-count')}
          cancelLabel={intl.formatMessage({ id: 'action_cancel', defaultMessage: 'Cancel' })}
          submitLabel={intl.formatMessage({ id: 'stock_count.form_submit', defaultMessage: 'Start Count' })}
          submitIcon="solar:clipboard-list-linear"
          isPending={createMutation.isPending}
          isDisabled={!warehouseId}
        />
      </form>
    </section>
  );
}