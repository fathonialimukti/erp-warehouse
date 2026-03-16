/**
 * ERP Design System - Spacing Scale
 * 4px base unit grid system
 */

export const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
} as const;

/**
 * Responsive padding/margin helpers for Tailwind classes
 * Maps to Tailwind spacing scale: p-4 = 16px, m-8 = 32px, etc.
 */
export const spacingMap = {
  xs: spacing[1],      // 4px
  sm: spacing[2],      // 8px
  md: spacing[3],      // 12px
  lg: spacing[4],      // 16px
  xl: spacing[6],      // 24px
  '2xl': spacing[8],   // 32px
  '3xl': spacing[12],  // 48px
  '4xl': spacing[16],  // 64px
} as const;

export type Spacing = typeof spacing;
