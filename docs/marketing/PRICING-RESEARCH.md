# Pricing Research — One-Time Buyout of a Self-Built WMS (+ Source)

**Date:** 2026-11-26 · **Owner context:** solo developer, Indonesia-locale product, MIT-licensed repo (`LICENSE`), per-customer workflow customization.
**Prior art:** extends [`RESEARCH.md`](RESEARCH.md) §7 (69 sources, Nov 2026) — re-verified live, not restated. See [`OFFER-SPEC.md`](OFFER-SPEC.md) §2/§3/§11 and [`PLAYBOOK.md`](PLAYBOOK.md).
**FX used:** **1 USD = Rp 18,200** (USD/IDR ≈ 18,230 on 2026-11-25, tradingeconomics.com; BCA mid-buy 18,282 on 2026-11-26). All IDR conversions use 18,200.
**Legend:** `[S#]` = source in §11 · `[ESTIMATE]` = reasoned, no direct source.

---

## 1. Executive recommendation (actionable, no pricing background needed)

**Use model (a): one fixed buyout price per tier + a paid, itemized rate card for customization. Do not price per module. Do not price hourly for the base deal.**

### 1.1 The numbers to put on the pricing page

| Item                                                    | Price (USD)                                   | Price (IDR @18,200) | Notes                                                                    |
| ------------------------------------------------------- | --------------------------------------------- | ------------------- | ------------------------------------------------------------------------ |
| **Tier 1 — Single Warehouse** (1 site, ≤15 users)       | **$12,000**                                   | ~Rp 218 jt          | deployment + config + handover + 90-day support. Source included.        |
| **Tier 2 — Multi-Warehouse** (2–5 sites)                | **$24,000**                                   | ~Rp 437 jt          | + warehouse-scoped roles, cross-site transfer, multi-site rollout        |
| **Tier 3 — Enterprise / owned codebase**                | **$40,000**                                   | ~Rp 728 jt          | + 2 extra integration slots + on-site handover + 60-day code walkthrough |
| **Pilot fee** (60–90 days, 1 site, 1–2 workflows)       | **$3,500**                                    | ~Rp 64 jt           | 100% credited against buyout if converted ≤30 days                       |
| **Customization rate (per workflow package)**           | **$900–$3,500**                               | ~Rp 16–64 jt        | see §4 rate card                                                         |
| **Extra customization (out-of-package / change order)** | **$75/hr** (ID market) / **$150/hr** (export) | —                   | market day-rate anchored §4                                              |
| **Annual maintenance retainer**                         | **15% of buyout/yr**, 90-day support included | —                   | optional; not required                                                   |
| **Managed hosting (optional)**                          | **$220/mo** single-site                       | ~Rp 4 jt/bln        | [S8] Rorix $200–$500; ID VPS Rp 300k–5jt [S6]                            |
| **Founding Partner discount**                           | **25% off tier price**, first 2–3 buyers only | —                   | exchanged for case study + 2 reference calls                             |

### 1.2 How to quote a deal (the 4-step recipe)

1. **Discovery** → map the request to a tier (site count + user count).
2. **Customization** → list each item from §4's rate card, quote the range midpoint in writing.
3. **Discount** → apply Founding Partner (25%) only if no case study exists yet for the tier; otherwise 0–10% for cash upfront.
4. **Total = (Tier × (1−discount)) + rate-card subtotal − pilot credit (cap = pilot fee paid).**

**Never** quote below Tier 1 − 25% ($9,000). **Never** discount customization packages (cut scope instead). **Never** quote above $80,000 for a single buyer without an in-person site visit and a 2-site pilot — above that you are competing with multi-vendor RFPs you cannot win alone.

> Why these numbers, not RESEARCH.md §7's $15K–$45K: §7 was US/EU-anchored. Section 7 of _this_ doc shows a $45K tier is unmarketable to first Indonesian buyers; $12K/24K/40K is the defensible bridge from local willingness-to-pay to export-anchored value (§7, §8).

---

## 2. What WMS actually costs the market

