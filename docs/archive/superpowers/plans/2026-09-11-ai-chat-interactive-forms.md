# AI Chat Interactive Forms + Mutation Gate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the AI Assistant chatbox, then add AI-generated form-in-chat and an enforced user-confirmation gate (DB transaction + RETURNING + re-verify) to both AI chatboxes.

**Architecture:** AI SDK v6 native client-tools (`requestFormInput`, no `execute`) render HeroUI form cards in chat; native `needsApproval` pauses write-executing tools for user approval; approved input executes inside `prisma.$transaction`. One shared client toolkit (`components/AiChat/`) renders forms/approvals/results in both chats.

**Tech Stack:** AI SDK v6 (`ai@^6`, `@ai-sdk/react@^3`), Zod v4, HeroUI v3 (Tailwind v4), react-intl, Prisma/PostgreSQL, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-11-ai-chat-interactive-forms-design.md` (executors read both).

**Dispatch order:** Task 1 ∥ Task 2 ∥ Task 3 ∥ Task 5 → Task 4 (after 2+3) → final verification + code-reviewer.

## Global Constraints

- **Git is manual-only** — no `git add`/`commit`/`push` steps anywhere in this plan; the user commits.
- Source files are created/modified only via edit tools — never via shell heredocs/echo.
- Permission strings stay `resource@action`; no new permissions needed (existing `ai_admin@access` covers the admin chat; assistant endpoint already auth-gated).
- Arrow functions, early returns, no bare `!`, no `any` except AI/serialization boundaries (match each file's existing `/* eslint-disable */` style).
- i18n: every user-visible string gets a key in `apps/client/src/locales/en.json` **and** `id.json` with `ai_chat.` prefix; `defaultMessage` inline as fallback.
- Client page/chatbox edits must preserve existing behavior (scroll tracking, localStorage persistence, patched fetch) — only extend.

---

### Task 1: Server — form tool, approval gates, transactions, prompts, tests

**Files:**
- Create: `apps/server/src/lib/ai-form-tool.ts`
- Modify: `apps/server/src/lib/ai-admin-tools.ts` (executeSql)
- Modify: `apps/server/src/lib/ai-draft-tools.ts` (3 draft tools → actually 2 files here: receiving/shipment live here; reorder draft lives in `ai-reorder-tools.ts`)
- Modify: `apps/server/src/lib/ai-reorder-tools.ts` (`draft_reorder_receiving` only)
- Modify: `apps/server/src/routes/ai.ts` (register tool + prompt section)
- Modify: `apps/server/src/routes/ai-admin.ts` (register tool + prompt section)
- Test: `apps/server/src/tests/ai-admin-approval.test.ts` (create)

**Interfaces:**
- Consumes: existing `adminTools` export (`ai-admin-tools.ts`), `draftTools` export (`ai-draft-tools.ts`), `draft_reorder_receiving` inside `reorderTools` (`ai-reorder-tools.ts`), `tool()` from `'ai'`, `prisma` from `./prisma.js`.
- Produces:
  - `apps/server/src/lib/ai-form-tool.ts` exports `requestFormInput` (a v6 client-side tool: `tool({ description, inputSchema })` with **no** `execute`).
  - `ai-admin-tools.ts` exports `isWriteSql(sql: string): boolean` and `ensureReturning(sql: string): string` (used by tests and the tool).
  - Route files spread `requestFormInput` into their toolsets: `{ ...adminTools, requestFormInput }` / `{ ...clientTools, ..., requestFormInput }`.

- [ ] **Step 1: Write the failing tests** — create `apps/server/src/tests/ai-admin-approval.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ensureReturning, isWriteSql } from '../lib/ai-admin-tools.js';

describe('isWriteSql', () => {
  it('flags INSERT/UPDATE/DELETE case-insensitively with leading whitespace', () => {
    expect(isWriteSql(' INSERT INTO skus (id) VALUES (1)')).toBe(true);
    expect(isWriteSql('update skus set x = 1')).toBe(true);
    expect(isWriteSql('DELETE FROM skus;')).toBe(true);
  });

  it('does not flag reads', () => {
    expect(isWriteSql('SELECT * FROM skus')).toBe(false);
    expect(isWriteSql('WITH t AS (SELECT 1) SELECT * FROM t')).toBe(false);
    expect(isWriteSql('EXPLAIN ANALYZE SELECT 1')).toBe(false);
  });
});

