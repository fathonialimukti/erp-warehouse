import { motion, useReducedMotion } from 'framer-motion';
import { Icon } from '@iconify/react';
import type { ReactNode } from 'react';

interface FormSectionProps {
  /** Section number shown on the icon chip. */
  step: number;
  /** Iconify icon name for the section. */
  icon: string;
  title: string;
  description?: string;
  /** When true the chip flips to a success check (section complete). */
  filled?: boolean;
  /** Optional right-aligned action in the header (e.g. "Add Item" button). */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Numbered step card used to break a form into digestible sections.
 * Each section gets an icon chip with a step badge; once `filled`, the chip
 * swaps to a success check so the user always knows how far they are.
 */
export function FormSection({
  step,
  icon,
  title,
  description,
  filled = false,
  action,
  className = '',
  children,
}: FormSectionProps) {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <motion.section
      initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-48px' }}
      transition={{ duration: 0.3, ease: 'easeOut', delay: Math.min((step - 1) * 0.06, 0.24) }}
      className={`rounded-3xl border border-border/70 bg-surface shadow-sm ${className}`}
    >
      <div className="mb-5 flex flex-wrap items-center gap-3.5">
        <div
          className={`grid size-11 shrink-0 place-items-center rounded-2xl border ${
            filled ? 'border-success/40 bg-success/15 text-success' : 'border-accent/40 bg-accent/15 text-accent'
          }`}
        >
          <span className="relative flex items-center justify-center">
            <Icon icon={filled ? 'solar:check-circle-bold' : icon} className="size-5" />
            <span className="absolute -right-2 -top-2 grid size-4 place-items-center rounded-full bg-surface font-mono text-[9px] font-bold leading-none text-muted ring-1 ring-border">
              {step}
            </span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description ? <p className="mt-0.5 text-sm leading-5 text-muted">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </motion.section>
  );
}
