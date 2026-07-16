# Stock Movement Filter Redesign

**Date:** 2026-07-15
**Scope:** Frontend only — `apps/client/src/pages/stock-movement/StockMovementPage.tsx` + new custom components. No backend changes.

## Design

Transform the flat filter grid into a modern, interactive filter experience with:

### Components (NEW)

All in `apps/client/src/components/stock-movement/`:

1. **`FilterPill`** — Toggle button. Active = filled with accent color, inactive = outline. Supports `color` prop (`'accent'` | `'success'` | `'danger'`), optional icon, optional badge count.
2. **`FilterPillGroup`** — Wraps pills, manages single-select vs multi-select, optional "All" pill, horizontal scroll, overflow with "+N more" expandable.
3. **`ActiveFilterChips`** — Removable chips for each active filter with `×` button and "Clear all" link.
4. **`KpiStrip`** — 4 reactive stat cards (Total IN, Total OUT, Net Flow, Records) computed from current page data.
5. **`DateRangePresets`** — Preset pills (Today, 7d, 30d, This Month, Custom). "Custom" reveals two native `<input type="date">`.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Stock Movements                              [Clear all (n)] │
│  Immutable audit log of all approved inventory movements.    │
├─────────────────────────────────────────────────────────────┤
│  ┌─ KPI strip (4 reactive cards) ────────────────────────┐ │
│  │  Total IN    Total OUT    Net Flow    Records          │ │
│  │  +12,440     -8,320       +4,120      201              │ │
│  └────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  [🔍 Search document…]                                       │
│                                                             │
│  Direction   [All] [IN] [OUT]                                │
│  Date range  [Today][7d][30d][Month][Custom]                │
│  Type        [GR][FGR][CRR][MI][DO][SR][DS][TO][LO][FO]     │
│                                                             │
│  ▾ Advanced (Warehouse, SKU, custom date)                   │
├─────────────────────────────────────────────────────────────┤
│  Active: [IN ×] [7d ×] [Raw Material Hub ×]                 │
└─────────────────────────────────────────────────────────────┘
```

### Behavior

- **Direction pills** — single-select (All / IN / OUT). Uses `--success` for IN, `--danger` for OUT.
- **Date presets** — Today, 7d, 30d, This Month set `dateFrom`/`dateTo` automatically. Custom reveals two date inputs.
- **Type pills** — all 10 transaction types as compact pills with abbreviations. Single-select.
- **Advanced section** — collapsible. Contains Warehouse Select, SKU Select, and custom date inputs (shown when Custom preset is active).
- **Active filter chips** — every active filter renders as a removable chip. "Clear all" resets everything.
- **KPI strip** — computed from current page data: sum of positive `signedQty` = Total IN, sum of negative = Total OUT, difference = Net Flow, `meta.total` = Records.

### Locale keys to add

**en.json:**
```
stock_movement.kpi_total_in: "Total IN"
stock_movement.kpi_total_out: "Total OUT"
stock_movement.kpi_net_flow: "Net Flow"
stock_movement.kpi_records: "Records"
stock_movement.filter_all: "All"
stock_movement.filter_preset_today: "Today"
stock_movement.filter_preset_7d: "7d"
stock_movement.filter_preset_30d: "30d"
stock_movement.filter_preset_this_month: "Month"
stock_movement.filter_preset_custom: "Custom"
stock_movement.filter_advanced: "Advanced"
stock_movement.filter_advanced_show: "Show filters"
stock_movement.filter_advanced_hide: "Hide filters"
stock_movement.active_filters: "Active:"
stock_movement.clear_all: "Clear all"
stock_movement.filter_type_more: "+{count} more"
```

**id.json:** (translate all keys above)

### Files

| File | Action |
|---|---|
| `apps/client/src/components/stock-movement/FilterPill.tsx` | NEW |
| `apps/client/src/components/stock-movement/FilterPillGroup.tsx` | NEW |
| `apps/client/src/components/stock-movement/ActiveFilterChips.tsx` | NEW |
| `apps/client/src/components/stock-movement/KpiStrip.tsx` | NEW |
| `apps/client/src/components/stock-movement/DateRangePresets.tsx` | NEW |
| `apps/client/src/pages/stock-movement/StockMovementPage.tsx` | REWRITE filter panel |
| `apps/client/src/locales/en.json` | ADD ~15 keys |
| `apps/client/src/locales/id.json` | ADD ~15 keys |

### Constraints

- No new dependencies. Pure Tailwind + CSS custom properties + HeroUI primitives.
- Reuses existing `useListPage` spine, existing tRPC query (no backend changes).
- KPI strip uses already-returned page data + `meta.total`.
- All components must be accessible (keyboard navigable, proper ARIA).
- Follows HeroUI rules: no `className`/`classNames` on HeroUI components. Custom components are fine.
- Ponytail: each component is < 60 lines, single responsibility.
