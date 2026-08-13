# Task 1: Shared AI util — export collectPageContext + SSE tool-input parser

## Files
- Modify: `apps/client/src/components/AiAssistant/AiAssistant.tsx` — export `collectPageContext`
- Create: `apps/client/src/components/AiFill/aiStream.ts` — SSE parser + one-shot fill request helper

## Interfaces
- **Consumes:** existing `collectPageContext()` (currently module-private in `AiAssistant.tsx`)
- **Produces:**
  - `export const collectPageContext: () => string` (re-exported from `AiAssistant.tsx`)
  - `export async function requestAiFillFields(opts: { instruction: string; pageContext: string; chatId: string }): Promise<Record<string, unknown>>` in `aiStream.ts`
  - `export function extractFillFieldsFromStream(stream: ReadableStream<Uint8Array>): Promise<Record<string, unknown>>` in `aiStream.ts`

## Frozen contract
- Do NOT change the behavior of `collectPageContext` — only add `export`.
- The fill request reuses `POST /api/ai/chat` (the existing `aiChatHandler`). Body:
  `{ id: chatId, messages: [{ role: 'user', content: instruction }] }` with `credentials: 'include'`.
- The one-shot user message must instruct the model to ONLY call `fillFormFields` and
  return the fields — no navigateTo, no queryDatabase, no getPageContext.
- The SSE parser must:
  - read the `data:` lines of the UIMessage stream,
  - collect `tool-input-start` / `tool-input-delta` / `tool-input-available` events for
    tool name `fillFormFields`,
  - resolve the tool input JSON (handle both `input` and `inputText` fields),
  - return the `fields` object from the FIRST `fillFormFields` call,
  - ignore all other tool calls and all text parts,
  - reject on HTTP error / stream error with a readable message.
- Reuse the same SSE parsing approach as `createPatchedFetch` in `AiAssistant.tsx`
  (buffer `tool-input-delta` text per `toolCallId`).

## Steps
- [ ] Step 1: Add `export` to `collectPageContext` in `AiAssistant.tsx`
- [ ] Step 2: Create `aiStream.ts` with `requestAiFillFields` + `extractFillFieldsFromStream`
- [ ] Step 3: `bun run check-types` (client) passes
- [ ] Step 4: Self-review
