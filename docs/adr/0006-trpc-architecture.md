# ADR 0006: tRPC v11 End-to-End Type Safety

- **Status:** Accepted
- **Date:** 2026-08-17 (shipped in initial schema)
- **Scope:** `apps/server/src/trpc.ts`, `apps/server/src/router.ts`,
  `apps/client/src/lib/trpc.ts`, `packages/schemas/`

## Context

The ERP Warehouse needs an API layer that:

- Provides **end-to-end type safety** — client and server share one type definition
- Supports **35+ domain routers** with a clean registration pattern
- Works with **Tauri desktop** and **web** from a single client codebase
- Supports **React Query** for caching, optimistic updates, and pagination
- Has **minimal boilerplate** — no OpenAPI spec, no codegen, no duplicate types

Traditional REST/gRPC APIs require:

- Manual OpenAPI spec generation
- Client codegen (or `any` types)
- Separate validation on server and client
- Route path duplication between client and server

GraphQL requires:

- Schema definition language
- Query planning complexity
- N+1 query problem (mitigated but not eliminated)

## Decision

**tRPC v11 with vanilla client + React Query integration.**

### Server side

```ts
// apps/server/src/trpc.ts
export const t = initTRPC.create();

// apps/server/src/routers/receiving.ts
export const receivingRouter = t.router({
  list: t.procedure
    .use(auth)
    .use(hasPermission('receiving@read'))
    .input(baseListInputSchema)
    .query(async ({ ctx, input }) => { ... }),

  create: t.procedure
    .use(auth)
    .use(hasPermission('receiving@create'))
    .input(createReceivingInputSchema)
    .mutation(async ({ ctx, input }) => { ... }),
});
```

### Client side

```ts
// apps/client/src/lib/trpc.ts
export const trpcClient = createTRPCClient<AppRouter>({ ... });

// apps/client/src/lib/hooks/useReceiving.ts
export function useReceivingList() {
  return trpcClient.receiving.list.useQuery();
}
```

### Type flow

```
Router definition (server)
    │
    ▼
AppRouter type (inferred from all routers)
    │
    ├── Server: t.procedure.input/output validation via Zod
    │
    └── Client: createTRPCClient<AppRouter>()
            ├── trpcClient.receiving.list.useQuery() — fully typed
            ├── trpcClient.receiving.create.mutate(data) — fully typed
            └── inferRouterInputs/AppRouter / inferRouterOutputs<AppRouter>
```

### React Query integration

tRPC v11 integrates with `@tanstack/react-query` via `@trpc/react-query`.
Queries are cached, paginated, and optimistically updated like any React
Query hook. The `trpcClient` vanilla client is used directly (not the
React bindings) for maximum flexibility in the Tauri desktop context.

## Ruled-out alternatives

1. **REST + OpenAPI + codegen.** Rejected: duplicate types, codegen step,
   route path drift between client and server. tRPC eliminates all three.

2. **GraphQL.** Rejected: schema complexity, N+1 risk, and the ERP's
   data shape is relational (list/detail/create/update/delete) — not
   graph-shaped. REST/GraphQL abstractions don't fit CRUD.

3. **gRPC.** Rejected: browser support is poor (needs gRPC-Web + proxy),
   no first-class TypeScript inference without codegen, and the Tauri
   desktop doesn't benefit from HTTP/2 multiplexing.

4. **Fetch + manual Zod on client.** Rejected: duplicate validation logic,
   no type inference, easy to drift. The whole point is sharing types.

## Consequences

- **Positive:**
  - End-to-end types — change a schema field, the client breaks at compile time
  - No codegen — types are inferred from the router definition
  - Zod schemas in `packages/schemas` are the single source of truth
  - React Query integration — caching, pagination, optimistic updates
  - Works identically in Tauri desktop and web browser
  - 35+ routers compose into one `AppRouter` type

- **Trade-offs:**
  - tRPC is a framework, not a standard — vendor risk (though v11 is stable)
  - Batch links group multiple procedures into one HTTP request (default)
  - Error types are tRPC-specific (`TRPCClientError`)
  - Subscriptions require WebSocket setup (not currently used)

## Verification

- `bun run check-types` — client and server must agree on types
- `bunx vitest run routers/` — procedure-level tests with `createCaller()`
- E2E: `apps/client/src/tests/e2e/` — UI exercises tRPC procedures
- Manual: change a schema field and verify the client fails to compile
