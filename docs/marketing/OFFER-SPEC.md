# Offer Spec — One-Time Buyout of the WMS

**Status:** working spec. Commercial terms are **not final** — every number the deal owner must fix is a `[DECISION]` token, collected in §11. Ranges are suggestions anchored in `RESEARCH.md` §7 and `PLAYBOOK.md`; they are not commitments.
**Audience:** the deal owner (you) and a buyer's CFO/IT lead. This is the document that closes the `[PLACEHOLDER]`s in `faq-objections.md`.
**Grounding:** claims cite the repo file they come from (`PRODUCT.md`, `SECURITY.md`, `docs/ops/*`, `marketingConfig.ts`, `LICENSE`). No customer, benchmark, uptime or SLA is asserted.

---

## 1. The offer (30-second version)

> "You get a complete warehouse management system — the full application **and its source code**, installed on your infrastructure and configured to your warehouse workflows. You pay **once**; there is no subscription. I adapt your receiving-to-dispatch pipelines, approval rules, roles/permissions, import/export templates and report layout to how your company actually operates — I do not build new product modules or undocumented third-party integrations. Price depends on tier and scope (see §2), support after handover is optional, and you can maintain the system yourselves because you hold the source."

Gate (Playbook Stage 0): you can say the above, name the price range, and state what you will and won't configure, in under 30 seconds.

### 1.1 Quick reference table

| Tier             | Who                                     | Included                                                  | Excluded                                 | One-time price                                                                                                          |
| ---------------- | --------------------------------------- | --------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Single Warehouse | One site, one operating team            | Everything in the WMS Single tier                         | Multi-site, integrations                 | From $12,000 (≈ Rp 218 jt) — DECIDED 2026-11-27 (PRICING-RESEARCH.md §1). Starting price, final quoted after discovery. |
| Multi-Warehouse  | Several sites under one operation       | Everything in Single + multi-site                         | Custom integrations, new modules         | From $24,000 (≈ Rp 437 jt) — DECIDED 2026-11-27 (PRICING-RESEARCH.md §1). Starting price, final quoted after discovery. |
| Enterprise       | Team wants to own + extend the codebase | Everything in Multi + **full source delivery** + handover | Future features, hosting (unless add-on) | From $40,000 (≈ Rp 728 jt) — DECIDED 2026-11-27 (PRICING-RESEARCH.md §1). Starting price, final quoted after discovery. |

> **Note:** DECIDED 2026-11-27 (PRICING-RESEARCH.md §1): source-code delivery is included in **every** tier, not Enterprise-only. `marketingConfig.ts` reflects this. One published price list serves both the Indonesian and international markets (§2). The figures are **floors for standard scope, not final quotes** — the final price is quoted after discovery; see §2 for the scope rule and guardrails.

---

## 2. The three tiers

Mirror the names/IDs already shipped in `apps/client/src/pages/marketing/marketingConfig.ts` (`id: "single" | "multi" | "enterprise"`) so the spec and the pricing page cannot drift.

> **DECIDED 2026-11-27 (PRICING-RESEARCH.md §1/§7):** one published price list for both markets — USD prices with IDR shown as an equivalent at the current rate (1 USD ≈ Rp 18,200, 2026-11-25), **not** a locked IDR price; price in USD, invoice in USD. Local Indonesian buyers may qualify for the same **25% scope-based** Founding Partner discount when they self-host, self-load data and take no on-site delivery — justified by reduced delivery scope, **not** a separate published price list. Cash-upfront discount: **10%** (optional).

**Starting prices, not fixed quotes.** From $12K / $24K / $40K are floors for a standard deployment plus initial workflow configuration; the final price is quoted after discovery. Customization beyond the included workflows is priced from the rate card in `PRICING-RESEARCH.md` §4. A buyer needing many modules and custom printout documents is quoted **per item**, not at a fixed tier price. New rate-card line: **custom printout document — `[ESTIMATE: $400–$900 each]`**. Reasoning: derived from the report-pack range of $800–$2,000 (`PRICING-RESEARCH.md` §4) split across 2–4 documents; this is an `[ESTIMATE]`, not a committed rate.

**Guardrails:** never quote below **$9,000** for Single (the floor after the 25% Founding Partner discount). Cap customization at **~50% of the starting price**; beyond that, cut scope or decline — do not absorb it. Out-of-package work is **$75/hr local / $150/hr export**, in writing, before it starts.

### 2.1 Single Warehouse (`id: single`)

