/**
 * Upload storage guards (no DB — pure unit test over mock req/res + a temp dir).
 *
 * Covers the two storage-boundary regressions:
 * - the containment check was a bare `startsWith(UPLOADS_DIR)` string prefix, so
 *   a sibling directory sharing the name prefix (`uploads-evil`) passed,
 * - `image/svg+xml` was an accepted upload MIME and `serveUpload` mounted it
 *   inline on the API's own origin (stored XSS).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { persistUploadedImage, serveUpload } from "../lib/upload-file.js";

// UPLOADS_DIR is resolved from process.cwd() at module load, so chdir before
// importing would be needed for a real redirect; instead assert on the status
// codes, which is the observable contract either way.
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

type CapturedRes = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

const mockRes = (): { res: Response; captured: CapturedRes } => {
  const captured: CapturedRes = { statusCode: 0, headers: {}, body: "" };
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return res;
    },
    setHeader(name: string, value: string) {
      captured.headers[name.toLowerCase()] = value;
    },
    send(body?: string) {
      captured.body = body ?? "";
      return res;
    },
    end(body?: string) {
      captured.body = body ?? "";
      return res;
    },
  } as unknown as Response;
  return { res, captured };
};

const mockReq = (urlPath: string): Request =>
  ({
    path: urlPath,
    headers: { host: "localhost:10012" },
    protocol: "http",
  }) as unknown as Request;

const runServe = async (urlPath: string) => {
  const { res, captured } = mockRes();
  const next = vi.fn() as unknown as NextFunction;
  await (
    serveUpload as (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => Promise<void>
  )(mockReq(urlPath), res, next);
  return { captured, next: vi.mocked(next) };
};

const svgDataUrl =
  "data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIj48L3N2Zz4=";

describe("upload-file storage guards", () => {
  beforeAll(async () => {
    await fs.mkdir(path.join(UPLOADS_DIR, "guard-test"), { recursive: true });
    await fs.writeFile(
      path.join(UPLOADS_DIR, "guard-test", "ok.txt"),
      "plain text",
    );
    await fs.writeFile(
      path.join(UPLOADS_DIR, "guard-test", "photo.png"),
      "not-really-a-png-but-bytes",
    );
    // Sibling directory whose name shares the UPLOADS_DIR string prefix.
    await fs.mkdir(`${UPLOADS_DIR}-evil`, { recursive: true });
    await fs.writeFile(
      path.join(`${UPLOADS_DIR}-evil`, "secret.txt"),
      "TOP-SECRET-DO-NOT-SERVE",
    );
  });

  afterAll(async () => {
    await fs.rm(path.join(UPLOADS_DIR, "guard-test"), {
      recursive: true,
      force: true,
    });
    await fs.rm(`${UPLOADS_DIR}-evil`, { recursive: true, force: true });
  });

  it("rejects a traversal into a sibling dir sharing the uploads prefix", async () => {
    // `/app/uploads/../uploads-evil/secret.txt` resolves to
    // `/app/uploads-evil/secret.txt` — a bare string prefix accepts it.
    const { captured } = await runServe("/uploads/../uploads-evil/secret.txt");
    expect(captured.statusCode).toBe(403);
    expect(captured.body).not.toContain("TOP-SECRET");
  });

  it("rejects an encoded traversal into a sibling dir", async () => {
    const { captured } = await runServe(
      "/uploads/%2e%2e/uploads-evil/secret.txt",
    );
    expect(captured.statusCode).toBe(403);
    expect(captured.body).not.toContain("TOP-SECRET");
  });

  it("still serves files that are genuinely inside the uploads dir", async () => {
    const { captured, next } = await runServe("/uploads/guard-test/ok.txt");
    // Either served (200) or a clean 404 when the fixture is absent —
    // the point is that it is never 403 and never passes through.
    expect(captured.statusCode).not.toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("404s instead of 500ing on a malformed percent-escape", async () => {
    const { captured } = await runServe("/uploads/%zz");
    expect(captured.statusCode).toBe(404);
  });

  it("serves a raster image inline with an image content-type so <img src> renders it", async () => {
    // Regression guard: `attachment` here broke every photo/avatar preview
    // in the client (EntityPhoto + ImageUploadField render the stored URL).
    const { captured } = await runServe("/uploads/guard-test/photo.png");
    expect(captured.statusCode).toBe(200);
    expect(captured.headers["content-type"]).toBe("image/png");
    expect(captured.headers["content-disposition"]).toBe("inline");
    // The security headers stay on inline responses too.
    expect(captured.headers["content-security-policy"]).toContain("sandbox");
    expect(captured.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("serves a non-image upload as an attachment", async () => {
    const { captured } = await runServe("/uploads/guard-test/ok.txt");
    expect(captured.statusCode).toBe(200);
    expect(captured.headers["content-disposition"]).toMatch(
      /^attachment; filename="ok\.txt"$/,
    );
    expect(captured.headers["content-type"]).toBe("text/plain; charset=utf-8");
  });

  it("serves an .svg on disk as an attachment, never inline", async () => {
    await fs.writeFile(
      path.join(UPLOADS_DIR, "guard-test", "payload.svg"),
      '<svg onload="alert(1)"/>',
    );
    const { captured } = await runServe("/uploads/guard-test/payload.svg");
    expect(captured.statusCode).toBe(200);
    expect(captured.headers["content-disposition"]).toMatch(/^attachment;/);
    expect(captured.headers["content-security-policy"]).toContain("sandbox");
  });

  it("forces downloads with a sandbox CSP so uploads cannot run script in our origin", async () => {
    const { captured } = await runServe("/uploads/guard-test/ok.txt");
    if (captured.statusCode === 200) {
      expect(captured.headers["content-disposition"]).toMatch(/^attachment;/);
      expect(captured.headers["content-security-policy"]).toContain("sandbox");
      expect(captured.headers["x-content-type-options"]).toBe("nosniff");
    }
  });

  it("rejects image/svg+xml uploads", async () => {
    await expect(
      persistUploadedImage({
        image: svgDataUrl,
        folder: "guard-test",
        req: mockReq("/uploads"),
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_IMAGE_FORMAT" });
  });

  it("still accepts the raster image MIMEs", async () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    const url = await persistUploadedImage({
      image: png,
      folder: "guard-test",
      req: mockReq("/uploads"),
    });
    expect(url).toContain("/uploads/guard-test/");
    expect(url).toMatch(/\.png$/);
    const stored = path.join(
      UPLOADS_DIR,
      "guard-test",
      path.basename(new URL(url).pathname),
    );
    await fs.rm(stored, { force: true });
  });
});
