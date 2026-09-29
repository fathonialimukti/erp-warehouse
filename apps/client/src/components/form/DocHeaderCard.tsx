import { Card } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { ReactNode } from "react";

interface DocHeaderCardProps {
  title: string;
  description?: string;
  /** Iconify icon beside the title — accent coloured, e.g. `'solar:document-text-linear'`. */
  icon?: string;
  /** Right-aligned header action (e.g. an "Add Item" button on line cards). */
  action?: ReactNode;
  /** Wrap children in the canonical two-column field grid. Defaults to `true`. */
  columns?: boolean;
  children: ReactNode;
}

/**
 * Header card for document forms (General Information, Shipment & Driver,
 * Notes & Attachments…). Mirrors the receiving recipe: `Card.Header` with an
 * accent icon + title + description, fields in a two-column grid inside
 * `Card.Content`.
 *
 * Purchase-order pages extend via `children` (extra totals/tax fields) —
 * never by forking this card.
 */
export function DocHeaderCard({
  title,
  description,
  icon,
  action,
  columns = true,
  children,
}: DocHeaderCardProps) {
  return (
    <Card>
      <Card.Header className="flex flex-row items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon ? (
            <Icon icon={icon} className="size-[18px] shrink-0 text-accent" />
          ) : null}
          <div className="min-w-0">
            <Card.Title>{title}</Card.Title>
            {description ? (
              <Card.Description>{description}</Card.Description>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </Card.Header>
      <Card.Content>
        {columns ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {children}
          </div>
        ) : (
          children
        )}
      </Card.Content>
    </Card>
  );
}
