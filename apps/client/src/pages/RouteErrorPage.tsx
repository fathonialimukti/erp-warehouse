import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router";
import { useIntl } from "react-intl";
import { Button, Card } from "@heroui/react";
import { AppIcon } from "../components/AppIcon";
import { PageTitle } from "../components/PageTitle";

type RouteErrorShape =
  | { kind: "response"; status: number; statusText: string; data: unknown }
  | { kind: "error"; error: Error }
  | { kind: "unknown" };

function classifyError(error: unknown): RouteErrorShape {
  if (isRouteErrorResponse(error))
    return {
      kind: "response",
      status: error.status,
      statusText: error.statusText,
      data: error.data,
    };
  if (error instanceof Error) return { kind: "error", error };
  return { kind: "unknown" };
}

function RouteErrorPage() {
  const intl = useIntl();
  const error = useRouteError();
  const navigate = useNavigate();

  const genericTitle = intl.formatMessage({ id: "common.error.title" });
  const shape = classifyError(error);

  // HTTP responses keep their own status line; anything else gets the generic label.
  const title =
    shape.kind === "response"
      ? `${shape.status} ${shape.statusText}`.trim()
      : genericTitle;

  const detail =
    shape.kind === "response"
      ? typeof shape.data === "string" && shape.data.trim()
        ? shape.data
        : intl.formatMessage(
            { id: "common.error.status_detail" },
            { status: shape.status },
          )
      : shape.kind === "error"
        ? shape.error.message
        : intl.formatMessage({ id: "common.error.unknown" });

  return (
    <div data-ai-context={JSON.stringify({ section: "route-error" })}>
      <PageTitle title={title || genericTitle} />
      <Card variant="secondary" className="mx-auto max-w-2xl">
        <Card.Header>
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-danger/10">
              <AppIcon name="warning" className="size-6 text-danger" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-danger">
                {intl.formatMessage({ id: "common.error.eyebrow" })}
              </p>
              <Card.Title>{title || genericTitle}</Card.Title>
              <Card.Description>{detail}</Card.Description>
            </div>
          </div>
        </Card.Header>

        <Card.Content className="space-y-3">
          <p className="text-sm text-muted">
            {intl.formatMessage({ id: "common.error.description" })}
          </p>

          {/* Inlined `import.meta.env.DEV` guard (not a module const) so Vite
              folds the branch to `false` and the minifier drops the markup —
              production users get the message and the actions, never a stack. */}
          {import.meta.env.DEV &&
          shape.kind === "error" &&
          shape.error.stack ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                {intl.formatMessage({ id: "common.error.technical_details" })}
              </p>
              <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-surface-secondary p-3 text-xs text-foreground">
                {shape.error.stack}
              </pre>
            </div>
          ) : null}
        </Card.Content>

        <Card.Footer>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onPress={() => navigate(-1)}>
              {intl.formatMessage({ id: "common.action.go_back" })}
            </Button>
            <Button onPress={() => navigate("/dashboard")}>
              {intl.formatMessage({ id: "common.action.go_home" })}
            </Button>
          </div>
        </Card.Footer>
      </Card>
    </div>
  );
}

export { RouteErrorPage };
