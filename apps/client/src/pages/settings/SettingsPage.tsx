import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Label, ListBox, Select, Switch, TextArea, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { PageHeader } from '../../components/PageHeader';
import { trpcClient } from '../../lib/trpc';
import {
  SETTING_GROUP_IDS,
  SETTING_GROUP_LABEL_KEYS,
  type SettingGroupId,
} from '@repo/schemas/settings';

type SettingItem = Awaited<ReturnType<typeof trpcClient.settings.list.query>>['settings'][number];

function SettingField({
  def,
  value,
  onChange,
  isDisabled,
}: {
  def: SettingItem;
  value: string;
  onChange: (next: string) => void;
  isDisabled: boolean;
}) {
  const intl = useIntl();
  const label = intl.formatMessage({ id: def.labelKey, defaultMessage: def.key });
  const description = intl.formatMessage({ id: def.descriptionKey, defaultMessage: '' });

  if (def.type === 'boolean') {
    return (
      <div className="flex flex-row items-center justify-between gap-3">
        <div className="flex flex-col">
          <Label htmlFor={`setting-${def.key}`}>{label}</Label>
          {description ? <span className="text-sm text-muted">{description}</span> : null}
        </div>
        <Switch
          id={`setting-${def.key}`}
          isSelected={value === 'true'}
          isDisabled={isDisabled}
          onChange={(selected) => onChange(selected ? 'true' : 'false')}
          aria-label={label}
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </div>
    );
  }

  if (def.type === 'enum') {
    return (
      <TextField fullWidth isDisabled={isDisabled} name={def.key}>
        <Label>{label}</Label>
        <Select
          selectedKey={value}
          onSelectionChange={(key) => {
            if (typeof key === 'string') onChange(key);
          }}
          variant="secondary"
          aria-label={label}
        >
          <Select.Trigger>
            <Select.Value>{value}</Select.Value>
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {(def.options ?? []).map((option) => (
                <ListBox.Item key={option} id={option} textValue={option}>
                  <Label>{option}</Label>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        {description ? <span className="text-sm text-muted">{description}</span> : null}
      </TextField>
    );
  }

  if (def.type === 'number') {
    return (
      <TextField
        fullWidth
        isDisabled={isDisabled}
        isInvalid={value.trim() !== '' && Number.isNaN(Number(value))}
        name={def.key}
        value={value}
        onChange={onChange}
      >
        <Label>{label}</Label>
        <Input
          type="number"
          inputMode="numeric"
          placeholder={def.default}
          variant="secondary"
          aria-label={label}
        />
        {description ? <span className="text-sm text-muted">{description}</span> : null}
      </TextField>
    );
  }

  const isLong = (def.key.includes('recipients') || def.key.includes('host'));
  return (
    <TextField fullWidth isDisabled={isDisabled} name={def.key} value={value} onChange={onChange}>
      <Label>{label}</Label>
      {isLong ? (
        <TextArea
          placeholder={def.default || undefined}
          rows={2}
          variant="secondary"
          aria-label={label}
        />
      ) : (
        <Input
          type="text"
          placeholder={def.default || undefined}
          variant="secondary"
          aria-label={label}
        />
      )}
      {description ? <span className="text-sm text-muted">{description}</span> : null}
    </TextField>
  );
}

function SettingsContent() {
  const intl = useIntl();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['settingsList'],
    queryFn: () => trpcClient.settings.list.query(),
  });

  const [values, setValues] = useState<Record<string, string>>({});
  const current = (def: SettingItem): string => values[def.key] ?? def.value;

  const updateMutation = useMutation({
    mutationFn: (payload: { values: Array<{ key: string; value: string }> }) =>
      trpcClient.settings.update.mutate(payload),
    onSuccess: () => {
      setError(null);
      setValues({});
      void queryClient.invalidateQueries({ queryKey: ['settingsList'] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : intl.formatMessage({ id: 'settings.save_failed', defaultMessage: 'Failed to save settings.' }));
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<SettingGroupId, SettingItem[]>();
    for (const def of data?.settings ?? []) {
      const list = map.get(def.group) ?? [];
      list.push(def);
      map.set(def.group, list);
    }
    return map;
  }, [data]);

  const dirtyCount = data?.settings.filter((def) => (values[def.key] ?? undefined) !== undefined && values[def.key] !== def.value).length ?? 0;

  const handleSave = () => {
    if (!data) return;
    const changed = data.settings
      .filter((def) => values[def.key] !== undefined && values[def.key] !== def.value)
      .map((def) => ({ key: def.key, value: values[def.key] ?? def.value }));
    if (changed.length === 0) return;
    updateMutation.mutate({ values: changed });
  };

  return (
    <section className="space-y-6" data-ai-context={JSON.stringify({ section: 'system-settings' })}>
      <PageHeader
        title={intl.formatMessage({ id: 'settings.title', defaultMessage: 'System Settings' })}
        onBack={() => window.history.back()}
      >
        <Button
          variant="primary"
          onPress={handleSave}
          isPending={updateMutation.isPending}
          isDisabled={dirtyCount === 0 || updateMutation.isPending}
        >
          <Icon icon="solar:diskette-linear" className="size-4" />
          {intl.formatMessage({ id: 'settings.save', defaultMessage: 'Save Changes' })}
          {dirtyCount > 0 ? ` (${dirtyCount})` : ''}
        </Button>
      </PageHeader>

      {isLoading ? (
        <p className="text-sm text-muted">
          {intl.formatMessage({ id: 'settings.loading', defaultMessage: 'Loading settings...' })}
        </p>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <div className="flex items-start gap-2">
            <Icon icon="solar:danger-triangle-linear" className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      ) : null}

      {SETTING_GROUP_IDS.map((groupId) => {
        const defs = grouped.get(groupId);
        if (!defs || defs.length === 0) return null;
        return (
          <Card key={groupId}>
            <Card.Header>
              <Card.Title>
                {intl.formatMessage({
                  id: SETTING_GROUP_LABEL_KEYS[groupId],
                  defaultMessage: groupId,
                })}
              </Card.Title>
            </Card.Header>
            <Card.Content>
              <div className="space-y-6">
                {defs.map((def) => (
                  <SettingField
                    key={def.key}
                    def={def}
                    value={current(def)}
                    onChange={(next) => setValues((prev) => ({ ...prev, [def.key]: next }))}
                    isDisabled={updateMutation.isPending}
                  />
                ))}
              </div>
            </Card.Content>
          </Card>
        );
      })}
    </section>
  );
}

export function SettingsPage() {
  return <SettingsContent />;
}
