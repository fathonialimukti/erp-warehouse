import { motion, useReducedMotion } from 'framer-motion';
import { Button, Chip } from '@heroui/react';
import { Icon } from '@iconify/react';
import type { ReactNode } from 'react';

interface FormHeroProps {
  /** Iconify icon name for the entity being created/edited. */
  icon: string;
  title: string;
  description: string;
  mode: 'create' | 'edit';
  /** Label shown in the mode chip, e.g. "Create" / "Edit". */
  modeLabel: string;
  onBack: () => void;
  backLabel: string;
  /** Optional context chips under the description (e.g. existing code in edit mode). */
  chips?: Array<{ icon?: string; label: string; tone?: 'accent' | 'success' | 'warning' | 'danger' | 'default' }>;
  /** Right-aligned actions (e.g. <AiFillButton />). */
  actions?: ReactNode;
}

/**
 * Identity band that opens every creative form. Replaces the plain PageHeader
 * with an accent-tinted hero: back button, mode chip, entity icon, and a
 * live description — plus a soft glow + watermark so the form doesn't read as
 * a grey template.
 */
export function FormHero({
  icon,
  title,
  description,
  mode,
  modeLabel,
  onBack,
  backLabel,
  chips = [],
  actions,
}: FormHeroProps) {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <motion.section
      initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-3xl border border-border/70 bg-surface shadow-sm"
    >
      {/* Decorative layer */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-y-0 left-0 w-1 rounded-l-3xl bg-accent/50" />
        <div className="absolute -right-24 -top-28 size-72 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute -left-16 -bottom-14 size-44 rounded-full bg-accent/10 blur-2xl" />
        <Icon icon={icon} className="absolute -bottom-9 right-10 size-40 text-accent/10" />
      </div>

      <div className="relative flex flex-col gap-5 p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" isIconOnly onPress={onBack} aria-label={backLabel}>
            <Icon icon="solar:alt-arrow-left-linear" className="size-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Chip size="sm" variant="soft" color={mode === 'edit' ? 'warning' : 'accent'}>
              <span className="inline-flex items-center gap-1">
                <Icon icon={mode === 'edit' ? 'solar:pen-2-linear' : 'solar:add-circle-linear'} className="size-3.5" />
                {modeLabel}
              </span>
            </Chip>
            {actions}
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-accent/30 bg-accent/15 text-accent shadow-sm">
            <Icon icon={icon} className="size-7" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
            <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
          </div>
        </div>

        {chips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <Chip key={chip.label} size="sm" variant="soft" color={chip.tone ?? 'accent'}>
                <span className="inline-flex items-center gap-1">
                  {chip.icon ? <Icon icon={chip.icon} className="size-3.5" /> : null}
                  {chip.label}
                </span>
              </Chip>
            ))}
          </div>
        ) : null}
      </div>
    </motion.section>
  );
}
