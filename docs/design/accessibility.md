# Accessibility

The ERP Warehouse UI follows WCAG 2.1 AA guidelines for all user-facing
interfaces. This document states our commitments and known gaps.

## Commitments

### Keyboard Navigation

- All interactive elements are keyboard-reachable (Tab / Shift+Tab)
- Focus indicators are visible on all buttons, inputs, and links
- Shortcuts: `Cmd+K` (command palette), `?` (shortcut help)
- Skip-to-main-content link on every page

### Color & Contrast

- Text-to-background contrast ratio ≥ 4.5:1 for normal text (WCAG AA)
- Interactive element contrast ratio ≥ 3:1 (WCAG AA)
- Color is never the sole carrier of meaning — status also uses text + icons
- Brand blue (`#0B5FFA`) on white passes AA (4.9:1)

### Screen Reader

- All form fields have associated `<label>` elements
- Buttons have accessible names (visible text or `aria-label`)
- Tables have `<caption>` or `aria-labelledby` for context
- Modals trap focus and announce their open state
- Error messages are programmatically associated with fields (`aria-describedby`)

### Semantic HTML

- Proper heading hierarchy (`h1` → `h2` → `h3`) — no skipped levels
- Landmarks: `<main>`, `<nav>`, `<header>`, `<footer>`
- Lists use `<ul>`/`<ol>` with `<li>` items

## Known Gaps

| Area                           | Status     | Notes                                                    |
| ------------------------------ | ---------- | -------------------------------------------------------- |
| Screen reader testing          | Not tested | No formal audit with NVDA/JAWS/VoiceOver                 |
| Keyboard-only navigation audit | Not tested | Manual walkthrough not performed                         |
| Color contrast audit           | Partial    | Automated check only (no manual review)                  |
| Motion reduction               | Partial    | `prefers-reduced-motion` respected for some animations   |
| Form error announcements       | Partial    | Error messages use `aria-describedby` but no live region |

## Improvement Plan

1. Run automated accessibility audit (axe-core) in CI
2. Manual keyboard-only walkthrough of all 50 routes
3. Screen reader test on key flows (login, receiving, dashboard)
4. Add `prefers-reduced-motion` support to all animations
5. Add `aria-live` regions for toast notifications
