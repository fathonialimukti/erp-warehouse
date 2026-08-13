# Task 4: SelectSearch prefetch-on-load verification

## Files
- Modify (verify/adjust): `apps/client/src/components/SelectSearch.tsx`

## Frozen contract
- The user requirement: **SelectSearch must NOT rely on server-side fetch at AI-fill
  time — prefetch options on page load** so the AI can fill select fields from already
  loaded options.
- Verify the current `useQuery` in `SelectSearch.tsx` already fetches on mount (it does —
  `queryKey: [queryKeyBase, debouncedSearchTerm, dependencies, limit]` with empty search
  term on mount). Confirm the `data-ai-select-options` hidden div exposes the loaded
  options to `collectPageContext` (it already does).
- If the current behavior already prefetches on page load, **make no code change** —
  just document the verification in the task report.
- Only adjust if you find a real gap (e.g. options not loaded until the popover opens).
  Do not over-engineer.

## Steps
- [ ] Step 1: Read `SelectSearch.tsx` and confirm mount-time prefetch
- [ ] Step 2: Confirm `data-ai-select-options` is populated on load
- [ ] Step 3: Report findings; change code only if a real gap exists
