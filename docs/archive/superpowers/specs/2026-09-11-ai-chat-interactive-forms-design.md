# AI Chat Interactive Forms + Mutation Gate — Design

**Date:** 2026-09-11
**Status:** Approved in chat (pending final spec review)
**Scope:** AI Admin chatbox + regular-user AI Assistant chatbox

---

## 1. Problem

The ERP has two AI chat surfaces that lack the interactive UX users expect from
modern AI chat pages (ChatGPT/Claude style):

1. **AI Admin page** (`apps/client/src/pages/ai-admin/AiAdminPage.tsx`) — the
   only live chatbox today. Its `executeSql` tool **executes INSERT/UPDATE/DELETE
   immediately** with no user confirmation and no DB transaction. The only
   safety is prompt text ("warn the user before writes"), which is not enforced.
2. **Regular-user Assistant chatbox** — the component
   (`components/AiAssistant/AiAssistant.tsx`, 1080 lines) was deleted in commit
   `9388d2e` ("remove AI chat widget...") and was already orphaned (not mounted)
   before deletion. Everything it depends on still exists:
   - Server endpoint `/api/ai/chat` + full tool set (`ai.ts` route,
     `ai-tools.ts`, putaway/dispatch/draft/reorder/approval/anomaly tools)
   - All bridge atoms in `lib/atoms.ts` (`aiChatOpenAtom`,
     `aiChatPresetMessageAtom`, `aiFormFillAtom`, putaway/dispatch/approve)
   - `WarehouseLayoutPage` still writes `aiChatOpenAtom` to summon the chat —
     currently opens into nothing
   - The obvious mount point is `layouts/PrivateLayout.tsx` (shell with
     Navbar/Sidebar/CommandPalette)

Additionally, three server-side tools in the assistant endpoint execute DB
writes with no enforced confirmation: `draft_receiving_transaction`,
`draft_shipment_transaction`, `draft_reorder_receiving`.

**User requirements (explicit):**
- Form-in-chat: AI-generated interactive forms/popups rendered inside the
  conversation (the common modern AI chat pattern).
- AI Admin: analyze → show result → **mutate only after user confirmation**,
  **always inside a DB transaction**, and re-analyze/verify after execution,
  showing the result.

## 2. Goals / Non-goals

**Goals**
1. Restore the Assistant chatbot and mount it app-wide (authenticated shell).
2. Add AI-generated **form-in-chat** to both chatboxes (one shared renderer).
3. Enforce **user confirmation before any server-side DB mutation** in both
   chatboxes, using AI SDK v6 native `needsApproval`.
4. Wrap all AI DB mutations in `prisma.$transaction`; enforce `RETURNING` on
   writes; after a write, the AI re-queries (verify) and shows the result.
5. Shared, reusable toolkit so future chatboxes get the same behavior.

**Non-goals (untouched)**
- AiFill modal (`AiFillPanel`, `useAiFill`, `aiOneShot.ts`) — unchanged.
- RAG, tool business logic, drafts' domain behavior — unchanged.
- Resumable stream storage (server returns 204; local cache fallback stays).
- Old `AiFillBar` (deleted historical component) — stays deleted.

## 3. Architecture

```
┌ PrivateLayout ──────────────────────────────┐
│  Navbar / Sidebar / <Outlet />              │
│  CommandPalette                             │
│  <AiAssistant />  ← restored floating chat  │
└─────────────────────────────────────────────┘

Shared client toolkit: apps/client/src/components/AiChat/
  ChatFormCard.tsx    — renders AI-defined form spec (HeroUI inputs)
  ApprovalCard.tsx    — renders approval request (purpose + exact input preview)
  ToolResultTable.tsx — renders tool output rows as a compact table
  sendWhen.ts         — combined sendAutomaticallyWhen predicate

Server: apps/server/src/
  lib/ai-form-tool.ts            — NEW client-side tool requestFormInput (no execute)
  lib/ai-admin-tools.ts          — executeSql: needsApproval(write) + transaction
  lib/ai-draft-tools.ts          — 3 draft tools: needsApproval + transaction
  routes/ai.ts + routes/ai-admin.ts — register form tool + system prompt sections
```

### 3.1 Restore Assistant (bounded recovery)

- Byte-exact restore: `git restore --source=9388d2e^ --worktree -- apps/client/src/components/AiAssistant/AiAssistant.tsx`
- Mount `<AiAssistant />` in `PrivateLayout` (after `<CommandPalette />`).
- Its imports (atoms, `@heroui/react`, `useChat`, `DefaultChatTransport`,
  `lastAssistantMessageIsCompleteWithToolCalls`, react-router, react-markdown)
  all still exist — `AiAdminPage` was copied from it and is maintained, so the
  APIs are current. `bun run check-types` verifies.
- Zero behavior change to existing pages; `WarehouseLayoutPage`'s
  `aiChatOpenAtom` write starts working again.

