/* eslint-disable @typescript-eslint/no-explicit-any -- intentional at AI/serialization boundaries */
import { appRouter } from '../../router.js';
import { prisma } from '../../lib/prisma.js';
import type { Context } from '../../context.js';
import { DEFAULT_LOCALE, type ServerLocale } from '../../lib/locale.js';

export const createTestContext = (
  user: { userId: string; email: string; name: string | null } | null,
  locale: ServerLocale = DEFAULT_LOCALE
): Context => {
  return {
    req: { headers: {}, protocol: 'http' } as any,
    res: {
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name] = value;
      },
    } as any,
    user: user
      ? {
          ...user,
          exp: Math.floor(Date.now() / 1000) + 60 * 60,
          ver: 0,
        }
      : null,
    token: null,
    db: prisma,
    locale,
  };
};

export const createCaller = (user: { userId: string; email: string; name: string | null } | null) =>
  appRouter.createCaller(createTestContext(user));
