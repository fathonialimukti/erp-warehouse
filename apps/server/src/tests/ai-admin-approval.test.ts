import { describe, expect, it } from "vitest";
import {
  adminTools,
  ensureReturning,
  isWriteSql,
} from "../lib/ai-admin-tools.js";
import { draftTools } from "../lib/ai-draft-tools.js";
import { reorderTools } from "../lib/ai-reorder-tools.js";

// Minimal shape of the AI SDK needsApproval gate: (input, options) => boolean | Promise<boolean>.
type NeedsApprovalFn = (
  input: unknown,
  options: { toolCallId: string; messages: never[] },
) => boolean | Promise<boolean>;

const GATE_OPTIONS = { toolCallId: "test", messages: [] };

const expectGate = async (
  gate: unknown,
  input: unknown,
  expected: boolean,
): Promise<void> => {
  expect(typeof gate).toBe("function");
  expect(await (gate as NeedsApprovalFn)(input, GATE_OPTIONS)).toBe(expected);
};

describe("draft tool approval gates (AI SDK v6 needsApproval exposed on tool object)", () => {
  it("gates draft_receiving_transaction", async () => {
    await expectGate(
      draftTools.draft_receiving_transaction.needsApproval,
      {},
      true,
    );
  });

  it("gates draft_shipment_transaction", async () => {
    await expectGate(
      draftTools.draft_shipment_transaction.needsApproval,
      {},
      true,
    );
  });

  it("gates draft_reorder_receiving", async () => {
    await expectGate(
      reorderTools.draft_reorder_receiving.needsApproval,
      {},
      true,
    );
  });
});

describe("admin executeSql approval gate direction", () => {
  it("lets reads run without approval", async () => {
    await expectGate(
      adminTools.executeSql.needsApproval,
      { sql: "SELECT 1" },
      false,
    );
  });

  it("pauses writes for approval", async () => {
    await expectGate(
      adminTools.executeSql.needsApproval,
      { sql: "DELETE FROM skus" },
      true,
    );
  });
});

describe("isWriteSql", () => {
  it("flags INSERT/UPDATE/DELETE case-insensitively with leading whitespace", () => {
    expect(isWriteSql(" INSERT INTO skus (id) VALUES (1)")).toBe(true);
    expect(isWriteSql("update skus set x = 1")).toBe(true);
    expect(isWriteSql("DELETE FROM skus;")).toBe(true);
  });

  it("does not flag reads", () => {
    expect(isWriteSql("SELECT * FROM skus")).toBe(false);
    expect(isWriteSql("WITH t AS (SELECT 1) SELECT * FROM t")).toBe(false);
    expect(isWriteSql("EXPLAIN ANALYZE SELECT 1")).toBe(false);
  });
});

describe("ensureReturning", () => {
  it("appends RETURNING * and strips a trailing semicolon", () => {
    expect(
      ensureReturning("UPDATE skus SET description = 'x' WHERE id = 1;"),
    ).toBe("UPDATE skus SET description = 'x' WHERE id = 1 RETURNING *");
  });

  it("keeps an existing RETURNING clause untouched", () => {
    expect(ensureReturning("UPDATE skus SET x = 1 RETURNING id")).toBe(
      "UPDATE skus SET x = 1 RETURNING id",
    );
  });

  it("does not mistake a bare `returning` column in a predicate for a RETURNING clause", () => {
    // These are the false-match paths the old `(?!\s*[=<>!])` lookahead missed:
    // `returning` is a column, so RETURNING * must still be appended.
    expect(
      ensureReturning("UPDATE skus SET flagged = true WHERE returning IS NULL"),
    ).toBe(
      "UPDATE skus SET flagged = true WHERE returning IS NULL RETURNING *",
    );
    expect(
      ensureReturning(
        "UPDATE skus SET flagged = true WHERE returning LIKE 'a%'",
      ),
    ).toBe(
      "UPDATE skus SET flagged = true WHERE returning LIKE 'a%' RETURNING *",
    );
    expect(
      ensureReturning(
        "UPDATE skus SET flagged = true WHERE returning BETWEEN 1 AND 2",
      ),
    ).toBe(
      "UPDATE skus SET flagged = true WHERE returning BETWEEN 1 AND 2 RETURNING *",
    );
  });

  it("still detects a real RETURNING clause after a `returning` column reference", () => {
    expect(
      ensureReturning(
        "UPDATE skus SET x = 1 WHERE returning IS NULL RETURNING id",
      ),
    ).toBe("UPDATE skus SET x = 1 WHERE returning IS NULL RETURNING id");
  });
});
