# Copilot / Cursor / AI Coding Instructions

## Core Principle
Use the shortest correct solution that preserves readability and existing architecture.

---

## HeroUI Rules (Strict)
- Use **only** props, variants, slots, and composition.
- **Never** use `className` or `classNames` on any HeroUI component.
- If HeroUI cannot express the UI cleanly, explicitly say so before adding custom styling or Tailwind classes.

---

## General Rules

### TypeScript
- Prefer type inference whenever possible.
- Use `interface` for props and object shapes that might be extended.
- Use `type` for unions, intersections, and aliases.
- Avoid `any`. Use `unknown` when the type is truly unknown.
- Do not use non-null assertion (`!`) unless absolutely necessary with a comment.
- Keep types close to where they are used.

### React + Frontend
- Functional components only.
- Explicitly type component props using interfaces (avoid `React.FC` when possible).
- Default export pages and layouts. Named export reusable components.
- Keep components small and single-responsibility.
- Custom hooks must start with `use` and be colocated when possible.
- Use `useMemo`, `useCallback`, and `React.memo` only when a performance issue has been measured.
- Prefer composition over prop drilling. Use context or lightweight state management (Zustand/Jotai) only when needed.

### tRPC (Backend + Client)
- Follow domain-based nested routers (e.g. `userRouter`, `postRouter`).
- Use Zod for all input validation.
- Procedures should be thin. Move complex logic to services if needed.
- Use `TRPCError` with proper codes (`NOT_FOUND`, `UNAUTHORIZED`, `BAD_REQUEST`, etc.).
- Protected procedures must go through the shared `protectedProcedure` middleware.
- On the frontend:
  - Use the typed `trpc` client created with `createTRPCReact<AppRouter>()`.
  - Prefer `useQuery`, `useMutation`, and `useUtils` for invalidation.

### Turborepo Structure
Respect the current monorepo layout:
- `apps/client` -> frontend React app with tauri, vite and HeroUI
- `apps/server` → contains tRPC routers and types
- `packages/utils` → shared utilities and schemas

### Code Style
- Components: `PascalCase.tsx`
- Routers: `kebab-case.router.ts` or `domain.router.ts`
- Hooks: `usePascalCase.ts`
- Meaningful and readable names over overly short ones.
- No magic numbers or strings — extract to named constants.
- Consistent import ordering (enforced by ESLint).

### Performance & Best Practices
- Favor Server Components and Server Actions when using Next.js.
- Set reasonable `staleTime` / `gcTime` on tRPC queries based on data volatility.
- Ensure good accessibility — leverage HeroUI’s built-in a11y features.

---

## Important Reminders
- Always prioritize **readability** and **maintainability**.
- Do not over-engineer simple solutions.
- When in doubt, choose the simplest approach that follows the existing architecture.
- If you need to deviate from these rules, explain why clearly.

Follow these instructions strictly for every suggestion and code generation.