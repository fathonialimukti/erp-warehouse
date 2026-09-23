/* eslint-disable @typescript-eslint/no-explicit-any -- intentional at AI/serialization boundaries */
/**
 * Regression coverage for the AI SQL endpoints' central security invariant:
 * the string handed to `$queryRawUnsafe` must be derived ONLY from the
 * sanitized + validated SQL — never from the raw request body, and never from
 * an uncoerced `limit`.
 *
 * Before the fix both routes validated `sanitizeString(sql)` but then built the
 * executed statement from the raw `sql`, so sanitization was theater.
 */
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Request, Response } from 'express';

import { aiQueryDatabaseHandler } from '../routes/ai.js';
import { aiAdminQueryHandler } from '../routes/ai-admin.js';
import { seedRoleWithPermissions, seedTestActor, seedTestUser, deleteTestRole, deleteTestUser } from './helpers/seed.js';

// sanitizeString strips the markup below, leaving a clean "SELECT 1 AS v".
// The pre-fix code validated that sanitized string but executed the raw one.
const MARKED_UP_SQL = 'SELECT 1 AS v<b><script>DELETE FROM users</script></b>';
const SANITIZED_SELECT = 'SELECT 1 AS v';

// Legal-looking SQL that passes every validator (SELECT prefix, no forbidden
// keywords), but Postgres rejects inside a READ ONLY transaction — and would
// otherwise CREATE a table. Used to prove the transaction wrapper is applied.
const SELECT_INTO_SQL = 'SELECT id INTO ai_security_probe FROM users LIMIT 1';

let adminUserId: string;
let adminRoleId: string;
let plainUserId: string;
let plainRoleId: string;

beforeAll(async () => {
    const admin = await seedTestActor(['ai_admin@access']);
    adminUserId = admin.user.id;
    adminRoleId = admin.role.id;

    const plainRole = await seedRoleWithPermissions([]);
    const plainUser = await seedTestUser({
        roleId: plainRole.id,
        email: `ai-query-${randomUUID()}@example.com`,
        name: 'AI Query Test User',
    });
    plainUserId = plainUser.id;
    plainRoleId = plainRole.id;
});

afterAll(async () => {
    await deleteTestUser(adminUserId);
    await deleteTestUser(plainUserId);
    await deleteTestRole(adminRoleId);
    await deleteTestRole(plainRoleId);
});

/** Minimal express res that records what the handler wrote. */
const callHandler = async (
    handler: (req: Request, res: Response) => Promise<void>,
    body: unknown,
    userId: string,
): Promise<{ statusCode: number; body: any }> => {
    const token = jwt.sign(
        { userId, email: 'test@example.com', name: 'Test', ver: 0 },
        process.env.JWT_SECRET as string,
        { expiresIn: '1h' },
    );
    const res: any = {
        statusCode: 200,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(value: unknown) {
            this.body = value;
            return this;
        },
        end() {
            return this;
        },
    };
    await handler(
        { headers: { cookie: `access_token=${token}` }, body } as unknown as Request,
        res as unknown as Response,
    );
    return { statusCode: res.statusCode, body: res.body };
};

describe('ai query endpoint — validated string is the executed string', () => {
    it('executes the sanitized SQL, not the raw request body', async () => {
        const res = await callHandler(aiQueryDatabaseHandler, { sql: MARKED_UP_SQL }, plainUserId);

        expect(res.body).toEqual({
            success: true,
            rowCount: 1,
            data: [{ v: 1 }],
            truncated: false,
            hint: null,
        });
    });

    it('coerces limit to an integer so it cannot inject SQL', async () => {
        const res = await callHandler(
            aiQueryDatabaseHandler,
            { sql: SANITIZED_SELECT, limit: '1; DELETE FROM users' },
            plainUserId,
        );

        expect(res.body).toMatchObject({ success: true, rowCount: 1, data: [{ v: 1 }] });
    });

    it('rejects write statements before anything reaches the database', async () => {
        const res = await callHandler(aiQueryDatabaseHandler, { sql: 'DELETE FROM users' }, plainUserId);

        expect(res.body).toEqual({ error: 'Query rejected', message: expect.any(String) });
        expect(res.body).not.toHaveProperty('success');
    });

    it('runs every statement inside a read-only transaction', async () => {
        const res = await callHandler(aiQueryDatabaseHandler, { sql: SELECT_INTO_SQL }, plainUserId);

        expect(res.body).toMatchObject({ error: 'Query failed' });
        expect((res.body as any).message).toMatch(/read-only transaction/i);
    });
});

describe('ai admin query endpoint — validated string is the executed string', () => {
    it('executes the sanitized SQL, not the raw request body', async () => {
        const res = await callHandler(aiAdminQueryHandler, { sql: MARKED_UP_SQL }, adminUserId);

        expect(res.body).toEqual({ success: true, rowCount: 1, data: [{ v: 1 }] });
    });

    it('coerces limit to an integer so it cannot inject SQL', async () => {
        const res = await callHandler(
            aiAdminQueryHandler,
            { sql: SANITIZED_SELECT, limit: '1; DELETE FROM users' },
            adminUserId,
        );

        expect(res.body).toMatchObject({ success: true, rowCount: 1, data: [{ v: 1 }] });
    });

    it('rejects write statements at the HTTP endpoint', async () => {
        const res = await callHandler(
            aiAdminQueryHandler,
            { sql: "INSERT INTO skus (id, name, base_unit) VALUES ('x', 'y', 'z')" },
            adminUserId,
        );

        expect(res.body).toEqual({ error: 'Query rejected', message: expect.any(String) });
        expect(res.body).not.toHaveProperty('success');
    });

    it('runs every statement inside a read-only transaction', async () => {
        // The admin route previously ran raw $queryRawUnsafe with no
        // transaction at all — a validation bypass there could write.
        const res = await callHandler(aiAdminQueryHandler, { sql: SELECT_INTO_SQL }, adminUserId);

        expect(res.body).toMatchObject({ error: 'Query failed' });
        expect((res.body as any).message).toMatch(/read-only transaction/i);
    });
});