describe('ensureReturning', () => {
  it('appends RETURNING * and strips a trailing semicolon', () => {
    expect(ensureReturning("UPDATE skus SET description = 'x' WHERE id = 1;")).toBe(
      "UPDATE skus SET description = 'x' WHERE id = 1 RETURNING *",
    );
  });

  it('keeps an existing RETURNING clause untouched', () => {
    expect(ensureReturning('UPDATE skus SET x = 1 RETURNING id')).toBe('UPDATE skus SET x = 1 RETURNING id');
  });
});
```

- [ ] **Step 2: Run tests, verify they fail** — Run: `bunx vitest run apps/server/src/tests/ai-admin-approval.test.ts` — Expected: FAIL (exports not defined).

- [ ] **Step 3: Add helpers + gate to `ai-admin-tools.ts`** — below the `FORBIDDEN_DDL_KEYWORDS` array add:

```ts
/**
 * True when the statement mutates data (DML write). SELECT/WITH/EXPLAIN are reads.
 */
export function isWriteSql(sql: string): boolean {
    const upper = sql.trim().toUpperCase();
    return upper.startsWith('INSERT') || upper.startsWith('UPDATE') || upper.startsWith('DELETE');
}

/**
 * Ensure a write statement returns its affected rows so the UI can show what
 * changed. Appends `RETURNING *` when missing (validator already blocks
 * multi-statement input, so this is always a single statement).
 */
export function ensureReturning(sql: string): string {
    if (/\bRETURNING\b/i.test(sql)) return sql;
    return sql.replace(/;?\s*$/, '') + ' RETURNING *';
}
```

Then extract the JSON replacer currently inline in `formatQueryResult` to a module-level `const replacer = (_key: string, value: unknown): unknown => { ...same body... }` and have `formatQueryResult` call `JSON.stringify(obj, replacer)` — so the write path can reuse it.

Replace the `executeSql` tool with:

```ts
    executeSql: tool({
        description:
            'Execute a SQL query with full DML access (SELECT, INSERT, UPDATE, DELETE). ' +
            'Use this to query data, insert new rows, update existing records, or delete rows. ' +
            'DDL operations (DROP, TRUNCATE, ALTER, CREATE, GRANT, REVOKE) are blocked. ' +
            'INSERT/UPDATE/DELETE queries require explicit user approval in the chat UI before execution. ' +
            'Use PostgreSQL syntax with snake_case table and column names. ' +
            'Always include a LIMIT clause for SELECT queries. ' +
            'For INSERT/UPDATE/DELETE, always include a RETURNING clause to show affected rows.',
        inputSchema: z.object({
            sql: z
                .string()
                .describe(
                    'SQL query using PostgreSQL syntax. Can be SELECT, INSERT, UPDATE, or DELETE. ' +
                    'Table and column names are snake_case. ' +
                    'Example: SELECT id, code, name FROM skus WHERE type = \'RAW_MATERIAL\' LIMIT 10; ' +
                    'Example: UPDATE skus SET description = \'Updated\' WHERE id = \'01H...\' RETURNING id, code, description;'
                ),
            limit: z.number().optional().default(100).describe('Max rows to return (for SELECT queries). Default 100.'),
        }),
        // Human-in-the-loop gate: reads run immediately, writes pause until the
        // user approves the exact SQL in the chat (AI SDK v6 native approvals).
        needsApproval: async ({ sql }) => isWriteSql(sql),
        execute: async ({ sql, limit = 100 }) => {
            const validation = validateAdminSql(sql);
            if (!validation.valid) {
                return JSON.stringify({ error: 'Query rejected', message: validation.reason });
            }

            const isWrite = isWriteSql(sql);
            const hasLimit = /\bLIMIT\b/i.test(sql);
            const baseSql = hasLimit ? sql : sql.replace(/;?\s*$/, '') + ` LIMIT ${limit}`;
            const finalSql = isWrite ? ensureReturning(sql) : baseSql;

            try {
                if (isWrite) {
                    const rows = await prisma.$transaction(
                        async (tx) => tx.$queryRawUnsafe(finalSql),
                        { timeout: 30_000 },
                    );
                    const resultRows = Array.isArray(rows) ? rows : [];
                    return JSON.stringify({
                        success: true,
                        rowCount: resultRows.length,
                        data: resultRows,
                        committedInTransaction: true,
                        hint: 'Write committed inside a DB transaction. Rows returned via RETURNING. Immediately re-query the affected rows with a SELECT to verify and show the result to the user.',
                    }, replacer);
                }

                // Read path — read-only transaction for defense in depth.
                const result = await prisma.$transaction(async (tx) => {
                    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
                    return tx.$queryRawUnsafe(finalSql);
                }, { timeout: 30_000 });
                const rows = Array.isArray(result) ? result : [];
                return formatQueryResult(rows, rows.length, limit);
            } catch (error) {
                return JSON.stringify({
                    error: 'Query failed',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    hint: 'Check SQL syntax. Ensure table and column names match the database schema.',
                });
            }
        },
    }),
