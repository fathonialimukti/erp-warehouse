# AI Features Plan 2 — Portfolio Demo (Photo → Entry, Audit Narratives, WIP/Loss Classification, 3D Conversation, Stock-out Forecast, Voice Ops)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the next 6 high-visibility AI features to the WMS portfolio demo, **ordered by impact**: **(1) Photo → Inventory entry** (computer vision), **(2) AI audit narratives**, **(3) AI-assisted WIP/Loss classification**, **(4) 3D digital-twin conversation**, **(5) predictive stock-out forecasting**, **(6) voice floor ops (Tauri)**. Each demonstrable in 30 seconds.

**Architecture:** Same pattern as Plan 1 (`docs/plans/ai-features/PLAN.md` — read it first for the established conventions). Server-side AI tools follow the `ai-*-tools.ts` pattern; the chat endpoint `apps/server/src/routes/ai.ts` merges tools + prompt sections; client features are new pages/components or one-shot SSE requests reusing `POST /api/ai/chat`. No new dependencies, no schema migration.

**Tech Stack:** Bun + Turborepo · TypeScript strict (`exactOptionalPropertyTypes`) · Express + tRPC v11 + Prisma (PostgreSQL, ULID) · Vercel AI SDK (`ai` v6 + `@ai-sdk/openai-compatible`) · React 19 + Vite + Tauri · HeroUI v3 · react-intl v6 · jotai · recharts · Zod in `@repo/schemas`.

## Global Constraints

- **Permission strings:** always `resource@action` (never `resource_action`).
- **File edits:** create/update source ONLY via VS Code edit tools. NEVER write/overwrite product source via shell/Python. Shell is for running commands only.
- **Git:** manual only — no `add`/`commit`/`push`/`merge`/`PR` unless the user runs it.
- **TypeScript strict** with `exactOptionalPropertyTypes` — optional props explicitly `undefined` or omitted; no bare `!` without a safety comment.
- **No new dependencies.** `recharts`, `jotai`, `ai` v6, `@heroui/react` v3, `@tauri-apps/api` are already installed. No schema changes — zero migrations.
- **AI provider:** `apps/server/src/lib/ai-provider.ts` (OpenAI-compatible, `AI_BASE_URL ?? http://localhost:20128/v1`, model `AI_MODEL ?? 'chatbot'`, requires `AI_API_KEY`). Features must degrade gracefully (no crash) when AI is unavailable.
- **Server files** use `.js` import specifiers (ESM).
- **i18n:** every user-facing string needs `en.json` + `id.json` keys.
- **Client UI:** HeroUI v3 compound API only; tokens from `apps/client/src/index.css`. No new design system. UI craft owner: Frontend Engineer.
- **API key limit: 10 req/min (HARD).** Tests MUST be deterministic (no LLM calls). Manual AI verification deferred to the end, kept minimal.
- **Reference files (read first):** `apps/server/src/lib/ai-inventory-tools.ts` (tool pattern), `apps/server/src/lib/ai-draft-tools.ts` (draft pattern), `apps/server/src/routes/ai.ts` (tool wiring + prompt sections), `apps/client/src/lib/aiOneShot.ts` (one-shot SSE helper), `apps/client/src/components/AiInsights/AiInsightsCard.tsx` (dashboard card pattern), `apps/server/src/routers/upload.ts` + `apps/server/src/lib/upload-service.ts` (image persistence), `apps/server/src/routers/activity-log.ts` (audit log shape), `apps/server/src/lib/notification-service.ts` (`notify`).
- **Known pre-existing test failures** (NOT caused by this work): `permission.test.ts`, `access-control`, `sku-category` (FORBIDDEN: auth.insufficientPermissions). Client browser vitest fails without Playwright Chromium. Do not "fix".
- **Commit cadence:** one commit per completed task (user runs git manually).

---

## File Structure

