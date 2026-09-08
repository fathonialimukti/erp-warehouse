import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Label, ListBox, Select, Switch, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { SkuSelectSearch } from '../../components/SkuSelectSearch';
import { trpcClient } from '../../lib/trpc';

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

  const createMutation = useMutation({
    mutationFn: () =>
      trpcClient.stockCount.create.mutate({
        warehouseId,
        isBlindCount,
        notes: notes.trim() || undefined,
      }),
    onSuccess: (created) => navigate(`/stock-count/${created.id}`),
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to create count'),
  });

  return (
    <section className="space-y-6" data-ai-context={JSON.stringify({ section: 'stock-count-form' })}>
      <PageHeader
        title={intl.formatMessage({ id: 'stock_count.form_title', defaultMessage: 'New Cycle Count' })}
        onBack={() => navigate('/stock-count')}
      />

      <Card>
        <Card.Header>
          <Card.Title>
            {intl.formatMessage({ id: 'stock_count.form_section', defaultMessage: 'Count Session' })}
          </Card.Title>
          <Card.Description>
            {intl.formatMessage({
              id: 'stock_count.form_description',
              defaultMessage: 'All available pallets in the selected warehouse are snapshotted as count lines.',
            })}
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="space-y-6">
            <TextField fullWidth name="warehouse" value={warehouseId} onChange={setWarehouseId}>
              <Label>{intl.formatMessage({ id: 'stock_count.field_warehouse', defaultMessage: 'Warehouse' })}</Label>
              <Select
                selectedKey={warehouseId || null}
                onSelectionChange={(key) => setWarehouseId(typeof key === 'string' ? key : '')}
                variant="secondary"
                aria-label={intl.formatMessage({ id: 'stock_count.field_warehouse', defaultMessage: 'Warehouse' })}
              >
                <Select.Trigger>
                  <Select.Value>
                    {warehouses?.data.find((w) => w.id === warehouseId)?.name ??
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
            </TextField>

            <SkuSelectSearch
              queryKeyBase="stockCountSku"
              value=""
              onChange={() => undefined}
              label={intl.formatMessage({ id: 'stock_count.field_sku_filter_hint', defaultMessage: 'SKU filter (optional — snapshots all SKUs when empty)' })}
              isDisabled
            />

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

            <TextField fullWidth name="notes" value={notes} onChange={setNotes}>
              <Label>{intl.formatMessage({ id: 'stock_count.field_notes', defaultMessage: 'Notes' })}</Label>
              <textarea
                className="min-h-20 w-full rounded-xl border bg-content1 px-3 py-2 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                aria-label={intl.formatMessage({ id: 'stock_count.field_notes', defaultMessage: 'Notes' })}
              />
            </TextField>

            {error ? (
              <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                <div className="flex items-start gap-2">
                  <Icon icon="solar:danger-triangle-linear" className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              </div>
            ) : null}
          </div>
        </Card.Content>
        <Card.Footer>
          <div className="flex w-full justify-end gap-2">
            <Button variant="secondary" onPress={() => navigate('/stock-count')}>
              {intl.formatMessage({ id: 'action_cancel', defaultMessage: 'Cancel' })}
            </Button>
            <Button
              variant="primary"
              isPending={createMutation.isPending}
              isDisabled={!warehouseId}
              onPress={() => {
                setError(null);
                createMutation.mutate();
              }}
            >
              <Icon icon="solar:clipboard-list-linear" className="size-4" />
              {intl.formatMessage({ id: 'stock_count.form_submit', defaultMessage: 'Start Count' })}
            </Button>
          </div>
        </Card.Footer>
      </Card>
    </section>
  );
}
