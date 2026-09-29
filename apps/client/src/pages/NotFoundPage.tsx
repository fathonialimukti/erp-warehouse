import { useNavigate } from "react-router";
import { useIntl } from "react-intl";
import { Button, Card } from "@heroui/react";
import { Icon } from "@iconify/react";
import { PageTitle } from "../components/PageTitle";

function NotFoundPage() {
  const intl = useIntl();
  const navigate = useNavigate();

  const title = intl.formatMessage({ id: "common.not_found.title" });
  const code = intl.formatMessage({ id: "common.not_found.code" });

  return (
    <div data-ai-context={JSON.stringify({ section: "not-found" })}>
      <PageTitle title={title} />
      <Card variant="secondary" className="mx-auto max-w-2xl">
        <Card.Header>
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/10">
              <Icon
                icon="solar:compass-bold-duotone"
                className="size-6 text-accent"
              />
            </div>
            <div className="space-y-1">
              <p className="font-mono text-xs font-semibold uppercase tracking-widest tabular-nums text-accent">
                {code}
              </p>
              <Card.Title>{title}</Card.Title>
              <Card.Description>
                {intl.formatMessage({ id: "common.not_found.description" })}
              </Card.Description>
            </div>
          </div>
        </Card.Header>
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

export { NotFoundPage };
