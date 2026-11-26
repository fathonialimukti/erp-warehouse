# FAQ & Objections

Use these answers on calls. Where the real policy, price or number is not documented, the answer contains a `[PLACEHOLDER]` — **get the real value from the owner before sending**. Never invent a price, benchmark, customer, case study, or SLA.

---

## Pricing / one-time buyout vs. subscription

**Q: Why a one-time buyout instead of a monthly subscription?**

**A:** "This is a one-time purchase of the full WMS application **and its source code** — not SaaS, and there's no monthly fee. You own the system. Alongside the buyout, we adjust your warehouse pipelines and workflows to fit how your company operates. Pricing is `[PLACEHOLDER: one-time buyout price, what it includes, tiers/options]`."

**Q: What does the price include?**

**A:** "[PLACEHOLDER: exact inclusions — application, source code, workflow customization scope, delivery, any optional items]."

**Q: Isn't ongoing maintenance worth paying for?**

**A:** "The buyout covers the application and source code; what's included for updates/support after delivery is `[PLACEHOLDER: real support/maintenance terms — see the support objection below]`. We'll put exactly what's included in writing."

---

## "Customized pipelines" — what it means and its limit

**Q: What do you mean by "we'll customize it for us"?**

**A:** "It means adapting your warehouse pipelines and workflows — the order of steps, the rules, the fields captured and the approvals — so the system fits how your company actually operates. For example, how a receiving or dispatch flow runs in your warehouse, and who signs off at each stage."

**Q: What's the limit? What won't you build?**

**A:** "Customization works within the system's documented transaction types and platform. We configure flows around the supported screens — receiving, found, RMA receipt, WIP completion, shipment, disposal, loss, return-to-supplier, WIP issue, subinventory transfer, stock count, purchase order, pallets, warehouses, SKUs/products/suppliers — and the approval and permission rules around them. It does **not** mean building brand-new transaction types or entirely new product modules outside that set, or undocumented third-party integrations. If you need something outside that boundary, we'll scope it separately with the owner rather than promise it."

> **Owner note:** keep this boundary explicit. `[PLACEHOLDER: confirm the precise in-scope vs out-of-scope customization list with the owner and use that exact wording externally]`

---

## Deployment — desktop (Tauri) + web

**Q: Does it run on our warehouse floor PCs and in the browser?**

**A:** "Yes. The same React application ships as a Tauri desktop app and as a web app — one codebase, so features ship in both. Desktop gives an install-once, offline-capable presence on the floor; web gives remote managers access."

**Q: Where is data stored?**

**A:** "The app uses PostgreSQL via Prisma. With the buyout and source code, deployment and data placement are under your control — `[PLACEHOLDER: real deployment options, infrastructure requirements, and any hosting/support offering]`."

---

## Source code ownership

**Q: Do we actually get the source code?**

**A:** "Yes — the one-time buyout includes the full application source code. `[PLACEHOLDER: exact delivery list / repository handover method]`."

**Q: What license / what can we do with it?**

**A:** "`[PLACEHOLDER: real license terms — modification rights, internal use, redistribution, sublicensing, ownership of customizations]`. The owner should confirm the exact license wording before this is put in writing."

---

## Support / maintenance after buyout

**Q: What happens if something breaks after we go live?**

**A:** "Because you own the source code, your team can maintain and modify the system directly. Any additional support or maintenance arrangement with us is `[PLACEHOLDER: real support/maintenance offering, response times, and terms — no SLA is documented; do not state one]`. We'll confirm what's included in the buyout versus what's a separate arrangement."

**Q: Do you provide training?**

**A:** "`[PLACEHOLDER: real training offering and whether it is included]`. The integrated WMS AI assistant also helps users learn screens and forms by navigating and filling them on command."

---

## Implementation timeline

**Q: How long until we're live?**

**A:** "That depends on the scope of workflow customization, data migration and your deployment environment. We'll give you a written timeline after discovery. Indicative phases: discovery → customization of pipelines/approvals/roles → data setup and migration → testing → go-live. Timeline: `[PLACEHOLDER: real timeline / phase durations]`."

---

## Data migration

**Q: Can you bring over our existing stock, SKUs and pallets?**

**A:** "We can plan a migration of your master data and opening balances. The app supports XLSX import/export, which we can use where formats align. Scope and approach depend on your current source systems — see the integrations item in the discovery checklist. Migration scope/approach: `[PLACEHOLDER: real migration scope, format requirements, and who performs it]`."

---

## Security / permissions

**Q: How do you control who sees and does what?**

**A:** "Every route and action is gated by `resource@action` permission pairs, and a role/permission matrix drives UI visibility. Authentication is JWT cookie-based with protected routes. Approval history is tracked per entity, and activity logs are available for audit."

**Q: Can we enforce that the person who records a transaction cannot approve it?**

**A:** "Yes — that kind of segregation of duties can be configured through roles and approval rules. We'll map your approval matrix during discovery. Specific security/compliance requirements: `[PLACEHOLDER: record and confirm any compliance or audit requirements — do not claim certifications that are not documented]`."

---

## Quick reference — never assert without a real value

- Customer names, logos, testimonials, case studies, benchmarks
- Prices, discounts, payment terms
- SLA / uptime / response-time targets
- Certification or compliance claims
- Integration capabilities not documented in the product
- Delivery dates or timelines
