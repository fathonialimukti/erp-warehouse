/**
 * CSRF middleware contract (no DB — pure unit test over mock req/res).
 *
 * Guards the `Invalid CSRF token` 403 that blocked legitimate first-party
 * use of tRPC mutations (`trpcClient.<domain>.create/update/delete`,
 * `auth.login`, `assistant.send/chat`) and the Express AI endpoints
 * (`POST /api/ai/*`):
 * - safe methods + requests without a session cookie always pass,
 * - session-cookie requests pass on matching double-submit pair,
 * - session-cookie requests with a missing/mismatched pair still pass when
 *   provably first-party (allowlisted Origin/Referer, localhost, Tauri),
 * - the localhost/Tauri convenience shapes are DEV-ONLY: production rejects
 *   every one of them, including `tauri://localhost`, because the Tauri
 *   desktop build is a development client (see the policy note in csrf.ts),
 * - cross-origin mismatches are still rejected with 403.
 */
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { createCsrfMiddleware } from "../middleware/csrf.js";

const ALLOWED = ["https://erp-warehouse.aetherglo.com"];

const mockReq = (init: {
  method?: string;
  headers?: Record<string, string | string[]>;
}): Request =>
  ({
    method: init.method ?? "POST",
    headers: init.headers ?? {},
  }) as unknown as Request;

const run = (req: Request, allowedOrigins: string[] = ALLOWED) => {
  const middleware = createCsrfMiddleware(allowedOrigins);
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { status } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  (middleware as (req: Request, res: Response, next: NextFunction) => void)(
    req,
    res,
    next,
  );
  return { next: vi.mocked(next), status, json };
};

describe("createCsrfMiddleware", () => {
  it("passes safe methods through without cookies", () => {
    const { next, status } = run(mockReq({ method: "GET" }));
    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });

  it("passes mutating requests without a session cookie (auth.login shape)", () => {
    const { next, status } = run(mockReq({ method: "POST", headers: {} }));
    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });

  it("passes matching double-submit pair", () => {
    const { next, status } = run(
      mockReq({
        headers: {
          cookie: "access_token=sess; csrf_token=abc",
          "x-csrf-token": "abc",
          origin: "https://erp-warehouse.aetherglo.com",
        },
      }),
    );
    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });

  it("rejects mismatched pair with no Origin", () => {
    const { next, status, json } = run(
      mockReq({
        headers: {
          cookie: "access_token=sess; csrf_token=abc",
          "x-csrf-token": "wrong",
        },
      }),
    );
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    // Refreshable contract: `code` tells the client to refetch GET
    // /api/csrf and retry the request once with the fresh token.
    expect(json).toHaveBeenCalledWith({
      error: "Invalid CSRF token",
      code: "CSRF_TOKEN_INVALID",
    });
  });

  it("rejects missing header on cross-origin request", () => {
    const { next, status } = run(
      mockReq({
        headers: {
          cookie: "access_token=sess; csrf_token=abc",
          origin: "https://evil.example",
        },
      }),
    );
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  it("passes allowlisted Origin when the token pair is missing (reload race)", () => {
    const { next, status } = run(
      mockReq({
        headers: {
          cookie: "access_token=sess; csrf_token=abc",
          origin: "https://erp-warehouse.aetherglo.com",
        },
      }),
    );
    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });

  it("passes via Referer when Origin is absent", () => {
    const { next, status } = run(
      mockReq({
        headers: {
          cookie: "access_token=sess",
          referer: "https://erp-warehouse.aetherglo.com/warehouse",
        },
      }),
    );
    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });

  it("passes localhost and Tauri origins in dev shapes", () => {
    for (const origin of [
      "http://localhost:5173",
      "http://127.0.0.1:10011",
      "tauri://localhost",
      "http://tauri.localhost",
    ]) {
      const { next, status } = run(
        mockReq({ headers: { cookie: "access_token=sess", origin } }),
        [],
      );
      expect(next).toHaveBeenCalledOnce();
      expect(status).not.toHaveBeenCalled();
    }
  });

  it("rejects every dev/Tauri shape in production even with a session cookie", () => {
    // Policy, not an accident: the Tauri desktop build is dev-only, so
    // `tauri://localhost` gets no first-party pass in production. It is not
    // forgeable by a web page, but it does not need to be — a production
    // desktop client has no session at all while the auth cookie is
    // SameSite=Lax, so there is nothing here for the check to protect.
    // Supporting it in production is a change to `createAuthCookie` + CORS,
    // not a relaxation of this gate.
    vi.stubEnv("NODE_ENV", "production");
    try {
      for (const origin of [
        "http://localhost:5173",
        "http://127.0.0.1:10011",
        "http://localhost",
        "tauri://localhost",
        "tauri://localhost:1420",
        "http://tauri.localhost",
      ]) {
        const { next, status, json } = run(
          mockReq({
            headers: { cookie: "access_token=sess; csrf_token=abc", origin },
          }),
          [],
        );
        expect(next, origin).not.toHaveBeenCalled();
        expect(status, origin).toHaveBeenCalledWith(403);
        expect(json, origin).toHaveBeenCalledWith({
          error: "Invalid CSRF token",
          code: "CSRF_TOKEN_INVALID",
        });
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("still honours the CORS_ORIGIN allowlist in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const { next, status } = run(
        mockReq({
          headers: {
            cookie: "access_token=sess",
            origin: "https://erp-warehouse.aetherglo.com",
          },
        }),
      );
      expect(next).toHaveBeenCalledOnce();
      expect(status).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("treats array header values as missing", () => {
    const { next, status } = run(
      mockReq({
        headers: {
          cookie: "access_token=sess; csrf_token=abc",
          "x-csrf-token": ["abc", "abc"],
          origin: "https://evil.example",
        },
      }),
    );
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });
});