| Buyer profile                                      | License / subscription                           | Implementation (services)                                               | Typical year-1 total               | Source        |
| -------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------- | ---------------------------------- | ------------- |
| **Small cloud SaaS** (≤10 users)                   | $150–$500 /user/mo → $1,250–$10,000/mo           | $5,000–$25,000 (entry)                                                  | **~$25,000**                       | [S1][S3]      |
| **Mid-market SaaS** (10–50 users)                  | $200–$400 /user/mo                               | $60,000–$200,000                                                        | **$100,000–$300,000**              | [S1][S3][S5]  |
| **On-premise perpetual** (per facility)            | $2,500–$200,000+ one-time + **10–20%/yr maint.** | $10,000–$300,000+                                                       | **$50,000–$150,000 (single site)** | [S1][S2][S12] |
| **Mid-market on-prem (RFP)**                       | $100,000–$500,000 perpetual + 15–22% maint.      | rolled in                                                               | **$150,000–$700,000**              | [S2][S4][S9]  |
| **Enterprise / 3PL**                               | $500,000–$2M+ perpetual                          | $350,000–$1.5M                                                          | **$1M–$3M+**                       | [S2][S4]      |
| **Custom-built single-site WMS + ERP integration** | — (build = licence)                              | $30,000–$64,000 build, 8–12 wk, **100% source ownership**               | **$30,000–$64,000**                | [S1]          |
| **Indonesia off-the-shelf SaaS**                   | Rp 500k–5jt/mo (small) · Rp 5–25jt/mo (mid)      | —                                                                       | —                                  | [S6]          |
| **Indonesia custom WMS**                           | —                                                | Rp 50–150jt (basic) · Rp 150–500jt (mid) · Rp 500jt–miliar (enterprise) | —                                  | [S6]          |
| **Indonesia custom business app (generic)**        | —                                                | Rp 40–400jt (multi-module ≤5)                                           | —                                  | [S7]          |

**Two ratios that drive this doc's model:**

- **Licence is only 30–50% of project cost.** The rest is services/integration/data migration. ([S1] "implementation often = year of licences"; [S5] "licence is only 30–40% of total"; davanti-wics 40–60% [S12]).
- **On-premise maintenance = 10–22% of licence/yr** ([S1] 10–20%, [S2] 15–22%, [S4] 18–22%, [S9] 15–22%). Perpetual licence "pays back" in 5–7 years vs SaaS (RESEARCH §1, [S12]).

**Directly comparable product to ours:** Rorix's _custom-built, source-code-ownership_ single-site WMS with ERP integration at **$30K–$64K** [S1]. **This is the strongest competitor reference price** and the anchor for our Tier 2/Tier 3.

---

## 3. The three pricing models compared (for _this_ situation)

