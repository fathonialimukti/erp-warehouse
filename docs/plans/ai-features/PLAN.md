# AI Features for the ERP Portfolio Demo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the WMS from "an ERP with a chat assistant" into "an ERP that does the work" by adding 6 high-visibility AI features, **ordered by portfolio impact**: **(1) AI transaction drafting ("describe & create")** — the hero demo, **(2) natural-language analytics (chat → chart)**, then **(3) AI reorder assistant, (4) AI approval narratives, (5) AI anomaly detection, (6) daily AI digest** — each demonstrable in 30 seconds for a freelance portfolio.

**Architecture:** Each feature is a small, isolated slice of the existing agent stack. Server-side AI tools follow the established `ai-*-tools.ts` pattern (a `tool()` map with `execute` closures over Prisma). The chat endpoint `apps/server/src/routes/ai.ts` merges tools into `streamText` per request. Client-side, each feature is either a new page consuming a tRPC router, a new component reading/writing existing jotai atoms, or a one-shot SSE request reusing `POST /api/ai/chat`. No new dependencies, no new model provider, no schema migration.

**Tech Stack:** Bun + Turborepo · TypeScript strict (`exactOptionalPropertyTypes`) · Express + tRPC v11 + Prisma (PostgreSQL, ULID) · Vercel AI SDK (`ai` v6 + `@ai-sdk/openai-compatible`) · React 19 + Vite + Tauri · HeroUI v3 (`@heroui/react`) · react-intl v6 · @tanstack/react-query · jotai · recharts (already installed) · Zod in `@repo/schemas`.

## Global Constraints

- **Permission strings:** always `resource@action` (never `resource_action`).
- **File edits:** create/update source ONLY via VS Code edit tools (`create_file`, `replace_string_in_file`, multi-edit). NEVER write/overwrite product source via shell/Python. Shell is for running commands only.
- **Git:** manual only — no `add`/`commit`/`push`/`merge`/`PR` unless the user runs it.
- **TypeScript strict** with `exactOptionalPropertyTypes` — optional props must be explicitly `undefined` or omitted; no bare `!` without a safety comment.
- **No new dependencies.** `recharts`, `jotai`, `xlsx`, `ai` v6, `@heroui/react` v3 are already in `apps/client/package.json`. No schema changes — zero migrations.
- **AI provider:** `apps/server/src/lib/ai-provider.ts` (OpenAI-compatible, base URL `AI_BASE_URL ?? http://localhost:20128/v1`, model `AI_MODEL ?? 'chatbot'`, requires `AI_API_KEY`). Feature must degrade gracefully (no crash) when AI is unavailable.
- **Server files** use `.js` import specifiers (`import { x } from './y.js'`) — ESM.
- **i18n:** every user-facing string must have an `en.json` + `id.json` key (Indonesian).
- **Client UI:** HeroUI v3 compound API only (`Card.Header`/`Card.Content`, `Button`, `Modal`, `Dropdown`, `Table`), tokens from `apps/client/src/index.css` (the only visual authority). Match existing pages. No new design system. UI craft owner: Frontend Engineer.
- **Reference routers** (for tRPC/Prisma patterns): `apps/server/src/routers/receiving-transaction.ts` (transactional create + activity log), `apps/server/src/routers/inventory-aging.ts` (read-only AI-facing queries), `apps/server/src/routers/notification.ts` (notify + list).
- **Reference AI tools:** `apps/server/src/lib/ai-inventory-tools.ts` (server `execute` tools), `apps/server/src/lib/ai-tools.ts` (client tools), `apps/server/src/lib/ai-putaway-tools.ts` (stateful tools), `apps/server/src/lib/ai-db-tools.ts` (read-only SQL).
- **Reference client AI:** `apps/client/src/components/AiFill/aiStream.ts` (one-shot SSE parser), `apps/client/src/components/AiAssistant/AiAssistant.tsx` (`collectPageContext`, `createPatchedFetch`), `apps/client/src/pages/ai-admin/AiAdminPage.tsx` (tool-rendering page).
- **Tests:** server unit tests in `apps/server/src/tests/*.test.ts` (vitest; DB pool via `tests/setup.ts`). Client: Playwright e2e in `apps/client/src/tests/e2e/*.spec.ts`. Run: `bun run check-types` (root), `bunx vitest run <path>` (server).
- **Commit cadence:** one commit per completed task (user runs git manually).
- **Known pre-existing test failures** (NOT caused by this work): `apps/server/src/tests/routers/permission.test.ts`, `access-control`, `sku-category` fail with `TRPCError FORBIDDEN: auth.insufficientPermissions` (test seeds `user@*` but calls `permission@*`). Client browser vitest fails without a Playwright Chromium binary. Do not "fix" these.

