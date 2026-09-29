import { receivingTransactionItemSchema } from "@repo/schemas/receiving-transaction";
import {
  getRouteParams,
  type PageContextPayload,
} from "../../lib/ai/usePageContext";

/**
 * Page-aware chat context + deterministic receiving assist (client-only).
 *
 * The chat widget used to send bare user text and relied on the model choosing
 * to call `getPageContext` first — on `/inbound-transaction/receiving/new` it
 * often asked "which form/page?" instead. Every send now carries a compact
 * snapshot (current pathname + route params + form field meta) appended to the
 * wire copy only, so visible bubbles stay clean.
 *
 * On the receiving form, an explicit random/N-items request ("do random stuff
 * with 4 items") is additionally fulfilled deterministically with real SKU ids
 * (validated against `receivingTransactionItemSchema`) via `aiFormFillAtom`,
 * so the TanStack form populates even if the model never calls fillFormFields.
 */

const RECEIVING_ROUTE_RE = /^\/inbound-transaction\/receiving(\/|$)/;

export const RANDOM_FILL_COUNT_DEFAULT = 4;
export const RANDOM_FILL_COUNT_MAX = 10;

const MAX_CONTEXT_OPTIONS = 30;
const MAX_LABEL_LENGTH = 60;

export interface RandomFillItem {
  skuId: string;
  quantity: number;
  details: string;
}

/**
 * Explicit random/N-items fill intent on the receiving form → item count,
 * else null. Generic "help me fill this form" (no "random", no count+items)
 * returns null so it keeps flowing to the model with full page context.
 */
export const parseReceivingRandomFillCount = (
  text: string,
  route: string,
): number | null => {
  if (!RECEIVING_ROUTE_RE.test(route)) return null;
  if (!/\bitems?\b/i.test(text)) return null;
  const wantsRandom = /\brandom\b/i.test(text);
  const countMatch =
    text.match(/(\d+)\s*items?/i) ??
    text.match(/items?\s*(\d+)/i) ??
    (wantsRandom ? text.match(/(\d+)/) : null);
  if (!wantsRandom && !countMatch) return null;
  const count = countMatch ? Number(countMatch[1]) : RANDOM_FILL_COUNT_DEFAULT;
  if (!Number.isFinite(count)) return RANDOM_FILL_COUNT_DEFAULT;
  return Math.min(Math.max(Math.trunc(count), 1), RANDOM_FILL_COUNT_MAX);
};

/** Collect up to `limit` string ids from a `list` query result (`{ data: [...] }`). */
export const collectResultIds = (result: unknown, limit = 50): string[] => {
  if (!result || typeof result !== "object") return [];
  const data = (result as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  const ids: string[] = [];
  for (const row of data) {
    if (ids.length >= limit) break;
    if (!row || typeof row !== "object") continue;
    const id = (row as Record<string, unknown>).id;
    if (typeof id === "string" && id.length > 0 && !ids.includes(id))
      ids.push(id);
  }
  return ids;
};

/**
 * Build `count` valid receiving line items from real SKU ids. Each candidate
 * is validated against `receivingTransactionItemSchema`, so the form's
 * `items` setter receives only schema-conformant rows.
 */
export const buildRandomItems = (
  skuIds: string[],
  count: number,
): RandomFillItem[] => {
  const unique = [...new Set(skuIds.filter((id) => id.length > 0))];
  for (let i = unique.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = unique[i];
    const other = unique[j];
    if (current === undefined || other === undefined) continue;
    unique[i] = other;
    unique[j] = current;
  }
  const wanted = Math.min(
    Math.max(Math.trunc(count), 1),
    RANDOM_FILL_COUNT_MAX,
  );
  const items: RandomFillItem[] = [];
  for (const skuId of unique.slice(0, wanted)) {
    const candidate = {
      skuId,
      quantity: 1 + Math.floor(Math.random() * 10),
      details: "",
    };
    if (receivingTransactionItemSchema.safeParse(candidate).success)
      items.push(candidate);
  }
  return items;
};

interface CompactOption {
  id: string;
  label: string;
}

const shortLabel = (value: unknown): string => {
  const text = value == null ? "" : String(value);
  return text.length > MAX_LABEL_LENGTH
    ? `${text.slice(0, MAX_LABEL_LENGTH)}…`
    : text;
};

const toCompactOptions = (value: unknown): CompactOption[] => {
  if (!Array.isArray(value)) return [];
  const out: CompactOption[] = [];
  for (const entry of value) {
    if (out.length >= MAX_CONTEXT_OPTIONS) break;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const id = record.id == null ? "" : String(record.id);
    if (!id) continue;
    out.push({ id, label: shortLabel(record.label) });
  }
  return out;
};

/**
 * Compact wire-only page context: route + route params + form field meta.
 * Select-option aliases come from the normalized DOM scrape (real ids the
 * model must use for supplierId/warehouseId/skuId — never invented ids).
 */
export const buildChatContextBlock = (
  snapshot: PageContextPayload,
  assistNote: string | null,
): string => {
  const dom = (snapshot.dom ?? {}) as Record<string, unknown>;
  const sections = Array.isArray(dom.sections) ? dom.sections : [];
  const fieldSet = new Set<string>();
  for (const section of sections) {
    if (!section || typeof section !== "object" || Array.isArray(section))
      continue;
    const fields = (section as Record<string, unknown>).fields;
    if (!Array.isArray(fields)) continue;
    for (const field of fields) {
      if (typeof field === "string" && field.length > 0) fieldSet.add(field);
    }
  }
  const lines = [
    "[Current page context — authoritative. Do NOT ask which page or form the user is on.]",
    `route: ${snapshot.route}`,
    `routeParams: ${JSON.stringify(getRouteParams(snapshot.route))}`,
    `formId: ${snapshot.formId ?? "none (list/detail page)"}`,
    `missingRequired: ${JSON.stringify(snapshot.missingRequired)}`,
    `filledKeys: ${JSON.stringify(Object.keys(snapshot.formValues ?? {}))}`,
  ];
  if (fieldSet.size > 0)
    lines.push(`formFields: ${JSON.stringify([...fieldSet])}`);
  const supplier = toCompactOptions(dom.supplier);
  const warehouse = toCompactOptions(dom.warehouse);
  const sku = toCompactOptions(dom.sku);
  if (supplier.length > 0)
    lines.push(`supplierOptions (id → label): ${JSON.stringify(supplier)}`);
  if (warehouse.length > 0)
    lines.push(`warehouseOptions (id → label): ${JSON.stringify(warehouse)}`);
  if (sku.length > 0)
    lines.push(
      `skuOptions (id → label, use id for skuId): ${JSON.stringify(sku)}`,
    );
  if (assistNote) lines.push(assistNote);
  return lines.join("\n");
};

/**
 * Append a context block to the wire copy of the last user message.
 * The chat display uses the local message state (untouched) — only the
 * request body carries the block, so bubbles stay clean.
 */
export const appendBlockToLastUserMessage = <T>(
  messages: T,
  block: string,
): T => {
  if (!block || !Array.isArray(messages) || messages.length === 0)
    return messages;
  const mapped = (messages as unknown[]).map((message, index, all) => {
    if (index !== all.length - 1) return message;
    const msg = message as Record<string, unknown>;
    if (msg.role !== "user") return message;
    const contextPart = { type: "text", text: `\n\n${block}` };
    if (Array.isArray(msg.parts))
      return { ...msg, parts: [...(msg.parts as unknown[]), contextPart] };
    const base = typeof msg.content === "string" ? msg.content : "";
    return { ...msg, content: `${base}\n\n${block}` };
  });
  return mapped as T;
};
