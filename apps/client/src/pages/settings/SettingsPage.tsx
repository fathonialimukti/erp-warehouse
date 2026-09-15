import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { useBlocker } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  SearchField,
  Select,
  Skeleton,
  Switch,
  TextArea,
  TextField,
  toast,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { motion, useReducedMotion } from 'framer-motion';
import { PageHeader } from '../../components/PageHeader';
import { UnsavedChangesBadge } from '../../components/UnsavedChangesBadge';
import { trpcClient } from '../../lib/trpc';
import { SETTING_GROUP_ICON_REGISTRY } from '../../assets/SettingGroupIcons';
import {
  SECRET_SETTING_KEYS,
  SETTING_GROUP_IDS,
  SETTING_GROUP_LABEL_KEYS,
  type SettingGroupId,
} from '@repo/schemas/settings';

type SettingItem = Awaited<ReturnType<typeof trpcClient.settings.list.query>>['settings'][number];

/** Client-side validation mirroring the server rules (min/max for numbers, enum options). */
const getSettingFieldError = (
  def: SettingItem,
  raw: string,
  formatError: (id: string, defaultMessage: string, values?: Record<string, string | number>) => string,
): string | null => {
  if (def.type === 'number') {
    if (raw.trim() === '' || Number.isNaN(Number(raw))) {
      return formatError('settings.error.number', 'Must be a number');
    }
    const parsed = Number(raw);
    if (def.min !== undefined && parsed < def.min) {
      return formatError('settings.error.min', 'Must be at least {min}', { min: def.min });
    }
    if (def.max !== undefined && parsed > def.max) {
      return formatError('settings.error.max', 'Must be at most {max}', { max: def.max });
    }
  }

  if (def.type === 'enum' && !(def.options ?? []).includes(raw)) {
    return formatError('settings.error.option', 'Choose one of the listed options');
  }

  return null;
};

function ModifiedChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
      {label}
    </span>
  );
}

function ResetFieldButton({ onPress, ariaLabel }: { onPress: () => void; ariaLabel: string }) {
  return (
    <Button
      isIconOnly
      size="sm"
      variant="ghost"
      aria-label={ariaLabel}
      onPress={onPress}
      className="text-muted-foreground hover:text-foreground"
    >
      <Icon icon="solar:undo-left-round-linear" className="size-4" />
    </Button>
  );
}

const isLongTextDef = (def: SettingItem) =>
  def.type === 'string' && (def.key.includes('recipients') || def.key.includes('host'));

/**
 * Field layout in the settings grid:
 * - boolean toggle cards share a row with one compact field (2-per-row feel)
 * - long text renders as one big full-width textarea per row
 * - everything else packs 3-per-row on xl, 2-per-row on sm
 */
const getFieldSpanClass = (def: SettingItem): string => {
  if (def.type === 'boolean') return 'sm:col-span-2';
  if (isLongTextDef(def)) return 'col-span-full';
  return '';
};

