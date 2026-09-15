import type { ReactNode } from 'react';

/**
 * Two-column form canvas. On large screens the main sections sit on the left
 * and the sticky preview rail on the right (340px); on small screens everything
 * stacks. Use <FormFull /> for blocks that should span both columns (e.g. item
 * tables).
 */
export function FormCanvas({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">{children}</div>;
}

/** Left column — form sections stacked vertically. */
export function FormMain({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-5">{children}</div>;
}

/** Right column — sticky live-preview rail. */
export function FormRail({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start">{children}</div>;
}

/** Full-width block spanning both columns. */
export function FormFull({ children }: { children: ReactNode }) {
  return <div className="lg:col-span-2">{children}</div>;
}
