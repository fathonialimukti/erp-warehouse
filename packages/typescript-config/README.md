# @repo/typescript-config — Shared TypeScript Configuration

Base `tsconfig.json` presets consumed by every app and package in the monorepo.

## Presets

| File          | Purpose                                                          |
| ------------- | ---------------------------------------------------------------- |
| `base.json`   | Core compiler options — strict, ESNext, moduleResolution bundler |
| `react.json`  | Base + React 19 JSX settings (`jsx: react-jsx`)                  |
| `server.json` | Base + Node types, CommonJS interop helpers                      |

## Usage

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../packages/typescript-config/base.json",
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "rootDir": "src",
    "outDir": "dist"
  }
}
```

## Strictness

All presets enable `strict: true`. The server additionally uses
`exactOptionalPropertyTypes` (enforced in `apps/server/tsconfig.json`).

## Adding a preset

1. Create `packages/typescript-config/<name>.json`
2. Export it from the consuming `tsconfig.json` via `"extends"`
3. Run `bun run check-types` to verify