```

- [ ] **Step 4: Gate the draft tools** — in `ai-draft-tools.ts`, add to BOTH `draft_receiving_transaction` and `draft_shipment_transaction` (they already wrap creation in `prisma.$transaction` — keep that):

```ts
        // Pause until the user approves the draft in the chat UI (AI SDK v6).
        needsApproval: async () => true,
```

In `ai-reorder-tools.ts`, add the same line to `draft_reorder_receiving` only (NOT to the read-only `get_reorder_suggestions`).

- [ ] **Step 5: Create the form tool** — `apps/server/src/lib/ai-form-tool.ts`:

```ts
/* eslint-disable @typescript-eslint/no-explicit-any -- intentional at AI/serialization boundaries */
import { tool } from 'ai';
import { z } from 'zod';

/**
 * Client-side tool (NO execute): the model defines a form; the client renders
 * it as an interactive card (components/AiChat/ChatFormCard) and replies with
 * the user's answers via addToolOutput. The chat then resumes automatically
 * through the client's sendAutomaticallyWhen predicate.
 */
export const requestFormInput = tool({
    description:
        'Render an interactive form inside the chat for the user to fill. Use this when you need ' +
        'structured input from the user (missing required values, a choice among options, or ' +
        'confirmation details) instead of asking questions in prose. ' +
        'The result arrives as { submitted: true, values: {...} } or { submitted: false } (cancelled).',
    inputSchema: z.object({
        formTitle: z.string().describe('Short title shown on the form card'),
        description: z.string().optional().describe('One-line explanation of why you need this'),
        fields: z
            .array(
                z.object({
                    name: z.string().describe('Field key returned in values'),
                    label: z.string(),
                    type: z.enum(['text', 'number', 'date', 'select', 'textarea', 'checkbox']),
                    required: z.boolean().default(true),
                    placeholder: z.string().optional(),
                    defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
                    options: z
                        .array(z.object({ value: z.string(), label: z.string() }))
                        .optional()
                        .describe('Required when type=select'),
                }),
            )
            .min(1)
            .max(12),
    }),
    // NO execute — client-side tool.
});
```

- [ ] **Step 6: Register + prompt in both routes** —

`apps/server/src/routes/ai-admin.ts`: add `import { requestFormInput } from '../lib/ai-form-tool.js';` and change the streamText tools to `tools: { ...adminTools, requestFormInput },`. Append this section at the end of the system template returned by `buildAdminSystemPrompt`:

```

## Interactive Forms
You have a client-side tool requestFormInput that renders an interactive form card inside the chat.
- Use it whenever you need structured input from the user (missing required values, a choice among options, confirmation details) instead of asking questions in prose.
- Keep forms short: 1-6 fields, only what you actually need.
- The user's answers arrive as the tool result: { submitted: true, values }. Use them immediately and continue the task without re-asking.
- If the result is { submitted: false }, the user cancelled — continue in plain text without repeating the same form.

## Write Confirmation (enforced)
INSERT/UPDATE/DELETE queries pause for explicit user approval in the chat UI; you will see an approval response in the conversation.
- Never claim a write succeeded unless you received a successful executeSql result.
- If the user denied, do NOT retry the same mutation. Summarize what you intended and ask how to proceed.
- After any successful write, immediately run a SELECT on the affected rows and present before/after values in your reply (re-analyze and show result).
```

`apps/server/src/routes/ai.ts`: same import; in the streamText tools object add `requestFormInput` to the spread chain (`...clientTools, ...inventoryAgingTools, ..., ...anomalyTools, requestFormInput,`); append the same two sections to `buildSystemPrompt`'s returned template.

- [ ] **Step 7: Run tests, verify they pass** — Run: `bunx vitest run apps/server/src/tests/ai-admin-approval.test.ts` — Expected: PASS.

- [ ] **Step 8: Type-check** — Run: `bun run check-types` — Expected: no new errors.

---

### Task 2: Frontend — restore AiAssistant + mount in shell

**Files:**
- Restore: `apps/client/src/components/AiAssistant/AiAssistant.tsx`
- Modify: `apps/client/src/layouts/PrivateLayout.tsx`

**Interfaces:**
- Consumes: git history `9388d2e^` (full 1080-line component; all imports still exist — atoms, endpoint, HeroUI, `@ai-sdk/react`).
- Produces: `<AiAssistant />` rendered in `PrivateLayout` so `aiChatOpenAtom`/`aiChatPresetMessageAtom` (e.g. `WarehouseLayoutPage`) open it again.

- [ ] **Step 1: Restore byte-exact** — Run:
```bash
git restore --source=9388d2e^ --worktree -- apps/client/src/components/AiAssistant/AiAssistant.tsx
```
(Worktree only — file is NOT staged; user commits manually.)

- [ ] **Step 2: Mount in PrivateLayout** — add after the `CommandPalette` import:
```tsx
import { AiAssistant } from '../components/AiAssistant/AiAssistant';
```
and render it as the last child inside the root `div` (after `<CommandPalette ... />`):
```tsx
      <CommandPalette isOpen={paletteOpen} onOpenChange={setPaletteOpen} />
      <AiAssistant />
