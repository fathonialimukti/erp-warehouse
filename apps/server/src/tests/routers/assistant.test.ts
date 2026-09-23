/**
 * T4 — AI assistant backend contract.
 *
 * Covers the `trpcClient.assistant.*` namespace:
 * - every procedure requires `assistant@use` (FORBIDDEN without it),
 * - `getPageContext` canonicalizes the client snapshot (sanitized values,
 *   no base64/file payloads) with deterministic summary lines,
 * - `send`/`chat` echo the sanitized snapshot + missingRequired and always
 *   return a non-empty reply (LLM text when available, first-turn-safe
 *   fallback otherwise),
 * - `fillForm` / `updateItem` / `removeItem` return unpersisted proposals
 *   with sanitized values,
 * - the prompt section carries { route, formId, formValues, missingRequired }
 *   and the first-turn rule whenever a form is open.
 */
import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    buildFallbackReply,
    buildPageContextSection,
    sanitizePageContext,
    sanitizePageFormValues,
} from '../../lib/ai-page-context.js';
import { createCaller } from '../helpers/caller.js';
import { seedRoleWithPermissions, seedTestUser } from '../helpers/seed.js';
import { prisma } from '../../lib/prisma.js';

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let deniedCaller: ReturnType<typeof createCaller>;
let deniedUserId: string;
let deniedRoleId: string;

const RECEIVING_SNAPSHOT = {
    route: '/inbound-transaction/receiving/new',
    formId: 'receiving-transaction-form',
    formValues: {
        supplierId: '01J0000000000000000000001',
        warehouseId: '',
        items: [{ skuId: null, quantity: 0 }],
    },
    missingRequired: ['warehouseId', 'items[0].skuId', 'items[0].quantity'],
};

beforeAll(async () => {
    const role = await seedRoleWithPermissions(['assistant@use']);
    const actor = await seedTestUser({
        roleId: role.id,
        email: `assistant-actor-${randomUUID()}@example.com`,
        name: 'Assistant Test Actor',
    });
    actorRoleId = role.id;
    actorUserId = actor.id;
    caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });

    const deniedRole = await seedRoleWithPermissions([]);
    const denied = await seedTestUser({
        roleId: deniedRole.id,
        email: `assistant-denied-${randomUUID()}@example.com`,
        name: 'Assistant Denied Actor',
    });
    deniedRoleId = deniedRole.id;
    deniedUserId = denied.id;
    deniedCaller = createCaller({ userId: denied.id, email: denied.email, name: denied.name });
});

afterAll(async () => {
    await prisma.user.delete({ where: { id: actorUserId } });
    await prisma.role.delete({ where: { id: actorRoleId } });
    await prisma.user.delete({ where: { id: deniedUserId } });
    await prisma.role.delete({ where: { id: deniedRoleId } });
});

