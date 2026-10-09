import { useCallback, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { Button, Card, Chip, Spinner } from "@heroui/react";
import { AppIcon } from "../AppIcon";
import type { IconName } from "../AppIcon";
import { useAtomValue } from "jotai";
import { authUserAtom } from "../../lib/atoms";
import { requestToolOutput } from "../../lib/aiOneShot";

interface Anomaly {
  type: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  createdAt: string;
}

type Status = "idle" | "loading" | "success" | "error";

const SEVERITY_META: Record<
  Anomaly["severity"],
  { color: "danger" | "warning" | "default"; icon: IconName; labelKey: string }
> = {
  HIGH: {
    color: "danger",
    icon: "warning",
    labelKey: "aiInsights.severity_high",
  },
  MEDIUM: {
    color: "warning",
    icon: "alert",
    labelKey: "aiInsights.severity_medium",
  },
  LOW: {
    color: "default",
    icon: "info",
    labelKey: "aiInsights.severity_low",
  },
};

export function AiInsightsCard() {
  const intl = useIntl();
  const user = useAtomValue(authUserAtom);
  const [status, setStatus] = useState<Status>("idle");
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(() => {
    const requestId = ++requestIdRef.current;
    const chatId = user?.id ? `ai-insights-${user.id}` : "ai-insights-anon";

    setStatus("loading");
    setError(null);

    void requestToolOutput({
      toolName: "get_anomalies",
      instruction: "Run get_anomalies and return the anomalies list.",
      chatId,
    })
      .then((output) => {
        if (requestIdRef.current !== requestId) return; // stale response
        if (
          output &&
          typeof output === "object" &&
          Array.isArray((output as { anomalies?: unknown }).anomalies)
        ) {
          setAnomalies((output as { anomalies: Anomaly[] }).anomalies);
          setStatus("success");
        } else {
          setAnomalies([]);
          setStatus("success");
        }
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return;
        setError(err instanceof Error ? err.message : "AI Insights failed");
        setStatus("error");
      });
  }, [user?.id]);

  const sorted = [...anomalies].sort(
    (a, b) =>
      (a.severity === "HIGH" ? 0 : a.severity === "MEDIUM" ? 1 : 2) -
      (b.severity === "HIGH" ? 0 : b.severity === "MEDIUM" ? 1 : 2),
  );

  return (
    <Card>
      <Card.Header>
        <div className="flex w-full items-center justify-between">
          <div>
            <Card.Title>
              {intl.formatMessage({
                id: "aiInsights.title",
                defaultMessage: "AI Insights",
              })}
            </Card.Title>
            <Card.Description>
              {intl.formatMessage({
                id: "aiInsights.subtitle",
                defaultMessage: "Proactive warehouse health monitoring",
              })}
            </Card.Description>
          </div>
          {status !== "idle" && (
            <Button
              size="sm"
              variant="ghost"
              onPress={load}
              isDisabled={status === "loading"}
            >
              <AppIcon name="refresh" className="size-4" />
              {intl.formatMessage({
                id: "aiInsights.refresh",
                defaultMessage: "Refresh",
              })}
            </Button>
          )}
        </div>
      </Card.Header>
      <Card.Content className="space-y-2">
        {status === "idle" && (
          <div className="flex flex-col items-start gap-3 py-4">
            <p className="text-sm text-muted">
              {intl.formatMessage({
                id: "aiInsights.idle",
                defaultMessage:
                  "Run a proactive health check for dead stock, out-of-stock SKUs, and backlog.",
              })}
            </p>
            <Button size="sm" variant="primary" onPress={load}>
              <AppIcon name="sparkles" className="size-4" />
              {intl.formatMessage({
                id: "aiInsights.check",
                defaultMessage: "Run health check",
              })}
            </Button>
          </div>
        )}

        {status === "loading" && (
          <div className="flex items-center gap-2 text-sm text-muted py-4">
            <Spinner size="sm" />
            {intl.formatMessage({
              id: "aiInsights.loading",
              defaultMessage: "Analyzing warehouse health...",
            })}
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-start gap-3 py-4">
            <p className="text-sm text-danger">{error}</p>
            <Button size="sm" variant="ghost" onPress={load}>
              {intl.formatMessage({
                id: "aiInsights.refresh",
                defaultMessage: "Refresh",
              })}
            </Button>
          </div>
        )}

        {status === "success" && sorted.length === 0 && (
          <p className="py-4 text-sm text-muted">
            {intl.formatMessage({
              id: "aiInsights.empty",
              defaultMessage: "No anomalies detected",
            })}
          </p>
        )}

        {status === "success" && sorted.length > 0 && (
          <ul className="space-y-2">
            {sorted.map((a, i) => {
              const meta = SEVERITY_META[a.severity];
              return (
                <li
                  key={`${a.type}-${i}`}
                  className="flex items-start gap-2.5 rounded-xl bg-surface-hover px-3 py-2.5"
                >
                  <AppIcon
                    name={meta.icon}
                    className="mt-0.5 size-4 shrink-0 text-muted"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {a.title}
                      </span>
                      <Chip size="sm" variant="soft" color={meta.color}>
                        {intl.formatMessage({
                          id: meta.labelKey,
                          defaultMessage: a.severity,
                        })}
                      </Chip>
                    </div>
                    <p className="mt-0.5 text-xs text-muted leading-relaxed">
                      {a.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card.Content>
    </Card>
  );
}
