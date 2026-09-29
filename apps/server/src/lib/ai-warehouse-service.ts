/* eslint-disable @typescript-eslint/no-explicit-any -- intentional at AI/serialization boundaries */
import { generateText } from "ai";
import { prisma } from "./prisma.js";
import { getChatModel } from "./ai-provider.js";
import { parseLocationId } from "./ai-putaway-tools.js";

/**
 * RAG-only AI warehouse service: putaway/pick analysis + assignment suggestions.
 *
 * This is the replacement for the old deterministic putaway/pick scorers
 * (ai-putaway-tools / ai-dispatch-tools scoreLocation / scorePallet). Every
 * decision is delegated to the LLM, which reasons ONLY from:
 *   (a) raw operational FACTS gathered via Prisma (no scoring, no weights), and
 *   (b) behavior documents retrieved from the knowledge base (knowledge_chunks)
 *       by source slug.
 * This file never applies weights, priorities, or thresholds itself.
 *
 * Error convention: functions never throw. They return `{ error: string }`
 * results for failures (unconfigured AI, provider errors, unparseable model
 * output, unexpected DB/query failures) and `{ suggestions: [] }` when there
 * is nothing to decide — the tRPC router layer maps these to TRPCErrors as
 * needed. The happy-path shapes match the frozen contract:
 *   - analyze* → `{ markdown: string }`
 *   - suggest* → `{ suggestions: [...] }`
 * suggestPutawayAssignments additionally distinguishes "unassigned pallets
 * exist but no empty ACTIVE locations" with `{ suggestions: [], notice:
 * 'no_empty_locations' }`.
 *
 * Contract enforcement (not strategy): LLM suggestion output is filtered
 * against the candidate sets gathered from the DB (palletIds, location ids,
 * item ids) and deduped before being returned — the LLM can only suggest
 * members of the facts it was shown.
 */

// ============================================================
// Types (contract shapes + internal fact shapes)
// ============================================================

export type PutawayAnalysisInput = {
  warehouseId?: string;
  inboundTransactionId?: string;
};
export type PickAnalysisInput = {
  warehouseId?: string;
  outboundTransactionId?: string;
};

export type PutawaySuggestion = {
  palletId: string;
  storageLocationId: string;
  reason: string;
};
export type PickSuggestion = {
  outboundTransactionItemId: string;
  palletId: string;
  reason: string;
};

type ErrorResult = { error: string };

type LocationFact = {
  storageLocationId: string;
  type: string | null;
  seq: number | null;
};

type PutawayLineFact = {
  palletId: string;
  skuId: string | null;
  skuName: string | null;
  skuType: string | null;
  status: string;
  ageDays: number;
};

type PutawayTxnFact = {
  inboundTransactionId: string;
  transactionType: string;
  documentNumber: string | null;
  warehouseId: string;
  putawayStatus: string;
  completionRate: number;
  lines: PutawayLineFact[];
};

type PutawayFacts = {
  transactions: PutawayTxnFact[];
  /** key: `${warehouseId}|${skuId}` → locations currently holding a pallet of that SKU (raw same-SKU consolidation fact). */
  sameSkuLocationsByKey: Map<string, LocationFact[]>;
  /** key: warehouseId → empty ACTIVE storage locations (candidates). */
  candidateLocationsByWarehouse: Map<string, LocationFact[]>;
};

type UnassignedPalletFact = {
  palletId: string;
  skuId: string | null;
  skuName: string | null;
  skuType: string | null;
  ageDays: number;
  warehouseId: string;
};

type PickLineFact = {
  palletId: string;
  outboundTransactionItemId: string | null;
  skuName: string | null;
  skuType: string | null;
  storageLocationId: string | null;
  status: string;
  ageDays: number;
};

type PickItemFact = {
  outboundTransactionItemId: string;
  skuId: string;
  skuName: string | null;
  skuType: string | null;
  reservedPallets: PickLineFact[];
};

type PickTxnFact = {
  outboundTransactionId: string;
  transactionType: string;
  documentNumber: string | null;
  warehouseId: string;
  dispatchStatus: string;
  completionRate: number;
  items: PickItemFact[];
};

type PickFacts = { transactions: PickTxnFact[] };

// ============================================================
// Constants
// ============================================================

