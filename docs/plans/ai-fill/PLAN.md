# AI Fill — Dedicated Form-Fill Feature (below Page Header)

## Goal

Differentiate **chat-only** AI features from **page-interacting** AI features. Move the
`fillFormFields` capability out of the floating chat widget into a dedicated **AI Fill**
bar rendered **below the page header** on every page that already opts into
`useAiFillForm`.

## UX (per user)

```
[Page Header]
[AI Assistant]  [AI Fill]        ← row of buttons BELOW the header (not inside it)
   (gimmick)      (toggle)
                    │
                    ▼  (when AI Fill toggled open)
              ┌─────────────────────────────┐
              │ [textarea] "please help me  │
              │  fill this form with ..."   │
              │ [Submit]                    │
              └─────────────────────────────┘
              → loading → form prefilled (NO chat widget opens)
```

- `[AI Assistant]` is a **gimmick** — decorative, no action (per user: "not opening chat
  widget"). Render as a disabled/ghost button or static chip.
- `[AI Fill]` toggles a textarea + Submit. On Submit → loading → AI prefills the form
  via the existing `aiFormFillAtom` bridge. The chat widget must **not** open.

## Decisions (frozen)

| Decision | Choice |
|----------|--------|
| Fill endpoint | **Reuse existing `POST /api/ai/chat`** streaming endpoint (user-selected). No new server endpoint. |
| Fill bridge | Reuse `aiFormFillAtom` + `useAiFillForm` — already wired into ~25 pages. |
| Chat widget | Must NOT open during AI Fill. |
| SelectSearch | **Prefetch on page load** — do not rely on server-side fetch at fill time. |
| Scope | Every page that already calls `useAiFillForm` (form + index pages). |

## Architecture

```
AiFillBar (new, below PageHeader on each page)
  └─ useAiFill (new hook)
       ├─ collectPageContext()  ← exported from AiAssistant (shared util)
       ├─ POST /api/ai/chat  { id, messages: [one-shot user msg] }
       ├─ parse SSE stream → extract fillFormFields tool input
       └─ set aiFormFillAtom(fields)
            └─ useAiFillForm (existing, per page) → form.setFieldValue(...)
```

No server changes. The existing `aiChatHandler` already:
- accepts `{ id, messages }` and streams a UIMessage stream,
- instructs the model (system prompt) to use `fillFormFields` for creation requests,
- runs RAG + user-context system prompt.

The client sends a one-shot user message that strongly instructs the model to **only**
call `fillFormFields` (no navigate, no queryDatabase). The client parses the stream and
applies only `fillFormFields` inputs; all other tool calls are ignored.

## Task DAG

```
T1: Shared util — export collectPageContext + SSE tool-input parser   (Frontend)
T2: AiFillBar component + useAiFill hook + i18n keys                  (Frontend, depends T1)
T3: Integrate AiFillBar into all useAiFillForm pages                  (Frontend, depends T2)
T4: SelectSearch prefetch-on-load verification/adjustment             (Frontend, parallel T3)
T5: Whole-branch review                                               (Code Reviewer)
```

## Files

- Create: `apps/client/src/components/AiFill/AiFillBar.tsx`
- Create: `apps/client/src/components/AiFill/useAiFill.ts`
- Modify: `apps/client/src/components/AiAssistant/AiAssistant.tsx` (export `collectPageContext`)
- Modify: `apps/client/src/locales/en.json` + `id.json` (`aiFill.*` keys)
- Modify: ~25 pages that call `useAiFillForm` (add `<AiFillBar />` below `<PageHeader />`)
- Modify: `apps/client/src/components/SelectSearch.tsx` (prefetch verification)

## Verification

- `bun run check-types` (client)
- `bunx vitest run` (client tests)
- Manual: open a form page, click AI Fill, type instruction, submit → fields prefilled,
  chat widget stays closed.
