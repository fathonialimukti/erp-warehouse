import { Card } from "@heroui/react";
import { AppIcon } from "../AppIcon";
import type { IconName } from "../AppIcon";
import type { ReactNode } from "react";

export interface PreviewRow {
  label: string;
  value?: string | number | null;
  icon?: IconName;
  /** Fallback text when the value is empty (defaults to "—"). */
  emptyLabel?: string;
  tone?: "accent" | "default" | "success" | "warning" | "danger";
}

export interface FormPreviewCardProps {
  title: string;
  icon: IconName;
  description?: string;
  rows: PreviewRow[];
  /** Label above the completion meter, e.g. "Completed". */
  fillLabel: string;
  /** Optional footer content (e.g. AI fill tip). */
  footer?: ReactNode;
}

const TONE_CLASS: Record<NonNullable<PreviewRow["tone"]>, string> = {
  accent: "text-accent",
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

/**
 * Live preview rail for creative forms. Renders a configurable summary of the
 * values being typed, with a completion meter that fills in as fields are
 * completed. Empty rows show a muted dash so the user always sees the shape of
 * the record they are building.
 */
export function FormPreviewCard({
  title,
  icon,
  description,
  rows,
  fillLabel,
  footer,
}: FormPreviewCardProps) {
  const filled = rows.filter((row) => {
    const v = row.value;
    return v !== undefined && v !== null && String(v).trim() !== "";
  }).length;
  const total = rows.length;
  const pct = total === 0 ? 0 : Math.round((filled / total) * 100);

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-2">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
            <AppIcon name={icon} className="size-5" />
          </div>
          <Card.Title>{title}</Card.Title>
        </div>
        {description ? (
          <Card.Description>{description}</Card.Description>
        ) : null}
      </Card.Header>
      <Card.Content>
        <dl className="space-y-3">
          {rows.map((row) => {
            const isEmpty =
              row.value === undefined ||
              row.value === null ||
              String(row.value).trim() === "";
            return (
              <div
                key={row.label}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <dt className="flex min-w-0 items-center gap-2 text-muted">
                  {row.icon ? (
                    <AppIcon name={row.icon} className="size-4 shrink-0" />
                  ) : null}
                  <span className="truncate">{row.label}</span>
                </dt>
                <dd
                  className={`min-w-0 text-right font-medium ${isEmpty ? "text-muted" : TONE_CLASS[row.tone ?? "default"]}`}
                >
                  <span className="block truncate">
                    {isEmpty ? (row.emptyLabel ?? "—") : row.value}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>

        <div className="mt-4 rounded-xl bg-default-100 px-3 py-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted">{fillLabel}</span>
            <span className="font-mono tabular-nums text-foreground">
              {filled}/{total}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-default-200">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {footer ? <div className="mt-4">{footer}</div> : null}
      </Card.Content>
    </Card>
  );
}