### 3.2 Form-in-chat (`requestFormInput` client-side tool)

AI SDK v6 client-tool pattern (same mechanism the repo already uses for
`fillFormFields`): a tool **without `execute`** streams its input to the
client, the client renders UI and replies with `addToolOutput`, and
`sendAutomaticallyWhen` resumes the conversation.

**Tool definition** (shared, in `lib/ai-form-tool.ts`, spread into both
toolsets in `ai.ts` and `ai-admin.ts`):

```ts
requestFormInput: tool({
  description:
    'Render an interactive form inside the chat for the user to fill. ' +
    'Use this when you need structured input from the user (missing required ' +
    'values, choices, confirmations) instead of asking questions in prose. ' +
    'The user\'s answers are returned as the tool result.',
  inputSchema: z.object({
    formTitle: z.string().describe('Short title shown on the form card'),
    description: z.string().optional().describe('One-line explanation of why you need this'),
    fields: z.array(z.object({
      name: z.string().describe('Field key returned in values'),
      label: z.string(),
      type: z.enum(['text', 'number', 'date', 'select', 'textarea', 'checkbox']),
      required: z.boolean().default(true),
      placeholder: z.string().optional(),
      defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
      options: z.array(z.object({ value: z.string(), label: z.string() }))
        .optional().describe('Required when type=select'),
    })).min(1).max(12),
  }),
  // NO execute — client-side tool; client replies via addToolOutput
}),
```

**Client flow** (message-parts renderer in both chatboxes):
- `part.type === 'tool-requestFormInput'`
  - `input-streaming` → skeleton chip ("preparing form…")
  - `input-available` → `<ChatFormCard>`; Submit (validates `required`,
    skips unknown/empty) → `addToolOutput({ tool: 'requestFormInput',
    toolCallId, output: { submitted: true, values } })`; Cancel →
    `output: { submitted: false }`
  - `output-available` → collapsed chip ("form answered" / "form cancelled"),
    values as compact `ToolResultTable` when submitted
- After the tool output, `sendAutomaticallyWhen` fires and the model continues
  with the answers.
- System prompt additions (both routes): use the form when info is missing or
  a structured choice is clearer; after receiving values, continue the task
  without re-asking; cancelled form → continue in plain text.

**Security note:** the form only collects input *from* the user; nothing
executes on submit. All mutations stay gated by §3.3.

### 3.3 Mutation gate (approval + transaction + verify)

AI SDK v6 native human-in-the-loop: `needsApproval` on the tool pauses the
stream in `approval-requested` state; the client renders `ApprovalCard` and
calls `addToolApprovalResponse({ id: part.approval.id, approved })`;
`sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses`
auto-resumes; on approval the server executes the tool **with the exact
approved input** (no model re-relay → no drift between shown and executed
SQL). Stateless — works with the current Express handlers because resumption
is a fresh request carrying the full message chain.

**Admin `executeSql` (`ai-admin-tools.ts`):**
- Add `needsApproval: async ({ sql }) => isWriteSql(sql)` where
  `isWriteSql` = `upper.startsWith('INSERT'|'UPDATE'|'DELETE')` (same check the
  tool already computes). Reads (SELECT/WITH/EXPLAIN) stay auto-execute.
- `requestReason`: "The AI wants to run a write query — review before executing."
  (exact `approval.requestReason` API verified at implementation).
- Write execute path:
  - Ensure `RETURNING`: if the write statement has no `RETURNING` clause,
    append ` RETURNING *` (validator already blocks multi-statement).
  - Execute inside `prisma.$transaction(async (tx) => tx.$queryRawUnsafe(sql),
    { timeout: 30_000 })` — BEGIN…COMMIT, all-or-nothing.
  - Result includes affected rows; client renders them via `ToolResultTable`.
- Read path: wrap in a read-only transaction for defense-in-depth (same
  pattern as `aiQueryDatabaseHandler`: `SET TRANSACTION READ ONLY`).
- System prompt: after any write succeeds, immediately run a SELECT on the
  affected rows and present before/after ("re-analyze and show result"). If
  the user denies, do not retry the same mutation; summarize and ask how to
  proceed.

**Assistant draft tools (`ai-draft-tools.ts`):**
- `needsApproval: async () => true` on `draft_receiving_transaction`,
  `draft_shipment_transaction`, `draft_reorder_receiving` with a reason
  naming the transaction to be drafted.
- Wrap their header+items creation in `prisma.$transaction` (multi-model
  writes must be atomic).

### 3.4 Shared client toolkit (`components/AiChat/`)

- `ChatFormCard.tsx` — props: `{ spec, onSubmit(values), onCancel }`.
  HeroUI v3 inputs per field type (`Input`, `NumberField`, date input,
  `Select`, `TextArea`, `Switch`), required validation, Submit/Cancel row.
