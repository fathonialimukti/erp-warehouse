import { z } from "zod";
import { generateText } from "ai";
import { hasPermission, protectedProcedure, router } from "../trpc.js";
import { getChatModel } from "../lib/ai-provider.js";
import { retrieveRelevantChunks } from "../lib/rag.js";
import {
  ASSISTANT_PERMISSION,
  buildFallbackReply,
  buildPageContextSection,
  pageContextSnapshotSchema,
  sanitizePageContext,
  sanitizePageFormValues,
  summarizePageContext,
} from "../lib/ai-page-context.js";

/**
 * AI assistant proxy — `trpcClient.assistant.*`, guarded by `assistant@use`.
 *
 * No tRPC assistant router existed (chat lived only on Express
 * `POST /api/ai/chat`), so this is the typed contract the page-aware drawer
 * calls with its live snapshot ({ route, formId, formValues, missingRequired }).
 * The streaming widget keeps working unchanged via `routes/ai.ts`, which
 * injects the same page-context section through the shared helper.
 *
 * `send`/`chat` proxy one chat turn through the LLM with the snapshot in the
 * system prompt; `getPageContext` canonicalizes the snapshot; `fillForm` /
 * `updateItem` / `removeItem` validate client-applied proposals (never persist).
 */

// ponytail: proposal/LLM-only mutations (no DB writes) — no activity log,
// same precedent as the aiWarehouse / aiAnalytics routers.

const ASSISTANT_SYSTEM_BASE =
  `You are an AI assistant embedded in a Warehouse ERP Management System.
Answer concisely in Markdown. The Current Page Context snapshot below is authoritative for "where am I / what am I seeing" — never ask which module or page the user is on.
Always check the current page first: before answering any page-dependent intent (fill requests like "help me fill this form", page summaries like "what am I seeing", visible-data questions like counts/rows/filled fields), use the snapshot below; on every turn where the route/formId may be stale (route "/" with no formId means no snapshot was attached, or the user may have navigated), fetch a fresh snapshot via trpcClient.assistant.getPageContext BEFORE replying; then name the current page/formId + missingRequired fields instead of asking which module or page the user is on.
First-turn rule: when the user message is a help-me-fill request (e.g. "help me fill this form") with no page context attached yet (route "/" with no formId), call getPageContext (trpcClient.assistant.getPageContext) BEFORE replying; then name the current page/formId + missingRequired fields instead of asking which module or page the user is on.
When the user asks to fill the current form, propose exact field names and values for the form named by the fresh snapshot — never guess field names blind. Cover EVERY field/row in the page context: array forms need ALL item rows as \`items: [{ skuId, quantity, details }, ...]\` (never only the first row); select fields (supplierId/warehouseId/skuId) take option IDs resolved through the page context's selectOptions \`{ id, label }[]\` maps (never guess an id or name); when a missingRequired value is unknown, ask for it instead of guessing.
Fill/update/remove results are proposals only (applied:false): the client applies them, the user reviews and clicks Save; nothing is persisted here, so never claim a record was created, updated, saved, submitted, or persisted.`.trim();

const historyMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().min(1).max(4000),
});

const sendInputSchema = z.object({
  message: z.string().trim().min(1, "Message is required").max(4000),
  pageContext: pageContextSnapshotSchema.default({
    route: "/",
    formValues: {},
    missingRequired: [],
  }),
  history: z.array(historyMessageSchema).max(20).default([]),
});

type SendInput = z.infer<typeof sendInputSchema>;

/**
 * Page-dependent intents that must never be answered blind. `send`/`chat` run
 * a single-shot LLM call with NO tool loop, so when the snapshot is the stale
 * sentinel (route "/" + no formId + nothing filled) these intents short-circuit
 * to a deterministic refresh reply instead of reaching the model.
 */
const PAGE_DEPENDENT_PATTERNS = [
  /help me fill/i,
  /\bfill\b[^.]{0,60}\bform\b/i,
  /\bform\b[^.]{0,60}\bfill\b/i,
  /\bcomplete\b[^.]{0,60}\bform\b/i,
  /\bpopulate\b/i,
  /\bpre-?fill\b/i,
  /what am i (seeing|looking at)/i,
  /what'?s on (this|the|my|the current) (page|screen)/i,
  /summar(y|iz|is).{0,40}(this|the|my|current) (page|screen|form)/i,
  /how many (rows|records|items).{0,40}(visible|shown|on (this|the|current) page)/i,
  /\bthis form\b/i,
  /\bcurrent page\b/i,
  /\bmissing required\b/i,
];

const isPageDependentIntent = (message: string): boolean =>
  PAGE_DEPENDENT_PATTERNS.some((pattern) => pattern.test(message));

const isStaleSnapshot = (snapshot: {
  route: string;
  formId: string | null;
  formValues: Record<string, unknown>;
  missingRequired: string[];
}): boolean =>
  snapshot.route === "/" &&
  snapshot.formId === null &&
  Object.keys(snapshot.formValues).length === 0 &&
  snapshot.missingRequired.length === 0;

