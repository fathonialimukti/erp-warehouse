import { useIntl } from 'react-intl';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import type { ReactNode } from 'react';
import { UnsavedChangesBadge } from '../UnsavedChangesBadge';

interface FormActionBarProps {
  onCancel: () => void;
  cancelLabel: string;
  submitLabel: string;
  submitIcon: string;
  isPending?: boolean;
  isDisabled?: boolean;
  isDirty?: boolean;
  dirtyCount?: number;
  /** Show a success "All changes saved" chip when the form is not dirty. */
  showSavedState?: boolean;
  /** Extra actions rendered before the Cancel/Submit pair (e.g. "Save Draft"). */
  children?: ReactNode;
  /** When provided, the primary button calls this instead of submitting the form. */
  submitOnPress?: () => void;
  className?: string;
}

/**
 * Sticky bottom action bar for creative forms. Frosted surface with a live
 * save-state indicator on the left (unsaved badge vs all-saved chip) and the
 * primary actions on the right. Rendered inside the <form> so the submit
 * button works via type="submit".
 */
export function FormActionBar({
  onCancel,
  cancelLabel,
  submitLabel,
  submitIcon,
  isPending = false,
  isDisabled = false,
  isDirty = false,
  dirtyCount,
  showSavedState = false,
  children,
  submitOnPress,
  className = '',
}: FormActionBarProps) {
  const intl = useIntl();
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <div className={`sticky bottom-4 z-10 ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut', delay: 0.15 }}
        className="rounded-2xl border border-border/70 bg-surface/90 px-4 py-3 shadow-lg backdrop-blur-md"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            {isDirty ? (
              <UnsavedChangesBadge count={dirtyCount} />
            ) : showSavedState ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                <Icon icon="solar:check-circle-bold" className="size-3.5" />
                {intl.formatMessage({ id: 'common.all_saved', defaultMessage: 'All changes saved' })}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {children}
            <Button variant="secondary" onPress={onCancel} isDisabled={isPending}>
              {cancelLabel}
            </Button>
            <Button
              variant="primary"
              type={submitOnPress ? 'button' : 'submit'}
              onPress={submitOnPress}
              isPending={isPending}
              isDisabled={isDisabled}
            >
              {({ isPending: pending }) => (
                <>
                  <Icon
                    icon={pending ? 'solar:refresh-linear' : submitIcon}
                    className={pending ? 'size-4 animate-spin' : 'size-4'}
                  />
                  {submitLabel}
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
