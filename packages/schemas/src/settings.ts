import { z } from 'zod';

// =============================================
// APP SETTINGS REGISTRY
// =============================================
// Single source of truth for every tunable system setting.
// Values are stored in the AppSetting table as raw strings
// (key primary key, value, updatedAt) and parsed per `type`.
// The server falls back to `default` when a key has no row.

export const SETTING_GROUP_IDS = ['ratelimit', 'logs', 'security', 'mail', 'reports', 'ai'] as const;
export type SettingGroupId = (typeof SETTING_GROUP_IDS)[number];

export type SettingType = 'string' | 'number' | 'boolean' | 'enum';

export interface SettingDef {
  key: string;
  group: SettingGroupId;
  type: SettingType;
  /** Raw string stored in AppSetting when the key has no row. */
  default: string;
  /** intl message id for the field label. */
  labelKey: string;
  /** intl message id for the field description. */
  descriptionKey: string;
  /** Allowed values when type === 'enum'. */
  options?: readonly string[];
  min?: number;
  max?: number;
}

export const SETTING_GROUP_LABEL_KEYS: Record<SettingGroupId, string> = {
  ratelimit: 'settings.group.ratelimit',
  logs: 'settings.group.logs',
  security: 'settings.group.security',
  mail: 'settings.group.mail',
  reports: 'settings.group.reports',
  ai: 'settings.group.ai',
};