- **Who it's for:** one warehouse, one operating team.
- **Included:**
  - Full WMS application (web; desktop dev client per §6.3), one codebase
  - Single-site deployment and data setup
  - Pipeline/workflow customization for that site (receiving, putaway, picking, dispatch, returns/RMA, WIP, disposals/losses/found, transfers, stock counts, purchase orders)
  - Approval workflows (DRAFT → PROPOSED → APPROVED/REJECTED) and roles
  - Reports: stock movement, inventory aging, balance snapshots, dispatch queue, SKU detail
  - English + Indonesian UI
- **Excluded:** multi-warehouse deployment, custom integrations, new product modules, support beyond the included window.
- **Starting price:** From $12,000 (≈ Rp 218 jt) — DECIDED 2026-11-27 (PRICING-RESEARCH.md §1). One-time, source included; final quoted after discovery.

### 2.2 Multi-Warehouse (`id: multi`, recommended/highlighted)

- **Who it's for:** several warehouses under one operation.
- **Included:** everything in Single, plus multi-site deployment, pipeline customization across warehouses, warehouse-scoped permissions/user assignment, cross-warehouse stock movement and 3D layout views.
- **Excluded:** custom integrations, new product modules.
- **Starting price:** From $24,000 (≈ Rp 437 jt) — DECIDED 2026-11-27 (PRICING-RESEARCH.md §1). One-time, source included; final quoted after discovery.

### 2.3 Enterprise (`id: enterprise`)

- **Who it's for:** a team that wants to own and extend the codebase.
- **Included:** everything in Multi, **full application source-code delivery**, deeper pipeline/approval customization, WMS AI assistant knowledge base tuned to their processes, handover so their team can maintain and extend.
- **Excluded:** future features (covered by optional retainer §5 if bought), managed hosting (separately priced, §5), integrations not separately scoped.
- **Starting price:** From $40,000 (≈ Rp 728 jt) — DECIDED 2026-11-27 (PRICING-RESEARCH.md §1). One-time, source included; final quoted after discovery.

---

## 3. Customization boundary — in scope vs out of scope

**Quotable verbatim to a prospect.** Grounded in `discovery-checklist.md`.

**In scope** (adapting the existing system — not new product surface):

- **Pipelines & workflow order** — which screens/steps a user moves through, what is captured at each step, for the transaction types they actually use (receiving, found, RMA receipt, WIP completion, shipment, disposal, loss, return-to-supplier, WIP issue, subinventory transfer, stock count, purchase order).
- **Approval matrix** — which transactions require approval, by whom, value/warehouse/role thresholds, per-entity approval history.
- **Roles & permissions** — the `resource@action` matrix mapped to their org chart, warehouse-scoped assignment, segregation of duties (recorder ≠ approver).
- **Import/export templates** — XLSX templates adapted to their data formats where formats align.
- **Reports** — which reports are emphasized, dashboard arrangement, fields/filters the managers use.
- **Master-data setup** — warehouses, storage locations, SKUs, pallets, products, suppliers shaped to their operation.

**Out of scope** (must be separately scoped, or declined):

- **New product modules** or new top-level feature areas that don't exist in the build.
- **New/undocumented transaction types** beyond the documented set above.
- **Third-party integrations** not documented in the product (ERP, accounting, warehouse-automation, scanner middleware) — each is a separate SOW with its own price and risk.
- **Rewriting the core architecture**, multi-tenant SaaS conversion, or a mobile-native app.
- **Regulatory certifications** (e.g. formal validation packages) — not offered unless explicitly contracted.

> **Owner note (faq-objections.md):** confirm the precise lists above and use this exact wording externally.

---

## 4. License and source-code delivery

**This is the honest part. Read before quoting any price.**

The repository is **MIT-licensed** (`LICENSE`, "Copyright (c) 2026 ERP Warehouse contributors"). MIT grants _everyone_ the right to use, copy, modify, merge, publish, distribute, sublicense and sell the software. Consequences:

- A story of "we sell you an **exclusive** license" collapses the moment the buyer reads `LICENSE`.
- You **cannot revoke** MIT on code already published — anyone who already received it keeps their perpetual rights.
- What you _can_ sell is **delivery, configuration, deployment support, and handover** — and, if you choose, a **commercial license for future versions** that were never published under MIT.

The realistic options — pick one per `[DECISION]`:

