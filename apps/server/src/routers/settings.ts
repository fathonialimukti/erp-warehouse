import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  SECRET_SETTING_KEYS,
  SECRET_VALUE_MASK,
  updateSettingsInputSchema,
  SETTING_DEFS,
  getSettingDef,
  parseSettingValue,
} from '@repo/schemas/settings';
import { getRawSettings, invalidateSettingsCache, updateSettings } from '../lib/app-settings.js';
import { logActivity } from '../lib/activity-log.js';
import { getMessage } from '../lib/locale.js';
import { hasPermission, protectedProcedure, router, transactional } from '../trpc.js';

export const settingsRouter = router({
  /** All setting definitions with their current raw + parsed values. Requires settings@read. */
  list: protectedProcedure.use(hasPermission('settings@read')).query(async () => {
    const raw = await getRawSettings();
    return {
      settings: SETTING_DEFS.map((def) => {
        const stored = raw[def.key] ?? def.default;
        // Secrets never leave the server — clients see a fixed mask placeholder.
        const value = SECRET_SETTING_KEYS.has(def.key) && stored ? SECRET_VALUE_MASK : stored;
        return { ...def, value, parsedValue: parseSettingValue(def, value) };
      }),
    };
  }),

  /** Persist a batch of setting values. Requires settings@update. */
  update: protectedProcedure
    .use(hasPermission('settings@update'))
    .use(transactional)
    .input(updateSettingsInputSchema)
    .mutation(async ({ input, ctx }) => {
      let updatedCount: number;
      try {
        updatedCount = await updateSettings(ctx.db, input);
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : getMessage(ctx.locale, 'settings.updateFailed'),
        });
      }

      const keys = input.values.map((v) => v.key).join(', ');
      // Never write secret values into the activity log.
      const loggedChanges = input.values.map((v) => ({
        key: v.key,
        value: SECRET_SETTING_KEYS.has(v.key) ? SECRET_VALUE_MASK : v.value,
      }));
      await logActivity(ctx.db, {
        action: 'UPDATE',
        userId: ctx.user!.userId,
        resource: 'app_setting',
        resourceId: keys.slice(0, 200),
        message: `Updated system settings: ${keys}`,
        detail: { changes: loggedChanges },
      });

      invalidateSettingsCache();
      return { success: true, updated: updatedCount };
    }),

  /** Reset a single setting back to its default. Requires settings@update. */
  reset: protectedProcedure
    .use(hasPermission('settings@update'))
    .use(transactional)
    .input(z.object({ key: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const def = getSettingDef(input.key);
      if (!def) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Unknown setting: ${input.key}` });
      }

      const rawBefore = (await getRawSettings(ctx.db))[input.key];
      // Never write secret values into the activity log.
      const before = SECRET_SETTING_KEYS.has(input.key) && rawBefore ? SECRET_VALUE_MASK : (rawBefore ?? null);
      await ctx.db.appSetting.deleteMany({ where: { key: input.key } });
      invalidateSettingsCache();

      await logActivity(ctx.db, {
        action: 'UPDATE',
        userId: ctx.user!.userId,
        resource: 'app_setting',
        resourceId: input.key,
        message: `Reset setting ${input.key} to default`,
        detail: { before, after: def.default },
      });

      return { success: true, value: def.default };
    }),
});
