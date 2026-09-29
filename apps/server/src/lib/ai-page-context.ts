import { z } from "zod";

/**
 * Page/form context for the AI assistant (T4).
 *
 * The client drawer snapshots the current page — route, open form id, live
 * (sanitized) form values, and still-missing required fields — and sends it
 * with every assistant call. This module is the single server-side owner of:
 *
 * - validating + sanitizing that snapshot (never trust client input, never
 *   forward base64/file payloads to the model),
 * - rendering it as a system-prompt section with the first-turn rule
 *   (formId present → never ask "which module/page", summarize + fill),
 * - a deterministic fallback reply so `assistant.send` stays useful (and
 *   testable) when the LLM provider is unreachable.
 *
 * Consumed by the tRPC `assistant` router and the Express `/api/ai/chat`
 * proxy — one contract, both transports.
 */

/** Permission gating every `trpcClient.assistant.*` procedure. */
export const ASSISTANT_PERMISSION = "assistant@use" as const;

const MAX_STRING_LENGTH = 2000;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 100;
const MAX_DEPTH = 6;
const MAX_SERIALIZED_VALUES = 20_000;

/**
 * Client snapshot shape. Declared here (not @repo/schemas) — this task owns
 * backend only and must not touch packages/schemas/*.
 */
export const pageContextSnapshotSchema = z.object({
  route: z.string().max(500).default("/"),
  formId: z.string().min(1).max(200).nullish(),
  formValues: z.record(z.string(), z.unknown()).default({}),
  missingRequired: z.array(z.string().max(200)).max(100).default([]),
});

export interface PageContextSnapshot {
  route: string;
  formId: string | null;
  formValues: Record<string, unknown>;
  missingRequired: string[];
}

const sanitizeValue = (value: unknown, depth: number): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    // Never forward embedded file payloads (receiving `files[].dataUrl`).
    if (value.startsWith("data:")) return "[omitted: embedded file data]";
    if (value.length > MAX_STRING_LENGTH) {
      return `${value.slice(0, MAX_STRING_LENGTH)}... [truncated]`;
    }
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= MAX_DEPTH) return "[omitted: too deep]";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((entry) => sanitizeValue(entry, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(
      value as Record<string, unknown>,
    ).slice(0, MAX_OBJECT_KEYS)) {
      // Never send base64 file payloads to the assistant (mirrors the
      // client sanitizer in `lib/ai/usePageContext.ts`).
      if (key === "dataUrl") continue;
      out[key] = sanitizeValue(entry, depth + 1);
    }
    return out;
  }
  return null;
};

/** Strip file payloads / oversized values from a form-values record. */
export const sanitizePageFormValues = (
  values: unknown,
): Record<string, unknown> => {
  if (!values || typeof values !== "object" || Array.isArray(values)) return {};
  const sanitized = sanitizeValue(values, 0);
  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized))
    return {};
  const record = sanitized as Record<string, unknown>;
  try {
    if (JSON.stringify(record).length > MAX_SERIALIZED_VALUES) {
      return { _omitted: "form values too large" };
    }
  } catch {
    return {};
  }
  return record;
};

/** Forgiving canonicalization — the proxy must never throw on a bad snapshot. */
export const sanitizePageContext = (input: unknown): PageContextSnapshot => {
  const parsed = pageContextSnapshotSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { route: "/", formId: null, formValues: {}, missingRequired: [] };
  }
  const route = parsed.data.route.trim() || "/";
  const missingRequired = parsed.data.missingRequired
    .map((field) => field.trim())
    .filter((field) => field.length > 0);
  return {
    route,
    formId: parsed.data.formId ?? null,
    formValues: sanitizePageFormValues(parsed.data.formValues),
    missingRequired,
  };
};

/** Deterministic summary lines — no LLM needed. */
export const summarizePageContext = (
  snapshot: PageContextSnapshot,
): string[] => {
  const lines = [`Route: ${snapshot.route}`];
  if (snapshot.formId) {
    const filledCount = Object.keys(snapshot.formValues).length;
    lines.push(`Form: ${snapshot.formId} (${filledCount} field(s) filled)`);
    lines.push(
      snapshot.missingRequired.length > 0
        ? `Missing required: ${snapshot.missingRequired.join(", ")}`
        : "Missing required: none — the form looks complete",
    );
  } else {
    lines.push("Form: none (list/detail page)");
  }
  return lines;
};