/** Deterministic no-blind-answer reply: names the staleness, never asks which module/page. */
const buildStaleSnapshotReply = (): string =>
  [
    'You\'re asking about the current page/form, but no page snapshot was attached to this turn (route "/", no formId).',
    "",
    "Refresh the snapshot via `trpcClient.assistant.getPageContext` with the live route/formId/missingRequired and resend — " +
      "I'll then name the page/formId + missingRequired fields and draft values. Nothing was guessed in the meantime.",
  ].join("\n");

const handleSend = async (input: SendInput) => {
  const snapshot = sanitizePageContext(input.pageContext);
  const summary = summarizePageContext(snapshot);
  if (isStaleSnapshot(snapshot) && isPageDependentIntent(input.message)) {
    return {
      reply: buildStaleSnapshotReply(),
      pageContext: snapshot,
      missingRequired: snapshot.missingRequired,
      summary,
      aiAvailable: true,
    };
  }
  try {
    const relevantContext = await retrieveRelevantChunks(input.message).catch(
      () => "",
    );
    const chatModel = await getChatModel();
    const historyText = input.history
      .slice(-10)
      .map(
        (entry) =>
          `${entry.role === "user" ? "User" : "Assistant"}: ${entry.text}`,
      )
      .join("\n");
    const { text } = await generateText({
      model: chatModel,
      system:
        `${ASSISTANT_SYSTEM_BASE}\n\n${buildPageContextSection(snapshot)}` +
        (relevantContext
          ? `\n\n## Relevant Documentation\n${relevantContext}`
          : ""),
      prompt: `${historyText ? `${historyText}\n` : ""}User: ${input.message}`,
      temperature: 0,
    });
    const reply = text.trim() || buildFallbackReply(snapshot);
    return {
      reply,
      pageContext: snapshot,
      missingRequired: snapshot.missingRequired,
      summary,
      aiAvailable: true,
    };
  } catch {
    // Graceful degradation (aiAnalytics precedent): stay useful offline.
    return {
      reply: buildFallbackReply(snapshot),
      pageContext: snapshot,
      missingRequired: snapshot.missingRequired,
      summary,
      aiAvailable: false,
    };
  }
};

const formIdSchema = z.string().trim().min(1, "formId is required").max(200);
const itemIndexSchema = z.number().int().min(0).max(9999);
const fieldsSchema = z.record(z.string(), z.unknown()).refine(
  (fields) => {
    const size = Object.keys(fields).length;
    return size >= 1 && size <= 50;
  },
  { error: "Provide between 1 and 50 fields" },
);

const assistantGuard = hasPermission(ASSISTANT_PERMISSION);

export const assistantRouter = router({
  /**
   * Live page-context round-trip (`getPageContext` tool equivalent): the
   * client sends its snapshot, the server canonicalizes (sanitized values,
   * no base64) and returns it with deterministic summary lines.
   */
  getPageContext: protectedProcedure
    .use(assistantGuard)
    .input(pageContextSnapshotSchema)
    .query(({ input }) => {
      const snapshot = sanitizePageContext(input);
      return { ...snapshot, summary: summarizePageContext(snapshot) };
    }),

  /**
   * Page-aware chat proxy. The system prompt carries route/formId/values/
   * missingRequired with the first-turn rule, so "fill this form" resolves
   * to the current page without clarification. Page-dependent intents with a
   * stale (unattached) snapshot short-circuit to a refresh reply — never
   * answered blind, never "which module/page?".
   */
  send: protectedProcedure
    .use(assistantGuard)
    .input(sendInputSchema)
    .mutation(async ({ input }) => handleSend(input)),

  /** Alias of `send` — the contract names this entry point `chat`/`send`. */
  chat: protectedProcedure
    .use(assistantGuard)
    .input(sendInputSchema)
    .mutation(async ({ input }) => handleSend(input)),

  /**
   * `fillFormFields` tool equivalent (proposal only): validates + sanitizes
   * a fill proposal for the open form. The client applies it to the inputs;
   * the user reviews and clicks Save — nothing is persisted here.
   */
  fillForm: protectedProcedure
    .use(assistantGuard)
    .input(z.object({ formId: formIdSchema, fields: fieldsSchema }))
    .mutation(({ input }) => ({
      formId: input.formId,
      fields: sanitizePageFormValues(input.fields),
      applied: false as const,
      message:
        "Proposal only — the client applies these via fillFormFields. " +
        "Tell the user to review and click Save; nothing was persisted.",
    })),

  /** Item-row patch proposal for array forms (e.g. `items[i]`). */
  updateItem: protectedProcedure
    .use(assistantGuard)
    .input(
      z.object({
        formId: formIdSchema,
        index: itemIndexSchema,
        patch: fieldsSchema,
      }),
    )
    .mutation(({ input }) => ({
      formId: input.formId,
      index: input.index,
      patch: sanitizePageFormValues(input.patch),
      applied: false as const,
      message:
        "Proposal only — the client applies this patch. Nothing was persisted.",
    })),

  /** Item-row removal proposal for array forms. */
  removeItem: protectedProcedure
    .use(assistantGuard)
    .input(z.object({ formId: formIdSchema, index: itemIndexSchema }))
    .mutation(({ input }) => ({
      formId: input.formId,
      index: input.index,
      applied: false as const,
      message:
        "Proposal only — the client removes this row. Nothing was persisted.",
    })),
});
