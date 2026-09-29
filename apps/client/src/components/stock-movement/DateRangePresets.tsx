import { useState } from "react";
import { useIntl } from "react-intl";
import { FilterPill, type PillColor } from "./FilterPill";

type Preset = "today" | "7d" | "30d" | "month" | "custom";

interface DateRangePresetsProps {
  dateFrom: string;
  dateTo: string;
  onChange: (from: string, to: string) => void;
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function DateRangePresets({
  dateFrom,
  dateTo,
  onChange,
}: DateRangePresetsProps) {
  const intl = useIntl();
  const [preset, setPreset] = useState<Preset>(() => {
    if (!dateFrom || !dateTo) return "custom";
    const today = toDateStr(startOfToday());
    if (dateFrom === today && dateTo === today) return "today";
    const d7 = toDateStr(new Date(Date.now() - 7 * 86400000));
    if (dateFrom === d7 && dateTo === today) return "7d";
    const d30 = toDateStr(new Date(Date.now() - 30 * 86400000));
    if (dateFrom === d30 && dateTo === today) return "30d";
    const mStart = toDateStr(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    );
    if (dateFrom === mStart && dateTo === today) return "month";
    return "custom";
  });

  const applyPreset = (p: Preset) => {
    setPreset(p);
    const today = startOfToday();
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    const endStr = toDateStr(end);
    switch (p) {
      case "today":
        onChange(toDateStr(today), endStr);
        break;
      case "7d":
        onChange(toDateStr(new Date(Date.now() - 7 * 86400000)), endStr);
        break;
      case "30d":
        onChange(toDateStr(new Date(Date.now() - 30 * 86400000)), endStr);
        break;
      case "month": {
        const mStart = toDateStr(
          new Date(today.getFullYear(), today.getMonth(), 1),
        );
        onChange(mStart, endStr);
        break;
      }
      case "custom":
        onChange(dateFrom, dateTo);
        break;
    }
  };

  const options: { value: Preset; label: string; color?: PillColor }[] = [
    {
      value: "today",
      label: intl.formatMessage({
        id: "stock_movement.filter_preset_today",
        defaultMessage: "Today",
      }),
    },
    {
      value: "7d",
      label: intl.formatMessage({
        id: "stock_movement.filter_preset_7d",
        defaultMessage: "7d",
      }),
    },
    {
      value: "30d",
      label: intl.formatMessage({
        id: "stock_movement.filter_preset_30d",
        defaultMessage: "30d",
      }),
    },
    {
      value: "month",
      label: intl.formatMessage({
        id: "stock_movement.filter_preset_this_month",
        defaultMessage: "Month",
      }),
    },
    {
      value: "custom",
      label: intl.formatMessage({
        id: "stock_movement.filter_preset_custom",
        defaultMessage: "Custom",
      }),
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {options.map((o) => (
          <FilterPill
            key={o.value}
            label={o.label}
            active={preset === o.value}
            onPress={() => applyPreset(o.value)}
          />
        ))}
      </div>
      {preset === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onChange(e.target.value, dateTo)}
            className="rounded-large border bg-transparent px-3 py-1.5 text-sm"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          />
          <span className="text-xs text-muted">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onChange(dateFrom, e.target.value)}
            className="rounded-large border bg-transparent px-3 py-1.5 text-sm"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          />
        </div>
      )}
    </div>
  );
}
