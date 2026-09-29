/**
 * CORS policy contract (no DB — pure unit test).
 *
 * Locks in the desktop-build policy: the Tauri shell is DEV-ONLY, so
 * `tauri://localhost` is admitted in development and rejected in production
 * exactly like any other unlisted origin. See `lib/cors-policy.ts` and the
 * policy note in `middleware/csrf.ts`.
 */
import { describe, expect, it } from "vitest";
import { isOriginAllowed } from "../lib/cors-policy.js";

const ALLOWED = ["https://erp-warehouse.aetherglo.com"];

describe("isOriginAllowed", () => {
  it("admits a request with no Origin header", () => {
    expect(isOriginAllowed(undefined, ALLOWED, false)).toBe(true);
  });

  it("admits an allowlisted origin in production", () => {
    expect(
      isOriginAllowed("https://erp-warehouse.aetherglo.com", ALLOWED, false),
    ).toBe(true);
  });

  it("rejects an unlisted origin in production", () => {
    expect(isOriginAllowed("https://evil.example", ALLOWED, false)).toBe(false);
  });

  it("rejects the Tauri desktop origin in production (dev-only build)", () => {
    for (const origin of [
      "tauri://localhost",
      "tauri://localhost:1420",
      "http://tauri.localhost",
    ]) {
      expect(isOriginAllowed(origin, ALLOWED, false), origin).toBe(false);
    }
  });

  it("rejects localhost in production", () => {
    expect(isOriginAllowed("http://localhost:10011", ALLOWED, false)).toBe(
      false,
    );
  });

  it("admits the Tauri and localhost shapes in development", () => {
    for (const origin of [
      "http://localhost:10011",
      "http://127.0.0.1:5173",
      "tauri://localhost",
      "http://tauri.localhost",
      "http://192.168.1.20:10011",
    ]) {
      expect(isOriginAllowed(origin, ALLOWED, true), origin).toBe(true);
    }
  });

  it("still admits an allowlisted origin in development", () => {
    expect(
      isOriginAllowed("https://erp-warehouse.aetherglo.com", ALLOWED, true),
    ).toBe(true);
  });
});
