import {
  SETTING_DEFS,
  getSettingDefaults,
  getSettingDef,
  parseSettingValue,
  validateSettingValue,
  type UpdateSettingsInput,
} from '@repo/schemas/settings';
import { prisma, type DbClient } from './prisma.js';
import { logger } from './logger.js';
import { setDbMinLevelMirror } from './system-log.js';

/**
 * Typed accessor over the AppSetting KV table.
 *
 * - All registry defaults are merged with DB overrides.
 * - Values are cached in memory for 30s (rate limiter reads settings on
 *   every request — the cache keeps that off the DB hot path).
 * - `invalidateSettingsCache()` is called after every update so changes
 *   apply immediately on the next request.
 * - Never throws: if the DB is unavailable, defaults are served so that
 *   middleware (rate limiter, logger) keeps working.
 */

type RawValues = Record<string, string>;

interface SettingsCache {
  values: RawValues;
  loadedAt: number;
}

const CACHE_TTL_MS = 30_000;
const DEFAULTS = getSettingDefaults();

const globalForSettings = globalThis as unknown as {
  __appSettingsCache?: SettingsCache | null;
};

function getCache(): SettingsCache | null {
  return globalForSettings.__appSettingsCache ?? null;
}

function setCache(cache: SettingsCache | null): void {
  globalForSettings.__appSettingsCache = cache;
}

export function invalidateSettingsCache(): void {
  setCache(null);
}

/** Raw string values (defaults + DB overrides). */
export async function getRawSettings(db: DbClient = prisma): Promise<RawValues> {
  const cached = getCache();
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.values;
  }

  let overrides: RawValues = {};
  try {
    const rows = await db.appSetting.findMany();
    overrides = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  } catch (error) {
    logger.warn({ err: error }, 'app-settings: DB read failed, serving defaults');
    return { ...DEFAULTS };
  }

  const values: RawValues = { ...DEFAULTS, ...overrides };
  setCache({ values, loadedAt: Date.now() });
  setDbMinLevelMirror(values['logs.dbMinLevel'] ?? 'warn');
  return values;
}

/** Typed settings map (key -> string | number | boolean). */
export async function getSettings(db: DbClient = prisma): Promise<Record<string, string | number | boolean>> {
  const raw = await getRawSettings(db);
  const out: Record<string, string | number | boolean> = {};
  for (const def of SETTING_DEFS) {
    out[def.key] = parseSettingValue(def, raw[def.key] ?? def.default);
  }
  return out;
}

export async function getNumberSetting(key: string, db: DbClient = prisma): Promise<number> {
  const def = getSettingDef(key);
  const raw = (await getRawSettings(db))[key] ?? def?.default ?? '';
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? Number(def?.default ?? 0) : parsed;
}

export async function getBooleanSetting(key: string, db: DbClient = prisma): Promise<boolean> {
  const def = getSettingDef(key);
  const raw = (await getRawSettings(db))[key] ?? def?.default ?? 'false';
  return raw === 'true';
}

export async function getStringSetting(key: string, db: DbClient = prisma): Promise<string> {
  const def = getSettingDef(key);
  return (await getRawSettings(db))[key] ?? def?.default ?? '';
}

/** Validate + persist a batch of setting values. Throws a plain Error with a field-level message on invalid input. */
export async function updateSettings(db: DbClient, input: UpdateSettingsInput): Promise<number> {
  for (const { key, value } of input.values) {
    const def = getSettingDef(key);
    if (!def) {
      throw new Error(`Unknown setting: ${key}`);
    }
    const error = validateSettingValue(def, value);
    if (error) {
      throw new Error(`Invalid value for ${key}: ${error}`);
    }
  }

  for (const { key, value } of input.values) {
    await db.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  invalidateSettingsCache();
  return input.values.length;
}
