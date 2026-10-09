import { useIntl } from "react-intl";
import { AppIcon } from "../AppIcon";

interface ActiveFilterChipsProps {
  filters: { label: string; onClear: () => void }[];
  onClearAll: () => void;
}

export function ActiveFilterChips({
  filters,
  onClearAll,
}: ActiveFilterChipsProps) {
  const intl = useIntl();

  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted">
        {intl.formatMessage({
          id: "stock_movement.active_filters",
          defaultMessage: "Active:",
        })}
      </span>
      {filters.map((f) => (
        <span
          key={f.label}
          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          {f.label}
          <button
            type="button"
            onClick={f.onClear}
            aria-label={`${intl.formatMessage({ id: "common.action.cancel", defaultMessage: "Cancel" })} ${f.label}`}
            className="rounded-full p-0.5 hover:bg-black/5"
          >
            <AppIcon name="close-circle" className="size-3.5" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs font-medium underline underline-offset-2 hover:opacity-80"
      >
        {intl.formatMessage({
          id: "stock_movement.clear_all",
          defaultMessage: "Clear all",
        })}
      </button>
    </div>
  );
}
