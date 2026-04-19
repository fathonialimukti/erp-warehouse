# Copilot / Cursor / AI Coding Instructions

## Core Principle

**Write the shortest, cleanest, and most maintainable solution** that follows the existing architecture and modern minimalist principles.
Prioritize clarity, simplicity, and consistency over cleverness or premature optimization.

Use:

- **Bun** as runtime, package manager, and script runner
- **TypeScript** (strict mode) for all code
- **React 19** + **Vite** + **Tauri** for the frontend
- **tRPC** (v11+) for end-to-end typesafe communication
- **HeroUI** + **Tailwind CSS** for UI
- **Turborepo** for monorepo management

Always respect the current project structure and recent file edits.
Only refer to file i provided in the context, focus on it and feel free to ask for more files if needed. Do not suggest code that has been deleted in recent edits.
---

**Preferred architecture**: Feature-Sliced Design (light version) — group by **feature** inside `features/` when it grows.

---

## HeroUI Rules (Strict)

- Use **only** HeroUI props, variants, slots, and composition.
- **Never** pass `className` or `classNames` to any HeroUI component.
- If HeroUI cannot achieve the desired UI cleanly, **explicitly state** it and ask for permission before adding custom Tailwind classes.
- Prefer composition (`<HeroCard><HeroButton>...</HeroButton></HeroCard>`) over deep prop drilling.

---

## TypeScript Rules

- Enable `strict: true` and `exactOptionalPropertyTypes`
- Prefer **type inference** wherever possible
- Use `interface` for props and extendable object shapes
- Use `type` for unions, intersections, utility types, and aliases
- Avoid `any`. Use `unknown` or `never` when appropriate
- Never use non-null assertion (`!`) without a clear `// TODO:` or safety comment
- Colocate types close to their usage

---

## React + Frontend Rules

- Functional components only
- Explicitly type props with `interface ComponentProps {}` (avoid `React.FC`)
- Default export for pages and root components
- Named export for reusable components and hooks
- Keep components small, focused, and single-responsibility
- Use **feature folders** (`features/auth`, `features/dashboard`, etc.) for complex modules
- Custom hooks must start with `use` and be colocated in the feature or `hooks/` folder
- Use `useMemo` / `useCallback` / `React.memo` **only** when performance issues are measured
- Prefer **composition** and **context** over heavy prop drilling
- Use **Zustand** or **Jotai** sparingly for global state (only when truly needed)

---

## tRPC Rules (Modern & Clean)

- Use **domain-based nested routers** (`user.ts`, `post.ts`, `settings.ts`)
- All input/output validation with **Zod**
- Keep procedures **thin** — move complex logic to `services/`
- Use `TRPCError` with correct error codes (`NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `BAD_REQUEST`, `CONFLICT`)
- All protected routes must use the shared `protectedProcedure` middleware
- On frontend:
  - Use typed `trpc` client via `createTRPCReact<AppRouter>()`
  - Prefer `useQuery`, `useMutation`, `useSuspenseQuery` (React 19), and `useUtils`
  - Set sensible `staleTime` / `gcTime` based on data volatility

---

## Code Style & Best Practices

- File naming:
  - Components: `PascalCase.tsx`
  - Routers: `domain.ts`
  - Hooks: `usePascalCase.ts`
  - Utils: `kebab-case.ts` or `camelCase.ts`
- Use **arrow functions** consistently
- Prefer early returns: `if (!condition) return ...`
- No magic numbers or strings — extract to well-named constants
- Consistent import order (ESLint enforced)
- Meaningful names > extreme brevity
- Write self-documenting code. Comments only when necessary

### Performance

- Favor React Server Components where possible (if using any SSR)
- Use Tauri’s native capabilities wisely (window, dialog, fs, etc.)
- Keep bundle size in mind — avoid unnecessary dependencies

### Accessibility & Design

- Leverage HeroUI’s built-in accessibility features
- Follow modern minimalist design: generous whitespace, clean typography, subtle interactions
- Ensure high contrast and keyboard navigation

---

## Important Reminders

- **Always check recent file edits** before suggesting changes to existing files.
- Do **not** suggest deleted code.
- Prioritize **readability and maintainability** above all.
- Keep the app **modern and minimalist** in both code and UI.
- If you need to deviate from these rules, **explain why clearly** first.
- When in doubt, choose the **simplest solution** that respects the architecture.

Follow these instructions **strictly** for every code suggestion and generation.