| Model                                                          | How it works                                         | Pros (for this seller)                                                                                                                                             | Cons                                                                                                                                                                                                                | Verdict                                                                                                                    |
| -------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **(a) Fixed tier + paid customization rate card**              | 3 tier prices, customize priced per workflow package | Buyer compares on **total**, not per-module; protects margin on surprises; easy for a novice to quote; meets the buyer's RFP framing (they already evaluate total) | Needs a written scope boundary (OFFER-SPEC §3) or scope creep                                                                                                                                                       | ✅ **Recommended**                                                                                                         |
| **(b) Value-based pricing** (anchor to customer's annual loss) | Price = % of saved losses                            | Highest theoretical ceiling; best for mid-market/export                                                                                                            | Requires a CFO/ops buyer who can _quantify_ the loss; most Indonesian SME buyers cannot; risk of anchoring _downward_ if their quantified loss is small                                                             | ✅ **Use as a negotiation ceiling**, not a posted price. Apply inside discovery: "your reconciliation burden is ~Rp X/yr". |
| **(c) Hourly / day-rate services only**                        | Charge $/hr for everything                           | Simple, honest, zero scope risk                                                                                                                                    | Caps revenue at hours; no ownership story; the buyer's RFP expects a "total project" number; a solo dev at $75/hr × 300 hrs = $22.5K, _below_ what the same package can earn as Tier 2; invites stop-watch haggling | ❌ **Do not use for the base deal.** Use only for out-of-package change orders.                                            |

**Why (a) wins here, specifically:**

1. The market _already_ compares on total ("license is only 30–40% of total" — buyers are trained to look at totals) [S5].
2. MIT licence (see §5) makes any gating strategy impossible; only whole-deal pricing works.
3. The 3 tier-sizes match the actual buyer segmentation in every pricing guide reviewed ([S1][S4][S5][S9]).

---

## 4. The customization rate card

**Day-rate anchor (the number under every range):** Indonesian senior developer market ≈ **$28–$45/hr** ([S10] "Indonesia $28–$45/hr", Smooets 2026). At 6 productive hrs/day → **$170–$270/day**. Philippine/regional day rate (bottom of SEA range). Export market: US senior $125–$250/hr, EU $50–$95 ([S10][S13]).

**Rule:** price each package at **1.5–2.5× raw day-cost** (this is the margin that makes the one-time model survive zero maintenance revenue for the first year). Do not publish the day-rate multiplier.

| Workflow package                                                                              | Est. effort   | Market reference                                | Rate card `[SUGGESTED]` USD                           | IDR @18,200   |
| --------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------- | ----------------------------------------------------- | ------------- |
| **Pipeline / workflow alignment** (1–2 transaction types, reorder steps, add captured fields) | 3–5 days      | included in custom WMS build [S1]               | **$900–$1,800**                                       | Rp 16–33 jt   |
| **Approval matrix** (thresholds by value/warehouse/role, per-entity approval history)         | 2–4 days      | — `[ESTIMATE]` (sub-feature of custom build)    | **$700–$1,500**                                       | Rp 13–27 jt   |
| **Roles & permissions** (map `resource@action` matrix, SoD recorder≠approver)                 | 2–3 days      | `[ESTIMATE]`                                    | **$500–$1,200**                                       | Rp 9–22 jt    |
| **Import/export templates** (XLSX format alignment, per entity)                               | 1–3 days/form | `[ESTIMATE]`                                    | **$300–$900/form**                                    | Rp 5–16 jt    |
| **Report pack** (dashboard arrangement, new filters/fields, up to 5 reports)                  | 3–5 days      | `[ESTIMATE]`                                    | **$800–$2,000**                                       | Rp 15–36 jt   |
| **Single-system API integration** (documented REST/DB pull-push; e-site or acc.)              | 2–5 wks       | **$5,000–$15,000** [S8]; ERP+WMS $25K–$75K [S8] | **$3,000–$8,000** (we're cheaper because WMS is ours) | Rp 55–146 jt  |
| **Multi-system / ERP integration**                                                            | 8–16 wks      | **$25,000–$75,000** [S8]                        | **$12,000–$30,000**                                   | Rp 218–546 jt |
| **Extra change order** (out of any package)                                                   | hourly        | US senior $125–250/hr [S10]                     | **$75/hr (ID) / $150/hr (export)**                    | —             |

**Cap rule:** total customization may not exceed **60% of tier price** without moving up a tier. If a Single-Warehouse buyer wants >$7,200 of customization, they are a Multi-Warehouse buyer (see §5).

---

## 5. Why not per-module pricing

Four concrete reasons grounded in the research:

1. **Buyers already normalise to total.** Every buyer guide reviewed tells the buyer to compute total project cost (licence + implementation + migration + training + maintenance) — [S1][S3][S5][S9]. A per-module sheet invites the buyer to mentally total it and compare against a competitor's quoted total, with no upside.
2. **Module pricing invites cherry-picking.** If receiving is $2K and putaway is $2K, a buyer buys only receiving, then asks you to make receiving "know about" putaway for free. You end up delivering the integrated system for a fraction of the price.
3. **MIT makes module gating impossible.** The repo is MIT-licensed (`LICENSE`) — anyone can fork and enable a module ([OFFER-SPEC §4](OFFER-SPEC.md)). Any per-module _price_ is unenforceable and self-defeating; only whole-package value (deployment + configuration + handover + support) holds.
4. **Per-module pricing signals _construction cost_, not _operational outcome_.** It starts the conversation at "how many lines of code" rather than "how much warehouse pain are we solving" — the failure mode called out in RESEARCH §7 ("price on buyer value, not time") [S14].

**What to do instead:** price the tier on **value to the buyer**, and use §4's packages only for **deviations from the standard build within that tier**.

---

## 6. First-customer pricing strategy

| Element                           | Recommended                                                                                                                  | Evidence / guard                                                                                                                                                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pilot fee**                     | **$3,500** (single site, 1–2 workflows, 60–90 days)                                                                          | 10–30% of projected yr-1 value [S15]; PLAYBOOK Stage 6 says $3K–$8K. $3,500 = 10–30% of a $12K–$24K tier — bottom of band keeps it buyable by an SME.                                                               |
| **Credit mechanic**               | 100% credited against buyout if converted ≤30 days after pilot end; gift card→forfeit if not                                 | Standard paid-pilot norm [S15], RESEARCH §6.                                                                                                                                                                        |
| **Founding Partner discount**     | **25% off tier**, capped at **3 buyers**                                                                                     | 25% sits inside RESEARCH §7's "never >30%" and inside `[S9]`'s typical first-3-buyer discount range; equivalent to the "first 10–20 customers get ~50%" rule [S16] but tightened because our per-deal risk is high. |
| **What the discount buys**        | Written case study (before/after metrics), 2 reference calls, LinkedIn quote, permission to name                             | RESEARCH §6/§9; a reference call is worth more than a review for the first sale [S15].                                                                                                                              |
| **When 25% is not enough (rare)** | Add **one free customization package** (≤$1,800 value) or **extend support 90→180 days** — do **not** push discount past 30% | Cutting price >30% removes all margin to cover the first-deal overrun; RESEARCH §7.                                                                                                                                 |
| **When discount is 0**            | Any buyer who arrives via referral from a paying customer, or a second buyer in the same tier                                | You already have proof in that tier.                                                                                                                                                                                |

**Why discounts are standard at all:** early buyers absorb risk (no reviews, no references, unproven post-handover support). The 25% is the _price of a reference_ — treat it as a marketing line item, not a revenue discount.

---

## 7. Indonesia / SEA reality check (honest version)

The RESEARCH.md §7 anchors ($15K–$45K base, $30K–$150K mid) are **US/EU-market** numbers ([S1][S2][S4][S9]). An Indonesian distributor's actual willingness-to-pay is materially lower.

### Willingness-to-pay evidence (Indonesia)

| Data point                                            | Value                                                                                 | Source               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------- |
| Local generic custom software (multi-module, ERP-ish) | Rp 40–400 jt (**$2.2K–$22K**)                                                         | [S7]                 |
| Local **custom WMS** (basic → mid → enterprise)       | Rp 50–150jt / 150–500jt / 500jt+ (**$2.7K–\$8.2K / \$8.2K–\$27.5K / \$27.5K+**)       | [S6]                 |
| Local off-the-shelf WMS SaaS                          | Rp 500k–5jt / mo (small); Rp 5–25jt / mo (mid) (**\$27–\$275/mo / \$275–\$1,374/mo**) | [S6]                 |
| Local WMS implementation (setup/customization)        | Rp 5–50jt (**$275–$2,747**)                                                           | [S6] (inventoryflow) |
| Local ERP starter packages                            | Rp 15–25jt (**$824–$1,374**)                                                          | [S6][S7]             |
| Local senior dev market rate                          | $28–$45/hr                                                                            | [S10]                |

### Buying-power mirror

A US/EU mid-market single-site WMS is $50K–$150K [S2][S4]; an Indonesian custom WMS at the top of the local range is $27K+. That's a **~2–5× gap**. But a locally _built_ full WMS with source (what we have) sits structurally at the **top** of the Indonesian custom range, because it replaces a 6–12 month build that a local software house would charge Rp 150–500jt for (§2, [S6][S7]).

### Recommended dual pricing

| Tier       | **Exported / international price** (USD, anchors RESEARCH §7) | **Indonesian local price** (USD / IDR @18,200)                                               | Who pays local                                       |
| ---------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Single     | $12,000                                                       | **~$8,000 / Rp 146 jt** `[ESTIMATE: 33% below export, between basic & mid local custom WMS]` | 1-warehouse distributor, <15 users, local IT support |
| Multi      | $24,000                                                       | **~$15,000 / Rp 273 jt** `[ESTIMATE]`                                                        | multi-site 3PL or FMCG distributor                   |
| Enterprise | $40,000                                                       | **~$27,000 / Rp 491 jt** `[ESTIMATE]` (top of local custom WMS)                              | group with own IT + integration budget               |
| Pilot      | $3,500                                                        | **$2,000 / Rp 36 jt** `[ESTIMATE]`                                                           | all local                                            |
| Rate card  | §4                                                            | **rate card × 0.7** `[ESTIMATE]`                                                             | all local                                            |

**Rule of thumb to apply at quote time:** if the buyer's HQ is Indonesia and their accountant is driving procurement → local price. If the buyer is a foreign-owned 3PL operating in Indonesia (DHL/DFM/local partner of a US client) → export price. **Do not publish the local price on the public pricing page**; publish the export price and negotiate down to local.

**$45K be honest:** a $45K single-tier price **will not close** with an Indonesian SME in 2026. It may close with a foreign-owned 3PL or a Jakarta-listed group — but those close on RFP, 6–12 months, and you will lose to incumbents. Price local; earn the export price with proof.

---

## 8. Worked quote example (2-warehouse distributor, Jakarta)

> "PT Sinar Gudang" — 2 warehouses (Cikarang, Surabaya), ~30 users, uses Accurate for accounting, wants receiving→putaway→picking→dispatch adapted to their actual racking and SOPs, plus a CSV feed from their e-commerce channel, plus a monthly stock-movement report their finance team approves.

| Line                               | Package / tier                                           | Rate-card range | **Quoted**                                                     |
| ---------------------------------- | -------------------------------------------------------- | --------------- | -------------------------------------------------------------- |
| Base                               | **Tier 2 — Multi-Warehouse**                             | —               | **$24,000**                                                    |
| Customization 1                    | Pipeline alignment (2 sites, receiving + dispatch)       | $1,800–$3,600   | **$2,600**                                                     |
| Customization 2                    | Approval matrix (finance signs off on stock adjustments) | $700–$1,500     | **$1,100**                                                     |
| Customization 3                    | Roles & permissions (2-site with SoD)                    | $500–$1,200     | **$800**                                                       |
| Customization 4                    | Report pack (finance stock-movement + aging)             | $800–$2,000     | **$1,300**                                                     |
| Customization 5                    | Single-system integration (e-commerce CSV feed)          | $3,000–$8,000   | **$4,500**                                                     |
| Customization 6                    | Import templates (Accurate ↔ WMS item master + COA)      | $600–$1,800     | **$1,000**                                                     |
| **Subtotal**                       |                                                          |                 | **$35,300**                                                    |
| Founding Partner −25% on base only | Tier 2 $24,000 × 0.75                                    | —               | −$6,000                                                        |
| **Total**                          |                                                          |                 | **$29,300 / Rp 533 jt**                                        |
| **Local adjustment**               | ×0.75 if Indonesian SME only                             | —               | **$21,975 / Rp 400 jt**                                        |
| Pilot fee (already paid)           | credited                                                 |                 | −$3,500                                                        |
| **Final**                          |                                                          |                 | **$25,800 / Rp 470 jt (export) · $18,475 / Rp 336 jt (local)** |

**Payment schedule:** 30% signing ($7,740/$5,542), 40% go-live, 30% handover sign-off. **Maintenance (optional):** 15% of net licence = $3,600/yr export / $2,700/yr local.

**What this example shows:** the rate card carries the "different workflows" problem, not the tier price. That is why we price by tier + packages: no two buyers total the same, but the tier name and base price stay comparable in the buyer's RFP.

---

## 9. The 5 numbers to decide now

| #   | Decision                      | **Recommended**                                                                                                                                                                     | One-line justification                                                                                                                                                             |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Tier prices**               | $12K / $24K / $40K (USD, export); local 0.7×                                                                                                                                        | Top of the Indonesian custom-WMS range minus a defensible discount to a first buyer; baseline undercut vs Rorix's $30K–$64K custom build [S1].                                     |
| 2   | **Licence model**             | Keep **MIT**; sell delivery + configuration + deployment + 90-day support + optional 15% maintenance; **add a private `COMMERCIAL.md` with a _future-versions_ commercial licence** | MIT cannot be revoked; only the _service wrapper_ is defensible ([OFFER-SPEC §4](OFFER-SPEC.md)). The commercial future-version licence gives export buyers something MIT doesn't. |
| 3   | **Pilot fee**                 | **$3,500** export / $2,000 local; 50% upfront / 50% day 30; 100% credited ≤30 days                                                                                                  | Bottom of the 10–30% of year-1 band [S15], buyable by a hesitant first SME.                                                                                                        |
| 4   | **Founding Partner discount** | **25% off tier only** (never off rate card), **cap 3 buyers**, in exchange for case study + 2 references                                                                            | Inside RESEARCH §7's >30% floor and typical first-buyer discounts [S16]; pays for the reference it produces.                                                                       |
| 5   | **Customization cap**         | **60% of tier price** as the ceiling before moving up a tier; single-workspace per-package cap per §4                                                                               | A Single-Warehouse buyer who needs >$7,200 of customization is a Multi buyer in disguise; cap prevents the "we padded a cheap tier" objection.                                     |

---

## 10. Risks and guardrails

| Risk                                                                          | What it costs                                                   | Guardrail                                                                                                                                                            |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scope creep** (buyer keeps adding "just one more field")                    | Kills margin; first deal may overrun 30–50%                     | Written scope boundary (OFFER-SPEC §3); every change = rate-card change order at $75/hr; % cap in §9.                                                                |
| **Integration surprises** (their ERP has no docs, auth is behind a 3rd party) | $5K–$75K of unplanned work [S8]; the biggest single cost killer | Quote integrations as **time-boxed packages with explicit assumptions**; "documented REST or DB access" precondition; a paid discovery day for undocumented systems. |
| **Unpaid customization** (buyer delays final payment, then asks for changes)  | Full loss of leverage                                           | 30/40/30 payment; source handover only on final payment (OFFER-SPEC §4); customization delivered on staging copy.                                                    |
| **Buyer expects SaaS support**                                                | Unbounded support load                                          | "Best-effort, no SLA" in writing (OFFER-SPEC §5); maintenance is optional and 15%.                                                                                   |
| **Undercutting yourself via the local price**                                 | Buyer cross-checks and feels cheated                            | Publish only export price; everything below is a negotiated local rate — never call it a "discount", call it "regional pricing".                                     |
| **First-deal overrun on the _first_ build** (you under-estimate one workflow) | First deal nets ~0                                              | Budget 1.5× hours on the first deal; treat it as marketing spend; the case study is the return.                                                                      |

---

## 11. Sources (claimed and accessed 2026-11-26)

| #   | Source                                                                                                          | URL                                                                               | Date                 |
| --- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------- |
| S1  | Rorix — WMS cost 2026 (on-prem $2.5K–$200K; custom $30K–$64K w/ source; impl $10K–$300K+)                       | rorixtech.com/blogs/warehouse/how-much-does-a-warehouse-management-system-cost    | 2026-07-08           |
| S2  | CPCON — WMS cost 2026 (on-prem $100K–$500K perpet.; 15–22% maint.)                                              | cpcongroup.com/insights/article/warehouse-management-system-cost-guide            | 2026-03-11           |
| S3  | Morsa — WMS cost 2026 (impl $5K–$25K entry; $60K–$200K mid)                                                     | morsa.ai/guides/wms-cost                                                          | 2026-10-25           |
| S4  | ASC Software — WMS cost 2026 (on-prem $25K–$1M+; 18–22% maint.)                                                 | ascsoftware.com/blog/wms-cost                                                     | 2026-10-06           |
| S5  | OrderPilots — WMS implementation cost (licence only 30–40% of total)                                            | orderpilots.com/wms-implementation-cost-guide                                     | 2026-10-19           |
| S6  | Digisentra — Harga WMS (ID SaaS Rp 500k–25jt/mo; custom WMS Rp 50–500jt+)                                       | digisentra.com/blog/harga-wms-warehouse-management-system                         | 2026-06-11           |
| S7  | Sekawan Media — Biaya software custom 2026 (ID ranges by project type)                                          | sekawanmedia.co.id/blog/biaya-pembuatan-software-custom                           | 2026-10-18           |
| S8  | Abba Technologies — WMS integration cost (single $5K–$15K; ERP $25K–$75K)                                       | abbacustechnologies.com/how-much-does-it-cost-to-build-a-wms-integration          | 2026-09-24           |
| S9  | BinLogic — WMS cost 2026 (on-prem $100–500K; 15–22% maint.)                                                     | binlogic.io/blog/how-much-does-a-wms-cost-a-realistic-2026-breakdown              | 2026-07-29           |
| S10 | Smooets — Software house Indonesia 2026 ($28–$45/hr; US/EU comparison)                                          | smooets.com/blog/software-house-indonesia-complete-practical-guide-2026           | 2026-08-30           |
| S11 | Acquire.com — Jan 2026 multiples report (SaaS ~5.5× rev; median 3.9× profit)                                    | blog.acquire.com/acquire-com-biannual-acquisition-multiples-report-jan-2026       | 2026-02-11           |
| S12 | Davanti WICS — WMS implementation timeline (licence 40–60% of cost; £15–50K small)                              | davanti-wics.com/en/what-is-the-typical-wms-implementation-timeline               | 2025-10-21           |
| S13 | Dock30 — custom software cost 2026 (US $125–$250/hr; EU $50–$95)                                                | dock30.com/blog/custom-software-cost-2026                                         | 2026-07-07           |
| S14 | Chroma (via SOFTWARE-PRICING) — pricing on value, not time                                                      | softwarepricing.com/blog/pricing-to-value/                                        | 2026-11-15           |
| S15 | JetThoughts — paid pilot full guide (10–30% of yr-1 value)                                                      | jetthoughts.com/paid-pilot-full                                                   | (via RESEARCH.md §6) |
| S16 | LinkedIn — Founder early-customer discount rule (50% for first 10–20; we tighten to 25% for high per-deal risk) | linkedin.com/pulse/founders-guide-early-customer-discounts-siddharth-gangal-ybsyc | 2026-01-30           |
| S17 | Adyen — perpetual vs subscription (one-time + ~20% maint.)                                                      | adyen.com/knowledge-hub/perpetual-license                                         | 2026-11-09           |
| S18 | SoftwareAdvice — WMS pricing models (entry ~$146/mo; high-end $848–$1,349/mo)                                   | softwareadvice.com/resources/warehouse-management-software-pricing-models         | 2024-09-04           |
| S19 | Capterra — WMS pricing guide (published plans $31.10–$1,199/mo; avg $201)                                       | capterra.com/resources/warehouse-management-software-pricing-models/              | 2026-10-27           |
| S20 | G2 — WMS vendor pricing (COPERNICO $61–$154/user/mo; Cin7 Core from $349/5 users)                               | g2.com/products/copernico-wms-2025-10-01/pricing                                  | 2025-10-01           |
| S21 | TradingEconomics — USD/IDR (18,229 on 2026-11-25)                                                               | tradingeconomics.com/indonesia/currency                                           | 2026-11-25           |
| S22 | Decipher Zone — source-code escrow cost ($1.5K–$3.5K/yr + $250–$1K setup)                                       | decipherzone.com/blog-detail/source-code-escrow-for-startups                      | 2026-11-11           |
| S23 | Ceris — Real cost of custom software Indonesia (Rp 100–400jt; 15–20% maint.)                                    | ceris.id/blog/real-cost-custom-software                                           | 2026-05-15           |

**22 sources live-verified this session; 2 (`S15`,`S16`-partially) rely on RESEARCH.md's prior citation.** All others checked via TinyFish search + fetch on 2026-11-26.

> Sold-price benchmarks for **software businesses** (Acquire.com S11; ~5.5× revenue / 3.9× profit in Jan 2026) are _not_ relevant to a one-time per-customer licence — include them only if you ever sell the _whole business_, not one customer's copy.

---

_Derived from RESEARCH.md §7 and OFFER-SPEC.md; commit/push is manual._
