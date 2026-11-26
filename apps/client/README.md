# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Marketing-only build

Ship just the public marketing site (`/`, `/features`, `/pricing`, `/about`,
`/contact`, `/faq`, `/privacy`, `/terms`) — no login screen, no protected app.

```bash
bun run build:marketing   # → dist/
```

- **Flag:** `VITE_MARKETING_ONLY=true`. When unset (the default, `bun run build`)
  the full app is built exactly as before. `build:marketing` sets it for both the
  typecheck and the Vite build. POSIX-only syntax (`VAR=… cmd`); Windows shells
  need `cross-env` or a shell that exports the variable.
- **Output:** the usual `dist/` — there is no separate outDir. The deploy step
  runs this command and uploads `dist/`; it replaces any previous build.
- **Routing:** this is a client-rendered SPA. The host **must** rewrite unknown
  paths to `/index.html` (`/* → /index.html`, HTTP 200), or deep links like
  `/pricing` will 404 at the CDN.
- **The API is not used:** `VITE_TRPC_URL` is irrelevant for the marketing
  deploy. Leave it unset; nothing on these pages calls the server (the contact
  form is client-side only).
