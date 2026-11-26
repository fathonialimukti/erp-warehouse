# Marketing Material — WMS ("Enterprise Systems That Think")

This folder contains the reusable material for selling the WMS as a **one-time buyout** of the full application plus source code. It is written to be used as-is, with `[PLACEHOLDER]` tokens filled in by the deal owner before anything is sent externally.

> **Grounding rule:** everything here is drawn from `PRODUCT.md` and the real route catalog in `apps/client/src/routes.tsx`. No customer names, logos, testimonials, benchmarks, case studies, prices, or SLAs are asserted. Where a real number, price, email, URL, or timeline is required, a `[PLACEHOLDER]` token is used — do not send material with unfilled placeholders.

## Business model (read this first)

- **Offer:** one-time buyout of the entire WMS application **and its source code**. Not SaaS, no monthly/subscription fee.
- **What "customization" means:** adapting the customer's warehouse pipelines and workflows so the system fits how that company actually operates. It is _not_ building a different product. See `faq-objections.md` for the exact boundary and how to state it.
- **Buyer:** warehouses and distribution companies in general — operations staff who record transactions and the managers/department heads who approve and review them.
- **Positioning line:** "Enterprise Systems That Think."

## Index

| File                                                   | Purpose                                                                                                                             | When to use                                                  |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [`PLAYBOOK.md`](PLAYBOOK.md)                           | Research-backed best path: from nothing to closing, with inputs/outputs and a realistic 24-week calendar                            | Read first — the execution playbook                          |
| [`RESEARCH.md`](RESEARCH.md)                           | Deep research (69 sources, Nov 2026): channels, reviews, pricing, pilot, closing mechanics                                          | Evidence behind the playbook                                 |
| [`PLAN.md`](PLAN.md)                                   | The overall plan: marketing site pages, pricing tiers, 2-month timeline, open decisions                                             | Strategy and scope                                           |
| [`preparation-checklist.md`](preparation-checklist.md) | Step-by-step prep: decisions, assets, site, directory listings, outreach, first sale                                                | Work through this before listing anywhere                    |
| [`one-pager.md`](one-pager.md)                         | Product overview, audience, what's included, grounded differentiators, the buyout offer                                             | Leave behind after an intro call; attach to outreach         |
| [`discovery-checklist.md`](discovery-checklist.md)     | Structured questions to ask a prospect, each mapped to what gets customized in return                                               | Run at the start of the first call; capture answers verbatim |
| [`demo-script.md`](demo-script.md)                     | Timed, step-by-step demo flow using real screens/routes, with talking points and discovery tie-backs                                | Use when presenting the app live                             |
| [`faq-objections.md`](faq-objections.md)               | Answers to the standard objections (pricing, customization limits, deployment, source code, support, timeline, migration, security) | Keep open during calls; fill placeholders with real policy   |
| [`email-templates.md`](email-templates.md)             | Short outreach and follow-up templates with `[PLACEHOLDER]` fields                                                                  | Cold outreach, post-call recap, follow-up                    |

## How to use this

1. **Prepare:** before any external use, replace every `[PLACEHOLDER]` with the real value for this deal (pricing, your contact details, links, timeline, scope boundaries). Search the folder for `[PLACEHOLDER]` to find them all.
2. **Open with discovery, not a demo.** Start with `discovery-checklist.md` — lead with "which process do you want to change?" The answers drive which screens you emphasize in the demo.
3. **Demo with intent.** Use `demo-script.md` as a timed script, but jump to the screens that match the prospect's discovery answers. Every step has a "tie back to discovery" note.
4. **Leave something behind.** Send `one-pager.md` after the call, tailored to the one or two workflows the prospect cares about most.
5. **Handle objections honestly.** Use `faq-objections.md`. If a real policy or number is not documented, keep the placeholder and get it from the owner — never guess.
6. **Do not overpromise.** The documented transaction set and platform are bounded. Customization adjusts pipelines/workflows; it does not invent new product modules or undocumented transaction types unless separately scoped with the owner.

## Maintenance notes

- Routes are named in `demo-script.md` exactly as they appear in `apps/client/src/routes.tsx`. If routes change, update the script so demos reference real screens.
- Capability claims are grounded in `PRODUCT.md`. If the product changes, refresh `one-pager.md` and `faq-objections.md` from that source rather than from memory.
- This folder is sales documentation only — no application source code is owned or modified here.
