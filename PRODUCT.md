# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are **warehouse administration staff, managers, and department heads** who operate within a warehouse environment using a desktop application. Administration staff record inbound and outbound transactions (receiving, putaway, picking, shipping, RMA, WIP). Managers and department heads approve draft transactions, review inventory aging, monitor dispatch queues, and audit activity logs.

## Product Purpose

A full-stack ERP Warehouse Management System (WMS) that tracks stock movement across warehouses and storage locations in real time. Users record inbound receipts, putaway, picking and dispatch, returns, disposals, losses, and WIP issues/completions against SKU and pallet granularity. The system maintains SKU inventory balances, generates monthly stock movement reports, and supports approval workflows on every transaction type. A native Tauri desktop shell gives offline-capable, install-once access on warehouse floors; the same React client also runs in browsers.

## Positioning

Built end-to-end by a single developer with **full desktop + web parity**: the same React/Vite codebase ships as both a Tauri desktop app and a web app, avoiding the duplication that separates native-wrapper and browser products. Differentiators include a **3D warehouse layout visualizer** (React Three Fiber) showing real-time pallet positioning, and an **integrated AI agent** (Vercel AI SDK) that retrieves knowledge-base chunks via PostgreSQL FTS, navigates pages, and fills forms on command. Permissioned access control gates every route to resource-action pairs (`resource@action`).

## Operating Context

- **Desktop-first**: Tauri app used on warehouse floors; web app for remote management.
- **Approval workflow**: every transaction flows DRAFT → PROPOSED → APROVED/REJECTED, with approval history tracked per entity.
- **Multi-language**: English and Indonesian locales via react-intl.
- **Three stock domains**: inbound, outbound, WIP, plus subinventory transfer, pallets, SKUs, products, suppliers, users, roles.
- **Reports**: dispatch queue, inventory aging, monthly stock movement, SKU-level detail, inventory balance snapshot.
- **Auth**: JWT cookie-based authentication with protected routes; role/permission matrix drives UI visibility.
- **DB**: PostgreSQL via Prisma ORM with ULID primary keys.

## Capabilities and Constraints

### Confirmed functionality
- TRC client (React 19, HeroUI v3, Tailwind v4, TanStack Table & Form, React Three Fiber, Jotai, react-intl)
- Express + tRPC v11 server with end-to-end typesafe procedures
- Prisma ORM with PostgreSQL; ULID ids; Zod schemas in `@repo/schemas`
- AI chat assistant with SSE streaming, RAG via PostgreSQL FTS, tool-calling (navigation, form fill, page context read)
- 3D warehouse layout viewer using Three.js / R3F with GLTF/OBJ models
- Dark/light theme toggle (oklch-based tokens in `index.css`)
- Real-time notification stream over SSE
- Tauri native bridge for push notifications and file dialogs
- QR code generation via `qrcode.react`
- XLSX import/export via `xlsx`

### Technical constraints
- TypeScript strict with `exactOptionalPropertyTypes`
- Permission strings always `resource@action`
- Monorepo via Turborepo + Bun; `bun` as package manager
- Server port 10022 (Tauri proxy)

### Undecided product facts
- Specific enterprise customers or benchmarks (none documented)
- Formal SLA / uptime target (not specified)

## Brand Commitments

- **Name**: WMS (Warehouse Management System); window title reads "WMS — Enterprise Systems That Think"
- **Voice**: "Enterprise Systems That Think" — professional, technical, AI-enabled
- **Visual identity**: Professional/corporate blue-based color palette (primary `#0B5FFA`, secondary `#0046CC`) with neutral grays; HeroUI v3 component library; oklch-based theme variables for light and dark modes
- **Assets**: Custom SVG icon set in `apps/client/public/icons/` (KPIs, navigation items); `dashboard.png` logo in `public/icons/`
- **Fonts**: Poppins (declared as `--font-sans` in `index.css`)
- **AI assistant positioning**: Marketed as "WMS AI" — an integrated agent, not a separate product

## Evidence on Hand

- Source repository: `/apps/client` (React/Tauri), `/apps/server` (Express/tRPC/Prisma), `/packages/schemas` (Zod schemas)
- AI agent architecture reference: `apps/server/AI_AGENT.md`
- Knowledge base source files: `apps/server/src/knowledge/*.md` (pages, forms, navigation, permissions, approvals, general)
- Visual assets: `apps/client/public/icons/` (SVGs), `apps/client/src/assets/` (IconRegistry, KPI icons, nav icons)
- Color tokens: `apps/client/src/styles/colors.ts`
- Theme tokens: `apps/client/src/index.css` (HeroUI v3 oklch variables, light + dark)
- Routes catalog: `apps/client/src/routes.tsx` — ~50 routes across inbound, outbound, inventory, reports, knowledge, AI admin, users, roles, warehouses, suppliers, products, SKUs, pallets
- Locales: `apps/client/src/locales/en.json` and `id.json`

## Product Principles

1. **Parity first**: desktop and web share one codebase; features ship everywhere
2. **Warehouse-native**: design for floor operators — keyboard shortcuts, dense data, fast transactions
3. **Visibility through 3D**: spatial understanding of stock via real-time 3D layouts
4. **Agent-assisted workflows**: AI handles navigation and form filling so humans focus on exceptions
5. **Permissioned transparency**: every route and action gated by `resource@action`, surfaced in the UI

## Accessibility & Inclusion

No explicitly documented accessibility requirements found in the repository. Standard WCAG considerations expected for a data-dense enterprise admin tool (keyboard navigation, sufficient color contrast, screen reader labels on forms). Indonesian + English locale support confirms i18n commitment.
