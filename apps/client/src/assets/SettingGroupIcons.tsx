import type { ComponentType, SVGProps } from 'react';
import type { SettingGroupId } from '@repo/schemas/settings';

/**
 * Colorful settings group icons (inline SVG, 64×64 rounded rect style
 * matching the nav icon family in `assets/icons/nav-*.svg`).
 */

type SettingGroupIconProps = SVGProps<SVGSVGElement> & { size?: number };

const IconFrame = ({ children, size = 48, frameFill, ...rest }: SettingGroupIconProps & { frameFill: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width={size} height={size} {...rest}>
    <rect x="2" y="2" width="60" height="60" rx="14" fill={frameFill} />
    {children}
  </svg>
);

/* ── Rate Limiting (gauge) ─────────────────────────────────── */
const RateLimitIcon = ({ size = 48, ...props }: SettingGroupIconProps) => (
  <IconFrame size={size} frameFill="#EFF6FF" {...props}>
    <path d="M14 42 A18 18 0 0 1 50 42" fill="none" stroke="#0EA5E9" strokeWidth="5" strokeLinecap="round" />
    <path d="M20 28 l3 3 M32 24 v4 M44 28 l-3 3" fill="none" stroke="#7DD3FC" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M32 42 L42 31" fill="none" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
    <circle cx="32" cy="42" r="4.5" fill="#F59E0B" />
    <path d="M20 50 h24" fill="none" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
  </IconFrame>
);

/* ── Logging (document lines) ──────────────────────────────── */
const LogsIcon = ({ size = 48, ...props }: SettingGroupIconProps) => (
  <IconFrame size={size} frameFill="#ECFDF5" {...props}>
    <rect x="18" y="12" width="24" height="40" rx="4" fill="#10B981" />
    <path d="M32 12 l10 10 h-10 z" fill="#6EE7B7" />
    <path d="M24 30 h12 M24 36 h12 M24 42 h8" fill="none" stroke="#ECFDF5" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="45" cy="45" r="9" fill="#3B82F6" />
    <path d="M41.5 45 a3.5 3.5 0 0 1 7 0 a3.5 3.5 0 0 1 -7 0 M48.5 42 v5" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
  </IconFrame>
);

/* ── Security (shield lock) ────────────────────────────────── */
const SecurityIcon = ({ size = 48, ...props }: SettingGroupIconProps) => (
  <IconFrame size={size} frameFill="#F5F3FF" {...props}>
    <path d="M32 11 l15 6 v12 c0 11-6.5 17.5-15 21.5-8.5-4-15-10.5-15-21.5V17 z" fill="#8B5CF6" />
    <path d="M32 16 l10 4.2 v9.3 c0 7.5-4.3 12-10 15.2-5.7-3.2-10-7.7-10-15.2 v-9.3 z" fill="#A78BFA" />
    <rect x="26" y="32" width="12" height="10" rx="2.5" fill="#FBBF24" />
    <path d="M29 32 v-3.5 a3 3 0 0 1 6 0 V32" fill="none" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="32" cy="36.5" r="1.8" fill="#FFFFFF" />
  </IconFrame>
);

/* ── Mail (envelope) ───────────────────────────────────────── */
const MailIcon = ({ size = 48, ...props }: SettingGroupIconProps) => (
  <IconFrame size={size} frameFill="#FFF1F2" {...props}>
    <rect x="13" y="19" width="38" height="27" rx="5" fill="#F43F5E" />
    <path d="M15.5 24 l16.5 12.5 16.5-12.5" fill="none" stroke="#FDA4AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="47" cy="44" r="9" fill="#FBBF24" />
    <path d="M43.5 44 a3.5 3.5 0 0 1 7 0 c0 2-1.5 3.5-3.5 3.5" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
  </IconFrame>
);

/* ── Scheduled Reports (bar chart) ─────────────────────────── */
const ReportsIcon = ({ size = 48, ...props }: SettingGroupIconProps) => (
  <IconFrame size={size} frameFill="#FFFBEB" {...props}>
    <path d="M18 13 v37 h33" fill="none" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="24" y="37" width="6" height="10" rx="2" fill="#FBBF24" />
    <rect x="34" y="30" width="6" height="17" rx="2" fill="#F59E0B" />
    <rect x="44" y="22" width="6" height="25" rx="2" fill="#3B82F6" />
    <circle cx="22" cy="17" r="4.5" fill="#FBBF24" />
    <path d="M20.5 17 l1.2 1.2 2-2.2" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </IconFrame>
);

/* ── AI Configuration (spark chip) ─────────────────────────── */
const AiIcon = ({ size = 48, ...props }: SettingGroupIconProps) => (
  <IconFrame size={size} frameFill="#FDF4FF" {...props}>
    <path d="M26 15 v5 M38 15 v5 M26 44 v5 M38 44 v5 M15 26 h5 M15 38 h5 M44 26 h5 M44 38 h5" fill="none" stroke="#F0ABFC" strokeWidth="2.5" strokeLinecap="round" />
    <rect x="20" y="20" width="24" height="24" rx="7" fill="#A21CAF" />
    <path d="M32 24 l2.4 5.6 5.6 2.4 -5.6 2.4 -2.4 5.6 -2.4-5.6 -5.6-2.4 5.6-2.4 z" fill="#FFFFFF" />
    <circle cx="46" cy="46" r="5" fill="#22D3EE" />
  </IconFrame>
);

export const SETTING_GROUP_ICON_REGISTRY: Record<SettingGroupId, ComponentType<SettingGroupIconProps>> = {
  ratelimit: RateLimitIcon,
  logs: LogsIcon,
  security: SecurityIcon,
  mail: MailIcon,
  reports: ReportsIcon,
  ai: AiIcon,
};
