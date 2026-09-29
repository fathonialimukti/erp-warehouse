import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { authBootstrapReadyAtom, isAuthenticatedAtom } from "./atoms";
import { showPushNotification } from "./push-notification";

const SSE_URL = "/notifications/stream";

interface SseNotificationPayload {
  title: string;
  message: string;
  actionUrl?: string | null;
}

interface SseEvent {
  type: "connected" | "notification";
  payload?: SseNotificationPayload;
}

/**
 * Opens a persistent SSE connection to the server.
 * On each incoming notification:
 *   1. Invalidates notification query cache (updates badge + drawer)
 *   2. Fires an OS/browser push notification
 *
 * Reconnects with exponential backoff on error.
 * Mount once in PrivateLayout after auth bootstrap.
 */
export const useNotificationStream = () => {
  const queryClient = useQueryClient();
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);
  const isReady = useAtomValue(authBootstrapReadyAtom);
  const esRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayRef = useRef(1_000);

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;

    const connect = () => {
      const es = new EventSource(SSE_URL, { withCredentials: true });
      esRef.current = es;

      es.onopen = () => {
        retryDelayRef.current = 1_000;
      };

      es.onmessage = (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data) as SseEvent;
          if (data.type === "notification" && data.payload) {
            void queryClient.invalidateQueries({ queryKey: ["notifications"] });
            void queryClient.invalidateQueries({
              queryKey: ["notificationUnreadCount"],
            });
            void showPushNotification(
              data.payload.title,
              data.payload.message,
              data.payload.actionUrl ?? undefined,
            );
          }
        } catch {
          // skip malformed events
        }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30_000);
        retryTimeoutRef.current = setTimeout(connect, retryDelayRef.current);
      };
    };

    connect();

    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [isReady, isAuthenticated, queryClient]);
};