- `ApprovalCard.tsx` — props: `{ title, reason, inputPreview (SQL or JSON),
  onApprove, onDeny }`. Danger-accented for write SQL.
- `ToolResultTable.tsx` — props: `{ rows, maxRows=8 }`; compact bordered
  table styled like the existing markdown table CSS.
- `sendWhen.ts` —
  `(chat) => lastAssistantMessageIsCompleteWithToolCalls(chat) ||
    lastAssistantMessageIsCompleteWithApprovalResponses(chat)`
  (verify exact exported signatures from `'ai'` v6 at implementation; both
  exports exist per docs).

Both chatboxes render tool parts through this toolkit:

| Part | Renderer |
|------|----------|
| `tool-requestFormInput` | `ChatFormCard` (+ submitted/cancelled chips) |
| write-tool `approval-requested` | `ApprovalCard` |
| `output-available` (sql/draft) | compact rows via `ToolResultTable` (admin also keeps its chip row) |

localStorage persistence is unchanged — pending forms/approvals re-render
from cache after reload and remain answerable.

## 4. Files

| Action | Path | Owner task |
|--------|------|-----------|
| Create | `apps/server/src/lib/ai-form-tool.ts` | T1 |
| Modify | `apps/server/src/routes/ai.ts` (tool + prompts) | T1 |
| Modify | `apps/server/src/routes/ai-admin.ts` (tool + prompts) | T1 |
| Modify | `apps/server/src/lib/ai-admin-tools.ts` (needsApproval, tx, RETURNING) | T1 |
| Modify | `apps/server/src/lib/ai-draft-tools.ts` (needsApproval, tx) | T1 |
| Restore | `apps/client/src/components/AiAssistant/AiAssistant.tsx` | T2 |
| Modify | `apps/client/src/layouts/PrivateLayout.tsx` (mount) | T2 |
| Create | `apps/client/src/components/AiChat/{ChatFormCard,ApprovalCard,ToolResultTable,sendWhen}.tsx|.ts` | T3 |
| Modify | `apps/client/src/pages/ai-admin/AiAdminPage.tsx` (toolkit wiring) | T4 |
| Modify | `apps/client/src/components/AiAssistant/AiAssistant.tsx` (toolkit wiring) | T4 |
| Modify | `apps/client/src/locales/{en,id}.json` (`ai_chat.*` keys) | T5 |
| Create | `apps/server/src/tests/ai-admin-approval.test.ts` | T6 |

Shared-file ownership: exactly one task per file (T2 restores then T4 wires
`AiAssistant.tsx` — strictly sequential).

## 5. Error handling

- Denied approval → part `output-denied`; model prompt: don't retry, explain,
  propose alternatives. Nothing executes.
- Form cancelled → `{ submitted: false }`; model continues in prose.
- Form invalid submit → client blocks until required fields valid.
- Transaction failure → existing catch path returns structured error JSON to
  the model; UI shows error chip.
- Unknown tool names at render → fall back to existing chip rendering.

## 6. Testing

- **Server (vitest, mirrors `ai-anomaly-tools.test.ts`):**
  - `needsApproval` gating: write SQL → true; SELECT/WITH/EXPLAIN → false.
  - RETURNING enforcement rewriter (append only when missing; multi-statement
    already blocked by validator).
  - Draft tool `needsApproval` → true.
- **Type/protocol:** `bun run check-types` (restored component + toolkit).
- **Manual pass:**
  1. Assistant FAB opens from any page; `WarehouseLayoutPage` preset-message
     summon works; putaway/dispatch flows intact.
  2. Admin: "delete the SKU named X" → ApprovalCard shows SQL → Deny →
     nothing happens → Approve → tx runs → RETURNING rows shown → AI re-SELECTs
     and shows verification.
  3. Both chats: AI asks for missing info via form → answers resume the task;
     cancel → prose fallback.
- **Verification commands:** `bun run check-types`,
  `bunx vitest run apps/server/src/tests/ai-admin-approval.test.ts`.

## 7. Task DAG (for writing-plans)

```
T1 (backend)  — server: form tool + registrations + prompts; approval gate + tx   [owns ai.ts, ai-admin.ts, ai-admin-tools.ts, ai-draft-tools.ts, ai-form-tool.ts]
T2 (frontend) — restore AiAssistant + mount in PrivateLayout                       [owns AiAssistant.tsx, PrivateLayout.tsx]   ∥ with T1
T3 (frontend) — AiChat toolkit (4 files)                                           [owns components/AiChat/*]                  ∥
T5 (frontend) — i18n ai_chat.* keys                                                [owns locales/*.json]                       ∥
T4 (frontend) — wire toolkit into AiAdminPage + AiAssistant                        [owns those 2 files]                        after T2,T3
T6 (backend)  — vitest approval/transaction tests                                  [owns tests file]                           after T1
T7 (review)   — code-reviewer, whole change set
```