**New files (server):**
- `apps/server/src/lib/ai-vision-tools.ts` — photo → SKU extraction (T1)
- `apps/server/src/lib/ai-audit-tools.ts` — audit narrative tools (T2)
- `apps/server/src/lib/ai-classify-tools.ts` — WIP/Loss cause classification (T3)
- `apps/server/src/lib/ai-forecast-tools.ts` — stock-out forecasting (T5)
- `apps/server/src/tests/ai-vision-tools.test.ts` (T1)
- `apps/server/src/tests/ai-audit-tools.test.ts` (T2)
- `apps/server/src/tests/ai-classify-tools.test.ts` (T3)
- `apps/server/src/tests/ai-forecast-tools.test.ts` (T5)

**New files (client):**
- `apps/client/src/components/AiVision/AiVisionPanel.tsx` — photo → form-fill panel (T1)
- `apps/client/src/components/AiAudit/AiAuditNarrative.tsx` — audit log narrative (T2)
- `apps/client/src/components/AiClassify/AiClassifySuggest.tsx` — WIP/Loss cause suggestion (T3)
- `apps/client/src/components/AiForecast/AiForecastCard.tsx` — stock-out forecast card (T5)
- `apps/client/src/components/AiVoice/AiVoiceBar.tsx` — voice floor ops (T6)

**Modified files:**
- `apps/server/src/routes/ai.ts` — merge new tools + prompt sections (T4 owns this file)
- `apps/client/src/pages/activity-logs/ActivityLogsIndexPage.tsx` — render `AiAuditNarrative` (T2)
- `apps/client/src/pages/outbound-transaction/loss/LossTransactionFormPage.tsx` — render `AiClassifySuggest` (T3)
- `apps/client/src/pages/inbound-transaction/receiving/ReceivingTransactionFormPage.tsx` — render `AiVisionPanel` (T1)
- `apps/client/src/pages/Dashboard.tsx` — render `AiForecastCard` (T5)
- `apps/client/src/layouts/PrivateLayout.tsx` — render `AiVoiceBar` (T6)
- `apps/client/src/locales/en.json` + `id.json` — `aiVision.*`, `aiAudit.*`, `aiClassify.*`, `aiForecast.*`, `aiVoice.*`

**Shared-file ownership (no two tasks touch the same file):**
- `apps/server/src/routes/ai.ts` — owned by T4 ONLY
- `apps/client/src/pages/Dashboard.tsx` — owned by T5 ONLY
- `apps/client/src/locales/en.json` + `id.json` — T1 writes `aiVision.*`; T2 appends `aiAudit.*`; T3 appends `aiClassify.*`; T5 appends `aiForecast.*`; T6 appends `aiVoice.*` (sequenced)

---

## Task DAG (ordered by portfolio priority)

```
T1: AI Vision tools + panel (server + client) — Photo → Entry ⭐ (highest)
T2: AI Audit narrative tools + component (server + client)
T3: AI WIP/Loss classification tools + component (server + client)
  ↓
T4: Wire all new tools into ai.ts (server)      (depends T1, T2, T3, T5)
  ↓
T5: AI Forecast tools + card (server + client)  (parallel with T1–T3; T4 needs it)
  ↓
T6: AI Voice floor ops bar (client, Tauri)      (depends T4 — uses chat endpoint)
  ↓
T7: Whole-branch review (Code Reviewer)
```

Parallel groups:
- **Layer 1:** T1 + T2 + T3 + T5 (all disjoint files — vision/audit/classify/forecast tool files + their client components).
- **Layer 2:** T4 (owns `ai.ts`; imports T1, T2, T3, T5 — must run after them).
- **Layer 3:** T6 (voice bar; uses the wired chat endpoint).
- **Layer 4:** T7 (review).

---

### Task 1: AI Vision — Photo → Inventory Entry ⭐ HIGHEST PRIORITY

