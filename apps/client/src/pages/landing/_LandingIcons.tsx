/**
 * Custom AI-generated SVG icon components for the landing page.
 * Replaces @iconify/react solar:* icons with clean, consistent geometric SVGs.
 */

interface IconProps {
  className?: string;
}

const defaultSize = 'size-4';

function icon(size: string) {
  return { width: 16, height: 16, viewBox: '0 0 24 24', className: size };
}

// ─── Navigation ───

export function BuildingsIcon({ className = defaultSize }: IconProps) {
  const { width, height, viewBox } = icon(className);
  return (
    <svg width={width} height={height} viewBox={viewBox} className={className} fill="currentColor">
      <path d="M3 21V7l8-4v4h2V3l8 4v14H3zm2-2h3v-3H5v3zm5 0h3v-3h-3v3zm5 0h3v-3h-3v3zM5 13h3V9H5v4zm5 0h3V9h-3v4zm5-2h3V9h-3v2z" />
    </svg>
  );
}

export function HamburgerIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function CloseIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function ChatIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 3C6.5 3 2 6.6 2 11c0 2 1 3.8 2.5 5.1L3 21l5.5-1.5c1 .4 2.3.5 3.5.5 5.5 0 10-3.6 10-8s-4.5-8-10-8z" />
    </svg>
  );
}

// ─── Hero ───

export function StarIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2l2.8 6.6L22 9.5l-5 5.4 1 7.1-6-3.2-6 3.2 1-7.1-5-5.4 7.2-.9L12 2z" />
    </svg>
  );
}

export function PlayIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M8 5.5v13l11-6.5L8 5.5z" />
    </svg>
  );
}

export function GalleryIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M22 3H2v18h20V3zm-2 16H4V5h16v14zm-3-8l-3 4-2-3-3 4V7h8v4z" />
    </svg>
  );
}

export function CheckCircleIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.5 15L5.5 12l1.4-1.4 3.6 3.6 7.6-7.6L19.5 8l-9 9z" />
    </svg>
  );
}

export function CubeIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 22V12M2 7l10 5 10-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Services ───

export function RobotIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2a2 2 0 012 2c0 .7-.4 1.4-1 1.7V7h5a3 3 0 013 3v1a3 3 0 01-3 3h-1v1a3 3 0 01-3 3H8a3 3 0 01-3-3v-1H4a3 3 0 01-3-3v-1a3 3 0 013-3h5V5.7c-.6-.3-1-1-1-1.7a2 2 0 012-2h2zM8 15h8v2H8v-2zm-1-6H4a1 1 0 00-1 1v1a1 1 0 001 1h3V9zm10 0v2h3a1 1 0 001-1v-1a1 1 0 00-1-1h-3z" />
    </svg>
  );
}

export function BoxIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path fillRule="evenodd" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M2 7v10l10 5V12L2 7zm20 0v10l-10 5V12l10-5z" fill="currentColor" fillOpacity="0.15" />
    </svg>
  );
}

export function LightbulbIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2a7 7 0 00-7 7c0 2.4 1.2 4.5 3 5.7V17a2 2 0 002 2h4a2 2 0 002-2v-2.3c1.8-1.2 3-3.3 3-5.7a7 7 0 00-7-7zm-1 17h2v1a1 1 0 01-1 1h0a1 1 0 01-1-1v-1z" />
    </svg>
  );
}

// ─── Process ───

export function SearchIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function PenIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M3 17.3V21h3.7L17.8 9.9l-3.7-3.7L3 17.3zM20.7 7c.4-.4.4-1 0-1.4l-2.3-2.3c-.4-.4-1-.4-1.4 0l-1.8 1.8 3.7 3.7L20.7 7z" />
    </svg>
  );
}

export function CodeIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

export function RocketIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2.5s-4.5.5-8 4c-2 2-2 5.5-2 8.5l3-3c.5.5 1.2.8 2 .8 1.7 0 3-1.3 3-3 0-.8-.3-1.5-.8-2l3-3c3 0 6.5 0 8.5-2 3.5-3.5 4-8 4-8s-4.5.5-8 4zM9.5 14.5c-.8.8-.8 2.2 0 3s2.2.8 3 0 .8-2.2 0-3-2.2-.8-3 0z" />
    </svg>
  );
}

export function ChecklistIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="3" rx="1" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

// ─── Gallery/Portfolio ───

export function ArrowLeftIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export function ArchiveIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M20 3H4a2 2 0 00-2 2v2a2 2 0 001 1.7V19a2 2 0 002 2h14a2 2 0 002-2V8.7A2 2 0 0022 7V5a2 2 0 00-2-2zM5 9h14v10H5V9zm5 3h4v2h-4v-2z" />
    </svg>
  );
}

export function ClockIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