/**
 * Shared form-fill rules injected alongside the page snapshot (T11). Both
 * transports (`assistant.send`/`chat` and Express `/api/ai/chat`) render
 * `buildPageContextSection`, so one block keeps the fill contract identical:
 * cover EVERY field/row, resolve select labels→ids via the option maps, and
 * let missingRequired drive follow-ups instead of guesses.
 */
export const FORM_FILL_RULES = `Form-fill rules (whenever the user asks to fill the open form):
- Fill EVERY field present in the page context — never stop after the first row or the obvious headers.
- Array forms carry ALL their rows as \`items: [{ skuId, quantity, details }, ...]\` — one entry per requested item, each with its own skuId/quantity/details; never fill only the first row.
- Select fields (supplierId, warehouseId, skuId, ...) take option IDs, not display names. Resolve the user's labels through the selectOptions \`{ id, label }[]\` maps (getPageContext output or embedded page-context JSON) and never invent or guess an id or name.
- Let missingRequired drive follow-ups: when a required value (or its label→id match) is unknown, ask for it via requestFormInput or a short question instead of guessing or leaving the field blank.`;

/**
 * System-prompt injection. Carries { route, formId, formValues, missingRequired }
 * plus the first-turn rule: when a form is open, never ask "which module/page" —
 * summarize the page + missing fields and help fill them instead.
 */
export const buildPageContextSection = (
  snapshot: PageContextSnapshot,
): string => {
  const filledKeys = Object.keys(snapshot.formValues);
  const valuesJson =
    filledKeys.length > 0
      ? JSON.stringify(snapshot.formValues, null, 2)
      : "(empty)";
  const missing =
    snapshot.missingRequired.length > 0
      ? snapshot.missingRequired.join(", ")
      : "none";
  const firstTurnRule = snapshot.formId
    ? `First-turn rule: a form (\`${snapshot.formId}\`) is open on this page. NEVER ask "which module/page" or "which form" — the snapshot above IS the current page. Instead, briefly summarize the page and the missing required fields, then help fill them.`
    : 'First-turn rule: no form is open — the user is on a list/detail page. NEVER ask "which module/page" — the route above IS the current page. Summarize what is visible before asking follow-ups.';
  // T9: the snapshot is per-turn — on every later turn where the route/formId
  // may be stale (no fresh snapshot attached, or the user may have navigated),
  // re-check via getPageContext before answering any page-dependent intent.
  const staleRule =
    "Every-turn rule: this snapshot is only fresh for this turn. Before answering any " +
    "page-dependent intent (fill requests, page summaries, visible-data questions) on a turn " +
    "where the route/formId may be stale — no snapshot attached, or the user may have navigated — " +
    "call getPageContext (trpcClient.assistant.getPageContext) FIRST, then name the current " +
    "page/formId + missingRequired fields instead of asking which module or page the user is on.";
  // Sentinel: route "/" with no formId means the client attached no snapshot —
  // it must NOT be read as a real page, or plain "help me fill this form"
  // gets answered blind.
  const sentinelNote =
    !snapshot.formId && snapshot.route === "/"
      ? '\n\nNote: route "/" with no formId means NO live snapshot was attached to this turn — ' +
        "the route/formId may be stale. Fetch a fresh snapshot via getPageContext before " +
        "answering any page-dependent intent; never guess the page or ask which module/page."
      : "";
  return `## Current Page Context (live client snapshot)
- Route: ${snapshot.route}
- Form: ${snapshot.formId ? `\`${snapshot.formId}\`` : "none (list/detail page)"}
- Form values (sanitized, no file payloads): ${valuesJson}
- Missing required fields: ${missing}

${firstTurnRule}

${staleRule}${sentinelNote}${snapshot.formId ? `\n\n${FORM_FILL_RULES}` : ""}`;
};

/**
 * Deterministic reply used when the LLM provider is unreachable. Still obeys
 * the first-turn rule: names the page/form + missing fields, never asks which
 * module the user is on.
 */
export const buildFallbackReply = (snapshot: PageContextSnapshot): string => {
  if (snapshot.formId) {
    const missing =
      snapshot.missingRequired.length > 0
        ? snapshot.missingRequired.join(", ")
        : "none — the form looks complete";
    return [
      `You're on the \`${snapshot.formId}\` form (${snapshot.route}).`,
      "",
      `Missing required fields: ${missing}.`,
      "",
      "Live AI answering is currently unavailable, so I can't draft values for you right now. " +
        "Fill the fields above, then review and click Save yourself.",
    ].join("\n");
  }
  return [
    `You're on ${snapshot.route} (no form open).`,
    "",
    "Live AI answering is currently unavailable. Tell me what you want to do on this page and I'll guide you step by step.",
  ].join("\n");
};
