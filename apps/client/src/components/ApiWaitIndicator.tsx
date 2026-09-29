import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { Icon } from "@iconify/react";
import { onApiWaitingChange } from "../lib/trpc";

/**
 * Subtle pill shown in the Navbar while requests are silently waiting on the
 * server-side rate limiter (transparent 429 auto-retry). Never blocks UI.
 */
export function ApiWaitIndicator() {
  const intl = useIntl();
  const [waitingCount, setWaitingCount] = useState(0);

  useEffect(() => {
    let count = 0;
    return onApiWaitingChange((delta) => {
      count = Math.max(0, count + delta);
      setWaitingCount(count);
    });
  }, []);

  if (waitingCount === 0) return null;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning"
      role="status"
      aria-live="polite"
      aria-label={intl.formatMessage({
        id: "nav.api_waiting",
        defaultMessage: "Requests are waiting",
      })}
    >
      <Icon icon="solar:hourglass-linear" className="size-3.5 animate-pulse" />
      {intl.formatMessage({
        id: "nav.api_waiting",
        defaultMessage: "Waiting…",
      })}
    </span>
  );
}
