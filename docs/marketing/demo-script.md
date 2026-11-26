# Demo Script — WMS ("Enterprise Systems That Think")

A timed, ~35-minute flow using the **real screens/routes** in `apps/client/src/routes.tsx`. The script is a spine, not a rigid track: jump to the steps that match the prospect's answers from [`discovery-checklist.md`](discovery-checklist.md), and skip what is irrelevant. Every step includes a talking point and a discovery tie-back.

> **Use a sandbox/demo dataset with clearly fictional data.** Never demo against live customer data. All routes below are relative to the app base URL `[PLACEHOLDER: demo URL]`.

## Before you start (2 min)

- Confirm the prospect's answer to **"which process do you want to change?"** and write it where you can see it.
- Have demo data ready: at least one warehouse with a layout, a few SKUs/pallets, one draft transaction ready to approve, and one completed transaction for reporting.
- Decide: show desktop (Tauri) first or web first? Match their deployment preference from discovery.

---

## Step 0 — Frame the demo (2 min) · `/` or `/login`

**Show:** landing/sign-in; mention the product name and positioning line.

**Talking point:** "Enterprise Systems That Think. Today I'll show the system following one real stock flow — and where it can be adapted to the way your warehouse works. Before I show anything, remind me: which process did you say you want to change?"

**Tie back to discovery:** Restate their process-to-change answer in one sentence and tell them which steps you'll focus on. Everything after this should serve that answer.

## Step 1 — The operating picture (3 min) · `/dashboard`

**Show:** dashboard KPIs and navigation; note the dark/light toggle and language switch if visible.

**Talking point:** "This is the day-to-day view — what's moving, what needs attention, what's waiting on approval. It's the same application on desktop and in the browser, so floor staff and remote managers see the same picture."

**Tie back to discovery:** If they said reporting/visibility is the pain, linger here. If they named a transaction process, move quickly to Step 2.

## Step 2 — Where stock lives (4 min) · `/warehouse`, `/warehouse/:id/layout`

**Show:** warehouse list → a warehouse → the **3D layout** at `/warehouse/:id/layout`. Rotate/zoom the layout to show pallet positioning.

**Talking point:** "Stock isn't just a number — you can see where pallets actually sit. This 3D warehouse visualizer shows real-time pallet positioning. This is the 'visibility' part of the positioning: spatial understanding, not just a table."

**Tie back to discovery:** If they described putaway/slotting or location problems, this is your key slide — ask "is this the view your team is missing today?" If warehouse/location count came up, point to how the structure is organized.

## Step 3 — Inbound, at their granularity (5 min) · `/inbound-transaction`, `/inbound-transaction/receiving/new`

**Show:** inbound transaction list → open a receiving form → point out SKU and pallet fields.

**Talking point:** "Inbound covers receiving, found stock, RMA receipts and WIP completions. Transactions are recorded at SKU and pallet granularity. The pipeline — the sequence of steps and the fields captured — is what we adjust to fit how your operation runs."

**Tie back to discovery:** If they said receiving/putaway is the process to change, walk the form slowly and ask which fields or steps differ in their warehouse. If they named RMA or WIP, open that specific sub-type instead.

## Step 4 — Approval in the flow (4 min) · transaction detail at `/inbound-transaction/receiving/:id` (or an outbound detail)

**Show:** a draft transaction → its DRAFT → PROPOSED → APPROVED/REJECTED states and approval history.

**Talking point:** "Every transaction type flows through approval, with history tracked per entity. Managers approve; operators record. The rules for who approves what are part of the customization."

**Tie back to discovery:** If approval rules or segregation of duties came up, stop here and map their approval matrix onto the flow. If not, keep it brief.

## Step 5 — Outbound and dispatch (5 min) · `/outbound-transaction`, `/outbound-transaction/shipment/new`

**Show:** outbound list → a shipment → mention disposal, loss, return-to-supplier and WIP issue as sibling types.

**Talking point:** "Outbound covers shipment, disposal, loss, return-to-supplier and WIP issue. Managers can monitor the dispatch queue and see what's ready to go."

**Tie back to discovery:** If picking/dispatch/returns/WIP was their answer, this is the core step — open the relevant sub-type and align to their local terms.

## Step 6 — Stock reality and movement (3 min) · `/stock-movement`, `/pallets`, `/inventory-aging`

**Show:** stock movement → a pallet detail → inventory aging.

**Talking point:** "Stock movement is real-time across warehouses and locations. Inventory aging shows what's been sitting — useful for slow movers and expiry risk."

**Tie back to discovery:** If aging/expiry or slow-moving stock was a pain, emphasize the aging and expiry views. If pallet-level control matters, stay on `/pallets`.

## Step 7 — Reports managers actually use (4 min) · `/reports/monthly-stock-movement`, `/reports/charts`, `/reports/expiry`

**Show:** monthly stock movement with SKU-level drill-down → chart dashboard → expiry report.

**Talking point:** "Reporting is built in: monthly stock movement with SKU detail, inventory balance, aging, expiry and chart dashboards. We can configure which views and filters your managers see most."

**Tie back to discovery:** Match the report list to their reporting-needs answer. If they named a specific report, open it directly.

## Step 8 — The AI agent (5 min) · in-app "WMS AI" chat panel; `/knowledge`, `/ai-admin`

**Show:** open the integrated WMS AI chat panel. Demonstrate one command end-to-end: ask it to **navigate to a page**, then **fill a form** or **read page context**. If helpful, show the knowledge base at `/knowledge` that powers retrieval.

**Talking point:** "This is WMS AI — an agent built into the system, not a separate product. It retrieves answers from the knowledge base, navigates to pages, fills forms and reads page context, so people focus on exceptions. That's the 'think' in 'Enterprise Systems That Think.'"

**Tie back to discovery:** If form-filling or training/new-staff onboarding was a pain, this is the differentiator to dwell on. Ask "who would use this in your team?"

## Step 9 — Control and deployment (3 min) · `/access-control/roles`, `/users`, `/settings`, `/settings/backup`, `/activity-logs`

**Show:** roles matrix → a user → settings/backup → activity logs. Then state the deployment and ownership points.

**Talking point:** "Access is permissioned — every route and action is gated by `resource@action` pairs, and the role matrix drives what each person sees. The same system runs as a Tauri desktop app on the floor and in the browser for remote management. And this is a one-time buyout: you own the application and its source code, with workflows customized to your operation."

**Tie back to discovery:** Map the roles screen to their org chart and roles answer. If deployment/security came up, this is the place to address it.

## Close — Recap and next step (2 min)

**Talking point:** "We covered [their process-to-change answer] end to end: record, approve, see it in 3D, report on it, with an AI agent to help. What we'd customize for you is the pipeline and rules around those screens. Next step: I'll send the one-pager and a written summary of what we'd configure, plus `[PLACEHOLDER: pricing / proposal document]`."

---

## Demo guardrails

- **Don't invent.** Only claim screens and capabilities that exist. If asked for something undocumented (a new transaction type, an external integration, a specific SLA), say "that's outside the documented set — let me confirm scope with the owner," and use a `[PLACEHOLDER]` in follow-up.
- **Don't quote price or SLA live** unless the owner has supplied a real value. Use the placeholder and follow up in writing.
- **Stay on their process.** If you feel the demo drifting into features unrelated to their answer, cut it and return to Step 0's chosen flow.
- **Route drift:** if routes change in the code, update the paths in this script before the next demo.
