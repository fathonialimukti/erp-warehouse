/**
 * CORS allowlist decision, extracted from `src/index.ts` so it is testable
 * without booting the HTTP server.
 *
 * Production is allowlist-only. Development is open on purpose: `vite --host`,
 * the Tauri dev webview (`tauri://localhost`, `http://tauri.localhost`) and a
 * LAN address all need to work without anyone editing `CORS_ORIGIN`.
 *
 * The Tauri desktop build is dev-only (rationale in `middleware/csrf.ts`), so
 * `tauri://localhost` is deliberately NOT added to the production allowlist:
 * the `access_token` cookie is `SameSite=lax`, so a production desktop build
 * could not hold a session against the API anyway. Supporting it means
 * `SameSite=none; Secure` on the session cookie plus this allowlist entry.
 */
export const isOriginAllowed = (
  origin: string | undefined,
  allowedOrigins: string[],
  isDev: boolean,
): boolean => {
  // No Origin header: same-origin, curl, or a non-CORS client.
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  return isDev;
};
