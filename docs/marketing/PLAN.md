# Plan — Selling the WMS: Marketing Site + Sales Material

**Status:** planning only. No application code has been changed for this yet.
**Business model:** one-time buyout of the full WMS application + source code. Each customer's
customization = adjusting their warehouse pipelines/workflows to fit how they operate. Not SaaS.
**Timeline target:** ~2 months.

## 1. What already exists

- Working app: React 19 + Vite client (desktop Tauri + web), Express + tRPC + Prisma server,
  permissioned routes, AI assistant, 3D warehouse visualizer, EN/ID locales.
- A public landing page at `/` (`apps/client/src/pages/LandingPage.tsx`) with navbar/footer and
  section components in `apps/client/src/pages/landing/`.
- A product brief: `PRODUCT.md` (brand "WMS — Enterprise Systems That Think", brand blue
  `#0B5FFA` / `#0046CC`, Poppins, HeroUI v3 + Tailwind v4 oklch tokens in `index.css`).
- **Sales material already written in this folder:** `README.md`, `one-pager.md`,
  `discovery-checklist.md`, `demo-script.md`, `faq-objections.md`, `email-templates.md`. All
  grounded in `PRODUCT.md`; prices/contacts are `[PLACEHOLDER]` tokens.

## 2. Goal of the marketing site

Make the existing app a "proper selling app": a public, polished, navigable marketing site with
pricing and company info, while leaving the protected app (`/dashboard`, `/warehouse/...`, etc.)
and `/login` untouched. The marketing site must reflect the one-time buyout model, not SaaS.

## 3. Pages to build (public routes)

| Route       | Purpose                       | Notes                                                         |
| ----------- | ----------------------------- | ------------------------------------------------------------- |
| `/`         | Home (existing landing)       | Keep all current sections; reuse on the shared shell.         |
| `/features` | Feature overview              | Grounded in `PRODUCT.md` capabilities only.                   |
| `/pricing`  | One-time buyout tiers         | One constants file holds all prices/tier names/contact email. |
| `/about`    | Company + product story       | No invented customers/benchmarks.                             |
| `/contact`  | Inquiry / request-a-demo form | Client-side only (no backend yet).                            |
| `/faq`      | FAQ + objections              | Reuse [`faq-objections.md`](faq-objections.md) content.       |

## 4. Architecture decisions (to confirm before building)

1. **Shared marketing shell.** Reuse/adapt the existing landing navbar + footer
   (`_LandingNavbar`, `_FooterSection`) as one `MarketingLayout` so navigation works across pages.
   The existing `/` keeps its sections.
2. **One constants file** (`apps/client/src/pages/marketing/marketingConfig.ts`) holds tier names,
   feature lists, sample prices, and the contact email — all marked as placeholders the owner
   replaces. This is the single edit point for sales copy.
3. **No fabricated proof.** No customer logos, testimonials, benchmarks, uptime/SLA claims (none
   are documented). Claims come only from `PRODUCT.md`.
4. **English only** for marketing copy initially. No new locale keys unless trivial.
5. **Contact form is client-side only** with a local success message and a clear TODO; no fake
   API call. A backend endpoint can be added later.
6. **SEO:** per-page `document.title` via a small hook. No meta framework (the app uses
   `createBrowserRouter` data router, not framework mode).
7. **Pricing framing:** one-time buyout of app + source code, with pipeline customization.
   Top tier = "source code + custom pipelines", CTA = "Contact us" (not a checkout).

## 5. Pricing tiers (proposal — owner to finalize)

| Tier             | Who it's for                   | Includes                                                                    |
| ---------------- | ------------------------------ | --------------------------------------------------------------------------- |
| Single Warehouse | One warehouse                  | Full app, single-warehouse deployment, pipeline customization for that site |
| Multi-Warehouse  | Several warehouses             | Full app, multi-warehouse deployment, customization across sites            |
| Enterprise       | Source code + custom pipelines | Everything + full source code delivery + deeper customization               |

All three are **one-time**. No monthly/SaaS line. Final prices, what each tier includes, and
delivery terms are placeholders until the owner sets them.

## 6. Sales material (this folder)

See [`README.md`](README.md) for the index. The material leads with discovery ("which process do
you want to change?"), maps answers to what gets customized, and includes a timed demo script
using real routes (`/dashboard`, `/warehouse/:id/layout`, `/inbound-transaction/...`,
`/outbound-transaction/...`, `/stock-movement`, `/pallets`, `/inventory-aging`, `/reports/...`,
`/knowledge`, `/ai-admin`, `/access-control/roles`, `/settings`, etc.). All prices/contacts remain
`[PLACEHOLDER]`.

## 7. Phased plan (2 months)

- **Weeks 1–2:** Confirm architecture decisions above + finalize pricing numbers and contact email.
  Write final marketing copy (English) for the six pages.
- **Weeks 3–4:** Build shared `MarketingLayout` + `/features`, `/pricing`, `/about` pages.
- **Weeks 5–6:** Build `/contact` form + `/faq`. Add per-page titles. Polish responsive + dark/light.
- **Weeks 7–8:** Pilot: run the discovery + demo flow (from `discovery-checklist.md` and
  `demo-script.md`) with one real prospect. Fix what breaks. Finalize `marketingConfig.ts` values
  and deploy.

## 8. What is NOT in scope

- No multi-tenant SaaS, billing, or subscription plumbing.
- No new backend endpoints (contact form stays client-side for now).
- No fabricated proof (customers/testimonials/benchmarks).
- No changes to the protected app, auth, or permissions.
- No localization of marketing copy beyond English initially.

## 9. Open decisions needed from you

1. Final pricing numbers (or keep clearly-marked placeholders for now).
2. Contact email / booking URL.
3. Exact page list — is `/faq` wanted, or fold FAQ into `/pricing`?
4. Whether to keep the sales files as written or adjust tone/length.
5. Confirm "WMS" stays the public product name, or rename for sales.

## 10. When you're ready to build

Say "build it" and I'll implement the plan (marketing pages + shared shell) with the frontend
worker, running `check-types` and not committing. The sales material is already in place here in
`docs/marketing/`.