**Files:**
- Create: `apps/server/src/lib/ai-vision-tools.ts`
- Create: `apps/server/src/tests/ai-vision-tools.test.ts`
- Create: `apps/client/src/components/AiVision/AiVisionPanel.tsx`
- Modify: `apps/client/src/pages/inbound-transaction/receiving/ReceivingTransactionFormPage.tsx` (render `AiVisionPanel` below the header)
- i18n: `aiVision.*` keys (en + id)

**Interfaces:**
- Consumes: `prisma` from `./prisma.js`; `tool`, `z`; `chatModel` from `./ai-provider.js`; `generateText` from `ai`.
- Produces:
  - `export const visionTools = { extract_sku_from_photo: tool({...}) }`
  - `extract_sku_from_photo` input `{ imageDataUrl: string }` → `{ skuCode?, skuId?, skuName?, quantity?, confidence, error? }`
  - `export function AiVisionPanel(): JSX.Element`

**Frozen contract:**
- `extract_sku_from_photo`: takes a base64 data-URL image, sends it to the vision-capable model via `generateText` with an image part (check the AI SDK v6 API for image content parts — `{ type: 'image', image: dataUrl }`), and asks it to extract the SKU code, name, and quantity from a label/box photo. Returns structured JSON. On ANY failure (no API key, model down, parse fail) → `{ error: 'AI unavailable' }` — never throw.
- The tool must NOT persist anything — it only extracts. The client applies the result to the form.
- `AiVisionPanel`: a card below the page header on the Receiving form. Contains an image picker (reuse the `ImageUploadField` pattern from `apps/client/src/components/ImageUploadField.tsx` — it reads files to data-URLs), an "Extract" button, and a result area showing the extracted SKU/qty with an "Apply to form" button that calls `useAiFillForm`-style field setting (reuse `aiFormFillAtom` from `apps/client/src/lib/atoms.ts`).
- The panel calls `extract_sku_from_photo` via a one-shot chat request (reuse `requestToolOutput` from `apps/client/src/lib/aiOneShot.ts` with `toolName: 'extract_sku_from_photo'`).
- i18n keys: `aiVision.title`, `aiVision.subtitle`, `aiVision.pick_image`, `aiVision.extract`, `aiVision.loading`, `aiVision.error`, `aiVision.apply`, `aiVision.no_result`.
- Test (deterministic, no LLM): `extract_sku_from_photo.execute!({ imageDataUrl: 'data:image/png;base64,AAAA' }, ...)` returns an object with `error` (no model → caught, not thrown). Assert tool exists with `execute`.

**Steps:**
- [ ] Step 1: Write failing test (invalid image → `{ error }`, no throw).
- [ ] Step 2: Run test, verify FAIL.
- [ ] Step 3: Create `ai-vision-tools.ts`.
- [ ] Step 4: Create `AiVisionPanel.tsx` + render on Receiving form + i18n.
- [ ] Step 5: `bunx vitest run apps/server/src/tests/ai-vision-tools.test.ts` — PASS.
- [ ] Step 6: `bun run check-types` (server + client) — PASS.

---

### Task 2: AI Audit Narratives

**Files:**
- Create: `apps/server/src/lib/ai-audit-tools.ts`
- Create: `apps/server/src/tests/ai-audit-tools.test.ts`
- Create: `apps/client/src/components/AiAudit/AiAuditNarrative.tsx`
- Modify: `apps/client/src/pages/activity-logs/ActivityLogsIndexPage.tsx` (render `AiAuditNarrative` — an "Explain this log" action per row, or a summary card)
- i18n: `aiAudit.*` keys

**Interfaces:**
- Consumes: `prisma` from `./prisma.js`; `tool`, `z`.
- Produces:
  - `export const auditTools = { get_activity_summary: tool({...}), explain_activity: tool({...}) }`
  - `get_activity_summary` input `{}` → `{ summary: { totalLogs, byAction: Record<string, number>, byResource: Record<string, number>, recentUsers: Array<{ name, count }>, generatedAt } }`
  - `explain_activity` input `{ activityLogId: string }` → `{ explanation: { id, user, action, resource, message, createdAt, detail, flags: Array<string> } | null, error? }`

