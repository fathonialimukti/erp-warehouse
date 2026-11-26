# Preparation Checklist — Step by Step

**Goal:** go from "working app + marketing docs" to "first paid pilot in 4–8 weeks, first full buyout
in 3–6 months" (see [`RESEARCH.md`](RESEARCH.md) — the old 2-month estimate was too optimistic).
**Rule:** finish each phase before starting the next. No application code is changed until you say "build it".

---

## Phase 0 — Decisions you must make first (1–2 days)

- [ ] **1. Product name.** Keep "WMS" publicly or rename? Everything else depends on this.
- [ ] **2. Pricing numbers.** Three **one-time** tiers (Single Warehouse / Multi-Warehouse / Enterprise = source code + custom pipelines). No monthly fee.
- [ ] **3. Delivery terms.** What exactly do they receive: repo handover method, license (internal use / modification / redistribution), what "customization" includes and excludes, what support after buyout costs.
- [ ] **4. Contact details.** Sales email, phone, calendar/booking link.
- [ ] **5. Route.** Confirm: software directories (recommended) + direct outreach. Flippa/Acquire only later if you have revenue.

---

## Phase 1 — Proof and assets (week 1)

- [ ] **6. Fill every `[PLACEHOLDER]`** in `docs/marketing/` (search the folder).
- [ ] **7. Demo environment.** A stable URL with seeded, fictional data (`/dashboard`, 3D layout, one draft approval, reports). Never demo on live customer data.
- [ ] **8. Visual assets.** Screenshots of dashboard, 3D warehouse view, inbound/outbound forms, reports; a short screen recording of the AI agent navigating/filling a form.
- [ ] **9. Get 3–5 real reviews.** Give early access to testers/customers and ask for honest reviews. G2 caps incentives at $100 and requires them to be labeled — follow that. You need ~20 reviews in 24 months for a Capterra Shortlist badge.
- [ ] **10. Brand kit.** Logo, one-line positioning ("Enterprise Systems That Think"), consistent colors (#0B5FFA / #0046CC).

---

## Phase 2 — Selling surface (weeks 2–4) — build step, do when ready

- [ ] **11. Marketing pages.** `/features`, `/pricing`, `/about`, `/contact`, `/faq` + shared navbar/footer, per `PLAN.md`.
- [ ] **12. Pricing page** from Phase 0 numbers; `marketingConfig.ts` is the single edit point.
- [ ] **13. Contact form delivery.** Currently client-side only — at minimum send to your email (or add a small endpoint). A lead that goes nowhere is a wasted listing.
- [ ] **14. Legal pages.** `/privacy` and `/terms` — directories and buyers ask for these. Source: `docs/ops/privacy.md`.
- [ ] **15. Basic SEO.** Per-page `<title>`, meta description, OG image; make the site crawlable.

---

## Phase 3 — Directory listings (week 5)

- [ ] **16. Create one `my.G2` account.** Add your product; enable G2, Capterra, GetApp and Software Advice listings in one pass.
- [ ] **17. Fill each profile.** Category: Warehouse Management Software. Pricing: one-time buyout. Add screenshots, description from `one-pager.md`, and your site URL.
- [ ] **18. Verify live.** A listing marked "Published" in the admin did not always appear on the live site during the 2026 migration — check each public page.
- [ ] **19. Ask for reviews from every user** through `my.G2` (one review now counts on all four sites).
- [ ] **20. Stay free at first.** Paid options (G2 Ads Clicks, Verified Leads, Buyer Intent) only after you've tested the free route. Ads Clicks has a $500/month minimum.

---

## Phase 4 — Outreach and pilot (weeks 6–8)

- [ ] **21. Build a target list.** Warehouses and distribution companies via LinkedIn and local business directories.
- [ ] **22. Cold outreach.** Use `email-templates.md` with all placeholders filled; track sends and replies.
- [ ] **23. Discovery calls.** Run `discovery-checklist.md` — lead with "which process do you want to change?" Capture answers verbatim.
- [ ] **24. Demo.** Use `demo-script.md`, jumping to the screens that match their answer.
- [ ] **25. First pilot customer.** Pick one design partner; agree in writing what pipelines get customized, the price, and the timeline.

---

## Phase 5 — Close and deliver (after week 8)

- [ ] **26. Contract / invoice.** One-time buyout scope, source-code license, customization boundary, support terms. Base it on `faq-objections.md`.
- [ ] **27. Deliver.** Hand over source, configure the pipelines/approvals/roles, test, go live.
- [ ] **28. Ask for a review.** Feed it into all four G2-owned sites, then repeat the cycle.

---

## What to do today (top 3)

1. Decide the **name, prices, and contact email** (Phase 0).
2. Fill the `[PLACEHOLDER]` tokens in `docs/marketing/`.
3. Set up a **demo URL** and capture screenshots — directories need visuals before you list.

## Dependencies to remember

- **Reviews need real users.** Without testers/customers you cannot build the social proof the directories reward. Solve this first.
- **Paid leads need a working contact form.** Finish Phase 2 before paying for clicks.
- **Directory listings are free.** You can list before the marketing site is perfect, but a strong `/pricing` and `/contact` page will convert far better.
