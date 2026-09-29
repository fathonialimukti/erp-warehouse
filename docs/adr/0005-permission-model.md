# ADR 0005: `resource@action` Permission Model

- **Status:** Accepted
- **Date:** 2026-08-17 (shipped in initial schema, `ad4fb44`)
- **Scope:** `packages/schemas/src/permission.ts`, `apps/server/src/lib/permissions.ts`,
  `apps/server/src/middleware/auth.ts`, `apps/client/src/lib/permissions.ts`

## Context

The ERP Warehouse has 10+ transaction types (receiving, putaway, picking,
dispatch, returns, disposals, losses, WIP, transfers, purchase orders) plus
master data (SKUs, products, warehouses, users, roles). Every action —
viewing, creating, editing, deleting, approving — must be gated by role.

The system serves multiple user types:

- **Warehouse floor operators** — execute transactions, can't approve
- **Managers** — approve transactions, review reports
- **Admins** — full access, manage users and settings
- **Auditors** — read-only access to all logs and activity

We needed a permission model that is:

- **Composable** — permissions combine to form roles
- **Granular** — per-resource, per-action
- **Server-enforced** — UI is a mirror, not the source of truth
- **Bilingual** — the same permission strings work for EN and ID locales

## Decision

**`resource@action` string permissions, enforced server-side, mirrored in UI.**

### Format

```
<resource>@<action>
```

- `resource` — the domain entity (e.g., `receiving`, `shipment`, `user`, `role`)
- `action` — the operation (e.g., `create`, `read`, `update`, `delete`, `approve`)

### Examples

| Permission          | Meaning                         |
| ------------------- | ------------------------------- |
| `receiving@create`  | Create a receiving transaction  |
| `receiving@approve` | Approve a receiving transaction |
| `user@delete`       | Delete a user                   |
| `system@read`       | View system settings            |

### Wildcards

- `*` in either position: `receiving@*` = all actions on receiving
- `*@*` = super-admin (full access)

### Role composition

Roles are sets of permission strings. A user's effective permissions are the
union of their role's permissions. The `Role` model stores permissions as a
string array (validated by `permission.ts` Zod schema).

### Enforcement

```
Client request → tRPC procedure → hasPermission(ctx.user, 'receiving@create')
    ├── allowed → proceed
    └── denied → 403 Forbidden
```

Every procedure that mutates data calls `hasPermission` explicitly. The UI
mirrors this — buttons and routes are hidden/disabled based on the same
permission check (client-side copy of the server logic).

## Ruled-out alternatives

1. **Role-based only (no per-action granularity).** Rejected: too coarse.
   A "warehouse clerk" role would need to be split into "can create" vs
   "can approve" — which is exactly the SoD requirement.

2. **Capability tokens (per-user, per-resource).** Rejected: too complex.
   Each user would need a token per resource, tokens would expire, and
   revoking access means updating every token. The `resource@action` string
   is simpler and self-describing.

3. **ABAC (Attribute-Based Access Control).** Rejected: overkill for a
   single-tenant ERP. ABAC's policy engine adds complexity without benefit
   here — we don't need time-of-day, location, or device-based rules.

4. **Client-side only enforcement.** Rejected: security boundary is the
   server. The UI can hide buttons, but a determined client can still call
   the tRPC procedure directly.

## Consequences

- **Positive:**
  - Composable — roles are just sets of strings
  - Granular — per-resource, per-action
  - Server-enforced — UI is a mirror, not the source of truth
  - Bilingual — permission strings are locale-independent
  - Auditable — activity logs record which permission was checked
  - SoD-friendly — no role has both `@create` and `@approve` for the same
    resource

- **Trade-offs:**
  - Permission strings are hardcoded in routers — adding a new permission
    requires a code change
  - No hierarchical roles (role inheritance) — roles are flat sets
  - `*` wildcard is powerful; use sparingly

## Verification

- `bunx vitest run role` — role CRUD + permission validation
- `bunx vitest run permissions` — `hasPermission` unit tests
- E2E: `apps/client/src/tests/e2e/sku.spec.ts` — delete button visibility
  depends on `sku@delete` permission
- Manual: create a role with `receiving@read` only, verify the clerk can
  view but not create
