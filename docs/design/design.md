# Design System — Iconography

The single source of truth for every SVG in `apps/client/src/assets/`.
Icons are **solid fill only** — no gradients, no soft blurs, no drop
shadows. Every glyph is drawn on the same 24-unit grid so the whole app
reads as one family.

**There is no third-party icon set.** All 128 UI glyphs are drawn in this
repo and nothing is fetched at runtime. See
[Entry point](#entry-point) below.

Consumed by `AppIcon.tsx` (every inline icon), `IconRegistry.tsx`,
`NavIcons.tsx` (nav tiles), `KpiIcons.tsx` (KPI tiles) and
`SettingGroupIcons.tsx` (settings tiles). Colours come from the `--icon-*`
tokens in `index.css`. See [tokens.md](./tokens.md) for the HeroUI token
set, [components.md](./components.md) for the component catalog.

## Entry point

`components/AppIcon.tsx` is the only way to render a UI icon. Do not import
`assets/icons/*.svg` directly outside of that file — the registry is what
keeps the size scale and the type-checking honest.

```tsx
<AppIcon name="trash" />             // 16px (sm, the default)
<AppIcon name="trash" size="md" />   // 20px
<AppIcon name="trash" size="xs" />   // 12px
<AppIcon name="trash" size={28} />   // raw pixels
<AppIcon name="trash" className="text-danger" />
```

| Size | Token | px  | Typical use                           |
| ---- | ----- | --- | ------------------------------------- |
| `xs` | —     | 12  | Dense table cells, chip interiors     |
| `sm` | —     | 16  | Inline, buttons, toolbar, row actions |
| `md` | —     | 20  | Card headers, empty states            |
| `lg` | —     | 24  | Section headings                      |
| `xl` | —     | 32  | Feature callouts                      |

`name` is a union of string literals, so a typo is a compile error and
`isIconName()` narrows untrusted values (e.g. a column from the DB).

Brand marks are the one exception and live in `components/BrandIcon.tsx` —
see [Brand marks](#brand-marks).

## The two families

| Family    | Canvas | Colour                            | Used for                                         |
| --------- | ------ | --------------------------------- | ------------------------------------------------ |
| **Glyph** | 24×24  | `currentColor`, stroke only       | Inline icons, buttons, tabs, badges, row actions |
| **Tile**  | 32×32  | Tinted squircle + saturated glyph | Sidebar nav, KPI cards, settings groups, heroes  |

A tile is **not** a special case of a glyph — it is a glyph on the same
grid, scaled down and coloured in the accent hue. Both families share
one drawing vocabulary, so a "box" looks the same in a button and in the
sidebar.

## Glyph family (24×24)

Root element carries the shared presentation attributes; children are
plain geometry.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
     width="24" height="24" stroke="currentColor" stroke-width="1.75"
     stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 5v14" />
</svg>
```

| Rule          | Value                                                         |
| ------------- | ------------------------------------------------------------- |
| Live area     | 20×20 — coordinates stay within `2 … 22`                      |
| Stroke weight | `1.75` (the "Regular" weight)                                 |
| Caps / joins  | `round` / `round` — never `butt` or `miter`                   |
| Fill          | `none`, except solid dots that opt in explicitly              |
| Colour        | `currentColor` — **never a hex value**                        |
| Padding       | Optical, not metric. Diagonals may reach `2.5`, axes stay `4` |

Because the root sets `stroke="currentColor"`, an icon inherits `color`
from its container. A `className="text-accent"` on any glyph component
tints it — no per-file colour override required.

## Tile family (32×32)

iOS Settings construction: a **soft tinted squircle** with a **saturated
glyph**, not a saturated block with a white glyph. Twenty-six saturated
blocks stacked in a sidebar is a wall of competing hue; tinted tiles let
the user read the module name first and the colour second.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <rect x="2" y="2" width="28" height="28" rx="8.5"
        fill="var(--icon-blue-bg, #dce4fb)" />
  <g transform="translate(16 16) scale(0.74) translate(-12 -12)"
     fill="none" stroke="var(--icon-blue, #1d4ed8)" stroke-width="1.9"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 4v15.5h16" />
    <path d="m7.5 15 4-4.75 3.25 2.5L19 7" />
  </g>
</svg>
```

| Rule           | Value                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| Container      | `rect x="2" y="2" width="28" height="28"`                                                                      |
| Corner radius  | `rx="8.5"` — 30% of the tile (iOS Settings icon ratio)                                                         |
| Bleed          | 2 units per side, so tiles read as inset rather than cropped                                                   |
| Glyph scale    | `0.74` about the tile centre — the glyph occupies **53%** of the tile, matching an iOS app icon. Not 74%       |
| Glyph centring | `translate(16 16) scale(0.74) translate(-12 -12)` — the 24-grid centre (12,12) maps to the tile centre (16,16) |
| Stroke weight  | `1.9` before scaling (~`1.4` effective)                                                                        |
| Colour         | `var(--icon-<tone>-bg)` and `var(--icon-<tone>)`                                                               |

Hero tiles (48px) use `scale(0.8)` and `stroke-width="2.1"` — they carry
the page and need more presence than a 28px sidebar tile.

Each SVG carries its light-mode hex as a CSS fallback so it still renders
correctly outside the app (design tools, preview pages).

## Tone tokens

Nine tones, defined twice in `index.css` — once in the light block, once
in the `.dark` / `[data-theme="dark"]` block. Each theme defines a glyph
colour and a tile background. Every value is one solid colour.

| Tone      | Light glyph | Light tile | Dark glyph | Dark tile | Module                             |
| --------- | ----------- | ---------- | ---------- | --------- | ---------------------------------- |
| `emerald` | `#047857`   | `#d7efe6`  | `#34d399`  | `#0e2a22` | Inbound, receiving, putaway        |
| `teal`    | `#0f766e`   | `#d6ebe9`  | `#2dd4bf`  | `#0c2a28` | Transfers, stock movement          |
| `blue`    | `#1d4ed8`   | `#dce4fb`  | `#60a5fa`  | `#152244` | Dashboard, analytics, reports      |
| `indigo`  | `#4338ca`   | `#e0dff8`  | `#818cf8`  | `#1e1b45` | Catalogue: SKUs, products, pallets |
| `purple`  | `#7e22ce`   | `#eddef7`  | `#c084fc`  | `#2a1340` | AI, knowledge base                 |
| `amber`   | `#b45309`   | `#f6e7d6`  | `#fbbf24`  | `#33230c` | Aging, pending approvals           |
| `orange`  | `#c2410c`   | `#f8e1d6`  | `#fb923c`  | `#33190d` | Outbound, dispatch                 |
| `red`     | `#b91c1c`   | `#f8dede`  | `#f87171`  | `#331415` | Notifications, security            |
| `slate`   | `#334155`   | `#e2e5ea`  | `#94a3b8`  | `#1f242e` | Administration, system             |

Measured glyph-on-tile contrast: **4.13:1 – 8.20:1** in light,
**5.42:1 – 9.07:1** in dark. The floor is amber and orange in light mode;
everything clears WCAG SC 1.4.11 for non-text content (3:1), and eight
of the nine also clear 4.5:1. Re-measure rather than eyeball when adding
a tone.

### Why dark tiles are not just darker shades

A light tile (`#d7efe6`) pasted into a dark theme becomes a bright hole
punched in the sidebar. So the dark set is a **separate palette**, not a
filter: the tile background drops to roughly the `--surface` level and the
glyph flips to a bright tint of the same hue. The hue relationship is
preserved; the value relationship is inverted. This is why the tiles read
as part of the surface rather than on top of it.

## Icon inventory

### Tiles — navigation (`assets/icons/nav-*.svg`)

| File                        | Module         | Tone    |
| --------------------------- | -------------- | ------- |
| `nav-dashboard.svg`         | Overview       | blue    |
| `nav-analytics.svg`         | Overview       | blue    |
| `nav-reports.svg`           | Overview       | blue    |
| `nav-monthly-stock.svg`     | Overview       | blue    |
| `nav-inbound.svg`           | Inbound        | emerald |
| `nav-outbound.svg`          | Outbound       | orange  |
| `nav-subinventory.svg`      | Inventory      | teal    |
| `nav-stock-movement.svg`    | Inventory      | teal    |
| `nav-skus.svg`              | Catalogue      | indigo  |
| `nav-products.svg`          | Catalogue      | indigo  |
| `nav-inventory-balance.svg` | Catalogue      | indigo  |
| `nav-pallets.svg`           | Catalogue      | indigo  |
| `nav-inventory-aging.svg`   | Inventory      | amber   |
| `nav-notifications.svg`     | Overview       | red     |
| `nav-ai-admin.svg`          | AI             | purple  |
| `nav-knowledge.svg`         | AI             | purple  |
| `nav-warehouses.svg`        | Administration | slate   |
| `nav-suppliers.svg`         | Administration | slate   |
| `nav-users.svg`             | Administration | slate   |
| `nav-roles.svg`             | Administration | slate   |
| `nav-access-control.svg`    | Administration | slate   |
| `nav-settings.svg`          | Administration | slate   |
| `nav-system.svg`            | Administration | slate   |
| `nav-logs.svg`              | Administration | slate   |
| `nav-activity-logs.svg`     | Administration | slate   |
| `nav-backup.svg`            | Administration | slate   |

### Tiles — dashboard KPIs

| File                        | Tone    |
| --------------------------- | ------- |
| `kpi-pallets.svg`           | indigo  |
| `kpi-available-pallets.svg` | emerald |
| `kpi-putaway-queue.svg`     | emerald |
| `kpi-dispatch-queue.svg`    | orange  |
| `kpi-pending-approvals.svg` | amber   |

### Tiles — page heroes

| File                     | Tone    | Rendered |
| ------------------------ | ------- | -------- |
| `icon-inbound-hero.svg`  | emerald | 48px     |
| `icon-outbound-hero.svg` | orange  | 48px     |

### Glyphs — actions (`assets/icons/icon-*.svg`, 24×24)

Arrow down, arrow up, box, check circle, chevron left, clipboard, close
circle, document, download, eye, info, layers, menu dots, notes,
paperclip, pen, plus, putaway, save, scale, send, spinner, theme, trash,
truck.

### Glyphs — transaction types

| File                               | Metaphor                    | Rendered at  |
| ---------------------------------- | --------------------------- | ------------ |
| `icon-receiving-type.svg`          | Arrow down into a dock      | 13 / 18 / 20 |
| `icon-shipment-type.svg`           | Arrow up out of a dock      | 13 / 18 / 20 |
| `icon-return-to-supplier-type.svg` | Arrow back out of a dock    | 13 / 18      |
| `icon-rma-receipt-type.svg`        | U-turn return               | 13 / 18      |
| `icon-disposal-type.svg`           | Bin                         | 13 / 18 / 20 |
| `icon-loss-type.svg`               | Package split in two        | 13 / 18 / 20 |
| `icon-found-type.svg`              | Package with a lens         | 13 / 18 / 20 |
| `icon-wip-issue-type.svg`          | Package with an exclamation | 13 / 18 / 20 |
| `icon-wip-completion-type.svg`     | Package with a check        | 13 / 18      |
| `icon-notifications.svg`           | Bell                        | 24           |
| `icon-theme.svg`                   | Half-filled circle          | 24           |

Transaction types are glyphs, not tiles, because they render at **13px**
in tab chips. A tile shrunk to 13px is an unreadable smudge; a
`currentColor` glyph inherits its chip's text colour and stays legible.

### App marks

| File             | Use                                      |
| ---------------- | ---------------------------------------- |
| `logo.svg`       | Transparent mark — three flat cube faces |
| `logo-badge.svg` | Squircle mark for favicons and app icons |

App marks predate the token system and keep baked colours — they must
render identically outside the app.

## Brand marks (third-party logos)

`components/BrandIcon.tsx`, rendered from `assets/brands/*.svg`. These are
**trademarks owned by other projects** — they are deliberately _not_ part
of the in-house system and must never be restyled to match it. They appear
only on the landing tech-stack strip.

```tsx
<BrandIcon name="react" size={16} />
```

Vendored as static files rather than fetched, so dropping `@iconify/react`
left the app with no icon dependency at all. Source: Simple Icons (CC0) and
the svglogos collection.

| Name         | Asset                        |
| ------------ | ---------------------------- |
| `react`      | `logos-react.svg`            |
| `threejs`    | `logos-threejs.svg`          |
| `typescript` | `logos-typescript-icon.svg`  |
| `trpc`       | `logos-trpc.svg`             |
| `prisma`     | `simple-icons-prisma.svg`    |
| `tauri`      | `simple-icons-tauri.svg`     |
| `heroui`     | `simple-icons-heroui.svg`    |
| `ai-sdk`     | `logos-vercel-ai-sdk.svg`    |
| `tailwind`   | `logos-tailwindcss-icon.svg` |
| `postgresql` | `logos-postgresql.svg`       |

## Authoring rules

1. **Solid only.** No `linearGradient`, no `radialGradient`, no
   `opacity` on a fill. Opacity is a shadow, not a colour.
2. **One tone per tile, one stroke per glyph.** Never a multi-colour
   icon.
3. **Glyphs inherit.** No hex in a `icon-*.svg` file. If it needs
   colour, it belongs in a tile.
4. **Tiles reference tokens.** `fill="var(--icon-<tone>-bg)"` and
   `stroke="var(--icon-<tone>)"`. Never a bare hex in a `nav-*.svg` or
   `kpi-*.svg` file — a new tone means a new pair in both theme blocks
   of `index.css`.
5. **Equal optical weight.** A glyph is at most 6 shapes. If it needs a
   seventh, it is a drawing, not an icon. `nav-settings` is sliders, not
   a gear, because a gear at 24px is four times the ink of a bell.
6. **Grid before detail.** `nav-pallets` is three boards and three
   blocks; it is not seventeen rects.
7. **Optical balance over symmetry.** A triangle sits low, a clock sits
   high.
8. **Match the family.** A new tile is a 24-grid glyph at
   `scale(0.74)`, centred — not a bespoke drawing.
9. **Both themes.** Adding a tone means adding it twice in `index.css`.
   Check the tile against both themes before shipping.
10. **Go through `AppIcon`.** Adding a glyph means drawing
    `assets/icons/icon-<name>.svg` _and_ registering it in
    `AppIcon.tsx`. Importing the `.svg` directly bypasses the size scale
    and the type checking.
11. **Never add a third-party icon set back.** The 166 strings that used to
    come from Solar, MDI, Material Symbols, TDesign and Fluent are now
    semantic names. If a needed glyph does not exist, draw it.

## Retired

| Removed                                                                   | Why                                                         |
| ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `@iconify/react` (runtime dependency)                                     | 5 collections, 5 weights, no size control, remote icon data |
| `solar:*`, `mdi:*`, `material-symbols:*`, `tdesign:*`, `fluent:*` strings | Replaced by 128 in-house glyphs                             |
| `react.svg`, `public/vite.svg`, `public/tauri.svg`                        | Vite/Tauri scaffold, imported by nothing                    |
| `nav-dispatch.svg`, `nav-putaway.svg`                                     | Not registered in `NAV_ICON_REGISTRY`                       |
| Emoji in live UI (`✓ ✗ 🔴 🟡` in chips, legends, form rows)               | Rendered inconsistently, unthemed, untranslatable           |

### What removing them fixed

- One collection and one weight instead of five of each. Solar alone mixed
  `linear` / `bold` / `duotone` / `broken` / `outline` in the same UI.
- Every icon inherits `currentColor` and the `--icon-*` tokens, so themes
  and states work without a per-icon override.
- Icons render at build time. No network fetch, no icon payload at
  runtime, no layout shift when one fails to load.
- Sizes are one of five tokens instead of `size-3` / `size-3.5` / `size-4` /
  `size-4.5` / `size-[18px]` / `style={{width:16}}` / unsized.

## Known gaps

- `icon-theme.svg` and `icon-notifications.svg` are exported from
  `IconRegistry.tsx` but no page renders them yet.
- Favicons in `apps/client/public/favicon_io/` and the AppImage are still
  PNG exports of the **old** logo. Regenerate from `logo-badge.svg`
  before the next release.
- `assets/object/DrumOnPallet.tsx` still writes `⚠ FLAMMABLE ⚠` into a
  canvas texture. That is a 2D canvas label, not a DOM icon, so it is out
  of scope for this system.
- `vitest.config.ts` now mirrors `vite.config.ts` (`svgr()`). Without it,
  any test rendering a component that uses an in-house icon throws
  `Invalid tag`. Keep the two configs in step.
