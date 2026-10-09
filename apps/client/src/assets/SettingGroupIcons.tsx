import type { ComponentType, SVGProps } from "react";
import type { SettingGroupId } from "@repo/schemas/settings";

/**
 * Settings group icons — tile family (32×32).
 *
 * Same construction as `assets/icons/nav-*.svg`: a tinted squircle with a
 * 24-grid glyph in the accent hue, scaled to 74% and centred. Colour comes
 * from the `--icon-*` tokens in `index.css`, so dark mode needs no variant.
 * See `docs/design/design.md` for the full spec.
 */

type SettingGroupIconProps = SVGProps<SVGSVGElement> & { size?: number };

const IconFrame = ({
  children,
  size = 44,
  tone,
  ...rest
}: SettingGroupIconProps & {
  tone: "blue" | "slate" | "red" | "indigo" | "teal" | "purple";
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 32 32"
    width={size}
    height={size}
    {...rest}
  >
    <rect
      x="2"
      y="2"
      width="28"
      height="28"
      rx="8.5"
      fill={`var(--icon-${tone}-bg)`}
    />
    <g
      transform="translate(16 16) scale(0.74) translate(-12 -12)"
      fill="none"
      stroke={`var(--icon-${tone})`}
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </g>
  </svg>
);

/* ── Rate Limiting (gauge) ─────────────────────────────────── */
const RateLimitIcon = ({ size = 44, ...props }: SettingGroupIconProps) => (
  <IconFrame size={size} tone="blue" {...props}>
    <path d="M3.75 18a8.25 8.25 0 0 1 16.5 0" />
    <path d="m12 18 4.25-6.75" />
    <circle cx="12" cy="18" r="1.5" />
  </IconFrame>
);

/* ── Logging (document lines) ──────────────────────────────── */
const LogsIcon = ({ size = 44, ...props }: SettingGroupIconProps) => (
  <IconFrame size={size} tone="slate" {...props}>
    <path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5l-5-5Z" />
    <path d="M13.5 3.5v5h5" />
    <path d="M9 13h6" />
    <path d="M9 16.5h4" />
  </IconFrame>
);

/* ── Security (shield lock) ────────────────────────────────── */
const SecurityIcon = ({ size = 44, ...props }: SettingGroupIconProps) => (
  <IconFrame size={size} tone="red" {...props}>
    <path d="M12 2.75 20 6v6.4c0 4.75-3.35 7.25-8 8.85-4.65-1.6-8-4.1-8-8.85V6l8-3.25Z" />
    <rect x="9.25" y="11.75" width="5.5" height="5" rx="1.5" />
    <path d="M10.5 11.75v-1.5a1.5 1.5 0 0 1 3 0v1.5" />
  </IconFrame>
);

/* ── Mail (envelope) ───────────────────────────────────────── */
const MailIcon = ({ size = 44, ...props }: SettingGroupIconProps) => (
  <IconFrame size={size} tone="indigo" {...props}>
    <rect x="3" y="5.5" width="18" height="13" rx="3" />
    <path d="m4.5 8.5 6.6 4.5a1.4 1.4 0 0 0 1.8 0L19.5 8.5" />
  </IconFrame>
);

/* ── Scheduled Reports (bar chart) ─────────────────────────── */
const ReportsIcon = ({ size = 44, ...props }: SettingGroupIconProps) => (
  <IconFrame size={size} tone="teal" {...props}>
    <path d="M3.5 3.75v16.5h17" />
    <path d="M8.5 17.25v-4.5" />
    <path d="M12 17.25v-8" />
    <path d="M15.5 17.25v-6" />
  </IconFrame>
);

/* ── AI Configuration (sparkle) ────────────────────────────── */
const AiIcon = ({ size = 44, ...props }: SettingGroupIconProps) => (
  <IconFrame size={size} tone="purple" {...props}>
    <path d="m10.25 3.75 1.75 5L17 10.5l-5 1.75-1.75 5L8.5 12.25 3.5 10.5l5-1.75 1.75-5Z" />
    <path d="m18 14.5.75 2 2 .75-2 .75L18 20l-.75-2-2-.75 2-.75.75-2Z" />
  </IconFrame>
);

export const SETTING_GROUP_ICON_REGISTRY: Record<
  SettingGroupId,
  ComponentType<SettingGroupIconProps>
> = {
  ratelimit: RateLimitIcon,
  logs: LogsIcon,
  security: SecurityIcon,
  mail: MailIcon,
  reports: ReportsIcon,
  ai: AiIcon,
};
