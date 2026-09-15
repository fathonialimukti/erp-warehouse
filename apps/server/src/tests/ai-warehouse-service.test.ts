/**
 * Tests for the RAG-only AI warehouse service (ai-warehouse-service.ts).
 *
 * Coverage split:
 *  - Export surface + RAG-only guardrails: pure (no DB, no AI provider).
 *  - DB smoke: exercises the real Prisma retrieval paths (same norm as the
 *    other ai-* smoke tests), but getChatModel is mocked to throw so no test
 *    ever calls a real LLM (rate limits / cost / network). DB-dependent tests
 *    skip gracefully when no database is reachable.
 *
 * The service contract: every exported function returns `{ ... } | { error }`
 * and never throws. A throwing test below is therefore a contract violation.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import type { PutawaySuggestion, PickSuggestion } from '../lib/ai-warehouse-service.js';

// Mock the AI provider so every LLM call short-circuits to `{ error }`: the
// service's `runLlm` catches a throwing getChatModel and returns the
// "AI not configured" error instead of propagating. No network, no API key.
vi.mock('../lib/ai-provider.js', () => ({
  getChatModel: vi.fn(async () => {
    throw new Error('ai provider intentionally unavailable in tests');
  }),
}));

// vitest.config.ts sets `isolate: false`, so this worker shares one module
// registry across every test file. By the time this file runs, another file
// (helpers/caller.ts → router.ts → the ai-warehouse router) has already
// imported the REAL ai-provider, and a plain `vi.mock` would be ignored — the
// service would call the real LLM. Reset the registry first so the mock above
// takes effect for the dynamic imports below. The `getChatModel` mock is
// asserted directly, so a real provider call can never slip through silently.
vi.resetModules();
const { getChatModel } = await import('../lib/ai-provider.js');
const { prisma } = await import('../lib/prisma.js');
const {
  analyzePutawayLines,
  suggestPutawayAssignments,
  analyzePickLines,
  suggestPickAssignments,
  parsePutawaySuggestions,
  parsePickSuggestions,
  filterPutawaySuggestions,
  filterPickSuggestions,
} = await import('../lib/ai-warehouse-service.js');

// Ping the DB once at load; skip DB smoke when unreachable (e.g. CI without a
// reachable DATABASE_URL). Pure tests above still run.
let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}

describe('ai-warehouse-service exports', () => {
  it('exposes all four contract functions taking a single input object', () => {
    const fns = [analyzePutawayLines, suggestPutawayAssignments, analyzePickLines, suggestPickAssignments];
    for (const fn of fns) {
      expect(typeof fn).toBe('function');
      expect(fn.constructor.name).toBe('AsyncFunction');
      expect(fn.length).toBe(1); // single input arg, per the frozen contract
    }
  });
});

describe('ai-warehouse-service provider mock', () => {
  it('exposes the throwing getChatModel mock (no real provider reachable)', async () => {
    // Guard: if isolate:false module bleed ever re-introduces the real provider,
    // this returns a model instead of throwing and fails loudly here.
    await expect(getChatModel()).rejects.toThrow('ai provider intentionally unavailable in tests');
  });
});

describe('ai-warehouse-service RAG-only guardrails', () => {
  const source = readFileSync(new URL('../lib/ai-warehouse-service.ts', import.meta.url), 'utf8');

  it('retrieves knowledgeChunk by the approved source slugs (RAG retrieval path)', () => {
    expect(source).toMatch(/KNOWLEDGE_SOURCES\s*=\s*\['putaway',\s*'dispatch',\s*'execution-analysis'\]/);
    expect(source).toMatch(/knowledgeChunk\.findMany/);
    expect(source).toMatch(/source:\s*\{\s*in:/);
  });

  it('contains no hardcoded strategy scoring — only prose that forbids it', () => {
    // The file may mention "weights"/"scoring" inside prompts that forbid the
    // LLM from inventing them; it must never define or apply them itself.
    expect(source).not.toMatch(/\bscore\b/); // no bare `score` identifier / property
    expect(source).not.toMatch(/\b(score|weight|priority|threshold)s?\s*[:=]/); // no scoring assignments
    expect(source).not.toMatch(/\+\s*(100|30|50|15)\b/); // no hardcoded bonus/penalty constants
  });

  it('wraps every public entry point so unexpected failures return { error } (never throws)', () => {
    // The never-throws contract is enforced with a shared helper; all four
    // public functions must route their catch through it.
    expect(source).toMatch(/const unexpectedError = \(error: unknown\): ErrorResult =>/);
    expect(source.match(/return unexpectedError\(error\);/g) ?? []).toHaveLength(4);
  });

  it('distinguishes "no empty ACTIVE locations" from "nothing to assign" via notice', () => {
    expect(source).toMatch(/notice:\s*'no_empty_locations'/);
    expect(source).toMatch(/unassigned\.length === 0/);
    expect(source).toMatch(/candidates\.length === 0/);
  });
});

describe('ai-warehouse-service suggestion parsing + membership validation (pure)', () => {
  it('parsePutawaySuggestions parses the instructed JSON object shape', () => {
    const text = '{"suggestions":[{"palletId":"P1","storageLocationId":"L1","reason":"near dock"}]}';
    expect(parsePutawaySuggestions(text)).toEqual([{ palletId: 'P1', storageLocationId: 'L1', reason: 'near dock' }]);
  });

  it('parsePutawaySuggestions also accepts a bare array and returns null on invalid JSON', () => {
    expect(parsePutawaySuggestions('[{"palletId":"P1","storageLocationId":"L1","reason":"r"}]')).toEqual([
      { palletId: 'P1', storageLocationId: 'L1', reason: 'r' },
    ]);
    expect(parsePutawaySuggestions('not json')).toBeNull();
  });

  it('parsePickSuggestions parses the instructed JSON object shape and returns null on invalid JSON', () => {
    const text = '{"suggestions":[{"outboundTransactionItemId":"I1","palletId":"P1","reason":"FIFO"}]}';
    expect(parsePickSuggestions(text)).toEqual([{ outboundTransactionItemId: 'I1', palletId: 'P1', reason: 'FIFO' }]);
    expect(parsePickSuggestions('garbage')).toBeNull();
  });

  it('filterPutawaySuggestions keeps only members of the candidate sets and dedupes by palletId', () => {
    const suggestions: PutawaySuggestion[] = [
      { palletId: 'P1', storageLocationId: 'L1', reason: 'a' },
      { palletId: 'P1', storageLocationId: 'L2', reason: 'duplicate pallet' },
      { palletId: 'P9', storageLocationId: 'L1', reason: 'hallucinated pallet' },
      { palletId: 'P2', storageLocationId: 'L9', reason: 'hallucinated location' },
    ];
    const filtered = filterPutawaySuggestions(suggestions, new Set(['P1', 'P2']), new Set(['L1', 'L2']));
    expect(filtered).toEqual([{ palletId: 'P1', storageLocationId: 'L1', reason: 'a' }]);
  });

  it('filterPickSuggestions keeps only reserved pallets of real items and dedupes by itemId+palletId', () => {
    const suggestions: PickSuggestion[] = [
      { outboundTransactionItemId: 'I1', palletId: 'P1', reason: 'a' },
      { outboundTransactionItemId: 'I1', palletId: 'P1', reason: 'duplicate' },
      { outboundTransactionItemId: 'I1', palletId: 'P9', reason: 'not reserved for I1' },
      { outboundTransactionItemId: 'I9', palletId: 'P1', reason: 'item not in txn' },
    ];
    const filtered = filterPickSuggestions(suggestions, new Map([['I1', new Set(['P1', 'P2'])]]));
    expect(filtered).toEqual([{ outboundTransactionItemId: 'I1', palletId: 'P1', reason: 'a' }]);
  });
});

describe.skipIf(!dbAvailable)('ai-warehouse-service DB smoke (AI mocked off)', () => {
  it('analyzePutawayLines never throws; returns { error } when AI is unavailable', async () => {
    const result = await analyzePutawayLines({}); // if it throws, the test fails = contract violation
    expect(result).toBeDefined();
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toContain('AI not configured');
  });

  it('analyzePickLines never throws; returns { error } when AI is unavailable', async () => {
    const result = await analyzePickLines({});
    expect(result).toBeDefined();
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toContain('AI not configured');
  });

  it('suggestPutawayAssignments short-circuits to { suggestions: [] } when nothing to decide', async () => {
    const result = await suggestPutawayAssignments({
      warehouseId: 'bogus-warehouse',
      inboundTransactionId: 'bogus-inbound',
    });
    expect(result).toBeDefined();
    expect('suggestions' in result).toBe(true);
    if ('suggestions' in result) expect(result.suggestions).toEqual([]);
  });

  it('suggestPickAssignments short-circuits to { suggestions: [] } when nothing to decide', async () => {
    const result = await suggestPickAssignments({ outboundTransactionId: 'bogus-outbound' });
    expect(result).toBeDefined();
    expect('suggestions' in result).toBe(true);
    if ('suggestions' in result) expect(result.suggestions).toEqual([]);
  });
});