export function DeliveryIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M2 4h14v2h2l4 4v5h-2a3 3 0 01-6 0H8a3 3 0 01-6 0H2V4zm14 2h3.5l2.5 3H16V6zM5 18.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm12 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
    </svg>
  );
}

export function MagnifierIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

// ─── About ───

export function UserHandIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z" />
      <path d="M17 4l2 2-2 2M15 6h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function DiplomaIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2l3 6h6l-5 4 2 6-6-4-6 4 2-6-5-4h6l3-6z" />
    </svg>
  );
}

export function ShieldCheckIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2L4 5v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V5l-8-3zm-2 13l-3-3 1.4-1.4 1.6 1.6 5.6-5.6L17 8l-7 7z" />
    </svg>
  );
}

// ─── CTA ───

export function PaletteIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.8 0 1.5-.3 2-.8.5-.5.8-1.2.8-2 0-.5-.2-1-.5-1.4-.3-.4-.5-.8-.5-1.3 0-.8.7-1.5 1.5-1.5H18c3.3 0 6-2.7 6-6 0-4.4-4-7-12-7zm-5.5 9c-.8 0-1.5-.7-1.5-1.5S5.7 8 6.5 8 8 8.7 8 9.5 7.3 11 6.5 11zm3-4c-.8 0-1.5-.7-1.5-1.5S8.7 4 9.5 4s1.5.7 1.5 1.5S10.3 7 9.5 7zm5 0c-.8 0-1.5-.7-1.5-1.5S13.7 4 14.5 4s1.5.7 1.5 1.5S15.3 7 14.5 7zm3 4c-.8 0-1.5-.7-1.5-1.5S16.7 8 17.5 8s1.5.7 1.5 1.5-.7 1.5-1.5 1.5z" />
    </svg>
  );
}

export function StarsIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2l1.5 5h5l-4 3 1.5 5-4-3-4 3 1.5-5-4-3h5L12 2zm0 4l-.8 2.5H9.5l1.5 1-1 2.5 2-1.5 2 1.5-1-2.5 1.5-1h-1.7L12 6z" />
    </svg>
  );
}

// ─── Contact ───

export function LetterIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
  );
}

export function SendIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
    </svg>
  );
}

export function RefreshIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2v6h-6M3 22v-6h6" />
      <path d="M21 8a9 9 0 00-7.5-4.5A9 9 0 0010 5.5M3 16a9 9 0 007.5 4.5A9 9 0 0014 18.5" />
    </svg>
  );
}

// ─── Testimonials ───

export function QuotesIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M6 17h3l2-4V7H5v6h3l-2 4zm8 0h3l2-4V7H13v6h3l-2 4z" />
    </svg>
  );
}

// ─── Case Studies ───

export function DangerIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2L2 22h20L12 2zm0 4l7 14H5l7-14zm-1 5v4h2v-4h-2zm0 6v2h2v-2h-2z" />
    </svg>
  );
}

export function BulbIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2a7 7 0 00-7 7c0 2.4 1.2 4.5 3 5.7V17a2 2 0 002 2h4a2 2 0 002-2v-2.3c1.8-1.2 3-3.3 3-5.7a7 7 0 00-7-7zm-1 17h2v1a1 1 0 01-1 1h0a1 1 0 01-1-1v-1z" />
    </svg>
  );
}

export function ChartIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  );
}

// ─── FAQ ───

export function ChevronDownIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ChevronUpIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );
}

// ─── RAG Showcase ───

export function DocumentIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

export function BrainIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A5.5 5.5 0 004 7.5c0 1.5.5 2.8 1.3 3.8" />
      <path d="M14.5 2A5.5 5.5 0 0120 7.5c0 1.5-.5 2.8-1.3 3.8" />
      <path d="M4.7 11.5A5.5 5.5 0 004 14.5 5.5 5.5 0 009.5 20" />
      <path d="M19.3 11.5a5.5 5.5 0 01.7 3 5.5 5.5 0 01-5.5 5.5" />
      <path d="M12 20v2M12 2v2M8 20v2M16 20v2" />
    </svg>
  );
}

export function SparklesIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zm6 10l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3zM5 14l.75 2.25L8 17l-2.25.75L5 20l-.75-2.25L2 17l2.25-.75L5 14z" />
    </svg>
  );
}

export function ArrowRightIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export function DatabaseIcon({ className = defaultSize }: IconProps) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.7-4 3-9 3s-9-1.3-9-3" />
      <path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5" />
    </svg>
  );
}

// ─── Brand logos (kept as Iconify) ───
// logos:react, logos:threejs, logos:typescript-icon, logos:tailwindcss-icon, logos:postgresql
// simple-icons:prisma, simple-icons:tauri
// mdi:github, mdi:linkedin
// These remain in their respective components via @iconify/react