| Option                                                                                                                   | One-line implication                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| **(a) Keep MIT; sell delivery + configuration + deployment support**                                                     | You are selling a solved problem and a working handover, not exclusivity. Simplest and defensible. `[DECISION]` |
| **(b) Relicense _future_ versions under a commercial license**                                                           | New code can be exclusive/commercial; already-published MIT code stays MIT forever. `[DECISION]`                |
| **(c) Dual-license** (MIT for community, commercial terms for buyers who want support/indemnity/exclusivity on new code) | More legal surface; lets you charge for what MIT doesn't give them. `[DECISION]`                                |

**Handover mechanism** `[DECISION]`: private repo transfer / encrypted archive / source delivery on final payment. Recommended default: private repo or encrypted archive **released only on final payment**.

**Hard policy: never deliver full source before final payment** (Playbook Stage 7; RESEARCH §8). State it in the SOW.

**Liability:** MIT's warranty disclaimer ("AS IS", no warranty, no liability for damages) is the foundation of the liability cap in §8. Keep it in the delivered `LICENSE` and restate the cap in the contract.

---

## 5. Support and maintenance

- **Included support after handover:** `[DECISION: duration — suggested 90 days per RESEARCH §1/PLAYBOOK]`.
- **Optional annual maintenance retainer:** `[DECISION: suggested 15–20% of license/yr per RESEARCH §7]` — covers fixes/updates on maintained branches, not new features.
- **Optional managed hosting:** `[DECISION: suggested $200–$500/mo per RESEARCH §7]` — who operates the server, backups and monitoring.
- **Response-time expectations:** `[DECISION]` — best-effort targets only.
- **Explicit: no SLA exists** (no uptime %, no response guarantee) **unless separately contracted.** PRODUCT.md lists "Formal SLA / uptime target" as undecided — do not imply one.

---

## 6. Deployment & production-readiness disclosure

This server runs in **production**. The buyer must be told the real posture before signing.

### 6.1 Documented security posture (per `SECURITY.md` / `docs/ops/privacy.md`)

- JWT cookie sessions (`access_token`, HttpOnly); revocation via per-user `tokenVersion` bump.
- CSRF double-submit (`csrf_token` cookie must equal `x-csrf-token` on mutations).
- Lockout driven by settings; password reset via hashed single-use tokens.
- helmet headers; per-user/IP wait-queue rate limiting; output sanitisation on XSS-prone write paths; JWT enforcement on every protected procedure.
- TLS 1.2+ in transit; bcrypt cost 12 for passwords; `JWT_SECRET` via env, never committed.

### 6.2 Open advisories — disclosed plainly

As of this revision, measured `bun audit` reports **75 vulnerabilities (1 critical, 32 high, 31 moderate, 11 low)** across the workspace (`SECURITY.md`). Most are build/CLI-only. We **closed the two reachable highs before quoting**:

- **`react-router` — remediated before delivery.** Now `7.18.7`; the 5 advisories (incl. the **high** unauthenticated route-matching DoS `< 7.18.0` and the RSC CSRF bypass `< 7.18.2`) are gone.
- **`zod` — remediated before delivery.** Now `4.6.7`; the **high** memory-exhaustion advisory `GHSA-mrhx-c7xc-m3w5` (fixed 4.6.6) is gone.

Still open:

- **`xlsx@0.18.5`** — **2 high** advisories (prototype pollution, ReDoS) with **no published fix** (SheetJS moved releases off npm); needs replacement or removal of the xlsx import path.
- **1 critical — `proxy-addr@2.0.7`, not exploitable in this deployment.** Reached via `express@5.2.1`; the advisory (IP spoofing via IPv4-mapped IPv6, `GHSA-jqcg-44mw-7w3h`) only applies when Express `trust proxy` is enabled. It is **disabled** (not set in `apps/server/src` or `ecosystem.config.cjs`), so `X-Forwarded-For` is not trusted and `req.ip` is the socket address. **This changes if a reverse proxy is put in front with `trust proxy` enabled** — disclose it plainly anyway.
- **`@vitest/browser` / `ws` / `vite` / `postcss` / `nanoid` / `browserslist`** — dev/CSS toolchain; not in the production bundle.

**Commitment:** these are known and tracked. The two runtime highs (react-router, zod) are **done**; the remaining remediation (xlsx replacement) is either included before handover or explicitly excluded — `[DECISION: remediation commitment — include the remaining runtime fix (xlsx) before delivery, or sell as-is with a written caveat?]`. Do **not** bury this; put it in the SOW.

### 6.3 Desktop (Tauri) is a development client, not a supported production client

