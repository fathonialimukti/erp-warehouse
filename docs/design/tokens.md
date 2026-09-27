# Design Tokens

Color, spacing, typography, and component tokens for the ERP Warehouse UI.
Defined in `apps/client/src/index.css` (HeroUI v3 oklch variables) and
consumed by Tailwind v4 utilities.

## Color Palette

### Primary

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `oklch(0.62 0.18 264)` | Primary buttons, links, active states |
| `--color-primary-foreground` | `oklch(0.98 0 0)` | Text on primary |
| `--color-secondary` | `oklch(0.55 0.14 266)` | Secondary actions |
| `--color-accent` | `oklch(0.65 0.16 280)` | Highlights, AI indicators |

### Semantic

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-success` | `oklch(0.65 0.17 145)` | `oklch(0.70 0.16 145)` | Approved, in-stock, healthy |
| `--color-danger` | `oklch(0.60 0.20 25)` | `oklch(0.70 0.18 25)` | Rejected, out-of-stock, errors |
| `--color-warning` | `oklch(0.75 0.16 85)` | `oklch(0.80 0.15 85)` | Pending, low stock, aging |
| `--color-background` | `oklch(0.99 0 0)` | `oklch(0.17 0.01 260)` | Page background |
| `--color-foreground` | `oklch(0.15 0.01 260)` | `oklch(0.95 0.01 260)` | Primary text |
| `--color-muted` | `oklch(0.94 0.01 260)` | `oklch(0.22 0.01 260)` | Secondary background |
| `--color-muted-foreground` | `oklch(0.50 0.01 260)` | `oklch(0.70 0.01 260)` | Secondary text |

### Brand

| Token | Value | Usage |
|---|---|---|
| `--color-brand-blue` | `#0B5FFA` | Primary brand color |
| `--color-brand-blue-deep` | `#0046CC` | Secondary brand, hover states |

## Typography

| Token | Value | Usage |
|---|---|---|
| `--font-sans` | `Poppins`, system-ui, sans-serif | Body, UI |
| `--font-mono` | `JetBrains Mono`, monospace | Data, codes, document numbers |
| `--text-xs` | `0.75rem` (12px) | Labels, captions |
| `--text-sm` | `0.875rem` (14px) | Secondary text, table cells |
| `--text-base` | `1rem` (16px) | Body text, form inputs |
| `--text-lg` | `1.125rem` (18px) | Section headings |
| `--text-xl` | `1.25rem` (20px) | Page titles |
| `--text-2xl` | `1.5rem` (24px) | Hero headings |
| `--font-weight-normal` | `400` | Body |
| `--font-weight-medium` | `500` | Labels, UI text |
| `--font-weight-bold` | `700` | Headings, emphasis |

## Spacing

| Token | Value | Usage |
|---|---|---|
| `--spacing-1` | `0.25rem` (4px) | Tight gaps |
| `--spacing-2` | `0.5rem` (8px) | Standard gaps |
| `--spacing-3` | `0.75rem` (12px) | Form field spacing |
| `--spacing-4` | `1rem` (16px) | Default padding |
| `--spacing-6` | `1.5rem` (24px) | Card padding |
| `--spacing-8` | `2rem` (32px) | Section gaps |
| `--spacing-12` | `3rem` (48px) | Page max-width gutters |

## Borders & Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `0.375rem` (6px) | Badges, chips |
| `--radius-md` | `0.5rem` (8px) | Cards, inputs |
| `--radius-lg` | `0.75rem` (12px) | Modals, panels |
| `--border-width` | `1px` | Default border |
| `--border-color` | `oklch(0.90 0.01 260)` | Default border color |

## Shadows

| Token | Value | Usage |
|---|---|---|
| `--shadow-sm` | `0 1px 2px 0 oklch(0 0 0 / 0.05)` | Elevated elements |
| `--shadow-md` | `0 4px 6px -1px oklch(0 0 0 / 0.1)` | Cards, dropdowns |
| `--shadow-lg` | `0 10px 15px -3px oklch(0 0 0 / 0.1)` | Modals, popovers |

## Motion

| Token | Value | Usage |
|---|---|---|
| `--duration-fast` | `150ms` | Button hover, chip enter |
| `--duration-normal` | `250ms` | Page transitions, modal open |
| `--duration-slow` | `400ms` | Staggered lists, complex animations |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Standard easing |
