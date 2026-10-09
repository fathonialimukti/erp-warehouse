import { useState } from "react";
import { type ReactNode } from "react";
import { useIntl } from "react-intl";
import { FilterPill, type PillColor } from "./FilterPill";

export interface PillOption {
  value: string;
  label: string;
  color?: PillColor;
  icon?: ReactNode;
}

interface FilterPillGroupProps {
  options: PillOption[];
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
  maxVisible?: number;
}

export function FilterPillGroup({
  options,
  value,
  onChange,
  allLabel,
  maxVisible = 8,
}: FilterPillGroupProps) {
  const intl = useIntl();
  const [expanded, setExpanded] = useState(false);

  const selected = [value].filter(Boolean);
  const toggle = (v: string) => {
    onChange(selected[0] === v ? "" : v);
  };

  const visible = expanded ? options : options.slice(0, maxVisible);
  const hiddenCount = expanded ? 0 : Math.max(options.length - maxVisible, 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {allLabel && (
        <FilterPill
          label={allLabel}
          icon="circle"
          active={selected.length === 0}
          onPress={() => onChange("")}
        />
      )}
      {visible.map((o) => (
        <FilterPill
          key={o.value}
          label={o.label}
          color={o.color}
          icon={o.icon}
          active={selected.includes(o.value)}
          onPress={() => toggle(o.value)}
        />
      ))}
      {hiddenCount > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="rounded-full border border-dashed px-3 py-1.5 text-sm text-muted hover:text-foreground"
        >
          {intl.formatMessage(
            {
              id: "stock_movement.filter_type_more",
              defaultMessage: "+{count} more",
            },
            { count: hiddenCount },
          )}
        </button>
      )}
    </div>
  );
}