---

## File Structure

**New files (server):**
- `apps/server/src/lib/ai-draft-tools.ts` — describe-and-create drafting tools (T1)
- `apps/server/src/routers/ai-analytics.ts` — analytics tRPC router (T2)
- `apps/server/src/lib/ai-reorder-tools.ts` — reorder assistant tools (T4)
- `apps/server/src/lib/ai-approval-tools.ts` — approval narrative tools (T5)
- `apps/server/src/lib/ai-anomaly-tools.ts` — anomaly detection tools (T6)
- `apps/server/src/tests/ai-draft-tools.test.ts` (T1)
- `apps/server/src/tests/routers/ai-analytics.test.ts` (T2)
- `apps/server/src/tests/ai-reorder-tools.test.ts` (T4)
- `apps/server/src/tests/ai-approval-tools.test.ts` (T5)
- `apps/server/src/tests/ai-anomaly-tools.test.ts` (T6)

**New files (client):**
- `apps/client/src/pages/ai-analytics/AiAnalyticsPage.tsx` — natural-language analytics page (T3)
- `apps/client/src/lib/aiAnalytics.ts` — analytics client helpers (T3)
- `apps/client/src/components/AiInsights/AiInsightsCard.tsx` — dashboard insights card (T8)
- `apps/client/src/components/AiDigest/AiDigestCard.tsx` — daily digest card (T9)

**Modified files:**
- `apps/server/src/routes/ai.ts` — merge new server tools into `streamText` tools + add prompt sections (T7)
- `apps/server/src/router.ts` — register `aiAnalytics` router (T2)
- `apps/client/src/routes.tsx` — add `/ai-analytics` route (T3)
- `apps/client/src/constants/nav-menu.ts` — add "AI Analytics" menu entry gated by `stock-movement@read` (T3)
- `apps/client/src/pages/Dashboard.tsx` — render `AiInsightsCard` (T8) and `AiDigestCard` (T9)
- `apps/client/src/locales/en.json` + `id.json` — `aiAnalytics.*` (T3), `aiInsights.*` (T8), `aiDigest.*` (T9)

**Shared-file ownership (no two tasks touch the same file):**
- `apps/server/src/routes/ai.ts` — owned by T7 ONLY
- `apps/server/src/router.ts` — owned by T2 ONLY
- `apps/client/src/routes.tsx` — owned by T3 ONLY
- `apps/client/src/constants/nav-menu.ts` — owned by T3 ONLY
- `apps/client/src/pages/Dashboard.tsx` — owned by T8 AND T9; T9 must wait for T8 to land (sequenced)
- `apps/client/src/locales/en.json` + `id.json` — T3 writes `aiAnalytics.*`; T8 appends `aiInsights.*`; T9 appends `aiDigest.*` after T8 lands (sequenced)

---

## Task DAG (ordered by portfolio priority)

```
T1: AI Draft tools (server) — Describe & Create ⭐ (highest priority)
T2: AI Analytics router + register (server) — chat→chart (2nd priority)
  ↓
T3: AI Analytics page + route + nav (client)      (depends T2)
T4: AI Reorder tools (server)                     (parallel with T3)
T5: AI Approval tools (server)                    (parallel with T3)
T6: AI Anomaly tools (server)                     (parallel with T3)
  ↓
T7: Wire all AI tools into ai.ts (server)         (depends T1, T4, T5, T6)
  ↓
T8: AiInsightsCard on Dashboard (client)          (depends T7; touches Dashboard.tsx)
  ↓
T9: AiDigestCard on Dashboard (client)            (depends T8 — same file Dashboard.tsx)
  ↓
T10: Whole-branch review (Code Reviewer)
```

Parallel groups:
- **Layer 1:** T1 + T2 (disjoint files: `ai-draft-tools.ts` vs `ai-analytics.ts` + `router.ts`).
- **Layer 2:** T3 + T4 + T5 + T6 (all disjoint files — analytics page/routes/nav vs three tool files).
- **Layer 3:** T7 (owns `ai.ts`; imports T1, T4, T5, T6 — must run after them).
- **Layer 4:** T8 (owns `Dashboard.tsx` first).
- **Layer 5:** T9 (same `Dashboard.tsx` — after T8).
- **Layer 6:** T10 (review).

---

### Task 1: AI Draft ("describe & create") tools (server) ⭐ HIGHEST PRIORITY

**Files:**
- Create: `apps/server/src/lib/ai-draft-tools.ts`
- Test: `apps/server/src/tests/ai-draft-tools.test.ts`