**Frozen contract:**
- `get_activity_summary`: aggregate `activity_logs` (count by action, count by resource, top users by count). Deterministic, no LLM.
- `explain_activity`: fetch one `activity_log` by id (include `user`), return structured fields + rule-based `flags` (e.g. `"BULK_CREATE"` if same user created 3+ records in 10 min, `"DELETE_AFTER_CREATE"` if a delete follows a create on the same resource within 10 min — query `activity_logs` for context). The AI narrates the flags in the chat.
- Never throw: wrap in try/catch returning `{ summary: {...empty}, error }` / `{ explanation: null, error }`.
- `AiAuditNarrative`: a card on the Activity Logs page showing the summary (byAction chips, byResource counts, top users) + a per-row "Explain" button that opens a small panel calling `explain_activity` via `requestToolOutput` and renders the flags.
- i18n keys: `aiAudit.title`, `aiAudit.subtitle`, `aiAudit.explain`, `aiAudit.loading`, `aiAudit.error`, `aiAudit.by_action`, `aiAudit.by_resource`, `aiAudit.top_users`, `aiAudit.flag_bulk_create`, `aiAudit.flag_delete_after_create`.
- Test (deterministic): `get_activity_summary.execute!({}, ...)` returns `{ summary }` with arrays/records; `explain_activity.execute!({ activityLogId: 'bogus' }, ...)` returns `{ explanation: null }`.

**Steps:**
- [ ] Step 1: Write failing test.
- [ ] Step 2: Run, verify FAIL.
- [ ] Step 3: Create `ai-audit-tools.ts`.
- [ ] Step 4: Create `AiAuditNarrative.tsx` + render on Activity Logs page + i18n.
- [ ] Step 5: vitest — PASS.
- [ ] Step 6: check-types (server + client) — PASS.

---

### Task 3: AI WIP/Loss Cause Classification

**Files:**
- Create: `apps/server/src/lib/ai-classify-tools.ts`
- Create: `apps/server/src/tests/ai-classify-tools.test.ts`
- Create: `apps/client/src/components/AiClassify/AiClassifySuggest.tsx`
- Modify: `apps/client/src/pages/outbound-transaction/loss/LossTransactionFormPage.tsx` (render `AiClassifySuggest`)
- i18n: `aiClassify.*` keys

**Interfaces:**
- Consumes: `prisma` from `./prisma.js`; `tool`, `z`; `chatModel` + `generateText`.
- Produces:
  - `export const classifyTools = { suggest_loss_cause: tool({...}) }`
  - `suggest_loss_cause` input `{ skuId: string, quantity: number, notes?: string, warehouseId: string }` → `{ suggestedCause, confidence, similarHistory: Array<{ lossReason, count, lastDate }>, error? }`

**Frozen contract:**
- `suggest_loss_cause`: (1) deterministically query `loss_transactions` history for the same SKU to find common `lossReason` values (top 3 by count, with last date); (2) if history exists, return the top cause + confidence (rule-based: count/total); (3) if no history, call the LLM with the SKU name/type + notes to suggest a likely cause. On LLM failure → return `{ suggestedCause: null, similarHistory: [...], error: 'AI unavailable' }` — never throw.
- `AiClassifySuggest`: a small card on the Loss form that, when the user has selected a SKU + qty, shows "Likely cause: X (confidence Y%)" with a "Use" button that sets the `lossReason` field (via `aiFormFillAtom`). Reuses `requestToolOutput`.
- i18n keys: `aiClassify.title`, `aiClassify.subtitle`, `aiClassify.suggest`, `aiClassify.loading`, `aiClassify.error`, `aiClassify.use`, `aiClassify.confidence`, `aiClassify.no_history`.
- Test (deterministic): `suggest_loss_cause.execute!({ skuId: 'bogus', quantity: 1, warehouseId: 'bogus' }, ...)` returns an object with `similarHistory` array (empty DB → `[]`) and no throw.

