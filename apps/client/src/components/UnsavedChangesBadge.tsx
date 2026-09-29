import { useIntl } from "react-intl";
import { motion, useReducedMotion } from "framer-motion";

interface UnsavedChangesBadgeProps {
  /** Number of modified fields; renders "(N)" when provided and > 0. */
  count?: number;
  className?: string;
}

/**
 * Warning chip shown below update forms when there are dirty fields.
 * Render conditionally at the call site (e.g. `isEdit && form.state.isDirty`).
 */
export const UnsavedChangesBadge = ({
  count,
  className = "",
}: UnsavedChangesBadgeProps) => {
  const intl = useIntl();
  const reduceMotion = useReducedMotion() ?? false;
  const label = intl.formatMessage({
    id: "common.unsaved_changes",
    defaultMessage: "Unsaved changes",
  });

  return (
    <motion.span
      initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={`inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning ${className}`}
    >
      <span
        aria-hidden="true"
        className="size-1.5 animate-pulse rounded-full bg-warning"
      />
      {label}
      {typeof count === "number" && count > 0 ? ` (${count})` : ""}
    </motion.span>
  );
};