/** Approved IN transaction models that generate PutawayLines (mirrors ai-putaway-tools.ts). */
const PUTAWAY_MODELS: Record<string, any> = {
  RECEIVING: prisma.receivingTransaction,
  WIP_COMPLETION: prisma.wipCompletion,
  RMA_RECEIPT: prisma.rmaReceipt,
  FOUND: prisma.foundTransaction,
};

/** Approved OUT transaction models that generate PickLines (mirrors ai-dispatch-tools.ts). */
const DISPATCH_MODELS: Record<string, any> = {
  WIP_ISSUE: prisma.wipIssue,
  SHIPMENT: prisma.shipment,
  RETURN_TO_SUPPLIER: prisma.returnToSupplier,
  DISPOSAL: prisma.disposal,
};

/** Outbound item table per dispatch type — used to resolve each reserved pallet's outboundTransactionItemId. */
const PICK_ITEM_MODELS: Record<string, { model: any; fkField: string }> = {
  WIP_ISSUE: { model: prisma.wipIssueItem, fkField: "wipIssueId" },
  SHIPMENT: { model: prisma.shipmentItem, fkField: "shipmentId" },
  RETURN_TO_SUPPLIER: {
    model: prisma.returnToSupplierItem,
    fkField: "returnToSupplierId",
  },
  DISPOSAL: { model: prisma.disposalItem, fkField: "disposalId" },
};

/** Behavior doc sources (slugs) the RAG retrieval pulls from. */
const KNOWLEDGE_SOURCES = [
  "putaway",
  "dispatch",
  "execution-analysis",
] as const;

/** Short degradation note injected when no knowledge chunks are available (never throws). */
const KNOWLEDGE_FALLBACK_NOTE =
  "No knowledge base documents were found for this operation. Base your decisions strictly on the operational facts below — do not invent rules, weights, or priorities.";

const AI_NOT_CONFIGURED_ERROR =
  "AI not configured: no chat model available. Set ai.baseUrl / ai.apiKey / ai.model (or AI_BASE_URL / AI_API_KEY / AI_MODEL) in Settings.";

// ============================================================
// Small helpers
// ============================================================

const ageInDays = (createdAt: Date): number =>
  Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 86_400_000));

const parseLocationFact = (locationId: string): LocationFact => {
  const parsed = parseLocationId(locationId);
  return {
    storageLocationId: locationId,
    type: parsed?.type ?? null,
    seq: parsed?.seq ?? null,
  };
};

/**
 * Behavior docs by source slug, formatted in the formatKnowledgeHits markdown
 * style (rag.ts). Gracefully degrades to a short fallback note — never throws.
 */
const retrieveKnowledge = async (): Promise<string> => {
  try {
    const chunks = await prisma.knowledgeChunk.findMany({
      where: { source: { in: [...KNOWLEDGE_SOURCES] } },
      select: { title: true, content: true },
      orderBy: { title: "asc" },
      take: 50, // bound prompt size/cost — knowledge grows with every ingested doc
    });
    if (chunks.length === 0) return KNOWLEDGE_FALLBACK_NOTE;
    return chunks
      .map((chunk) => `### ${chunk.title}\n${chunk.content}`)
      .join("\n\n");
  } catch {
    return KNOWLEDGE_FALLBACK_NOTE; // degrade — the LLM still gets the operational facts
  }
};

type LlmResult = { ok: true; text: string } | { ok: false; error: string };

/** Single generateText call; surfaces unconfigured AI + provider errors as { error } results. */
const runLlm = async (system: string, prompt: string): Promise<LlmResult> => {
  let model: Awaited<ReturnType<typeof getChatModel>>;
  try {
    model = await getChatModel();
  } catch {
    return { ok: false, error: AI_NOT_CONFIGURED_ERROR };
  }
  try {
    const { text } = await generateText({
      model,
      system,
      prompt,
      temperature: 0,
    });
    return { ok: true, text };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { ok: false, error: `AI analysis failed: ${message}` };
  }
};

/** Strip markdown fences, then JSON.parse. Returns null on failure. */
const parseJson = (text: string): unknown => {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  if (!cleaned) return null;
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
};

/** Accept either `{ "suggestions": [...] }` (instructed shape) or a bare array. */
const parseSuggestionList = (
  text: string,
): Array<Record<string, unknown>> | null => {
  const parsed = parseJson(text);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const suggestions = (parsed as { suggestions?: unknown }).suggestions;
    if (Array.isArray(suggestions)) return suggestions;
  }
  return null;
};