**Steps:**
- [ ] Step 1: Write failing test.
- [ ] Step 2: Run, verify FAIL.
- [ ] Step 3: Create `ai-classify-tools.ts`.
- [ ] Step 4: Create `AiClassifySuggest.tsx` + render on Loss form + i18n.
- [ ] Step 5: vitest — PASS.
- [ ] Step 6: check-types — PASS.

---

### Task 4: Wire all new tools into `ai.ts`

**Files:**
- Modify: `apps/server/src/routes/ai.ts` (imports + tools spread + prompt sections)

**Interfaces:**
- Consumes: `visionTools` (T1), `auditTools` (T2), `classifyTools` (T3), `forecastTools` (T5).
- Produces: the chat endpoint exposes all four tool sets.

**Frozen contract:**
- Import the four tool maps from their `.js` files.
- Spread into `tools: { ...clientTools, ...inventoryAgingTools, ...putawayTools, ...dispatchTools, ...draftTools, ...reorderTools, ...approvalTools, ...anomalyTools, ...visionTools, ...auditTools, ...classifyTools, ...forecastTools }`.
- Add prompt sections to `buildSystemPrompt`:
  - `## AI Vision (Photo → Entry)` — when the user asks to extract SKU info from a photo, call `extract_sku_from_photo`.
  - `## AI Audit Narratives` — when the user asks "what happened?" / "explain this activity", call `get_activity_summary` / `explain_activity` and narrate.
  - `## AI WIP/Loss Classification` — when the user is creating a loss and asks for a likely cause, call `suggest_loss_cause`.
  - `## AI Stock-out Forecast` — when the user asks "what will run out?" / "stock-out risk", call `get_stockout_forecast` and narrate.

**Steps:**
- [ ] Step 1: Add imports + spread.
- [ ] Step 2: Add 4 prompt sections.
- [ ] Step 3: `bun run check-types` (server) — PASS.

---

### Task 5: AI Stock-out Forecast

**Files:**
- Create: `apps/server/src/lib/ai-forecast-tools.ts`
- Create: `apps/server/src/tests/ai-forecast-tools.test.ts`
- Create: `apps/client/src/components/AiForecast/AiForecastCard.tsx`
- Modify: `apps/client/src/pages/Dashboard.tsx` (render `AiForecastCard` below `AiDigestCard`)
- i18n: `aiForecast.*` keys

**Interfaces:**
- Consumes: `prisma` from `./prisma.js`; `tool`, `z`.
- Produces:
  - `export const forecastTools = { get_stockout_forecast: tool({...}) }`
  - `get_stockout_forecast` input `{}` → `{ forecasts: Array<{ skuId, skuCode, skuName, availableQty, avgDailyUsage, daysOfCover, projectedStockoutDate, risk: 'HIGH'|'MEDIUM'|'LOW' }>, generatedAt }`

**Frozen contract:**
- Deterministic (no LLM): reuse the reorder logic from `apps/server/src/lib/ai-reorder-tools.ts` (30-day avg usage, days-of-cover). For each SKU with `daysOfCover < 30`, compute `projectedStockoutDate = today + daysOfCover` and `risk` (HIGH < 7 days, MEDIUM < 14, LOW < 30). Sort by risk then daysOfCover.
- `AiForecastCard`: a Dashboard card listing at-risk SKUs with a projected stock-out date + risk chip. Reuses `requestToolOutput` with `toolName: 'get_stockout_forecast'`. Refresh button. Graceful error state.
- i18n keys: `aiForecast.title`, `aiForecast.subtitle`, `aiForecast.refresh`, `aiForecast.loading`, `aiForecast.empty`, `aiForecast.error`, `aiForecast.risk_high`, `aiForecast.risk_medium`, `aiForecast.risk_low`, `aiForecast.projected_date`.
- Test (deterministic): `get_stockout_forecast.execute!({}, ...)` returns `{ forecasts: [] }` + `generatedAt` on empty DB.

