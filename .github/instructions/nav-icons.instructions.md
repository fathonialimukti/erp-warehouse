---
description: "Use when creating or editing nav menu SVG icons in apps/client/src/assets/icons/, or when registering icons in NavIcons.tsx / referencing them in nav-menu.ts. Covers the flat minimalist tile spec, per-domain color palette, naming, and registration steps."
applyTo: "apps/client/src/assets/icons/**,apps/client/src/assets/NavIcons.tsx,apps/client/src/constants/nav-menu.ts,apps/client/src/components/Sidebar.tsx"
---

# Nav Icon Standard

All navigation menu icons in `apps/client/src/assets/icons/` follow a single, strict standard: **flat, colorful, minimalist app icons**.

## Icon Specification

Every `nav-*.svg` file MUST follow these rules:

| Property | Value | Reason |
|---|---|---|
| **viewBox** | `0 0 64 64` | 64-grid gives room for the rounded-square background + glyph |
| **Background** | Rounded square `rect x="2" y="2" width="60" height="60" rx="14"` | Light tinted background (10-20% opacity of domain color) |
| **Fill** | Light tinted color (no gradients) | Soft, modern aesthetic — no gradients, no glow, no shine |
| **Glyph** | Multi-color shapes (2-4 colors per icon) | Vibrant, distinctive glyphs that use complementary colors |
| **Stroke glyphs** | When a line glyph is needed, use `stroke-width="3"` or `4` with domain color | Matches the visual weight of filled glyphs |
| **No `currentColor`** | — | Colors are fixed per-domain; the tile is the visual anchor, not the button state |
| **No `<defs>`** | — | No gradients, no IDs — eliminates SVG ID collision bugs |

## Template

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect x="2" y="2" width="60" height="60" rx="14" fill="#LIGHT_TINT"/>
  <!-- Multi-color glyph shapes below -->
  <rect x="12" y="12" width="18" height="18" rx="4" fill="#DOMAIN_COLOR"/>
  <circle cx="44" cy="22" r="6" fill="#ACCENT_COLOR_1"/>
  <path d="..." fill="#ACCENT_COLOR_2"/>
</svg>
```

## Color Palette (per domain)

Each domain has a fixed solid color. Do not reuse a color across unrelated domains.

| Domain | Color | Hex | Tailwind |
|---|---|---|---|
| Dashboard | emerald | `#10B981` | emerald-500 |
| Access Control | rose | `#F43F5E` | rose-500 |
| Users | sky | `#0EA5E9` | sky-500 |
| Roles | violet | `#8B5CF6` | violet-500 |
| Warehouses | emerald | `#10B981` | emerald-500 |
| SKUs | amber | `#F59E0B` | amber-500 |
| Suppliers | cyan | `#06B6D4` | cyan-500 |
| Products | pink | `#EC4899` | pink-500 |
| Activity Logs | slate | `#64748B` | slate-500 |
| Notifications | red | `#EF4444` | red-500 |
| Inbound | green | `#22C55E` | green-500 |
| Outbound | orange | `#F97316` | orange-500 |
| Subinventory Transfer | blue | `#3B82F6` | blue-500 |
| Pallets | lime | `#65A30D` | lime-600 |
| Stock Movement | teal | `#14B8A6` | teal-500 |
| Reports | purple | `#A855F7` | purple-500 |
| Monthly Stock | indigo | `#6366F1` | indigo-500 |
| Inventory Balance | blue | `#2563EB` | blue-600 |
| Analytics | purple | `#9333EA` | purple-600 |
| Inventory Aging | amber | `#D97706` | amber-600 |

## File Naming

- Files are named `nav-{kebab-case-name}.svg`.
- The icon key in `constants/nav-menu.ts` is `nav:{kebab-case-name}` (e.g. `nav:access-control` → `nav-access-control.svg`).
- Every new icon file MUST be registered in `assets/NavIcons.tsx`:
  1. `import NewIconSvg from './icons/nav-new-icon.svg?react';`
  2. Export a wrapper: `export const NavNewIconIcon = ({ size = 32, ...props }) => <NewIconSvg width={size} height={size} {...props} />;`
  3. Add to `NAV_ICON_REGISTRY`: `'nav:new-icon': NavNewIconIcon,`

