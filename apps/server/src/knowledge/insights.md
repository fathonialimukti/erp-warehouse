# Warehouse Insights & Proactive Health Monitoring

## Overview

**Warehouse Insights** provide a proactive health snapshot of inventory and operations. Instead of waiting for problems to surface (out-of-stock, dead stock accumulating, backlogs), the AI assistant can query the insights tool and narrate warehouse health in plain business language.

The `get_warehouse_insights` tool returns structured data that the AI translates into actionable summaries:
- **Dead stock value** — total value of SKUs with no movement in > 180 days
- **Out-of-stock SKUs** — SKUs with zero available pallets
- **Putaway backlog** — count of pallets created by inbound but not yet assigned to storage
- **Dispatch backlog** — count of pick lines still pending (outbound pallets not yet picked)

## When to Use Insights

The user might ask:
- "How is the warehouse doing?"
- "What needs attention today?"
- "Any dead stock I should clear?"
- "Summarize today's insights"
- "Show me warehouse health"

The AI calls `get_warehouse_insights`, then translates the response into concise business language (e.g., "You have $12,500 of dead stock across 8 SKUs; the top one to clear is Raw Material XYZ with $4,200 sitting idle for 240 days").

## Inventory Aging Thresholds

The warehouse uses these thresholds (same as the Inventory Aging Analyzer tools):
- **Dead stock** — no stock movement in > 180 days
- **Slow-moving** — no movement in 30–180 days
- **Active** — movement within the last 30 days

`StockMovement` records track every inventory transaction (`IN` when putaway completes, `OUT` when dispatch completes). The most recent movement date per SKU determines its aging bucket.

## Insights Tool Output

The `get_warehouse_insights` tool returns structured data with dead stock value, top dead SKUs by value, out-of-stock SKUs, putaway backlog (pallets awaiting location assignment), and dispatch backlog (pending pick lines).

## How the AI Should Narrate Insights

**Good:**
> "Your warehouse health snapshot: You have $12,500 of dead stock across 8 SKUs. The top one to clear is Rice Paddy 25kg (SKU: RM001) — $4,200 sitting idle for 240 days. You have 3 SKUs out of stock. Putaway backlog: 12 pallets waiting for locations. Dispatch backlog: 5 picks pending."

**Bad:**
> "generatedAt: 2026-07-13T..., deadStockValue: 12500, deadStockSkuCount: 8, ..." (raw JSON dump)

The AI must translate structured numbers into business-friendly language. No raw JSON.

## Related Workflows

- **Inventory Aging Analyzer tools**: `get_inventory_aging_summary`, `get_dead_stock_by_zone`, `get_aging_by_zone` — deeper aging breakdowns by SKU and zone.
- **Putaway**: See `putaway.md` for how pallets move from receiving into storage.
- **Dispatch**: See `dispatch.md` for how pallets move from storage to the dispatch area.
- **Stock movements**: See `database-schema.md` for how `StockMovement` records are written.

## Proactive Monitoring Pattern

The AI can proactively check insights when the user opens the warehouse layout page or dashboard, and surface critical issues:
- "I see you have 18 pallets waiting for putaway — want me to help assign them?"
- "You have $8,000 of dead stock in Zone A — should I list the top SKUs?"

This shifts the AI from reactive ("help me pick this pallet") to proactive ("I noticed you have a backlog").