**Interfaces:**
- Consumes: `prisma` from `./prisma.js`; `tool`, `z` (AI SDK).
- Produces:
  - `export const draftTools = { draft_receiving_transaction: tool({...}), draft_shipment_transaction: tool({...}) }`
  - Inputs: `draft_receiving_transaction` `{ warehouseId, supplierId, createdById, items: [{ skuId, quantity }] }`; `draft_shipment_transaction` `{ warehouseId, recipient, createdById, items: [{ skuId, quantity }] }` (the shipment schema uses `recipient` — see `createShipmentSchema` in `packages/schemas/src/shipment.ts`; there is no customer model, `recipient` is a free-text field).
  - Outputs: `{ draftCreated: boolean, transactionId?, items, error? }`

**Frozen contract:**
- Both tools create a `DRAFT` transaction (header + items) inside `prisma.$transaction`. Do NOT create pallets/putaway/pick lines, do NOT write activity logs, do NOT call `notify`. The human reviews in the UI. Follow the shape of the existing `create` mutation in `apps/server/src/routers/receiving-transaction.ts` (lines ~100-146): `approvalHistory: []`, `approvalStatus: 'DRAFT'`, header fields + `items.create`.
- `draft_receiving_transaction`: `approvalStatus: 'DRAFT'`, `warehouseId`, `supplierId`, `createdById` (input), items `create` each `{ skuId, quantity }`. Required fields per `createReceivingTransactionSchema` in `packages/schemas/src/receiving-transaction.ts`: `supplierId`, `warehouseId`, `items` (min 1). `approvalHistory: []`. Optional fields (`date`, `carrier`, etc.) may be omitted (Prisma accepts partial input via `create`).
- `draft_shipment_transaction`: same pattern against the shipment model (`createShipmentSchema` in `packages/schemas/src/shipment.ts` — requires `warehouseId`, `items` min 1, `approvalHistory`; `recipient` optional).
- Tool returns DRAFT id; the AI then tells the user "draft created — open it here: /inbound-transaction/receiving/:id" (navigate tool remains client-side; the AI can call `navigateTo` after).
- Never throw: wrap in try/catch returning `{ draftCreated: false, error }`.

**Steps:**
- [ ] Step 1: Write smoke tests (invalid inputs → `{ draftCreated: false }`).
- [ ] Step 2: Run tests, verify FAIL (module not found).
- [ ] Step 3: Create `ai-draft-tools.ts` (follow `ai-inventory-tools.ts` structure exactly — `tool({ description, inputSchema, execute })`).
- [ ] Step 4: Run `bunx vitest run apps/server/src/tests/ai-draft-tools.test.ts` — PASS.
- [ ] Step 5: Run `bun run check-types` (server) — PASS.
- [ ] Step 6: Self-review (no `any`, no bare `!`, `.js` imports).

---

### Task 2: AI Analytics tRPC router + register (server)

**Files:**
- Create: `apps/server/src/routers/ai-analytics.ts`
- Modify: `apps/server/src/router.ts` (import + register `aiAnalytics: aiAnalyticsRouter`)
- Test: `apps/server/src/tests/routers/ai-analytics.test.ts`

**Interfaces:**
- Consumes: `protectedProcedure`, `router`, `hasPermission` from `../trpc.js`; `prisma`; zod.
- Produces (frozen tRPC surface — the client consumes these):
  - `trpcClient.aiAnalytics.suggestQuery.input({ question: string })` → `{ sql, chartType: 'LINE'|'BAR'|'TABLE', table, yKey?, xKey?, summary }` — AI generates SQL from the question via `chatModel` + a read-only SQL generator prompt. `chartType` instructs the client how to render. `table`/`yKey`/`xKey` describe the result shape.
  - `trpcClient.aiAnalytics.executeQuery.input({ sql: string })` → `{ columns: string[], rows: Array<Record<string, unknown>>, rowCount, truncated }` — runs the SQL through the EXISTING `validateReadOnlySql` from `./lib/ai-db-tools.js` (single source of truth; only SELECT/WITH/EXPLAIN allowed), then `prisma.$queryRawUnsafe`, formatting Decimals/BigInts like `formatQueryResult` does. `LIMIT` enforced (max 500).