function SettingField({
  def,
  value,
  serverValue,
  onChange,
  onReset,
  isDisabled,
  lockHint,
}: {
  def: SettingItem;
  value: string;
  serverValue: string;
  onChange: (next: string) => void;
  onReset: () => void;
  isDisabled: boolean;
  lockHint: string | null;
}) {
  const intl = useIntl();
  const label = intl.formatMessage({ id: def.labelKey, defaultMessage: def.key });
  const description = intl.formatMessage({ id: def.descriptionKey, defaultMessage: '' });
  const error = getSettingFieldError(def, value, (id, defaultMessage, values) =>
    intl.formatMessage({ id, defaultMessage }, values),
  );
  const isLocked = Boolean(lockHint);
  const effectiveDisabled = isDisabled || isLocked;
  const isModified = value !== serverValue;
  const isLong = isLongTextDef(def);
  const isSecret = SECRET_SETTING_KEYS.has(def.key);
  const [isRevealed, setIsRevealed] = useState(false);
  const revertLabel = intl.formatMessage({ id: 'settings.revert', defaultMessage: 'Revert to saved value' });
  const modifiedLabel = intl.formatMessage({ id: 'settings.modified', defaultMessage: 'Modified' });
  const showSecretLabel = intl.formatMessage({ id: 'settings.show_secret', defaultMessage: 'Show value' });
  const hideSecretLabel = intl.formatMessage({ id: 'settings.hide_secret', defaultMessage: 'Hide value' });

  const headerActions = (
    <div className="flex items-center gap-1">
      {isSecret ? (
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label={isRevealed ? hideSecretLabel : showSecretLabel}
          onPress={() => setIsRevealed((prev) => !prev)}
          className="text-muted-foreground hover:text-foreground"
        >
          <Icon icon={isRevealed ? 'solar:eye-closed-linear' : 'solar:eye-linear'} className="size-4" />
        </Button>
      ) : null}
      {isModified ? <ResetFieldButton onPress={onReset} ariaLabel={revertLabel} /> : null}
    </div>
  );

  const tone = error
    ? 'border-danger/40 bg-danger/5'
    : isModified
      ? 'border-warning/40 bg-warning/5'
      : 'border-border/50 bg-surface/40 hover:border-border';

  const fieldHeader = (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Label>{label}</Label>
      {isModified ? <ModifiedChip label={modifiedLabel} /> : null}
    </div>
  );

  const fieldFooter = error ? (
    <FieldError>{error}</FieldError>
  ) : lockHint ? (
    <p className="flex items-center gap-1 text-xs text-muted-foreground">
      <Icon icon="solar:lock-keyhole-minimalistic-linear" className="size-3.5 shrink-0" />
      {lockHint}
    </p>
  ) : description ? (
    <p className="text-xs text-muted-foreground">{description}</p>
  ) : null;

  const headerRow = (
    <div className="flex items-start justify-between gap-2">
      {fieldHeader}
      {headerActions}
    </div>
  );

  if (def.type === 'boolean') {
    return (
      <div className={`flex h-full flex-row items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition-colors ${tone}`}>
        <div className="min-w-0">
          {fieldHeader}
          {lockHint ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Icon icon="solar:lock-keyhole-minimalistic-linear" className="size-3.5 shrink-0" />
              {lockHint}
            </p>
          ) : description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {isModified ? <ResetFieldButton onPress={onReset} ariaLabel={revertLabel} /> : null}
          <Switch
            id={`setting-${def.key}`}
            isSelected={value === 'true'}
            isDisabled={effectiveDisabled}
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
      </div>
    );
  }

  if (def.type === 'enum') {
    return (
      <TextField
        fullWidth
        className={`h-full rounded-xl border px-4 py-3.5 transition-colors ${tone}`}
        isDisabled={effectiveDisabled}
        isInvalid={Boolean(error)}
        name={def.key}
      >
        {headerRow}
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
        {fieldFooter}
      </TextField>
    );
  }

  if (def.type === 'number') {
    return (
      <TextField
        fullWidth
        className={`h-full rounded-xl border px-4 py-3.5 transition-colors ${tone}`}
        isDisabled={effectiveDisabled}
        isInvalid={Boolean(error)}
        name={def.key}
        value={value}
        onChange={onChange}
      >
        {headerRow}
        <Input
          type="number"
          inputMode="numeric"
          placeholder={def.default}
          variant="secondary"
          aria-label={label}
        />
        {fieldFooter}
      </TextField>
    );
  }

  return (
    <TextField
      fullWidth
      className={`h-full rounded-xl border px-4 py-3.5 transition-colors ${tone}`}
      isDisabled={effectiveDisabled}
      isInvalid={Boolean(error)}
      name={def.key}
      value={value}
      onChange={onChange}
    >
      {headerRow}
      {isLong ? (
        <TextArea placeholder={def.default || undefined} rows={3} variant="secondary" aria-label={label} />
      ) : (
        <Input
          type={isSecret && !isRevealed ? 'password' : 'text'}
          autoComplete={isSecret ? 'off' : undefined}
          spellCheck={isSecret ? false : undefined}
          placeholder={def.default || undefined}
          variant="secondary"
          aria-label={label}
        />
      )}
      {fieldFooter}
    </TextField>
  );
}

