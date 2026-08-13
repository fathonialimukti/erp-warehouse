# Task 2: AiFillBar component + useAiFill hook + i18n keys

## Files
- Create: `apps/client/src/components/AiFill/AiFillBar.tsx`
- Create: `apps/client/src/components/AiFill/useAiFill.ts`
- Modify: `apps/client/src/locales/en.json` + `apps/client/src/locales/id.json` (add `aiFill.*` keys)

## Interfaces
- **Consumes:**
  - `requestAiFillFields` from `./aiStream` (Task 1)
  - `collectPageContext` from `../AiAssistant/AiAssistant` (Task 1)
  - `aiFormFillAtom` from `../../lib/atoms`
  - `authUserAtom` from `../../lib/atoms` (for chat id)
- **Produces:**
  - `export function AiFillBar(): JSX.Element` — the button row + collapsible textarea panel
  - `export function useAiFill(): { open, setOpen, instruction, setInstruction, submit, status, error }`

## Frozen contract
- **Layout:** `AiFillBar` renders a row of two buttons BELOW the page header:
  - `[AI Assistant]` — **gimmick only**: a disabled/ghost button with a sparkle icon.
    It must NOT open the chat widget and must NOT do anything on press.
  - `[AI Fill]` — toggles the panel open/closed.
- **Panel (when open):** a `TextArea` (placeholder: "please help me fill this form with ...")
  + a `Submit` button. While loading, show a `Spinner` and disable inputs.
- **On submit:** call `requestAiFillFields({ instruction, pageContext: collectPageContext(), chatId })`,
  then `setAiFormFill(fields)` (the jotai atom). The chat widget must NOT open.
- **Error handling:** show a readable error message in the panel on failure.
- **Styling:** use HeroUI v3 compound API (`Button`, `TextArea`, `Spinner`, `Chip`).
  Match the repo's existing tokens in `apps/client/src/index.css`. No new design system.
- **i18n keys** (add to both `en.json` and `id.json`):
  - `aiFill.assistant` — "AI Assistant"
  - `aiFill.fill` — "AI Fill"
  - `aiFill.placeholder` — "please help me fill this form with ..."
  - `aiFill.submit` — "Submit"
  - `aiFill.loading` — "Filling form..."
  - `aiFill.error` — "AI Fill failed. Please try again."
  - `aiFill.success` — "Form prefilled — please review before saving."
- **Do NOT** modify `AiAssistant.tsx` chat behavior in this task (only Task 1 touches it).

## Steps
- [ ] Step 1: Add `aiFill.*` keys to `en.json` + `id.json`
- [ ] Step 2: Create `useAiFill.ts`
- [ ] Step 3: Create `AiFillBar.tsx`
- [ ] Step 4: `bun run check-types` (client) passes
- [ ] Step 5: Self-review
