# Execution Analysis — Putaway & Pick

## Purpose

This document defines how to analyze putaway and pick **execution**: whether work is getting done, where it is stuck, and what to fix. Use it whenever asked to review warehouse execution, open work, throughput, or bottlenecks in putaway (inbound) or dispatch/picking (outbound). Always ground every observation in the data described below and express it in plain language — numbers first, explanation second.

## Data Sources

Analysis is built from the line tables, their pallets, and their locations:

### putaway_lines
- `id` (TEXT, PK, ULID)
- `transaction_type` (ENUM: RECEIVING, WIP_COMPLETION, RMA_RECEIPT, FOUND)
- `document_id` (TEXT — parent inbound transaction)
- `pallet_id` (TEXT, FK → pallets.id, UNIQUE)
- `storage_location_id` (TEXT, FK → storage_locations.id, nullable — **null means the line is not yet assigned to a location**)
- `status` (ENUM: PENDING, COMPLETED)
- `completed_at` (TIMESTAMP, nullable)
- `completed_by_id` (TEXT, FK → users.id, nullable)
- `created_at` (TIMESTAMP — line age is measured from here)

### pick_lines
- `id` (TEXT, PK, ULID)
- `transaction_type` (ENUM: WIP_ISSUE, SHIPMENT, RETURN_TO_SUPPLIER, DISPOSAL)
- `document_id` (TEXT — parent outbound transaction)
- `pallet_id` (TEXT, FK → pallets.id, UNIQUE)
- `from_location_id` (TEXT, FK → storage_locations.id, nullable)
- `status` (ENUM: PENDING, COMPLETED)
- `assigned_at` / `assigned_by_id` (TIMESTAMP / FK → users.id, nullable — **null means the line is not yet assigned a pick**)
- `completed_at` / `completed_by_id` (TIMESTAMP / FK → users.id, nullable)
- `created_at` (TIMESTAMP — line age is measured from here)

### Supporting
- `pallets` — `sku_id` (for SKU mix), `status` (AVAILABLE / NOT_AVAILABLE), `storage_location_id`
- `storage_locations` — `id` in format `WH01/<TYPE>/<NNNN>`, `warehouse_id`, `status` (ACTIVE / MAINTENANCE / FULL)
- `stock_movements` — confirms whether goods actually moved in/out of the warehouse

## Aging

A line's age is the number of days between its `created_at` and today.

- Always report aging for `PENDING` lines: count how many are 0–1 days, 2–3 days, 4–7 days, and over 7 days old.
- Always identify the **oldest pending lines** and call them out individually — these are the first candidates for follow-up.
- If any line is older than 7 days, flag it as stale and suggest investigating why (e.g. missing assignment, blocked document, unconfirmed staging).

## Backlog Counts

The backlog is the set of `PENDING` lines.

- Report the total count of pending putaway lines and pending pick lines, each split by `transaction_type`.
- Group pending lines by parent document (`document_id`) and by warehouse (via the pallet's location or the document's warehouse). Report the top groups — a document or warehouse carrying most of the backlog is the highest-leverage place to act.
- Distinguish the two causes of backlog: lines that are **unassigned** (see next section) vs. lines that are assigned but not yet confirmed/completed.

## Assigned vs Unassigned

- A putaway line is **assigned** when `storage_location_id` is set; otherwise it is unassigned.
- A pick line is **assigned** when `assigned_at` is set; otherwise it is unassigned.
- Report the assigned/unassigned split for pending lines, and list the unassigned ones explicitly. Unassigned lines are blocked on a decision and should be presented with their pallet and SKU so someone can assign them.
- If most pending lines are assigned but old, the bottleneck is confirmation/completion rather than decision-making.

## Completion Rate

- Per document: `completed / total` lines, reported as a percentage along with the document's derived status (PENDING = 0/N, PARTIAL = some, COMPLETED = all).
- Overall: completed putaway lines vs. total putaway lines, and the same for pick lines.
- Note that inventory only changes when a document is **fully** completed: stock movements are not written for partial completion. So a document at 80% does not yet affect inventory — say so when a user asks whether goods are on hand or shipped.

## SKU Mix

- Report which SKUs make up the pending backlog (putaway and pick separately), by line count.
- Surface patterns worth acting on: many pending lines of the same SKU (consolidation opportunity), or a single SKU dominating the backlog (possible supply or demand issue).
- When relevant, tie SKU type (`RAW_MATERIAL`, `PACKAGING_MATERIAL`, `FINISHED_GOOD`) to the location types in play — e.g. raw/packaging material waiting for floor space, finished goods waiting for rack space.

## Bottlenecks

Look for these recurring patterns and name them explicitly:

- **Document blockage** — one transaction holds many pending lines; everything else is done. Recommend finishing that document first.
- **Unassigned buildup** — many lines sit unassigned: the decision step is the bottleneck.
- **Location pressure** — the warehouse or a zone (e.g. all `FLOOR` slots full or `MAINTENANCE`) is preventing assignment. Verify with `storage_locations.status` and the empty-location count before claiming space pressure.
- **Oldest-first violation** — pick lines not completing in reservation order suggests staging/confirmation issues.
- **Warehouse imbalance** — one warehouse (of several) carries most pending lines.
- **Slow completion** — lines complete but very late (large gap between `created_at` and `completed_at`).

## Per-Transaction Summaries

For a single transaction, produce a compact summary with:

- Document id and type, derived status (PENDING / PARTIAL / COMPLETED), and line counts (total, completed, pending).
- Oldest pending line age, and how long the document has been open since its approval.
- Assigned vs unassigned among pending lines.
- SKU breakdown of the lines.
- For outbound: reservation order vs. completion order of the pick lines (oldest first?).

End with a one-sentence takeaway: what is healthy, what is stuck, and the single best next action.

## How to Present

- Summaries first (one or two sentences), detail second (tables or lists).
- Use concrete numbers and document/line ids, never vague phrases like "some work is old".
- Never invent data: if a number is unknown or a table is missing, say so.
- Frame every finding as an actionable observation tied to the guidance in the putaway and dispatch documents (consolidation, nearest-first, oldest-first, zone routing).