export const SETTING_DEFS: SettingDef[] = [
  // ── Rate limiting ─────────────────────────────────────────────────────────
  {
    key: 'ratelimit.enabled',
    group: 'ratelimit',
    type: 'boolean',
    default: 'true',
    labelKey: 'settings.ratelimit.enabled.label',
    descriptionKey: 'settings.ratelimit.enabled.description',
  },
  {
    key: 'ratelimit.windowMs',
    group: 'ratelimit',
    type: 'number',
    default: '900000',
    min: 10_000,
    max: 3_600_000,
    labelKey: 'settings.ratelimit.windowMs.label',
    descriptionKey: 'settings.ratelimit.windowMs.description',
  },
  {
    key: 'ratelimit.max',
    group: 'ratelimit',
    type: 'number',
    default: '600',
    min: 1,
    max: 100_000,
    labelKey: 'settings.ratelimit.max.label',
    descriptionKey: 'settings.ratelimit.max.description',
  },
  {
    key: 'ratelimit.queue.maxWaitMs',
    group: 'ratelimit',
    type: 'number',
    default: '10000',
    min: 0,
    max: 30_000,
    labelKey: 'settings.ratelimit.queue.maxWaitMs.label',
    descriptionKey: 'settings.ratelimit.queue.maxWaitMs.description',
  },
  {
    key: 'ratelimit.queue.maxSize',
    group: 'ratelimit',
    type: 'number',
    default: '100',
    min: 0,
    max: 5_000,
    labelKey: 'settings.ratelimit.queue.maxSize.label',
    descriptionKey: 'settings.ratelimit.queue.maxSize.description',
  },
  {
    key: 'ratelimit.ai.windowMs',
    group: 'ratelimit',
    type: 'number',
    default: '60000',
    min: 10_000,
    max: 3_600_000,
    labelKey: 'settings.ratelimit.ai.windowMs.label',
    descriptionKey: 'settings.ratelimit.ai.windowMs.description',
  },
  {
    key: 'ratelimit.ai.max',
    group: 'ratelimit',
    type: 'number',
    default: '10',
    min: 1,
    max: 1_000,
    labelKey: 'settings.ratelimit.ai.max.label',
    descriptionKey: 'settings.ratelimit.ai.max.description',
  },
  {
    key: 'ratelimit.auth.windowMs',
    group: 'ratelimit',
    type: 'number',
    default: '900000',
    min: 60_000,
    max: 3_600_000,
    labelKey: 'settings.ratelimit.auth.windowMs.label',
    descriptionKey: 'settings.ratelimit.auth.windowMs.description',
  },
  {
    key: 'ratelimit.auth.max',
    group: 'ratelimit',
    type: 'number',
    default: '10',
    min: 1,
    max: 1_000,
    labelKey: 'settings.ratelimit.auth.max.label',
    descriptionKey: 'settings.ratelimit.auth.max.description',
  },

  // ── Logging ────────────────────────────────────────────────────────────────
  {
    key: 'logs.dbMinLevel',
    group: 'logs',
    type: 'enum',
    options: ['debug', 'info', 'warn', 'error'],
    default: 'warn',
    labelKey: 'settings.logs.dbMinLevel.label',
    descriptionKey: 'settings.logs.dbMinLevel.description',
  },
  {
    key: 'logs.retentionDays',
    group: 'logs',
    type: 'number',
    default: '30',
    min: 1,
    max: 365,
    labelKey: 'settings.logs.retentionDays.label',
    descriptionKey: 'settings.logs.retentionDays.description',
  },
  {
    key: 'logs.httpRequestsEnabled',
    group: 'logs',
    type: 'boolean',
    default: 'true',
    labelKey: 'settings.logs.httpRequestsEnabled.label',
    descriptionKey: 'settings.logs.httpRequestsEnabled.description',
  },

  // ── Security ───────────────────────────────────────────────────────────────
  {
    key: 'security.maxLoginAttempts',
    group: 'security',
    type: 'number',
    default: '5',
    min: 1,
    max: 50,
    labelKey: 'settings.security.maxLoginAttempts.label',
    descriptionKey: 'settings.security.maxLoginAttempts.description',
  },
  {
    key: 'security.lockoutMinutes',
    group: 'security',
    type: 'number',
    default: '15',
    min: 1,
    max: 1_440,
    labelKey: 'settings.security.lockoutMinutes.label',
    descriptionKey: 'settings.security.lockoutMinutes.description',
  },
  {
    key: 'security.passwordMinLength',
    group: 'security',
    type: 'number',
    default: '8',
    min: 6,
    max: 128,
    labelKey: 'settings.security.passwordMinLength.label',
    descriptionKey: 'settings.security.passwordMinLength.description',
  },

  // ── Mail (SMTP) ────────────────────────────────────────────────────────────
  {
    key: 'mail.enabled',
    group: 'mail',
    type: 'boolean',
    default: 'false',
    labelKey: 'settings.mail.enabled.label',
    descriptionKey: 'settings.mail.enabled.description',
  },
  {
    key: 'mail.host',
    group: 'mail',
    type: 'string',
    default: '',
    labelKey: 'settings.mail.host.label',
    descriptionKey: 'settings.mail.host.description',
  },
  {
    key: 'mail.port',
    group: 'mail',
    type: 'number',
    default: '587',
    min: 1,
    max: 65_535,
    labelKey: 'settings.mail.port.label',
    descriptionKey: 'settings.mail.port.description',
  },
  {
    key: 'mail.secure',
    group: 'mail',
    type: 'boolean',
    default: 'false',
    labelKey: 'settings.mail.secure.label',
    descriptionKey: 'settings.mail.secure.description',
  },
  {
    key: 'mail.from',
    group: 'mail',
    type: 'string',
    default: '',
    labelKey: 'settings.mail.from.label',
    descriptionKey: 'settings.mail.from.description',
  },

  // ── Reports (scheduled email) ─────────────────────────────────────────────
  {
    key: 'reports.monthlyEmail.enabled',
    group: 'reports',
    type: 'boolean',
    default: 'false',
    labelKey: 'settings.reports.monthlyEmail.enabled.label',
    descriptionKey: 'settings.reports.monthlyEmail.enabled.description',
  },
  {
    key: 'reports.monthlyEmail.recipients',
    group: 'reports',
    type: 'string',
    default: '',
    labelKey: 'settings.reports.monthlyEmail.recipients.label',
    descriptionKey: 'settings.reports.monthlyEmail.recipients.description',
  },
  {
    key: 'reports.monthlyEmail.dayOfMonth',
    group: 'reports',
    type: 'number',
    default: '1',
    min: 1,
    max: 28,
    labelKey: 'settings.reports.monthlyEmail.dayOfMonth.label',
    descriptionKey: 'settings.reports.monthlyEmail.dayOfMonth.description',
  },

  // ── AI (pre-existing AppSetting keys, now editable) ───────────────────────
  {
    key: 'ai.baseUrl',
    group: 'ai',
    type: 'string',
    default: '',
    labelKey: 'settings.ai.baseUrl.label',
    descriptionKey: 'settings.ai.baseUrl.description',
  },
  {
    key: 'ai.model',
    group: 'ai',
    type: 'string',
    default: '',
    labelKey: 'settings.ai.model.label',
    descriptionKey: 'settings.ai.model.description',
  },
  {
    key: 'ai.embeddingModel',
    group: 'ai',
    type: 'string',
    default: '',
    labelKey: 'settings.ai.embeddingModel.label',
    descriptionKey: 'settings.ai.embeddingModel.description',
  },
  {
    key: 'ai.similarityThreshold',
    group: 'ai',
    type: 'number',
    default: '0.5',
    min: 0,
    max: 1,
    labelKey: 'settings.ai.similarityThreshold.label',
    descriptionKey: 'settings.ai.similarityThreshold.description',
  },
];

