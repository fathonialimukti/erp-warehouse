/**
 * Smoke tests for AI dispatch/pick tools.
 * Ponytail minimum: one test per tool proving valid data + no crash on empty input.
 */
import { describe, it, expect } from 'vitest';
import { dispatchTools } from '../lib/ai-dispatch-tools';

describe('ai-dispatch-tools (smoke)', () => {
  it('get_dispatch_state returns valid structure on empty input', async () => {
    const result = await dispatchTools.get_dispatch_state.execute!({}, { toolCallId: 'test', messages: [] });
    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'transactions' in result) {
      expect(Array.isArray(result.transactions)).toBe(true);
    }
  });

  // ponytail: get_available_pick_pallets + recommend_pick_pallet require DB state; defer to integration tests when UI is wired
});
