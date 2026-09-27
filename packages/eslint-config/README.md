# @repo/eslint-config — Shared ESLint Configuration

Flat ESLint configs shared across the monorepo. Each app/package extends the
appropriate base config.

## Configs

| Export | Purpose | Used by |
|---|---|---|
| `./base` | JS/TS baseline — typescript-eslint, prettier, turbo plugin | All packages |
| `./react-internal` | Base + React 19 + React Hooks + JSX accessibility | `apps/client` |
| `./next-js` | Base + Next.js-specific rules | Reserved (not currently used) |

## Usage

```js
// apps/client/eslint.config.mjs
import { reactInternal } from '@repo/eslint-config/react-internal';

export default [reactInternal];
```

## Rules

- `--max-warnings 0` — zero-warning policy enforced in CI
- `eslint-plugin-turbo` — lint task graph awareness
- `eslint-plugin-react-hooks` — rules-of-hooks enforcement
- `eslint-config-prettier` — disables conflicting formatting rules
- `eslint-plugin-only-warn` — non-fatal rules for incremental adoption

## Adding a rule

1. Edit the relevant config file in this package
2. Run `bun run lint` from the affected app to verify
3. If the rule is project-wide, update `./base`