describe('assistant router permission guard', () => {
    it('rejects getPageContext without assistant@use', async () => {
        await expect(deniedCaller.assistant.getPageContext({})).rejects.toMatchObject({
            code: 'FORBIDDEN',
        });
    });

    it('rejects send without assistant@use', async () => {
        await expect(
            deniedCaller.assistant.send({ message: 'fill this form', pageContext: RECEIVING_SNAPSHOT }),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('rejects fillForm without assistant@use', async () => {
        await expect(
            deniedCaller.assistant.fillForm({
                formId: 'receiving-transaction-form',
                fields: { supplierId: 'x' },
            }),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
});

describe('assistant.getPageContext', () => {
    it('canonicalizes the snapshot with summary lines', async () => {
        const result = await caller.assistant.getPageContext(RECEIVING_SNAPSHOT);
        expect(result.route).toBe('/inbound-transaction/receiving/new');
        expect(result.formId).toBe('receiving-transaction-form');
        expect(result.missingRequired).toEqual([
            'warehouseId',
            'items[0].skuId',
            'items[0].quantity',
        ]);
        expect(result.summary.join('\n')).toContain('receiving-transaction-form');
        expect(result.summary.join('\n')).toContain('warehouseId');
    });

    it('strips dataUrl keys and data-URI payloads', async () => {
        const result = await caller.assistant.getPageContext({
            route: '/inbound-transaction/receiving/new',
            formId: 'receiving-transaction-form',
            formValues: {
                supplierId: 's1',
                files: [{ name: 'a.pdf', dataUrl: 'data:application/pdf;base64,QUJD' }],
                note: 'data:image/png;base64,iVBORw0KGgo=',
            },
            missingRequired: [],
        });
        expect(JSON.stringify(result.formValues)).not.toContain('dataUrl');
        expect(JSON.stringify(result.formValues)).not.toContain('base64');
    });

    it('defaults an empty snapshot to the list-page shape', async () => {
        const result = await caller.assistant.getPageContext({});
        expect(result.route).toBe('/');
        expect(result.formId).toBeNull();
        expect(result.missingRequired).toEqual([]);
        expect(result.summary.join('\n')).toContain('list/detail page');
    });
});

describe('assistant.send / assistant.chat', () => {
    it('send returns a non-empty reply with the sanitized snapshot echo', async () => {
        const result = await caller.assistant.send({
            message: 'fill this form',
            pageContext: RECEIVING_SNAPSHOT,
        });
        expect(typeof result.reply).toBe('string');
        expect(result.reply.length).toBeGreaterThan(0);
        expect(result.pageContext.formId).toBe('receiving-transaction-form');
        expect(result.missingRequired).toEqual(RECEIVING_SNAPSHOT.missingRequired);
        expect(result.summary.join('\n')).toContain('receiving-transaction-form');
    });

    it('chat alias behaves like send', async () => {
        const result = await caller.assistant.chat({
            message: 'what am I seeing?',
            pageContext: { route: '/skus', formId: null, formValues: {}, missingRequired: [] },
        });
        expect(typeof result.reply).toBe('string');
        expect(result.reply.length).toBeGreaterThan(0);
        expect(result.pageContext.route).toBe('/skus');
        expect(result.pageContext.formId).toBeNull();
    });

    it('rejects an empty message', async () => {
        await expect(
            caller.assistant.send({ message: '   ', pageContext: {} }),
        ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('short-circuits help-me-fill with a stale snapshot to a refresh reply', async () => {
        const result = await caller.assistant.send({
            message: 'help me fill this form',
            pageContext: {},
        });
        expect(result.reply).toContain('getPageContext');
        expect(result.reply).not.toMatch(/which module\/page/i);
    });

    it('lets non-page questions through with a stale snapshot', async () => {
        const result = await caller.assistant.send({
            message: 'how many SKUs do we have?',
            pageContext: {},
        });
        expect(result.reply.length).toBeGreaterThan(0);
        expect(result.reply).not.toContain('no page snapshot was attached');
    });
});

describe('assistant fill proposals', () => {
    it('fillForm returns an unpersisted, sanitized proposal', async () => {
        const result = await caller.assistant.fillForm({
            formId: 'receiving-transaction-form',
            fields: {
                supplierId: 's1',
                attachment: { name: 'x', dataUrl: 'data:x;base64,AAA' },
            },
        });
        expect(result.formId).toBe('receiving-transaction-form');
        expect(result.applied).toBe(false);
        expect(result.fields.supplierId).toBe('s1');
        expect(JSON.stringify(result.fields)).not.toContain('dataUrl');
        expect(result.message).toContain('Proposal only');
    });

    it('updateItem returns an unpersisted row-patch proposal', async () => {
        const result = await caller.assistant.updateItem({
            formId: 'receiving-transaction-form',
            index: 0,
            patch: { skuId: 'sku-1', quantity: 5 },
        });
        expect(result).toMatchObject({
            formId: 'receiving-transaction-form',
            index: 0,
            applied: false,
        });
        expect(result.patch).toMatchObject({ skuId: 'sku-1', quantity: 5 });
    });

    it('removeItem returns an unpersisted row-removal proposal', async () => {
        const result = await caller.assistant.removeItem({
            formId: 'receiving-transaction-form',
            index: 2,
        });
        expect(result).toMatchObject({
            formId: 'receiving-transaction-form',
            index: 2,
            applied: false,
        });
    });

    it('rejects a negative item index', async () => {
        await expect(
            caller.assistant.removeItem({ formId: 'receiving-transaction-form', index: -1 }),
        ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
});

describe('ai-page-context prompt contract', () => {
    it('section carries route/formId/values/missingRequired with the first-turn rule', () => {
        const section = buildPageContextSection(sanitizePageContext(RECEIVING_SNAPSHOT));
        expect(section).toContain('/inbound-transaction/receiving/new');
        expect(section).toContain('receiving-transaction-form');
        expect(section).toContain('warehouseId');
        expect(section).toContain('items[0].skuId');
        expect(section).toContain('NEVER ask "which module/page"');
    });

    it('section without a form targets the list/detail first-turn rule', () => {
        const section = buildPageContextSection(
            sanitizePageContext({ route: '/skus', formId: null, formValues: {}, missingRequired: [] }),
        );
        expect(section).toContain('/skus');
        expect(section).toContain('NEVER ask "which module/page"');
        expect(section).toContain('list/detail page');
    });

    it('fallback reply names the page + missing fields instead of asking which module', () => {
        const reply = buildFallbackReply(sanitizePageContext(RECEIVING_SNAPSHOT));
        expect(reply).toContain('receiving-transaction-form');
        expect(reply).toContain('warehouseId');
        expect(reply).not.toMatch(/which module\/page/i);
    });

    it('sanitizer drops nested dataUrl payloads and truncates huge strings', () => {
        const cleaned = sanitizePageFormValues({
            items: [{ skuId: 's', files: [{ dataUrl: 'data:x;base64,AAA' }] }],
            blob: `data:text/plain;base64,${'A'.repeat(10)}`,
            huge: 'x'.repeat(5000),
        });
        expect(JSON.stringify(cleaned)).not.toContain('dataUrl');
        expect(JSON.stringify(cleaned)).not.toContain('base64');
        expect(cleaned.huge).toContain('[truncated]');
    });

    it('sentinel snapshot section flags the missing snapshot instead of a real page', () => {
        const section = buildPageContextSection(sanitizePageContext(undefined));
        expect(section).toContain('NO live snapshot was attached');
        expect(section).toContain('NEVER ask "which module/page"');
    });

    it('forgiving canonicalization never throws on garbage input', () => {
        expect(sanitizePageContext(undefined)).toEqual({
            route: '/',
            formId: null,
            formValues: {},
            missingRequired: [],
        });
        expect(sanitizePageContext('nope')).toEqual({
            route: '/',
            formId: null,
            formValues: {},
            missingRequired: [],
        });
    });
});

describe('T11 — multi-row + select-options fill contract', () => {
    it('form section carries multi-row/items + select-resolution + follow-up rules', () => {
        const section = buildPageContextSection(sanitizePageContext(RECEIVING_SNAPSHOT));
        // N rows, not just the first one.
        expect(section).toContain('items: [{ skuId, quantity, details }');
        // Select label→id resolution via the option maps, never guessed.
        expect(section).toContain('selectOptions');
        expect(section).toContain('never invent or guess an id or name');
        // missingRequired drives follow-ups.
        expect(section).toContain('missingRequired');
        expect(section).toContain('requestFormInput');
    });

    it('list-page section omits the form-fill rules', () => {
        const section = buildPageContextSection(
            sanitizePageContext({ route: '/skus', formId: null, formValues: {}, missingRequired: [] }),
        );
        expect(section).not.toContain('Form-fill rules');
    });

    it('fillForm accepts an N-row items[] proposal unpersisted', async () => {
        const result = await caller.assistant.fillForm({
            formId: 'receiving-transaction-form',
            fields: {
                supplierId: '01J0000000000000000000001',
                warehouseId: '01J0000000000000000000002',
                items: [
                    { skuId: '01J0000000000000000000011', quantity: 50, details: 'batch 1' },
                    { skuId: '01J0000000000000000000012', quantity: 20, details: '' },
                    { skuId: '01J0000000000000000000013', quantity: 5, details: 'fragile' },
                ],
            },
        });
        expect(result.applied).toBe(false);
        expect(result.fields.supplierId).toBe('01J0000000000000000000001');
        const items = result.fields.items as Array<Record<string, unknown>>;
        expect(items).toHaveLength(3);
        expect(items[1]).toMatchObject({ skuId: '01J0000000000000000000012', quantity: 20 });
        expect(result.message).toContain('Proposal only');
    });

    it('fillForm sanitizer keeps item rows while dropping file payloads', () => {
        const cleaned = sanitizePageFormValues({
            items: [
                { skuId: 's1', quantity: 2, files: [{ dataUrl: 'data:x;base64,AAA' }] },
                { skuId: 's2', quantity: 3, details: 'ok' },
            ],
        });
        const items = cleaned.items as Array<Record<string, unknown>>;
        expect(items).toHaveLength(2);
        expect(items[0]).toMatchObject({ skuId: 's1', quantity: 2 });
        expect(JSON.stringify(cleaned)).not.toContain('dataUrl');
    });
});