function SettingsContent() {
  const intl = useIntl();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion() ?? false;
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [activeGroup, setActiveGroup] = useState<SettingGroupId | null>(null);
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['settingsList'],
    queryFn: () => trpcClient.settings.list.query(),
  });

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

  const current = (def: SettingItem): string => values[def.key] ?? def.value;
  const formatError = (id: string, defaultMessage: string, msgValues?: Record<string, string | number>) =>
    intl.formatMessage({ id, defaultMessage }, msgValues);

  const grouped = useMemo(() => {
    const map = new Map<SettingGroupId, SettingItem[]>();
    for (const def of data?.settings ?? []) {
      const list = map.get(def.group) ?? [];
      list.push(def);
      map.set(def.group, list);
    }
    return map;
  }, [data]);

  const dirtyByGroup = useMemo(() => {
    const map = new Map<SettingGroupId, number>();
    for (const def of data?.settings ?? []) {
      if (values[def.key] !== undefined && values[def.key] !== def.value) {
        map.set(def.group, (map.get(def.group) ?? 0) + 1);
      }
    }
    return map;
  }, [data, values]);

  const invalidKeys = useMemo(() => {
    if (!data) return new Set<string>();
    return new Set(
      data.settings
        .filter((def) => getSettingFieldError(def, current(def), formatError) !== null)
        .map((def) => def.key),
    );
  }, [data, values]);

  const dirtyCount = data?.settings.filter((def) => (values[def.key] ?? undefined) !== undefined && values[def.key] !== def.value).length ?? 0;
  const hasInvalid = invalidKeys.size > 0;

  /** Master-switch dependencies: SMTP fields lock while email is off, report recipients lock while the report is off. */
  const settingRawValue = (key: string): string | undefined => {
    const def = data?.settings.find((d) => d.key === key);
    if (!def) return undefined;
    return values[key] ?? def.value;
  };
  const isMailEnabled = settingRawValue('mail.enabled') === 'true';
  const isMonthlyEmailEnabled = settingRawValue('reports.monthlyEmail.enabled') === 'true';
  const mailLockHint = intl.formatMessage({ id: 'settings.locked_mail', defaultMessage: 'Enable email to edit these fields.' });
  const reportLockHint = intl.formatMessage({ id: 'settings.locked_report', defaultMessage: 'Enable the monthly email report to edit these fields.' });
  const getLockHint = (def: SettingItem): string | null => {
    if (def.group === 'mail' && def.key !== 'mail.enabled' && !isMailEnabled) return mailLockHint;
    if (def.group === 'reports' && def.key !== 'reports.monthlyEmail.enabled' && !isMonthlyEmailEnabled) return reportLockHint;
    return null;
  };

  const normalizedSearch = search.trim().toLowerCase();
  const isFiltering = normalizedSearch.length > 0;

  const matchesSearch = (defs: SettingItem[]): SettingItem[] =>
    defs.filter((def) => {
      const label = intl.formatMessage({ id: def.labelKey, defaultMessage: def.key }).toLowerCase();
      const keyTail = (def.key.split('.').pop() ?? def.key).toLowerCase();
      return label.includes(normalizedSearch) || keyTail.includes(normalizedSearch);
    });

  /** First group with search matches becomes the shown panel while filtering. */
  const firstMatchingGroup = useMemo(() => {
    if (!isFiltering || !data) return null;
    for (const groupId of SETTING_GROUP_IDS) {
      if (matchesSearch(grouped.get(groupId) ?? []).length) return groupId;
    }
    return null;
  }, [isFiltering, normalizedSearch, data, grouped]);

  useEffect(() => {
    if (isFiltering && firstMatchingGroup && firstMatchingGroup !== activeGroup) {
      setActiveGroup(firstMatchingGroup);
    }
  }, [isFiltering, firstMatchingGroup]);

  useEffect(() => {
    if (!activeGroup && grouped.size) {
      setActiveGroup(grouped.keys().next().value ?? null);
    }
  }, [grouped, activeGroup]);

  const handleSave = () => {
    if (!data || hasInvalid) return;
    const changed = data.settings
      .filter((def) => values[def.key] !== undefined && values[def.key] !== def.value)
      .map((def) => ({ key: def.key, value: values[def.key] ?? def.value }));
    if (changed.length === 0) return;

    setError(null);
    toast.promise(updateMutation.mutateAsync({ values: changed }), {
      loading: intl.formatMessage({ id: 'settings.saving', defaultMessage: 'Saving settings...' }),
      success: intl.formatMessage(
        { id: 'settings.saved', defaultMessage: 'Saved {count} setting(s)' },
        { count: changed.length },
      ),
      error: (err: unknown) =>
        err instanceof Error ? err.message : intl.formatMessage({ id: 'settings.save_failed', defaultMessage: 'Failed to save settings.' }),
    });
  };

  const handleResetGroup = (groupId: SettingGroupId) => {
    if (!data) return;
    setValues((prev) => {
      const next = { ...prev };
      for (const def of data.settings.filter((d) => d.group === groupId)) {
        if (next[def.key] !== undefined && next[def.key] !== def.value) delete next[def.key];
      }
      return next;
    });
  };

  const handleResetField = (def: SettingItem) => {
    setValues((prev) => {
      const next = { ...prev };
      delete next[def.key];
      return next;
    });
  };

  const title = intl.formatMessage({ id: 'settings.title', defaultMessage: 'System Settings' });
  const searchLabel = intl.formatMessage({ id: 'settings.search_placeholder', defaultMessage: 'Filter settings...' });
  const saveLabel = intl.formatMessage({ id: 'settings.save', defaultMessage: 'Save' });

  const hasUnsaved = dirtyCount > 0;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsaved && currentLocation.pathname !== nextLocation.pathname,
  );

  // Warn on tab close / refresh while there are unsaved changes.
  useEffect(() => {
    if (!hasUnsaved) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsaved]);

  const shownGroup = activeGroup ?? SETTING_GROUP_IDS[0];
  const shownDefs = shownGroup ? grouped.get(shownGroup) ?? [] : [];
  const filteredDefs = isFiltering ? matchesSearch(shownDefs) : shownDefs;
  const shownGroupHasDirty = shownGroup ? (dirtyByGroup.get(shownGroup) ?? 0) > 0 : false;

  return (
    <section className="space-y-6" data-ai-context={JSON.stringify({ section: 'system-settings' })}>
      <PageHeader
        title={title}
        onBack={() => window.history.back()}
      />

      {error ? (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <div className="flex items-start gap-2">
            <Icon icon="solar:danger-triangle-linear" className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      ) : null}

      {hasInvalid ? (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          <div className="flex items-start gap-2">
            <Icon icon="solar:danger-circle-linear" className="mt-0.5 size-4 shrink-0" />
            <span>
              {intl.formatMessage({
                id: 'settings.invalid_banner',
                defaultMessage: 'Fix invalid values before saving ({count}).',
              }, { count: invalidKeys.size })}
            </span>
          </div>
        </div>
      ) : null}

      {isError ? (
        <Card>
          <Card.Content>
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-danger/10">
                <Icon icon="solar:cloud-cross-linear" className="size-6 text-danger" />
              </span>
              <p className="font-medium text-foreground">
                {intl.formatMessage({ id: 'settings.load_failed', defaultMessage: 'Could not load settings.' })}
              </p>
              <Button variant="secondary" onPress={() => void refetch()}>
                <Icon icon="solar:refresh-linear" className="size-4" />
                {intl.formatMessage({ id: 'action_retry', defaultMessage: 'Retry' })}
              </Button>
            </div>
          </Card.Content>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* Rail — search + group navigation */}
          <div className="space-y-3">
            <SearchField
              fullWidth
              variant="secondary"
              aria-label={searchLabel}
              value={search}
              onChange={setSearch}
              onClear={() => setSearch('')}
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder={searchLabel} />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>

            <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {SETTING_GROUP_IDS.filter((groupId) => (grouped.get(groupId) ?? []).length > 0).map((groupId) => {
                const IconComponent = SETTING_GROUP_ICON_REGISTRY[groupId];
                const active = groupId === shownGroup;
                const groupDirty = dirtyByGroup.get(groupId) ?? 0;
                return (
                  <Button
                    key={groupId}
                    size="sm"
                    variant={active ? 'primary' : 'ghost'}
                    onPress={() => setActiveGroup(groupId)}
                    className={`shrink-0 gap-1.5 ${active ? '' : 'text-foreground'}`}
                  >
                    <IconComponent size={20} className="size-5" />
                    {intl.formatMessage({ id: SETTING_GROUP_LABEL_KEYS[groupId], defaultMessage: groupId })}
                    {groupDirty > 0 ? (
                      <span className={`size-1.5 rounded-full ${active ? 'bg-white' : 'bg-warning'}`} />
                    ) : null}
                  </Button>
                );
              })}
            </div>

            <div className="sticky top-4 hidden flex-col gap-1 rounded-2xl border border-border/50 bg-surface/30 p-2 lg:flex">
              {SETTING_GROUP_IDS.filter((groupId) => (grouped.get(groupId) ?? []).length > 0).map((groupId) => {
                const IconComponent = SETTING_GROUP_ICON_REGISTRY[groupId];
                const active = groupId === shownGroup;
                const groupDirty = dirtyByGroup.get(groupId) ?? 0;
                return (
                  <button
                    key={groupId}
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => setActiveGroup(groupId)}
                    className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                      active
                        ? 'bg-accent/10 text-accent'
                        : 'text-foreground hover:bg-surface'
                    }`}
                  >
                    <IconComponent size={32} className="shrink-0" style={{ width: 32, height: 32 }} />
                    <span className="min-w-0 flex-1 truncate">
                      {intl.formatMessage({ id: SETTING_GROUP_LABEL_KEYS[groupId], defaultMessage: groupId })}
                    </span>
                    {groupDirty > 0 ? (
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-warning text-[10px] font-bold text-white">
                        {groupDirty}
                      </span>
                    ) : null}
                    {active ? (
                      <span aria-hidden="true" className="h-5 w-1 shrink-0 rounded-full bg-accent" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Panel — active group */}
          <Card className="min-w-0">
            {shownGroup ? (
              <Card.Header>
                <div className="flex w-full flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const GroupIcon = SETTING_GROUP_ICON_REGISTRY[shownGroup];
                      return <GroupIcon size={44} className="shrink-0" style={{ width: 44, height: 44 }} />;
                    })()}
                    <div>
                      <Card.Title>
                        {intl.formatMessage({ id: SETTING_GROUP_LABEL_KEYS[shownGroup], defaultMessage: shownGroup })}
                      </Card.Title>
                      <p className="text-xs text-muted-foreground">
                        {intl.formatMessage(
                          { id: `settings.group.${shownGroup}_description`, defaultMessage: '' },
                        )}
                      </p>
                    </div>
                  </div>
                  {shownGroupHasDirty && !isFiltering ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => handleResetGroup(shownGroup)}
                      isDisabled={updateMutation.isPending}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Icon icon="solar:undo-left-round-linear" className="size-4" />
                      {intl.formatMessage({ id: 'settings.reset_group', defaultMessage: 'Reset group' })}
                    </Button>
                  ) : null}
                </div>
              </Card.Header>
            ) : null}
            <Card.Content>
              {isLoading ? (
                <div className="space-y-6">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-40 rounded-full" />
                      <Skeleton className="h-10 w-full rounded-xl" />
                      <Skeleton className="h-3 w-64 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : filteredDefs.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <span className="flex size-10 items-center justify-center rounded-full bg-surface">
                    <Icon icon="solar:settings-minimalistic-linear" className="size-5 text-muted-foreground" />
                  </span>
                  <p className="text-sm font-medium text-foreground">
                    {intl.formatMessage({ id: 'settings.empty_filtered', defaultMessage: 'No settings match your filter' })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {intl.formatMessage({ id: 'settings.empty_filtered_hint', defaultMessage: 'Try a different keyword or clear the filter.' })}
                  </p>
                </div>
              ) : (
                <motion.div
                  key={shownGroup}
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:grid-flow-row-dense xl:grid-cols-3"
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  {filteredDefs.map((def) => (
                    <div key={def.key} className={getFieldSpanClass(def)}>
                      <SettingField
                        def={def}
                        value={current(def)}
                        serverValue={def.value}
                        onChange={(next) => setValues((prev) => ({ ...prev, [def.key]: next }))}
                        onReset={() => handleResetField(def)}
                        isDisabled={updateMutation.isPending}
                        lockHint={getLockHint(def)}
                      />
                    </div>
                  ))}
                </motion.div>
              )}
            </Card.Content>
          </Card>
        </div>
      )}

      {/* Form actions live below the form: unsaved indicator + save */}
      {!isError ? (
        <div className="flex items-center justify-end gap-3">
          {dirtyCount > 0 ? <UnsavedChangesBadge count={dirtyCount} /> : null}
          <Button
            variant="primary"
            onPress={handleSave}
            isPending={updateMutation.isPending}
            isDisabled={dirtyCount === 0 || hasInvalid || updateMutation.isPending}
          >
            <Icon icon="solar:diskette-linear" className="size-4" />
            {saveLabel}
          </Button>
        </div>
      ) : null}

      <Modal onOpenChange={() => undefined}>
        <Modal.Backdrop isOpen={blocker.state === 'blocked'} isDismissable={false} isKeyboardDismissDisabled>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Icon>
                  <Icon icon="solar:danger-triangle-linear" className="size-10 text-warning" />
                </Modal.Icon>
                <Modal.Heading>
                  {intl.formatMessage({ id: 'settings.leave_title', defaultMessage: 'Unsaved changes' })}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-muted">
                  {intl.formatMessage({
                    id: 'settings.leave_description',
                    defaultMessage: 'You have unsaved settings. Leave without saving?',
                  })}
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onPress={() => blocker.reset?.()}>
                  {intl.formatMessage({ id: 'settings.leave_stay', defaultMessage: 'Stay on page' })}
                </Button>
                <Button variant="danger" onPress={() => blocker.proceed?.()}>
                  {intl.formatMessage({ id: 'settings.leave_discard', defaultMessage: 'Discard changes' })}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}

export function SettingsPage() {
  return <SettingsContent />;
}
