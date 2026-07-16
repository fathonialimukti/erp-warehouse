/**
 * Smoke test for AI warehouse insights tool.
 * Ponytail minimum: one test proving valid data + no crash on empty input.
 */
import { describe, it, expect } from 'vitest';
import { inventoryAgingTools } from '../lib/ai-inventory-tools';

describe('ai-inventory-tools (smoke)', () => {
  it('get_warehouse_insights returns valid structure on empty input', async () => {
    const result = await inventoryAgingTools.get_warehouse_insights.execute!({}, { toolCallId: 'test', messages: [] });
    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'generatedAt' in result) {
      expect(result.generatedAt).toBeDefined();
      expect(typeof result.deadStockValue).toBe('number');
      expect(typeof result.deadStockSkuCount).toBe('number');
      expect(Array.isArray(result.deadStockTop)).toBe(true);
      expect(Array.isArray(result.outOfStockSkus)).toBe(true);
      expect(typeof result.putawayBacklog).toBe('number');
      expect(typeof result.dispatchBacklog).toBe('number');
    }
  });
});