**Steps:**
- [ ] Step 1: Write failing test.
- [ ] Step 2: Run, verify FAIL.
- [ ] Step 3: Create `ai-forecast-tools.ts`.
- [ ] Step 4: Create `AiForecastCard.tsx` + render on Dashboard + i18n.
- [ ] Step 5: vitest — PASS.
- [ ] Step 6: check-types — PASS.

---

### Task 6: AI Voice Floor Ops (Tauri)

**Files:**
- Create: `apps/client/src/components/AiVoice/AiVoiceBar.tsx`
- Modify: `apps/client/src/layouts/PrivateLayout.tsx` (render `AiVoiceBar`)
- i18n: `aiVoice.*` keys

**Interfaces:**
- Consumes: `@tauri-apps/api` (check the installed Tauri v2 API for speech — if no native speech API, use the Web Speech API `webkitSpeechRecognition`/`SpeechRecognition` with a graceful fallback); `requestTextReply` from `apps/client/src/lib/aiOneShot.ts`; `authUserAtom`.
- Produces: `export function AiVoiceBar(): JSX.Element`

**Frozen contract:**
- A floating bar (bottom-right) with a mic button. On press, starts speech recognition (Web Speech API if available; Tauri native if the plugin exists — check `apps/client/src-tauri` capabilities). Transcribed text is sent as a one-shot chat message via `requestTextReply` (e.g. "receive 50 pcs SKU-PB-001 from supplier X at warehouse A" → the AI drafts it via the T4-wired tools). The reply is shown in a small popover.
- Graceful degradation: if no speech API → hide the mic, show a tooltip "Voice not supported".
- i18n keys: `aiVoice.title`, `aiVoice.listening`, `aiVoice.not_supported`, `aiVoice.error`, `aiVoice.close`.
- This demonstrates "hands-free floor operations" — the desktop-native portfolio story.

**Steps:**
- [ ] Step 1: Create `AiVoiceBar.tsx`.
- [ ] Step 2: Render in `PrivateLayout.tsx`.
- [ ] Step 3: Add i18n keys.
- [ ] Step 4: `bun run check-types` (client) — PASS.

---

### Task 7: Whole-branch review (Code Reviewer)

**Files:** none (read-only).

**Interfaces:** review the full diff; verify:
- [ ] All 6 tasks' deliverables present; no shared-file conflicts (ai.ts owned by T4; Dashboard.tsx by T5; locales sequenced).
- [ ] Permission strings are `resource@action`.
- [ ] No new deps, no migrations, no shell file-writes.
- [ ] TypeScript strict compliance; no `any`, no bare `!`.
- [ ] Server tools never throw; SQL always through `validateReadOnlySql` (if any).
- [ ] i18n complete in en + id.
- [ ] Client components match existing HeroUI v3 + token patterns.
- [ ] Tests deterministic (no LLM calls — API key limit 10 req/min).

**Output:** findings list + one-sentence Commit/Push recommendation. No git writes.

---

## Verification (final)

- `bun run check-types` — all packages clean.
- `bunx vitest run apps/server/src/tests/ai-vision-tools.test.ts apps/server/src/tests/ai-audit-tools.test.ts apps/server/src/tests/ai-classify-tools.test.ts apps/server/src/tests/ai-forecast-tools.test.ts` — all PASS.
- Manual demo script (for the portfolio, in priority order):
  1. **Receiving form → AI Vision**: upload a label photo → SKU/qty extracted → Apply to form. *(The new hero demo.)*
  2. **Activity Logs → AI Audit**: "Explain this log" → narrative with flags.
  3. **Loss form → AI Classify**: pick a SKU → likely cause suggested.
  4. **Dashboard → AI Forecast**: at-risk SKUs with projected stock-out dates.
  5. **Voice bar**: say "receive 50 pcs SKU-PB-001..." → AI drafts the transaction.