**Frozen contract:**
- Permission: both procedures guard with `hasPermission('stock-movement@read')` (the existing permission used by `report.ts` and already seeded — do NOT invent a new permission string).
- `suggestQuery` failure mode: if AI call fails (no API key / model down), return `{ sql: null, chartType: 'TABLE', table: [], summary: 'AI unavailable' }` — the client shows a graceful message. Never throw to the client.
- `executeQuery` failure mode: on invalid SQL → `{ error: 'Query rejected: ...' }` shape (match `formatQueryResult` conventions).
- The SQL generator prompt: "You are a read-only SQL generator for a warehouse ERP. Schema: [paste the relevant table/column names from `apps/server/src/knowledge/database-schema.md` — READ THAT FILE FIRST and inline the key tables: stock_movements, pallets, skus, warehouses, receiving_transactions, shipment_items, sku_inventory_balances]. Return ONLY JSON: { sql, chartType, summary }. SQL must be SELECT-only, no semicolons, no comments, LIMIT 500."
- Parse the model output as JSON (use `JSON.parse` on the text, strip code fences). If parse fails → fallback `{ sql: null, chartType: 'TABLE', table: [], summary: 'Could not parse' }`.

**Steps:**
- [ ] Step 1: Write failing test: router exists, `suggestQuery` with `{ question: 'test' }` returns a shape (AI mock optional — test the fallback path by not setting `AI_API_KEY`; the unit test can stub `chatModel` if needed).
- [ ] Step 2: Run, verify FAIL.
- [ ] Step 3: Create `ai-analytics.ts` + register in `router.ts`.
- [ ] Step 4: `bunx vitest run apps/server/src/tests/routers/ai-analytics.test.ts` — PASS.
- [ ] Step 5: `bun run check-types` (server) — PASS.

---

### Task 3: AI Analytics page (client) + route + nav

**Files:**
- Create: `apps/client/src/pages/ai-analytics/AiAnalyticsPage.tsx`
- Create: `apps/client/src/lib/aiAnalytics.ts` (thin client helper — optional if page self-contains; keep only if used)
- Modify: `apps/client/src/routes.tsx` — add import + `{ path: 'ai-analytics', element: <AiAnalyticsPage /> }` inside the `ProtectedRoute`/`PrivateLayout` children, next to the existing `{ path: 'ai-admin', element: <AiAdminPage /> }` entry (routes.tsx uses object-form `createBrowserRouter` children, not JSX `<Route>` — match that style exactly)
- Modify: `apps/client/src/constants/nav-menu.ts` (the `NAV_MENU` array — add an "AI Analytics" item with a `solar:chart-2-linear` icon, gated by permission `stock-movement@read`)
- i18n: add `aiAnalytics.*` keys to `en.json` + `id.json`

**Interfaces:**
- Consumes: `trpcClient.aiAnalytics.suggestQuery` + `executeQuery` (T2); `useIntl`; HeroUI v3; `recharts` (installed).
- Produces: `export function AiAnalyticsPage(): JSX.Element`

**Frozen contract:**
- Layout: PageHeader (title "AI Analytics", subtitle) → prompt `TextArea` + "Analyze" `Button` → result area.
- Flow: on submit → `suggestQuery({ question })` → if `sql` null → error card. Else → `executeQuery({ sql })` → render:
  - `chartType: 'LINE'`/`'BAR'` → `recharts` `ResponsiveContainer` + `LineChart`/`BarChart` (xKey = `xKey`, series = `yKey`). If no numeric yKey, fall back to TABLE.
  - `chartType: 'TABLE'` → HeroUI `Table` with dynamic columns from `columns`.