```

- [ ] **Step 3: Verify** — Run: `bun run check-types` — Expected: no new errors. (If the restored file references something that no longer compiles, fix minimally in place — do NOT redesign.)

---

### Task 3: Frontend — shared AiChat toolkit

**Files:**
- Create: `apps/client/src/components/AiChat/sendWhen.ts`
- Create: `apps/client/src/components/AiChat/ToolResultTable.tsx`
- Create: `apps/client/src/components/AiChat/ApprovalCard.tsx`
- Create: `apps/client/src/components/AiChat/ChatFormCard.tsx`
- Create: `apps/client/src/components/AiChat/ChatToolPart.tsx`

**Interfaces:**
- Consumes: `ai` exports `lastAssistantMessageIsCompleteWithToolCalls`, `lastAssistantMessageIsCompleteWithApprovalResponses`; HeroUI v3 (`Button`, `Input`, `Label`, `ListBox`, `Select`, `Switch`, `TextArea`); `useChat` helpers `addToolOutput`/`addToolApprovalResponse` (passed in as props by callers).
- Produces (used by Task 4):
  - `chatContinuationWhen(chat): boolean` — OR-combined predicate for `useChat({ sendAutomaticallyWhen })`.
  - `ToolResultTable({ rows: Record<string, unknown>[]; maxRows?: number })`.
  - `ApprovalCard({ title, reason?, inputPreview, onApprove, onDeny })`.
  - `ChatFormCard({ spec: ChatFormSpec, onSubmit(values), onCancel })`; types `ChatFormSpec`, `ChatFormField`.
  - `ChatToolPart({ part, toolMeta?, addToolOutput, addToolApprovalResponse })` — renders ONE tool message part: form card for `requestFormInput`, approval card for `approval-requested`, result table + chip for outputs, fallback chip otherwise.

- [ ] **Step 1: `sendWhen.ts`**:

```ts
import {
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai';

type ChatLike = Parameters<typeof lastAssistantMessageIsCompleteWithToolCalls>[0];
type ApprovalLike = Parameters<typeof lastAssistantMessageIsCompleteWithApprovalResponses>[0];

/**
 * Resume the conversation when the last assistant message is complete with
 * either tool outputs (client-side tools such as requestFormInput) or tool
 * approval responses (needsApproval tools). AI SDK v6 accepts one predicate,
 * so combine the two built-ins with OR.
 */
export const chatContinuationWhen = (chat: ChatLike & ApprovalLike): boolean =>
  lastAssistantMessageIsCompleteWithToolCalls(chat) ||
  lastAssistantMessageIsCompleteWithApprovalResponses(chat);
```

- [ ] **Step 2: `ToolResultTable.tsx`**:

```tsx
type ToolResultTableProps = {
  rows: Record<string, unknown>[];
  maxRows?: number;
};

/** Compact bordered table for tool output rows (matches chat markdown table style). */
export const ToolResultTable = ({ rows, maxRows = 8 }: ToolResultTableProps) => {
  if (rows.length === 0) return null;
  const columns = Object.keys(rows[0] ?? {}).slice(0, 6);
  const shown = rows.slice(0, maxRows);
  return (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full text-[12px] border-collapse">
        <thead>
          <tr className="bg-black/5">
            {columns.map((c) => (
              <th key={c} className="border border-black/10 px-2 py-1 text-left font-semibold">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c} className="border border-black/10 px-2 py-1">{String(row[c] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length && (
        <p className="text-xs text-default-500 mt-1">+{rows.length - shown.length} more rows</p>
      )}
    </div>
  );
};
```

- [ ] **Step 3: `ApprovalCard.tsx`**:

```tsx
import { Icon } from '@iconify/react';
import { Button } from '@heroui/react';
import { useIntl } from 'react-intl';

type ApprovalCardProps = {
  title: string;
  reason?: string;
  inputPreview: string;
  danger?: boolean;
  onApprove: () => void;
  onDeny: () => void;
};

/** Chat card shown when a tool pauses for user approval (AI SDK v6 `needsApproval`). */
export const ApprovalCard = ({ title, reason, inputPreview, danger = false, onApprove, onDeny }: ApprovalCardProps) => {
  const intl = useIntl();
  return (
    <div className={`rounded-lg border px-3 py-2.5 my-1 ${danger ? 'border-warning/40 bg-warning-50' : 'border-default-200 bg-default-100'}`}>
      <div className="flex items-center gap-1.5">
        <Icon icon="solar:shield-warning-bold" width={14} className={danger ? 'text-warning' : 'text-primary'} />
        <span className="text-xs font-semibold">{title}</span>
      </div>
      {reason && <p className="text-xs text-default-500 mt-1">{reason}</p>}
      <pre className="bg-black/10 rounded p-2 my-2 overflow-x-auto text-[11px] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
        {inputPreview}
      </pre>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="secondary" onPress={onDeny}>
          {intl.formatMessage({ id: 'ai_chat.approval.deny', defaultMessage: 'Deny' })}
        </Button>
        <Button size="sm" variant="primary" onPress={onApprove}>
          {intl.formatMessage({ id: 'ai_chat.approval.approve', defaultMessage: 'Approve' })}
        </Button>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: `ChatFormCard.tsx`** (AI-defined form; HeroUI v3 compound APIs):

```tsx
import { useState } from 'react';
import { Button, Input, Label, ListBox, Select, Switch, TextArea } from '@heroui/react';
import { useIntl } from 'react-intl';

export type ChatFormField = {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox';
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  options?: { value: string; label: string }[];
};

export type ChatFormSpec = {
  formTitle: string;
  description?: string;
  fields: ChatFormField[];
};

type ChatFormCardProps = {
  spec: ChatFormSpec;
  onSubmit: (values: Record<string, unknown>) => void;
  onCancel: () => void;
};

/** Interactive form card rendered inside the chat from the AI's field spec. */
export const ChatFormCard = ({ spec, onSubmit, onCancel }: ChatFormCardProps) => {
  const intl = useIntl();
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const f of spec.fields) {
      if (f.type === 'checkbox') initial[f.name] = f.defaultValue === true;
      else if (f.defaultValue !== undefined) initial[f.name] = f.defaultValue;
    }
    return initial;
  });
  const [missing, setMissing] = useState<string[]>([]);

  const setValue = (name: string, value: unknown) => setValues((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = () => {
    const gaps = spec.fields
      .filter((f) => {
        if (!f.required) return false;
        const v = values[f.name];
        return v === undefined || v === null || v === '';
      })
      .map((f) => f.name);
    if (gaps.length > 0) {
      setMissing(gaps);
      return;
    }
    onSubmit(values);
  };

  const requiredLabel = (field: ChatFormField) => `${field.label}${field.required ? ' *' : ''}`;
  const missingHint = () => intl.formatMessage({ id: 'ai_chat.form.required', defaultMessage: 'This field is required' });

  return (
    <div className="rounded-lg border border-default-200 bg-default-100 px-3 py-3 my-1">
      <p className="text-sm font-semibold">{spec.formTitle}</p>
      {spec.description && <p className="text-xs text-default-500 mt-0.5">{spec.description}</p>}
      <div className="flex flex-col gap-3 mt-3">
        {spec.fields.map((field) => {
          const isMissing = missing.includes(field.name);
          switch (field.type) {
            case 'textarea':
              return (
                <div key={field.name} className="flex flex-col gap-1">
                  <Label className="text-xs">{requiredLabel(field)}</Label>
                  <TextArea
                    variant="secondary"
                    rows={3}
                    placeholder={field.placeholder}
                    value={(values[field.name] as string) ?? ''}
                    onChange={(e) => setValue(field.name, e.target.value)}
                    aria-label={field.label}
                  />
                  {isMissing && <span className="text-xs text-danger">{missingHint()}</span>}
                </div>
              );
            case 'select':
              return (
                <div key={field.name} className="flex flex-col gap-1">
                  <Label className="text-xs">{requiredLabel(field)}</Label>
                  <Select
                    aria-label={field.label}
                    placeholder={field.placeholder ?? intl.formatMessage({ id: 'ai_chat.form.select_placeholder', defaultMessage: 'Select…' })}
                    value={((values[field.name] as string) || null) as never}
                    onChange={(key) => setValue(field.name, key == null ? undefined : String(key))}
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {(field.options ?? []).map((opt) => (
                          <ListBox.Item key={opt.value} id={opt.value} textValue={opt.label}>
                            {opt.label}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  {isMissing && <span className="text-xs text-danger">{missingHint()}</span>}
                </div>
              );
            case 'checkbox':
              return (
                <Switch
                  key={field.name}
                  size="sm"
                  isSelected={values[field.name] === true}
                  onChange={(isSelected) => setValue(field.name, isSelected)}
                >
                  <span className="text-xs">{field.label}{field.required ? ' *' : ''}</span>
                </Switch>
              );
            default:
              return (
                <div key={field.name} className="flex flex-col gap-1">
                  <Label className="text-xs">{requiredLabel(field)}</Label>
                  <Input
                    variant="secondary"
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                    placeholder={field.placeholder}
                    value={values[field.name] == null ? '' : String(values[field.name])}
                    onChange={(e) =>
                      setValue(
                        field.name,
                        field.type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value,
                      )
                    }
                    aria-label={field.label}
                  />
                  {isMissing && <span className="text-xs text-danger">{missingHint()}</span>}
                </div>
              );
          }
        })}
      </div>
      <div className="flex gap-2 justify-end mt-3">
        <Button size="sm" variant="secondary" onPress={onCancel}>
          {intl.formatMessage({ id: 'ai_chat.form.cancel', defaultMessage: 'Cancel' })}
        </Button>
        <Button size="sm" variant="primary" onPress={handleSubmit}>
          {intl.formatMessage({ id: 'ai_chat.form.submit', defaultMessage: 'Submit' })}
        </Button>
      </div>
    </div>
  );
};
```

- [ ] **Step 5: `ChatToolPart.tsx`** (the one-part renderer both chats use):

```tsx
import { Icon } from '@iconify/react';
import { useIntl } from 'react-intl';
import { ChatFormCard, type ChatFormSpec } from './ChatFormCard';
import { ApprovalCard } from './ApprovalCard';
import { ToolResultTable } from './ToolResultTable';

export type ChatToolMeta = Record<string, { icon: string; label: string }>;

type ChatToolPartProps = {
  part: Record<string, unknown> & { type: string };
  toolMeta?: ChatToolMeta;
  addToolOutput: (o: { tool: string; toolCallId: string; output: unknown }) => void;
  addToolApprovalResponse: (o: { id: string; approved: boolean }) => void;
};

/** Extract tabular rows from a tool output (JSON string or object). */
const extractRows = (output: unknown): Record<string, unknown>[] => {
  try {
    const parsed = typeof output === 'string' ? (JSON.parse(output) as unknown) : output;
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
      if (obj.submitted === true && obj.values && typeof obj.values === 'object') {
        return [obj.values as Record<string, unknown>];
      }
    }
  } catch { /* not JSON — no table */ }
  return [];
};

/** Renders ONE tool message part: form card, approval card, result table, or chip. */
export const ChatToolPart = ({ part, toolMeta, addToolOutput, addToolApprovalResponse }: ChatToolPartProps) => {
  const intl = useIntl();
  const toolName = part.type === 'dynamic-tool' ? String(part.toolName) : part.type.slice('tool-'.length);
  const state = String(part.state ?? '');
  const meta = toolMeta?.[toolName] ?? { icon: 'solar:bolt-circle-linear', label: toolName };
  const toolCallId = String(part.toolCallId ?? '');

  const chip = (label: string, tone: 'default' | 'success' | 'danger' | 'warning') => (
    <div key={toolCallId} className="flex items-center gap-1.5">
      <Icon icon={meta.icon} width={12} />
      <span
        className={`text-xs font-medium ${
          tone === 'success' ? 'text-success' :
          tone === 'danger' ? 'text-danger' :
          tone === 'warning' ? 'text-warning' : 'text-default-500'
        }`}
      >
        {label}
      </span>
    </div>
  );

  // ── Form-in-chat (client-side tool requestFormInput) ──
  if (toolName === 'requestFormInput') {
    if (state === 'input-streaming') return chip(`${intl.formatMessage({ id: 'ai_chat.form.preparing', defaultMessage: 'Preparing form' })}…`, 'warning');
    if (state === 'input-available') {
      return (
        <ChatFormCard
          spec={part.input as ChatFormSpec}
          onSubmit={(values) => addToolOutput({ tool: 'requestFormInput', toolCallId, output: { submitted: true, values } })}
          onCancel={() => addToolOutput({ tool: 'requestFormInput', toolCallId, output: { submitted: false } })}
        />
      );
    }
    if (state === 'output-available') {
      const out = part.output as { submitted?: boolean; values?: Record<string, unknown> } | undefined;
      const submitted = out?.submitted === true;
      return (
        <div key={toolCallId} className="space-y-1">
          {chip(submitted
            ? intl.formatMessage({ id: 'ai_chat.form.answered', defaultMessage: '✓ Form answered' })
            : intl.formatMessage({ id: 'ai_chat.form.cancelled', defaultMessage: 'Form cancelled' }), submitted ? 'success' : 'default')}
          {submitted && out?.values && <ToolResultTable rows={[out.values]} />}
        </div>
      );
    }
    return chip(meta.label, 'default');
  }

  // ── Approval gate (AI SDK v6 needsApproval) ──
  if (state === 'approval-requested') {
    const approval = part.approval as { id?: string; requestReason?: string; isAutomatic?: boolean } | undefined;
    if (!approval?.id || approval.isAutomatic) return chip(`${meta.label}…`, 'warning');
    const input = part.input as Record<string, unknown> | undefined;
    const preview = typeof input?.sql === 'string'
      ? String(input.sql)
      : JSON.stringify(input ?? {}, null, 2);
    return (
      <ApprovalCard
        title={meta.label}
        reason={approval.requestReason}
        inputPreview={preview}
        danger
        onApprove={() => addToolApprovalResponse({ id: approval.id as string, approved: true })}
        onDeny={() => addToolApprovalResponse({ id: approval.id as string, approved: false })}
      />
    );
  }
  if (state === 'output-denied') {
    return chip(intl.formatMessage({ id: 'ai_chat.tool.denied', defaultMessage: '✗ Denied by user' }), 'danger');
  }

  // ── Outputs with tabular data ──
  if (state === 'output-available') {
    const rows = extractRows(part.output);
    return (
      <div key={toolCallId} className="space-y-1">
        {chip(`✓ ${meta.label}`, 'success')}
        {rows.length > 0 && <ToolResultTable rows={rows} />}
      </div>
    );
  }
  if (state === 'output-error') return chip(`✗ ${meta.label}`, 'danger');
  if (state === 'input-streaming') return chip(`${meta.label}…`, 'warning');
  return chip(meta.label, 'default');
};
```

- [ ] **Step 6: Verify** — Run: `bun run check-types` — Expected: no new errors. (HeroUI `Select` `value`/`onChange` use `Key | Key[] | null` — the `as never` cast on a single string keeps it honest; verify compound API against `heroui` docs if any prop mismatches.)

---

### Task 4: Frontend — wire toolkit into both chatboxes

**Files:**
- Modify: `apps/client/src/pages/ai-admin/AiAdminPage.tsx`
- Modify: `apps/client/src/components/AiAssistant/AiAssistant.tsx` (restored in Task 2 — strictly after it)

**Interfaces:**
- Consumes (from Task 3): `chatContinuationWhen`, `ChatToolPart`, `ChatToolMeta`.
- Consumes (from Task 1): server tools `requestFormInput`, `needsApproval` on admin writes + draft tools.
- Produces: both chats render form cards, approval cards, result tables; `useChat` resumes on tool outputs AND approval responses.

- [ ] **Step 1: AiAdminPage.tsx** —
  1. Import: `import { ChatToolPart, type ChatToolMeta } from '../../components/AiChat/ChatToolPart';` and `import { chatContinuationWhen } from '../../components/AiChat/sendWhen';`
  2. In the `useChat` destructure add `addToolOutput, addToolApprovalResponse` and change `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` → `sendAutomaticallyWhen: chatContinuationWhen` (keep `lastAssistantMessageIsCompleteWithToolCalls` import only if still referenced — otherwise remove it).
  3. Replace the assistant tool-parts chip mapping (the `msg.parts.filter(...).map((part, idx) => {...})` block that builds the state-colored chips) with:

```tsx
{msg.parts
  .filter((p) => p.type.startsWith('tool-') || p.type === 'dynamic-tool')
  .map((part) => (
    <ChatToolPart
      key={part.toolCallId ?? part.type}
      part={part as Record<string, unknown> & { type: string }}
      toolMeta={TOOL_META as ChatToolMeta}
      addToolOutput={addToolOutput}
      addToolApprovalResponse={addToolApprovalResponse}
    />
  ))}
```
  (Keep `TOOL_META` and the deleted `dynamic-tool` filtering behavior; the chip styling/state colors now live inside `ChatToolPart`.)

- [ ] **Step 2: AiAssistant.tsx** —
  1. Import `chatContinuationWhen` + `ChatToolPart` (with `ChatToolMeta`).
  2. In `useChat`: destructure `addToolApprovalResponse` (addToolOutput already there); change
```ts
    sendAutomaticallyWhen: (messages) => {
      if (pendingToolCallsRef.current.size > 0) return false;
      return lastAssistantMessageIsCompleteWithToolCalls(messages);
    },
```
to
```ts
    sendAutomaticallyWhen: (chat) => {
      // Block auto-send while any async tool call (like queryDatabase) is still pending
      if (pendingToolCallsRef.current.size > 0) return false;
      return chatContinuationWhen(chat);
    },
```
  3. In `runTool`, add an EARLY case before any pending-registration logic so the form tool is never auto-answered:
```ts
    // requestFormInput is answered by the user through the ChatFormCard in the
    // message stream — never auto-respond here, and never register it as pending.
    if (toolName === 'requestFormInput') return;
```
  4. In the assistant message parts rendering loop (the block around `message.parts.forEach((part, partIdx) => { ... if (!part.type.startsWith('tool-') ...) return; ... })` that renders tool chips), render `<ChatToolPart>` instead of the chip for every tool part, passing this component's TOOL_META and the useChat handlers (`addToolOutput`, `addToolApprovalResponse`). Keep the existing text/markdown rendering untouched.
  5. Ensure the assistant message bubble wraps tool parts and text in the existing layout (cards render inside the bubble, full bubble width is fine).

- [ ] **Step 3: Verify** — Run: `bun run check-types` — Expected: no new errors.

---

### Task 5: Frontend — i18n keys

**Files:**
- Modify: `apps/client/src/locales/en.json`
- Modify: `apps/client/src/locales/id.json`

**Interfaces:**
- Produces: `ai_chat.*` keys consumed by `ApprovalCard`, `ChatFormCard`, `ChatToolPart` (inline `defaultMessage` values are the EN source of truth).

- [ ] **Step 1: en.json** — add a top-level `"ai_chat"` object:

```json
"ai_chat": {
  "approval": { "approve": "Approve", "deny": "Deny" },
  "form": {
    "submit": "Submit",
    "cancel": "Cancel",
    "required": "This field is required",
    "select_placeholder": "Select…",
    "preparing": "Preparing form",
    "answered": "✓ Form answered",
    "cancelled": "Form cancelled"
  },
  "tool": { "denied": "✗ Denied by user" }
}
```
(match the file's existing nesting style — flatten `ai_chat.approval.approve` → nested objects if that's the file convention).

- [ ] **Step 2: id.json** — same structure with Indonesian values:

```json
"ai_chat": {
  "approval": { "approve": "Setujui", "deny": "Tolak" },
  "form": {
    "submit": "Kirim",
    "cancel": "Batal",
    "required": "Kolom ini wajib diisi",
    "select_placeholder": "Pilih…",
    "preparing": "Menyiapkan formulir",
    "answered": "✓ Formulir terjawab",
    "cancelled": "Formulir dibatalkan"
  },
  "tool": { "denied": "✗ Ditolak pengguna" }
}
```

- [ ] **Step 3: Verify** — Run: `bun run check-types` — Expected: no new errors.

---

### Final: Whole-change verification + review

- [ ] Run `bun run check-types` — clean.
- [ ] Run `bunx vitest run apps/server/src/tests/ai-admin-approval.test.ts` — PASS.
- [ ] Manual pass (dev server):
  1. Assistant FAB visible bottom-right on any authenticated page; opens; ask "what needs putaway?" → panel flows intact.
  2. `WarehouseLayoutPage` "explain putaway" button opens the assistant with preset message.
  3. Admin chat: "delete the SKU named X" → write SQL pauses in `ApprovalCard` → Deny → nothing executes, model re-plans → ask again → Approve → executes in transaction, RETURNING rows table shown, model re-SELECTs and reports verification.
  4. Both chats: AI requests missing info → form card renders → Submit answers continue the task; Cancel → prose fallback.
  5. Reload mid-form / mid-approval → card still renders from localStorage cache and remains answerable.
- [ ] `code-reviewer`: full session diff review + Commit/Push recommendation (reviewer never runs git writes).