export const SETTING_GROUP_ORDER: SettingGroupId[] = [
  'ratelimit',
  'logs',
  'security',
  'mail',
  'reports',
  'ai',
];

export function getSettingDef(key: string): SettingDef | undefined {
  return SETTING_DEFS.find((def) => def.key === key);
}

/** Defaults as a raw-string map (what AppSetting stores). */
export function getSettingDefaults(): Record<string, string> {
  return Object.fromEntries(SETTING_DEFS.map((def) => [def.key, def.default]));
}

/** Parse a raw stored string into its typed value. Invalid raw values fall back to the default. */
export function parseSettingValue(def: SettingDef, raw: string): string | number | boolean {
  if (def.type === 'boolean') return raw === 'true';
  if (def.type === 'number') {
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return Number(def.default);
    let clamped = parsed;
    if (def.min !== undefined && clamped < def.min) clamped = def.min;
    if (def.max !== undefined && clamped > def.max) clamped = def.max;
    return clamped;
  }
  if (def.type === 'enum') {
    return def.options?.includes(raw) ? raw : def.default;
  }
  return raw;
}

/** Validate a raw submitted value. Returns null when valid, else an error message key suffix. */
export function validateSettingValue(def: SettingDef, raw: string): string | null {
  if (def.type === 'boolean') {
    return raw === 'true' || raw === 'false' ? null : 'must be true or false';
  }
  if (def.type === 'number') {
    if (raw.trim() === '' || Number.isNaN(Number(raw))) return 'must be a number';
    const parsed = Number(raw);
    if (def.min !== undefined && parsed < def.min) return `must be >= ${def.min}`;
    if (def.max !== undefined && parsed > def.max) return `must be <= ${def.max}`;
    return null;
  }
  if (def.type === 'enum') {
    return def.options?.includes(raw) ? null : `must be one of: ${def.options?.join(', ')}`;
  }
  return raw.length > 2000 ? 'must be at most 2000 characters' : null;
}

// =============================================
// ROUTER INPUT SCHEMAS
// =============================================

export const updateSettingsInputSchema = z.object({
  values: z
    .array(
      z.object({
        key: z.string().min(1),
        value: z.string().max(2000),
      }),
    )
    .min(1)
    .max(100),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>;

export interface SettingWithRawValue extends SettingDef {
  /** Raw stored value (defaults applied). */
  value: string;
  /** Typed parsed value for display convenience. */
  parsedValue: string | number | boolean;
}