- Below chart: the SQL shown in a collapsed `<details>`/code block + `summary` text + rowCount.
- Add `data-ai-context` attribute with `{ section: 'ai-analytics' }` so the assistant can see this page (match existing pages' pattern).
- i18n keys: `aiAnalytics.page_title`, `aiAnalytics.page_subtitle`, `aiAnalytics.question_placeholder`, `aiAnalytics.analyze`, `aiAnalytics.loading`, `aiAnalytics.error_ai_unavailable`, `aiAnalytics.error_query_rejected`, `aiAnalytics.summary`, `aiAnalytics.sql_label`, `aiAnalytics.rows`, `aiAnalytics.empty`.
- Route + nav gated by `stock-movement@read` (both route guard and menu visibility).

**Steps:**
- [ ] Step 1: Create the page (structure modeled on `apps/client/src/pages/inbound-transaction/` index pages + `AiAdminPage.tsx` for tool-result rendering).
- [ ] Step 2: Add route in `routes.tsx` + menu entry in nav config.
- [ ] Step 3: Add i18n keys (both locales).
- [ ] Step 4: `bun run check-types` (client) — PASS.
- [ ] Step 5: Manual: `bun run dev`, log in as admin, open `/ai-analytics`, type "monthly outbound volume by warehouse", confirm chart renders. (Needs AI server + API key; if unavailable, confirm graceful error card.)

---

### Task 4: AI Reorder Assistant tools (server)

**Files:**
- Create: `apps/server/src/lib/ai-reorder-tools.ts`
- Test: `apps/server/src/tests/ai-reorder-tools.test.ts`

**Interfaces:**
- Consumes: `prisma` from `./prisma.js`; `tool`, `z` (AI SDK).
- Produces:
  - `export const reorderTools = { get_reorder_suggestions: tool({...}), draft_reorder_receiving: tool({...}) }`
  - Tool inputs/outputs (frozen):
    - `get_reorder_suggestions` input `{}` → output `{ suggestions: Array<{ skuId, skuCode, skuName, warehouseId, warehouseName, availableQty, avgDailyUsage, daysOfCover, suggestedReorderQty, preferredSupplierId?, preferredSupplierName?, unitPrice?, estOrderValue, reason }>, generatedAt }`
    - `draft_reorder_receiving` input `{ warehouseId: string, createdById: string, items: Array<{ skuId, quantity }> }` → output `{ draftCreated: boolean, transactionId?, items, error? }`

**Frozen contract:**
- Permission: no permission check inside the tool (the chat endpoint guards auth; keep tools permission-neutral like existing `inventoryAgingTools`).
- `get_reorder_suggestions` logic (deterministic, no LLM):
  - For each SKU with at least one `AVAILABLE` pallet (or zero pallets — out of stock), compute:
    - `availableQty` = `sum(pallets where status=AVAILABLE) * packagesPerPallet * quantityPerPackage`
    - `avgDailyUsage` = total OUT quantity from `stock_movements` (direction `OUT`) over the last 30 days ÷ 30
    - `daysOfCover` = `availableQty / max(avgDailyUsage, epsilon)`
    - `suggestedReorderQty` = `ceil(avgDailyUsage * 14)` (14-day lead time buffer; constant `REORDER_LEAD_DAYS = 14`) when `daysOfCover < 14` OR `availableQty === 0`
  - Preferred supplier: `supplier_skus` row with `isPreferred = true`; fall back to first row; include `unitPrice`, `minimumOrderQty`.
  - `estOrderValue` = `suggestedReorderQty * unitPrice ?? standardCost`.
  - `reason` = one of `"OUT_OF_STOCK"` | `"LOW_COVER"` | `"OK"` — only include suggestions with reason `OUT_OF_STOCK` or `LOW_COVER`.
  - Use Prisma `groupBy`/aggregate on `stock_movements`; wrap in try/catch returning `{ suggestions: [], generatedAt, error: message }` on failure (never throw — AI tool resilience).
- `draft_reorder_receiving`:
  - Builds a `receiving_transactions` row with `approvalStatus: 'DRAFT'`, `createdById` from input (tools receive `{ toolCallId, messages }` — deriving the user id from tool context is NOT possible, so accept `createdById` as an input param). Input: `{ warehouseId, createdById, items: [{ skuId, quantity }] }`.
  - Creates the transaction + `receiving_transaction_items` rows (one per item, `quantity`, `skuId`) in a `prisma.$transaction`.
  - Returns `{ draftCreated: true, transactionId }` or `{ draftCreated: false, error }`.
  - Do NOT create pallets, do NOT create putaway lines, do NOT write activity logs — a DRAFT created by the AI is just the header + items; the human reviews in the UI and completes it.

**Steps:**
- [ ] Step 1: Write the failing test `apps/server/src/tests/ai-reorder-tools.test.ts` — smoke test modeled on `ai-inventory-tools.test.ts`: call `get_reorder_suggestions.execute!({}, { toolCallId: 't', messages: [] })`, assert `suggestions` is an array and `generatedAt` exists; and `draft_reorder_receiving` with invalid `warehouseId` returns `{ draftCreated: false }`.
- [ ] Step 2: Run it to verify it fails (module not found).
- [ ] Step 3: Create `ai-reorder-tools.ts` implementing both tools (follow `ai-inventory-tools.ts` structure exactly — `tool({ description, inputSchema, execute })`).
- [ ] Step 4: Run `bunx vitest run apps/server/src/tests/ai-reorder-tools.test.ts` — PASS.
- [ ] Step 5: Run `bun run check-types` (server) — PASS.
- [ ] Step 6: Self-review (no `any`, no bare `!`, `.js` imports).

---

### Task 5: AI Approval Narrative tools (server)

**Files:**
- Create: `apps/server/src/lib/ai-approval-tools.ts`
- Test: `apps/server/src/tests/ai-approval-tools.test.ts`

**Interfaces:**
- Consumes: `prisma` from `./prisma.js`; `tool`, `z`.
- Produces:
  - `export const approvalTools = { get_approval_queue: tool({...}), get_transaction_summary: tool({...}) }`
  - `get_approval_queue` input `{}` → `{ items: Array<{ transactionType, transactionId, documentNumber?, warehouseName, skuCount, totalQuantity, totalValue, status, createdByName, createdAt }> }`
  - `get_transaction_summary` input `{ transactionType: string, id: string }` → `{ summary: { type, id, documentNumber?, warehouseName, status, createdByName, createdAt, items: Array<{ skuCode, skuName, quantity, unitPrice?, value }>, totalValue, flags: Array<string> } }`

**Frozen contract:**
- `get_approval_queue`: aggregate across ALL inbound+outbound routers' `PROPOSED` transactions (receiving, wipCompletion, rmaReceipt, found, shipment, wipIssue, returnToSupplier, disposal, subinventoryTransfer, loss). Use `Promise.all` of `prisma.<model>.findMany({ where: { approvalStatus: 'PROPOSED' }, include: items + warehouse + createdBy })`. Flatten to `items` with a `transactionType` string (use the Prisma model name lowercase, e.g. `'receivingTransaction'` — the AI uses this to call `get_transaction_summary`).
- `totalValue` = `sum(items: quantity * sku.standardCost ?? 0)` (Decimal→Number).
- `flags` (rule-based, no LLM): `"HIGH_VALUE"` if `totalValue > 1000000` (Rupiah-scale; constant `HIGH_VALUE_THRESHOLD = 1_000_000`), `"SINGLE_ITEM"` if 1 item, `"NO_WAREHOUSE"` if no warehouse.
- Return shapes must be plain JSON-serializable (Decimal → `Number(...)`, Date → `toISOString()`).
- Never throw: wrap in try/catch returning `{ items: [] }` / `{ summary: null, error }`.

**Steps:**
- [ ] Step 1: Write smoke test (empty DB → `items` array exists; `get_transaction_summary` with bogus id returns `summary: null`).
- [ ] Step 2: Run test, verify FAIL (module not found).
- [ ] Step 3: Create `ai-approval-tools.ts`.
- [ ] Step 4: Run `bunx vitest run apps/server/src/tests/ai-approval-tools.test.ts` — PASS.
- [ ] Step 5: `bun run check-types` (server) — PASS.
- [ ] Step 6: Self-review.

---

### Task 6: AI Anomaly Detection tools (server)

**Files:**
- Create: `apps/server/src/lib/ai-anomaly-tools.ts`
- Test: `apps/server/src/tests/ai-anomaly-tools.test.ts`

**Interfaces:**
- Consumes: `prisma` from `./prisma.js`; `tool`, `z`.
- Produces:
  - `export const anomalyTools = { get_anomalies: tool({...}) }`
  - `get_anomalies` input `{}` → `{ anomalies: Array<{ type: string, severity: 'HIGH'|'MEDIUM'|'LOW', title, description, skuId?, skuCode?, transactionId?, createdAt }>, generatedAt }`

**Frozen contract:**
- Deterministic rule engine (no LLM needed to detect; the AI narrates):
  - `DEAD_STOCK` (severity MEDIUM): AVAILABLE pallets with no stock movement > 180 days (reuse the SQL pattern from `get_warehouse_insights` in `ai-inventory-tools.ts`). Top 5 by value.
  - `OUT_OF_STOCK` (HIGH): SKUs with zero AVAILABLE pallets. Top 10.
  - `PUTAWAY_BACKLOG` (MEDIUM): count of AVAILABLE pallets with `storageLocationId: null`. One anomaly if > 0.
  - `DISPATCH_BACKLOG` (MEDIUM): count of `pick_lines` with `status: 'PENDING'` (check schema — if field names differ, use the dispatch router's pending query). One anomaly if > 0.
  - `NEAR_DUPLICATE_TRANSACTIONS` (LOW): within last 24h, two receiving transactions with same `warehouseId` + same first-item `skuId` + same `quantity` → flag as potential duplicate. Use a GROUP BY query; cap at 5.
- `severity` per rule as above. `createdAt` = ISO now.
- Never throw: wrap in try/catch returning `{ anomalies: [], generatedAt, error }`.

**Steps:**
- [ ] Step 1: Write smoke test (empty DB → `anomalies` array + `generatedAt`).
- [ ] Step 2: Run test, verify FAIL.
- [ ] Step 3: Create `ai-anomaly-tools.ts`.
- [ ] Step 4: Run vitest — PASS.
- [ ] Step 5: `bun run check-types` (server) — PASS.
- [ ] Step 6: Self-review.

---

### Task 7: Wire all AI tools into `ai.ts` (server)

**Files:**
- Modify: `apps/server/src/routes/ai.ts` (import + merge tools + prompt sections)

**Interfaces:**
- Consumes: `draftTools` (T1), `reorderTools` (T4), `approvalTools` (T5), `anomalyTools` (T6).
- Produces: the chat endpoint now exposes all four tool sets to the model.

**Frozen contract:**
- Import `draftTools` from `../lib/ai-draft-tools.js`, `reorderTools` from `../lib/ai-reorder-tools.js`, `approvalTools` from `../lib/ai-approval-tools.js`, `anomalyTools` from `../lib/ai-anomaly-tools.js`.
- In `aiChatHandler`'s `streamText` call, spread all four into `tools: { ...clientTools, ...inventoryAgingTools, ...putawayTools, ...dispatchTools, ...draftTools, ...reorderTools, ...approvalTools, ...anomalyTools }`.
- Add prompt sections to `buildSystemPrompt`:
  - `## AI Drafting (Describe & Create)` — when the user describes a transaction in natural language (e.g. "receive 50 pcs of SKU-PB-001 from supplier X at warehouse A"), call `draft_receiving_transaction` / `draft_shipment_transaction` directly. The draft is DRAFT status; tell the user it needs review + approval. This is the flagship capability — describe it prominently.
  - `## AI Reorder Assistant` — PREFER `get_reorder_suggestions` over SQL for reorder questions; use `draft_reorder_receiving` only when the user confirms a suggestion.
  - `## AI Approval Narratives` — when the user asks about pending approvals, call `get_approval_queue`, then `get_transaction_summary` for the item(s) the user cares about, and narrate in business language (no raw JSON).
  - `## AI Anomaly Detection` — when the user asks "what's wrong / what needs attention", call `get_anomalies` and narrate severity-ordered.

**Steps:**
- [ ] Step 1: Add the four imports + spread into `streamText` tools.
- [ ] Step 2: Add the four prompt sections to `buildSystemPrompt`.
- [ ] Step 3: `bun run check-types` (server) — PASS.
- [ ] Step 4: Manual: start server + a local OpenAI-compatible model (`AI_API_KEY` set), POST a chat message "receive 50 pcs SKU-PB-001..." and confirm the tool fires and a DRAFT row appears in `receiving_transactions`. (If no model available, skip manual — types is the gate.)

---

### Task 8: AI Insights card on Dashboard (client)

**Files:**
- Create: `apps/client/src/components/AiInsights/AiInsightsCard.tsx`
- Modify: `apps/client/src/pages/Dashboard.tsx` (render the card in the KPIs grid row area)
- Modify: `apps/client/src/locales/en.json` + `id.json` (`aiInsights.*` keys)

**Interfaces:**
- Consumes: `authUserAtom`, `useIntl`, HeroUI v3 `Card`; the `queryDatabase`-style fetch pattern (`fetch('/api/ai/query', ...)` used in `AiAssistant.tsx` runTool) — but here we call the NEW `get_anomalies` tool via a one-shot chat request (reuse `requestAiFillFields`-style SSE parsing from `aiStream.ts`, generalized). DECISION (frozen): use the one-shot chat SSE approach (`/api/ai/chat` with a single user message "run get_anomalies and summarize" + parse the tool output from the stream, same as `extractFillFieldsFromStream` in `aiStream.ts` but reading `tool-output-available` for `get_anomalies`).
- Produces: `export function AiInsightsCard(): JSX.Element`

**Frozen contract:**
- Card renders below the KPI grid on Dashboard, title "AI Insights" (i18n), a `Spinner` while loading, then a list of anomaly chips grouped by severity (HIGH = danger, MEDIUM = warning, LOW = default), each with title + description.
- Button "Refresh" re-runs. If the stream yields no anomalies → empty-state text "No anomalies detected".
- If AI unavailable → error state text + retry button (never crash Dashboard).
- Parse `tool-output-available` events for toolName `get_anomalies` (extend the `aiStream.ts` parser pattern — do NOT modify `aiStream.ts` if it's shared; create a local parser in `AiInsightsCard.tsx` or a new `lib/aiOneShot.ts` helper. Prefer a new helper file so `aiStream.ts` (owned by ai-fill plan) stays untouched).
- i18n keys: `aiInsights.title`, `aiInsights.subtitle`, `aiInsights.refresh`, `aiInsights.loading`, `aiInsights.empty`, `aiInsights.error`, `aiInsights.severity_high`, `aiInsights.severity_medium`, `aiInsights.severity_low`.
- Style: match existing Dashboard cards (KPI card styling in `Dashboard.tsx` lines ~88-140).

**Steps:**
- [ ] Step 1: Create `lib/aiOneShot.ts` helper (generalized one-shot tool call + SSE output parser for a named server tool).
- [ ] Step 2: Create `AiInsightsCard.tsx`.
- [ ] Step 3: Render in `Dashboard.tsx` (below KPI grid).
- [ ] Step 4: Add i18n keys.
- [ ] Step 5: `bun run check-types` (client) — PASS.
- [ ] Step 6: Manual verification (dashboard loads, card shows insights or graceful error).

---

### Task 9: AI Daily Digest card (client)

**Files:**
- Create: `apps/client/src/components/AiDigest/AiDigestCard.tsx`
- Modify: `apps/client/src/pages/Dashboard.tsx` (render digest card next to/below insights card — T8 must land first; both cards in the same file, different components)
- Modify: `apps/client/src/locales/en.json` + `id.json` (`aiDigest.*` keys — appended AFTER T8's keys)

**Interfaces:**
- Consumes: same `lib/aiOneShot.ts` helper (T8); HeroUI v3; `useIntl`; `authUserAtom`.
- Produces: `export function AiDigestCard(): JSX.Element`

**Frozen contract:**
- A card on the Dashboard titled "Today's AI Digest" (i18n). On mount, sends a one-shot chat message: "Generate a short morning digest for a warehouse manager: pending approvals, putaway/dispatch backlog, out-of-stock SKUs, dead stock value, and anything urgent. Use get_approval_queue, get_anomalies, and get_warehouse_insights. Answer in 5-7 short bullet lines in plain business language." — then renders the assistant's TEXT reply (parse `text-delta` from the SSE stream, not tool output). This shows the AI *narrating* across tools.
- Render: markdown-lite (the AI's reply is plain text; render with `whitespace-pre-line` + line splitting into `<li>` if it starts with `- `).
- "Regenerate" button. Graceful error state (AI unavailable).
- This demonstrates the "proactive AI that talks to you every morning" portfolio story.
- i18n keys: `aiDigest.title`, `aiDigest.subtitle`, `aiDigest.regenerate`, `aiDigest.loading`, `aiDigest.error`.

**Steps:**
- [ ] Step 1: Create `AiDigestCard.tsx` (reuse `lib/aiOneShot.ts`).
- [ ] Step 2: Render in `Dashboard.tsx` below `AiInsightsCard`.
- [ ] Step 3: Append i18n keys.
- [ ] Step 4: `bun run check-types` (client) — PASS.
- [ ] Step 5: Manual verification.

---

### Task 10: Whole-branch review (Code Reviewer)

**Files:** none (read-only).

**Interfaces:** review the full diff; verify:
- [ ] All 9 tasks' deliverables present; no shared-file conflicts.
- [ ] Permission strings are `resource@action` (`stock-movement@read` used for analytics — existing seeded permission).
- [ ] No new deps, no migrations, no shell file-writes.
- [ ] TypeScript strict compliance; no `any`, no bare `!`.
- [ ] Server tools never throw (always structured error returns); SQL always through `validateReadOnlySql`.
- [ ] i18n complete in en + id.
- [ ] Client pages match existing HeroUI v3 + token patterns (no gray shells).
- [ ] Tests exist and pass (server vitest; client check-types).

**Output:** findings list + one-sentence Commit/Push recommendation. No git writes.

---

## Verification (final)

- `bun run check-types` — all packages clean.
- `bunx vitest run apps/server/src/tests/ai-draft-tools.test.ts apps/server/src/tests/routers/ai-analytics.test.ts apps/server/src/tests/ai-reorder-tools.test.ts apps/server/src/tests/ai-approval-tools.test.ts apps/server/src/tests/ai-anomaly-tools.test.ts` — all PASS.
- Manual demo script (for the portfolio, in priority order):
  1. **Chat: "receive 50 pcs SKU-PB-001 from supplier PT Maju at Warehouse A"** → DRAFT receiving created, AI navigates to it. *(The hero demo — "an ERP that does the work.")*
  2. **`/ai-analytics`: "show monthly outbound volume by warehouse"** → chart renders. *(AI explains the data.)*
  3. Chat: "what needs attention?" → anomaly narration.
  4. Chat: "what's pending approval?" → approval narrative.
  5. Dashboard shows AI Insights card + Daily Digest (proactive AI).