export const parsePutawaySuggestions = (
  text: string,
): PutawaySuggestion[] | null => {
  const list = parseSuggestionList(text);
  if (!list) return null;
  const suggestions: PutawaySuggestion[] = [];
  for (const item of list) {
    const { palletId, storageLocationId, reason } = item;
    if (
      typeof palletId === "string" &&
      typeof storageLocationId === "string" &&
      typeof reason === "string"
    ) {
      suggestions.push({ palletId, storageLocationId, reason });
    }
  }
  return suggestions;
};

export const parsePickSuggestions = (text: string): PickSuggestion[] | null => {
  const list = parseSuggestionList(text);
  if (!list) return null;
  const suggestions: PickSuggestion[] = [];
  for (const item of list) {
    const { outboundTransactionItemId, palletId, reason } = item;
    if (
      typeof outboundTransactionItemId === "string" &&
      typeof palletId === "string" &&
      typeof reason === "string"
    ) {
      suggestions.push({ outboundTransactionItemId, palletId, reason });
    }
  }
  return suggestions;
};

/**
 * Membership validation (contract enforcement, NOT strategy scoring): keep only
 * suggestions whose ids are members of the candidate sets gathered from the DB,
 * and dedupe by palletId and storageLocationId (the prompt promises each pallet
 * and each location at most once). Reasons are kept verbatim from the LLM.
 */
export const filterPutawaySuggestions = (
  suggestions: PutawaySuggestion[],
  allowedPalletIds: ReadonlySet<string>,
  allowedStorageLocationIds: ReadonlySet<string>,
): PutawaySuggestion[] => {
  const seenPalletIds = new Set<string>();
  const seenStorageLocationIds = new Set<string>();
  const filtered: PutawaySuggestion[] = [];
  for (const suggestion of suggestions) {
    if (!allowedPalletIds.has(suggestion.palletId)) continue;
    if (!allowedStorageLocationIds.has(suggestion.storageLocationId)) continue;
    if (seenPalletIds.has(suggestion.palletId)) continue; // each pallet at most once
    if (seenStorageLocationIds.has(suggestion.storageLocationId)) continue; // each location at most once
    seenPalletIds.add(suggestion.palletId);
    seenStorageLocationIds.add(suggestion.storageLocationId);
    filtered.push(suggestion);
  }
  return filtered;
};

/**
 * Membership validation (contract enforcement, NOT strategy scoring): keep only
 * suggestions whose outboundTransactionItemId is a real item and whose palletId
 * is a reserved pallet of that item; dedupe by itemId+palletId. Reasons kept.
 */
export const filterPickSuggestions = (
  suggestions: PickSuggestion[],
  allowedPalletsByItem: ReadonlyMap<string, ReadonlySet<string>>,
): PickSuggestion[] => {
  const seenKeys = new Set<string>();
  const filtered: PickSuggestion[] = [];
  for (const suggestion of suggestions) {
    const reservedPallets = allowedPalletsByItem.get(
      suggestion.outboundTransactionItemId,
    );
    if (!reservedPallets?.has(suggestion.palletId)) continue;
    const key = `${suggestion.outboundTransactionItemId}|${suggestion.palletId}`;
    if (seenKeys.has(key)) continue; // dedupe by itemId+palletId
    seenKeys.add(key);
    filtered.push(suggestion);
  }
  return filtered;
};

// ============================================================
// Facts gathering (raw Prisma reads — NO scoring)
// ============================================================