Per `SECURITY.md`, the Tauri build is a **development client**; its origin is refused by production CORS and CSRF (`SameSite=lax` cookie can't cross-site). Shipping a production desktop build is a deliberate code change, not a config flag. **Production is web-only unless separately scoped** `[DECISION: offer a production desktop build as paid add-on?]`.

### 6.4 Backups

Per `docs/ops/backup-restore.md`: automated `pg_dump`, **AES-256-GCM encrypted**, configurable retention (default 30 days), local disk or **S3-compatible remote**. Documented RTO < 30 min / RPO < 5 min at target intervals. **Who operates and monitors backups** is `[DECISION: buyer's IT / your managed hosting / split]`.

---

## 7. Pilot offer (the close, part 1)

- **Scope:** one site, 1–2 workflows. Anything else deferred.
- **Duration:** 60–90 days.
- **Fee:** `[DECISION: suggested $3K–$8K per PLAYBOOK Stage 6]` — 10–30% of projected year-one value (RESEARCH §6), credited in full against buyout if converted within 30 days.
- **Payment:** **50% upfront / 50% day 30. Money before work starts.**
- **Success metrics (2–4, written):** e.g. inventory accuracy, pick error rate, receiving time, reconciliation hours.
- **Auto-convert clause:** "If 2 of 3 criteria met by Day 60, full buyout auto-converts unless buyer opts out in 7 days."
- **Legal:** mutual NDA, 1–2 page pilot agreement/SOW, data-handling terms (§9).
- **Founding Partner framing:** `[DECISION: suggested 15–25% buyout discount in exchange for a written case study + 1–3 reference calls]` — never discount > 30%.

---

## 8. Buyout terms (the close, part 2)

- **Payment schedule:** `[DECISION: suggested 30% signing / 40% go-live / 30% handover sign-off per RESEARCH §8]`.
- **Mechanism:** e-sign (DocuSign/PandaDoc/HelloSign), SOW with deliverables/milestones/acceptance/change-order process.
- **IP assignment:** **present-tense** wording ("assigns", not "will assign") — RESEARCH §8; **tied to final payment**.
- **Liability:** capped at fees paid; MIT as-is disclaimer is the base (§4).
- **Handover includes a rebuild test:** the buyer's IT deploys from delivered files **alone, without your help** — the strongest proof of a complete handover. Package: full repo with history, runbook/architecture, build instructions + dependency list, schema + migrations, third-party license list, credentials transfer, 2–3 walkthroughs.
- **Third-party component licenses** are listed and passed through; you don't warrant upstream components (incl. the open advisories in §6.2).

---

## 9. Data handling for production

- **Where data lives:** `[DECISION: buyer's own infrastructure / your managed hosting / specific region / air-gapped]` — `discovery-checklist.md` §9.
- **Admin access during customization:** `[DECISION: who has admin/DB access, for how long, under what NDA]`.
- **Live data vs copy:** customization work should run against a **staging copy**, not their live production DB, unless explicitly agreed — `[DECISION: staging-copy policy]`.
- **Retention** (per `docs/ops/privacy.md`): transaction records **7 years**, activity logs **1 year**, system logs 90 days, backups 30 days default. Retention is configurable in Settings.
- **Backup ownership:** `[DECISION: see §6.4]` — the buyer must know who holds the encryption key and the S3 remote.
- **On termination / handover:** `[DECISION: deletion timeline, export format, who confirms]` — deliver a final encrypted backup and confirm destruction of your copies.

---

## 10. Pre-launch checklist the OFFER depends on

Honest list of what is **not yet true** and blocks selling (cross-ref `preparation-checklist.md`):

- [ ] **Placeholders in `marketingConfig.ts`** — tier prices, `contactEmail` (`sales@example.com`), `bookingUrl` (`example.com`), `companyName`, social links.
- [ ] **Source-delivery tier inconsistency** — `marketingConfig.ts` puts source only in Enterprise; reconcile (§1.1, §4).
- [ ] **Contact form not wired** — client-side only; leads go nowhere (preparation-checklist item 13).
- [ ] **No deploy target / stable demo URL** with seeded fictional data.
- [ ] **No reviews / no proof** — zero public reviews; pilot + reference is the substitute.
- [ ] **Open advisories** — react-router bump and xlsx replacement (§6.2) undecided.
- [ ] **No production desktop build** — web-only unless scoped (§6.3).
- [ ] **Legal docs** — NDA/SOW/license agreement need attorney review before first use (RESEARCH §8).

---

## 11. Open decisions — the fill-in sheet

| #      | Decision                                                                                | Why it matters                   | Suggested range                                                    | Owner answer                                                                                                                                                                                                                                            |
| ------ | --------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~1~~  | ~~Single Warehouse price~~ (DECIDED 2026-11-27)                                         | Core anchor                      | $15K–$25K (RESEARCH §7)                                            | From $12K — starting price, scope quoted after discovery. DECIDED 2026-11-27 (PRICING-RESEARCH.md §1).                                                                                                                                                  |
| ~~2~~  | ~~Multi-Warehouse price~~ (DECIDED 2026-11-27)                                          | Volume tier                      | $25K–$50K (RESEARCH §7)                                            | From $24K — starting price, scope quoted after discovery. DECIDED 2026-11-27 (PRICING-RESEARCH.md §1).                                                                                                                                                  |
| ~~3~~  | ~~Enterprise price~~ (DECIDED 2026-11-27)                                               | Highest-value tier               | 2–3× base                                                          | From $40K — starting price, scope quoted after discovery. DECIDED 2026-11-27 (PRICING-RESEARCH.md §1).                                                                                                                                                  |
| ~~4~~  | ~~Is source delivery Enterprise-only or an add-on at every tier?~~ (DECIDED 2026-11-27) | Resolves config inconsistency    | —                                                                  | Included at **every tier** — DECIDED 2026-11-27 (PRICING-RESEARCH.md §1).                                                                                                                                                                               |
| 5      | License model (a/b/c)                                                                   | Legality of the whole offer (§4) | Keep MIT / relicense future / dual                                 | `[DECISION]`                                                                                                                                                                                                                                            |
| 6      | Handover mechanism                                                                      | Delivery risk (§4)               | Private repo / encrypted archive on final payment                  |                                                                                                                                                                                                                                                         |
| 7      | Included support duration                                                               | Sets expectation                 | 90 days                                                            | `[DECISION]`                                                                                                                                                                                                                                            |
| 8      | Maintenance retainer %                                                                  | Recurring revenue                | 15–20%/yr                                                          | `[DECISION]`                                                                                                                                                                                                                                            |
| 9      | Managed hosting price                                                                   | Optional add-on                  | $200–$500/mo                                                       | `[DECISION]`                                                                                                                                                                                                                                            |
| 10     | Response-time expectations                                                              | Not an SLA                       | Best-effort                                                        | `[DECISION]`                                                                                                                                                                                                                                            |
| 11     | Advisory remediation commitment                                                         | Production buyer trust           | Fix react-router + xlsx before handover, or sell as-is with caveat | `[DECISION]`                                                                                                                                                                                                                                            |
| 12     | Production desktop build add-on?                                                        | Scope                            | Web-only unless scoped                                             | `[DECISION]`                                                                                                                                                                                                                                            |
| 13     | Who operates backups                                                                    | Data safety                      | Buyer IT / you / split                                             | `[DECISION]`                                                                                                                                                                                                                                            |
| 14     | Pilot fee                                                                               | Cash + commitment                | $3K–$8K                                                            | `[DECISION]`                                                                                                                                                                                                                                            |
| ~~15~~ | ~~Founding Partner discount~~ (DECIDED 2026-11-27)                                      | First-buyer close                | 15–25%                                                             | 25% off the starting price for the first 2–3 buyers, in exchange for a case study + 2 reference calls. Local Indonesian buyers may qualify on reduced-delivery scope (self-host / self-load / no on-site). DECIDED 2026-11-27 (PRICING-RESEARCH.md §1). |
| 16     | Buyout payment schedule                                                                 | Cash flow                        | 30/40/30                                                           | `[DECISION]`                                                                                                                                                                                                                                            |
| 17     | Where data lives                                                                        | Compliance/residency             | Buyer infra / you                                                  | `[DECISION]`                                                                                                                                                                                                                                            |
| 18     | Admin access during customization                                                       | Security                         | Named, time-boxed, NDA                                             | `[DECISION]`                                                                                                                                                                                                                                            |
| 19     | Staging-copy policy                                                                     | Protects live data               | Copy, not live                                                     | `[DECISION]`                                                                                                                                                                                                                                            |
| 20     | Termination/deletion + export                                                           | Exit guarantee                   | Final encrypted backup + confirmation                              | `[DECISION]`                                                                                                                                                                                                                                            |

---

_Every `[DECISION]` above must be answered before this spec is sent to a buyer. Commit/push is manual._
