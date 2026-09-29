import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/**
 * Per-request context carried across awaits (tRPC procedures, middleware, DB sink).
 * Provides request-ID correlation for every log line.
 */
export interface RequestContext {
  requestId: string;
  userId: string | null;
  path: string;
  method: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Express middleware: assigns (or trusts incoming) x-request-id and opens the ALS context. */
export const requestContextMiddleware = (
  req: { headers: Record<string, unknown> },
  res: { setHeader: (k: string, v: string) => void },
  next: () => void,
) => {
  const incoming = req.headers["x-request-id"];
  const requestId =
    typeof incoming === "string" && incoming.length <= 128
      ? incoming
      : randomUUID();
  res.setHeader("x-request-id", requestId);

  const context: RequestContext = {
    requestId,
    userId: null,
    path: "",
    method: "",
  };
  storage.run(context, next);
};

export const getRequestContext = (): RequestContext | undefined =>
  storage.getStore();

export const runWithRequestContext = <T>(
  context: RequestContext,
  fn: () => T,
): T => storage.run(context, fn);

/** Best-effort request id for log lines outside a request (startup, jobs). */
export const currentRequestId = (): string | undefined =>
  storage.getStore()?.requestId;