## Rendering

Icons are rendered by `components/Sidebar.tsx` via `renderIcon()`:

- `nav:*` keys → resolved through `NAV_ICON_REGISTRY`, rendered at **32px** inside a fixed 32×32 span so the colorful tiles align.
- Other keys → fall back to `@iconify/react` `<Icon>` (e.g. `solar:*`) at 20px.
- Local asset paths (`.svg`, `.png`, URLs) → rendered as `<img>` at 32px.

## Design Guidelines
Colorful, vibrant tiles — rounded square with a light tinted background and multi-color glyphs.
- **Glyph weight**: Filled colored shapes are preferred. When a line/stroke glyph is needed (arrows, charts), use `stroke-width="3"` or `4` so it reads at 32px.
- **Density**: Keep glyphs simple — 1–6 shapes. Avoid hyper-detailed illustrations; they disappear at 32px.
- **Metaphor**: Each icon should clearly represent its domain (warehouse = building, users = people, reports = chart, inbound = house + down-arrow).
- **Consistency**: All icons in this set must look like they belong to the same family — same tile, same shine, same glyph color, same corner radius.
- **Color = identity**: Each domain keeps its color across the app. Do not recolor an icon for a different domain; create a new one.
- **Accessibility**: Icons are decorative — the adjacent text label is the accessible name. No `<title>` needed inside the SVG.

## Deprecated Style (do not reintroduce)

A previous iteration used 24×24 outline icons with `currentColor` (Lucide/Heroicons style). That style was rejected for this sidebar because:
- It lacked visual identity per domain (all icons were the same gray).
- It did not match the colorful, tile-based aesthetic of the rest of the app.
- It made the sidebar feel flat and generic rather than like a polished ERP product.

**Do not bring the outline-only style back.** If a monochrome indicator is needed for a specific status, use a `Chip` or `Badge` next to the label — not the nav icon itself.

## Current Icon Set

| File | Key | Domain | Color |
|---|---|---|---|
| `nav-dashboard.svg` | `nav:dashboard` | Dashboard | emerald |
| `nav-access-control.svg` | `nav:access-control` | Access Control (parent) | rose |
| `nav-users.svg` | `nav:users` | Users | sky |
| `nav-roles.svg` | `nav:roles` | Roles | violet |
| `nav-warehouses.svg` | `nav:warehouses` | Warehouses | emerald |
| `nav-skus.svg` | `nav:skus` | SKUs | amber |
| `nav-suppliers.svg` | `nav:suppliers` | Suppliers | cyan |
| `nav-products.svg` | `nav:products` | Products | pink |
| `nav-activity-logs.svg` | `nav:activity-logs` | Activity Logs | slate |
| `nav-notifications.svg` | `nav:notifications` | Notifications | red |
| `nav-inbound.svg` | `nav:inbound` | Inbound Transactions | green |
| `nav-outbound.svg` | `nav:outbound` | Outbound Transactions | orange |
| `nav-subinventory.svg` | `nav:subinventory` | Subinventory Transfer | blue |
| `nav-pallets.svg` | `nav:pallets` | Pallets | lime |
| `nav-stock-movement.svg` | `nav:stock-movement` | Stock Movements | teal |
| `nav-reports.svg` | `nav:reports` | Reports (parent) | purple |
| `nav-monthly-stock.svg` | `nav:monthly-stock` | Monthly Stock Movement report | indigo |
| `nav-inventory-balance.svg` | `nav:inventory-balance` | Inventory Balance report | blue |
| `nav-analytics.svg` | `nav:analytics` | Analytics Charts report | purple |
| `nav-inventory-aging.svg` | `nav:inventory-aging` | Inventory Aging | amber |
