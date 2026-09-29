import { type ReactNode } from "react";
import { Icon } from "@iconify/react";

export type PillColor = "accent" | "success" | "danger";

interface FilterPillProps {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: PillColor;
  icon?: ReactNode;
  "aria-label"?: string;
}

const COLOR_VAR: Record<PillColor, string> = {
  accent: "var(--accent)",
  success: "var(--success)",
  danger: "var(--danger)",
};

export function FilterPill({
  label,
  active,
  onPress,
  color = "accent",
  icon,
  "aria-label": ariaLabel,
}: FilterPillProps) {
  const c = COLOR_VAR[color];
  const iconNode =
    typeof icon === "string" ? (
      <Icon
        icon={icon}
        className={`size-4 ${active ? "text-accent-foreground" : "text-(--muted-foreground)"}`}
      />
    ) : (
      icon
    );
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel ?? label}
      onClick={onPress}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
      style={
        active
          ? { background: c, borderColor: c, color: "var(--accent-foreground)" }
          : { borderColor: "var(--border)", color: "var(--foreground)" }
      }
    >
      {iconNode}
      <span>{label}</span>
    </button>
  );
}
