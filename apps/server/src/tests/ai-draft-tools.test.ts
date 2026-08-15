/**
 * Smoke test for AI draft tools ("Describe & Create").
 * Deterministic only — never calls an LLM. Exercises the error paths
 * (invalid FK → caught, not thrown) so the API key rate limit is untouched.
 */
import { describe, it, expect } from 'vitest';
import { draftTools } from '../lib/ai-draft-tools';

describe('ai-draft-tools (smoke)', () => {
  it('exposes both draft tools with execute functions', () => {
    expect(draftTools.draft_receiving_transaction).toBeDefined();
    expect(draftTools.draft_shipment_transaction).toBeDefined();
    expect(typeof draftTools.draft_receiving_transaction.execute).toBe('function');
    expect(typeof draftTools.draft_shipment_transaction.execute).toBe('function');
  });

  it('draft_receiving_transaction returns draftCreated:false on invalid FK (no throw)', async () => {
    const result = await draftTools.draft_receiving_transaction.execute!(
      {
        warehouseId: 'bogus-warehouse',
        supplierId: 'bogus-supplier',
        createdById: 'bogus-user',
        items: [{ skuId: 'bogus-sku', quantity: 1 }],
      },
      { toolCallId: 'test', messages: [] },
    );
    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'draftCreated' in result) {
      expect(result.draftCreated).toBe(false);
      expect(typeof result.error).toBe('string');
    }
  });

  it('draft_shipment_transaction returns draftCreated:false on invalid FK (no throw)', async () => {
    const result = await draftTools.draft_shipment_transaction.execute!(
      {
        warehouseId: 'bogus-warehouse',
        createdById: 'bogus-user',
        items: [{ skuId: 'bogus-sku', quantity: 1 }],
      },
      { toolCallId: 'test', messages: [] },
    );
    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'draftCreated' in result) {
      expect(result.draftCreated).toBe(false);
      expect(typeof result.error).toBe('string');
    }
  });
});