const gatherPutawayFacts = async (input: {
  warehouseId?: string;
  inboundTransactionId?: string;
}): Promise<PutawayFacts> => {
  // Approved IN transactions (all putaway-capable models) with PENDING/PARTIAL putaway.
  const txns: Array<{
    id: string;
    documentNumber: string | null;
    warehouseId: string;
    putawayStatus: string;
    transactionType: string;
  }> = [];
  for (const [type, model] of Object.entries(PUTAWAY_MODELS)) {
    const rows = await model.findMany({
      where: {
        approvalStatus: "APPROVED",
        putawayStatus: { in: ["PENDING", "PARTIAL"] },
        ...(input.warehouseId ? { warehouseId: input.warehouseId } : {}),
        ...(input.inboundTransactionId
          ? { id: input.inboundTransactionId }
          : {}),
      },
      select: {
        id: true,
        documentNumber: true,
        warehouseId: true,
        putawayStatus: true,
      },
      orderBy: { date: "asc" },
      take: 50,
    });
    for (const row of rows) txns.push({ ...row, transactionType: type });
  }

  const sameSkuLocationsByKey = new Map<string, LocationFact[]>();
  const candidateLocationsByWarehouse = new Map<string, LocationFact[]>();

  if (txns.length > 0) {
    // Putaway lines (PENDING + COMPLETED) with aging + SKU info.
    const lines = await prisma.putawayLine.findMany({
      where: {
        documentId: { in: txns.map((t) => t.id) },
        status: { in: ["PENDING", "COMPLETED"] },
      },
      select: {
        palletId: true,
        documentId: true,
        status: true,
        createdAt: true,
        pallet: {
          select: { skuId: true, sku: { select: { name: true, type: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Locations already holding the same SKU per warehouse (raw consolidation fact).
    const pendingSkuIds = [
      ...new Set(
        lines.filter((l) => l.status === "PENDING").map((l) => l.pallet.skuId),
      ),
    ];
    if (pendingSkuIds.length > 0) {
      const sameSkuRows = await prisma.pallet.findMany({
        where: {
          skuId: { in: pendingSkuIds },
          storageLocationId: { not: null },
        },
        select: {
          skuId: true,
          storageLocationId: true,
          storageLocation: { select: { warehouseId: true } },
        },
      });
      for (const row of sameSkuRows) {
        if (!row.storageLocationId || !row.storageLocation) continue;
        const key = `${row.storageLocation.warehouseId}|${row.skuId}`;
        const list = sameSkuLocationsByKey.get(key) ?? [];
        list.push(parseLocationFact(row.storageLocationId));
        sameSkuLocationsByKey.set(key, list);
      }
    }

    // Candidate storage locations: empty (no pallet) + ACTIVE, per warehouse.
    const candidateRows = await prisma.storageLocation.findMany({
      where: {
        status: "ACTIVE",
        pallet: null,
        ...(input.warehouseId ? { warehouseId: input.warehouseId } : {}),
      },
      select: { id: true, warehouseId: true },
      orderBy: { id: "asc" },
    });
    for (const row of candidateRows) {
      const list = candidateLocationsByWarehouse.get(row.warehouseId) ?? [];
      list.push(parseLocationFact(row.id));
      candidateLocationsByWarehouse.set(row.warehouseId, list);
    }

    const linesByTxn = new Map<string, typeof lines>();
    for (const line of lines) {
      const list = linesByTxn.get(line.documentId) ?? [];
      list.push(line);
      linesByTxn.set(line.documentId, list);
    }

    const transactions: PutawayTxnFact[] = txns.map((txn) => {
      const txnLines = linesByTxn.get(txn.id) ?? [];
      const completed = txnLines.filter((l) => l.status === "COMPLETED").length;
      const completionRate =
        txnLines.length > 0
          ? Math.round((completed / txnLines.length) * 100)
          : 0;
      return {
        inboundTransactionId: txn.id,
        transactionType: txn.transactionType,
        documentNumber: txn.documentNumber,
        warehouseId: txn.warehouseId,
        putawayStatus: txn.putawayStatus,
        completionRate,
        lines: txnLines.map((l) => ({
          palletId: l.palletId,
          skuId: l.pallet.skuId,
          skuName: l.pallet.sku?.name ?? null,
          skuType: l.pallet.sku?.type ?? null,
          status: l.status,
          ageDays: ageInDays(l.createdAt),
        })),
      };
    });

    return {
      transactions,
      sameSkuLocationsByKey,
      candidateLocationsByWarehouse,
    };
  }

  return {
    transactions: [],
    sameSkuLocationsByKey,
    candidateLocationsByWarehouse,
  };
};

const listUnassignedPallets = (facts: PutawayFacts): UnassignedPalletFact[] => {
  const out: UnassignedPalletFact[] = [];
  for (const txn of facts.transactions) {
    for (const line of txn.lines) {
      if (line.status !== "PENDING") continue;
      out.push({
        palletId: line.palletId,
        skuId: line.skuId,
        skuName: line.skuName,
        skuType: line.skuType,
        ageDays: line.ageDays,
        warehouseId: txn.warehouseId,
      });
    }
  }
  return out;
};

const gatherPickFacts = async (input: {
  warehouseId?: string;
  outboundTransactionId?: string;
}): Promise<PickFacts> => {
  // Approved OUT transactions (all dispatch models) with PENDING/PARTIAL dispatch.
  const txns: Array<{
    id: string;
    documentNumber: string | null;
    warehouseId: string;
    dispatchStatus: string;
    transactionType: string;
  }> = [];
  const txnIdsByType = new Map<string, string[]>();
  for (const [type, model] of Object.entries(DISPATCH_MODELS)) {
    const rows = await model.findMany({
      where: {
        approvalStatus: "APPROVED",
        dispatchStatus: { in: ["PENDING", "PARTIAL"] },
        ...(input.warehouseId ? { warehouseId: input.warehouseId } : {}),
        ...(input.outboundTransactionId
          ? { id: input.outboundTransactionId }
          : {}),
      },
      select: {
        id: true,
        documentNumber: true,
        warehouseId: true,
        dispatchStatus: true,
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    const ids: string[] = [];
    for (const row of rows) {
      txns.push({ ...row, transactionType: type });
      ids.push(row.id);
    }
    txnIdsByType.set(type, ids);
  }
  if (txns.length === 0) return { transactions: [] };

  // Outbound item rows per type → (txn → skuId → itemId) for outboundTransactionItemId resolution.
  const itemsByTxn = new Map<string, Array<{ id: string; skuId: string }>>();
  for (const [type, { model, fkField }] of Object.entries(PICK_ITEM_MODELS)) {
    const ids = txnIdsByType.get(type) ?? [];
    if (ids.length === 0) continue;
    const rows = await model.findMany({
      where: { [fkField]: { in: ids } },
      select: { id: true, skuId: true, [fkField]: true },
    });
    for (const row of rows) {
      const parentId = row[fkField];
      const list = itemsByTxn.get(parentId) ?? [];
      list.push({ id: row.id, skuId: row.skuId });
      itemsByTxn.set(parentId, list);
    }
  }

  // Pick lines (PENDING + COMPLETED) with aging, SKU, location, and item resolution.
  const lines = await prisma.pickLine.findMany({
    where: {
      documentId: { in: txns.map((t) => t.id) },
      status: { in: ["PENDING", "COMPLETED"] },
    },
    select: {
      palletId: true,
      documentId: true,
      status: true,
      createdAt: true,
      pallet: {
        select: {
          skuId: true,
          sourceItemId: true,
          storageLocationId: true,
          sku: { select: { name: true, type: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const transactions: PickTxnFact[] = txns.map((txn) => {
    const txnLines = lines.filter((l) => l.documentId === txn.id);
    const completed = txnLines.filter((l) => l.status === "COMPLETED").length;
    const completionRate =
      txnLines.length > 0 ? Math.round((completed / txnLines.length) * 100) : 0;

    // Reserved pallets per outbound item (same derivation as the dispatch router).
    const itemBySku = new Map(
      (itemsByTxn.get(txn.id) ?? []).map((it) => [it.skuId, it.id]),
    );
    const linesByItem = new Map<string, PickLineFact[]>();
    for (const line of txnLines) {
      const itemId =
        line.pallet.sourceItemId ??
        (line.pallet.skuId ? (itemBySku.get(line.pallet.skuId) ?? null) : null);
      const fact: PickLineFact = {
        palletId: line.palletId,
        outboundTransactionItemId: itemId,
        skuName: line.pallet.sku?.name ?? null,
        skuType: line.pallet.sku?.type ?? null,
        storageLocationId: line.pallet.storageLocationId ?? null,
        status: line.status,
        ageDays: ageInDays(line.createdAt),
      };
      if (itemId) {
        const list = linesByItem.get(itemId) ?? [];
        list.push(fact);
        linesByItem.set(itemId, list);
      }
    }

    const items: PickItemFact[] = (itemsByTxn.get(txn.id) ?? []).map((it) => {
      const reservedPallets = linesByItem.get(it.id) ?? [];
      const first = reservedPallets[0];
      return {
        outboundTransactionItemId: it.id,
        skuId: it.skuId,
        skuName: first?.skuName ?? null,
        skuType: first?.skuType ?? null,
        reservedPallets,
      };
    });

    return {
      outboundTransactionId: txn.id,
      transactionType: txn.transactionType,
      documentNumber: txn.documentNumber,
      warehouseId: txn.warehouseId,
      dispatchStatus: txn.dispatchStatus,
      completionRate,
      items,
    };
  });

  return { transactions };
};

// ============================================================
// Facts → prompt markdown
// ============================================================

const formatPutawayFacts = (facts: PutawayFacts): string => {
  if (facts.transactions.length === 0)
    return "No pending putaway transactions found in the given scope.";

  const parts: string[] = [
    `## Pending Putaway Transactions (${facts.transactions.length})`,
  ];
  facts.transactions.forEach((txn, index) => {
    const pending = txn.lines.filter((l) => l.status === "PENDING").length;
    parts.push(
      [
        `${index + 1}. Transaction ${txn.inboundTransactionId} [${txn.transactionType}] — doc ${txn.documentNumber ?? "n/a"}`,
        `   - warehouse: ${txn.warehouseId} | putaway status: ${txn.putawayStatus} | completion: ${txn.completionRate}% (${txn.lines.length - pending} of ${txn.lines.length} lines)`,
        ...txn.lines.map(
          (l) =>
            `   - line ${l.palletId} | SKU ${l.skuName ?? "unknown"} (${l.skuType ?? "unknown"}) | status ${l.status} | age ${l.ageDays} day(s)`,
        ),
      ].join("\n"),
    );
  });

  const unassigned = listUnassignedPallets(facts);
  if (unassigned.length > 0) {
    parts.push(`## Unassigned Pallets (${unassigned.length})`);
    for (const pallet of unassigned) {
      const sameSku =
        facts.sameSkuLocationsByKey.get(
          `${pallet.warehouseId}|${pallet.skuId}`,
        ) ?? [];
      const sameSkuText =
        sameSku.length > 0
          ? sameSku
              .map(
                (loc) =>
                  `${loc.storageLocationId} (${loc.type ?? "?"}, seq ${loc.seq ?? "?"})`,
              )
              .join(", ")
          : "none";
      parts.push(
        `- ${pallet.palletId} | SKU ${pallet.skuName ?? "unknown"} (${pallet.skuType ?? "unknown"}) | age ${pallet.ageDays} day(s) | same-SKU locations: ${sameSkuText}`,
      );
    }
  }

  if (facts.candidateLocationsByWarehouse.size > 0) {
    parts.push(`## Candidate Storage Locations (empty, ACTIVE)`);
    for (const [
      warehouseId,
      locations,
    ] of facts.candidateLocationsByWarehouse) {
      parts.push(`- warehouse ${warehouseId}:`);
      parts.push(
        ...locations.map(
          (loc) =>
            `  - ${loc.storageLocationId} (${loc.type ?? "?"}, seq ${loc.seq ?? "?"})`,
        ),
      );
    }
  }

  return parts.join("\n");
};

const formatPickFacts = (facts: PickFacts): string => {
  if (facts.transactions.length === 0)
    return "No pending pick transactions found in the given scope.";

  const parts: string[] = [
    `## Pending Pick Transactions (${facts.transactions.length})`,
  ];
  facts.transactions.forEach((txn, index) => {
    parts.push(
      [
        `${index + 1}. Transaction ${txn.outboundTransactionId} [${txn.transactionType}] — doc ${txn.documentNumber ?? "n/a"}`,
        `   - warehouse: ${txn.warehouseId} | dispatch status: ${txn.dispatchStatus} | completion: ${txn.completionRate}%`,
        `   - items:`,
        ...txn.items.flatMap((item) => [
          `     - item ${item.outboundTransactionItemId} | SKU ${item.skuName ?? "unknown"} (${item.skuType ?? "unknown"}) | reserved pallets: ${item.reservedPallets.length}`,
          ...item.reservedPallets.map(
            (p) =>
              `       - pallet ${p.palletId} | location ${p.storageLocationId ?? "none"} | status ${p.status} | age ${p.ageDays} day(s)`,
          ),
        ]),
      ].join("\n"),
    );
  });

  return parts.join("\n");
};

// ============================================================
// Prompts — the LLM decides using ONLY the retrieved knowledge
// ============================================================

const ANALYSIS_SYSTEM = `You are a warehouse operations analyst embedded in a Warehouse ERP Management System.
Your analysis must be grounded ONLY in the retrieved knowledge documents and the operational facts provided in the prompt.
Never apply, invent, or assume strategy weights, priorities, scoring rules, or thresholds — the knowledge documents are the only source of operational guidance.`;

const SUGGESTION_SYSTEM = `You are a warehouse operations planner embedded in a Warehouse ERP Management System.
Decide using ONLY the retrieved knowledge documents and the operational facts provided in the prompt.
Never apply, invent, or assume strategy weights, priorities, scoring rules, or thresholds.
Respond with ONLY a JSON object — no markdown fences, no commentary.`;

const buildAnalysisPrompt = (
  operation: string,
  knowledge: string,
  facts: string,
): string =>
  [
    `## Knowledge Documents`,
    knowledge,
    ``,
    `## Operational Facts`,
    facts,
    ``,
    `Analyze the ${operation} workload: workload summary (transactions, pallets, aging), per-transaction status (completion rate, oldest pending pallet), bottlenecks and risks, and recommended next actions grounded in the knowledge documents.`,
    `Output concise business Markdown (headings, bullets, and at most one small table). Do not output raw JSON.`,
  ].join("\n");

const buildPutawaySuggestionPrompt = (
  knowledge: string,
  facts: string,
  unassigned: UnassignedPalletFact[],
  candidates: LocationFact[],
): string =>
  [
    `## Knowledge Documents`,
    knowledge,
    ``,
    `## Operational Facts`,
    facts,
    ``,
    `## Unassigned Pallets (must assign)`,
    ...unassigned.map(
      (p) =>
        `- ${p.palletId} | SKU ${p.skuName ?? "unknown"} (${p.skuType ?? "unknown"}) | age ${p.ageDays} day(s)`,
    ),
    ``,
    `## Candidate Storage Locations (empty, ACTIVE)`,
    ...candidates.map(
      (loc) =>
        `- ${loc.storageLocationId} (${loc.type ?? "?"}, seq ${loc.seq ?? "?"})`,
    ),
    ``,
    `Assign every unassigned pallet to exactly one candidate storage location, applying ONLY the operational rules in the knowledge documents (e.g. same-SKU consolidation, zone/type fit, proximity, floor access).`,
    `- palletId must come from the Unassigned Pallets list; storageLocationId must come from the Candidate Storage Locations list.`,
    `- Each pallet at most once; each location at most once.`,
    `- reason: one concise business sentence.`,
    ``,
    `Respond with ONLY: {"suggestions":[{"palletId":"...","storageLocationId":"...","reason":"..."}]}`,
  ].join("\n");

const buildPickSuggestionPrompt = (knowledge: string, facts: string): string =>
  [
    `## Knowledge Documents`,
    knowledge,
    ``,
    `## Operational Facts`,
    facts,
    ``,
    `For every item with reserved pallets, choose which reserved pallet should be picked first, applying ONLY the operational rules in the knowledge documents (e.g. FIFO/FEFO by age, co-located SKUs, dock/floor access).`,
    `- palletId must be one of the reserved pallets; outboundTransactionItemId must be the item the pallet is reserved for.`,
    `- Each pallet at most once; each item may appear multiple times only if it has multiple reserved pallets.`,
    `- reason: one concise business sentence.`,
    ``,
    `Respond with ONLY: {"suggestions":[{"outboundTransactionItemId":"...","palletId":"...","reason":"..."}]}`,
  ].join("\n");

// ============================================================
// Public API
// ============================================================

/** Convert an unexpected throw into the service's `{ error }` result (never-throws contract). */
const unexpectedError = (error: unknown): ErrorResult => ({
  error: `Unexpected AI warehouse service failure: ${error instanceof Error ? error.message : "unknown error"}`,
});

/** AI analysis of putaway lines. Returns `{ markdown }` or `{ error }` — never throws. */
export async function analyzePutawayLines(
  input: PutawayAnalysisInput,
): Promise<{ markdown: string } | ErrorResult> {
  try {
    const facts = await gatherPutawayFacts(input);
    const knowledge = await retrieveKnowledge();
    const result = await runLlm(
      ANALYSIS_SYSTEM,
      buildAnalysisPrompt("putaway", knowledge, formatPutawayFacts(facts)),
    );
    if (!result.ok) return { error: result.error };
    const markdown = result.text.trim();
    if (!markdown) return { error: "AI analysis returned an empty response." };
    return { markdown };
  } catch (error) {
    return unexpectedError(error);
  }
}

/**
 * AI putaway assignment suggestions. Returns `{ suggestions }`, `{ suggestions,
 * notice: 'no_empty_locations' }` when unassigned pallets exist but no empty
 * ACTIVE locations are available, or `{ error }` — never throws.
 */
export async function suggestPutawayAssignments(input: {
  warehouseId: string;
  inboundTransactionId: string;
}): Promise<
  | { suggestions: PutawaySuggestion[] }
  | { suggestions: []; notice: "no_empty_locations" }
  | ErrorResult
> {
  try {
    const facts = await gatherPutawayFacts(input);
    const unassigned = listUnassignedPallets(facts);
    const candidates =
      facts.candidateLocationsByWarehouse.get(input.warehouseId) ?? [];
    if (unassigned.length === 0) {
      return { suggestions: [] }; // nothing to decide — no LLM call needed
    }
    if (candidates.length === 0) {
      return { suggestions: [], notice: "no_empty_locations" }; // pallets exist but no empty ACTIVE locations
    }
    const knowledge = await retrieveKnowledge();
    const result = await runLlm(
      SUGGESTION_SYSTEM,
      buildPutawaySuggestionPrompt(
        knowledge,
        formatPutawayFacts(facts),
        unassigned,
        candidates,
      ),
    );
    if (!result.ok) return { error: result.error };
    const parsed = parsePutawaySuggestions(result.text);
    if (!parsed)
      return { error: "AI suggestions could not be parsed as JSON." };
    return {
      suggestions: filterPutawaySuggestions(
        parsed,
        new Set(unassigned.map((p) => p.palletId)),
        new Set(candidates.map((c) => c.storageLocationId)),
      ),
    };
  } catch (error) {
    return unexpectedError(error);
  }
}

/** AI analysis of pick lines. Returns `{ markdown }` or `{ error }` — never throws. */
export async function analyzePickLines(
  input: PickAnalysisInput,
): Promise<{ markdown: string } | ErrorResult> {
  try {
    const facts = await gatherPickFacts(input);
    const knowledge = await retrieveKnowledge();
    const result = await runLlm(
      ANALYSIS_SYSTEM,
      buildAnalysisPrompt("pick", knowledge, formatPickFacts(facts)),
    );
    if (!result.ok) return { error: result.error };
    const markdown = result.text.trim();
    if (!markdown) return { error: "AI analysis returned an empty response." };
    return { markdown };
  } catch (error) {
    return unexpectedError(error);
  }
}

/** AI pick assignment suggestions. Returns `{ suggestions }` or `{ error }` — never throws. */
export async function suggestPickAssignments(input: {
  outboundTransactionId: string;
}): Promise<{ suggestions: PickSuggestion[] } | ErrorResult> {
  try {
    const facts = await gatherPickFacts({
      outboundTransactionId: input.outboundTransactionId,
    });
    const pendingPallets = facts.transactions.flatMap((t) =>
      t.items.flatMap((item) =>
        item.reservedPallets.filter((p) => p.status === "PENDING"),
      ),
    );
    if (facts.transactions.length === 0 || pendingPallets.length === 0) {
      return { suggestions: [] }; // nothing to decide — no LLM call needed
    }
    const knowledge = await retrieveKnowledge();
    const result = await runLlm(
      SUGGESTION_SYSTEM,
      buildPickSuggestionPrompt(knowledge, formatPickFacts(facts)),
    );
    if (!result.ok) return { error: result.error };
    const parsed = parsePickSuggestions(result.text);
    if (!parsed)
      return { error: "AI suggestions could not be parsed as JSON." };
    const allowedPalletsByItem = new Map<string, Set<string>>();
    for (const txn of facts.transactions) {
      for (const item of txn.items) {
        const palletIds = new Set(
          item.reservedPallets
            .filter((p) => p.status === "PENDING")
            .map((p) => p.palletId),
        );
        if (palletIds.size > 0)
          allowedPalletsByItem.set(item.outboundTransactionItemId, palletIds);
      }
    }
    return { suggestions: filterPickSuggestions(parsed, allowedPalletsByItem) };
  } catch (error) {
    return unexpectedError(error);
  }
}
