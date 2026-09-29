import type { Response } from "express";

/**
 * SSE connection manager.
 *
 * SCALING CONSTRAINT: This stores connections in process memory.
 * For horizontal scaling, replace with Redis pub/sub or similar.
 * Current deployment target: single-instance PM2 (fork mode).
 */
type SseClient = Response;

const subscribers = new Map<string, Set<SseClient>>();

export const sseManager = {
  subscribe(userId: string, res: SseClient) {
    if (!subscribers.has(userId)) {
      subscribers.set(userId, new Set());
    }
    subscribers.get(userId)!.add(res);
  },

  unsubscribe(userId: string, res: SseClient) {
    subscribers.get(userId)?.delete(res);
    if (subscribers.get(userId)?.size === 0) {
      subscribers.delete(userId);
    }
  },

  broadcast(userId: string, payload: unknown) {
    const clients = subscribers.get(userId);
    if (!clients?.size) return;
    const line = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of clients) {
      client.write(line);
    }
  },

  closeAll() {
    for (const clients of subscribers.values()) {
      for (const client of clients) {
        client.end();
      }
    }
    subscribers.clear();
  },
};
