/**
 * ERP Design System - Typography Scale
 * Professional, accessible font sizing and weights
 */

export const typography = {
  // Heading styles
  heading: {
    h1: {
      fontSize: "32px",
      lineHeight: "40px",
      fontWeight: "700",
      letterSpacing: "-0.5px",
    },
    h2: {
      fontSize: "24px",
      lineHeight: "32px",
      fontWeight: "700",
      letterSpacing: "-0.25px",
    },
    h3: {
      fontSize: "18px",
      lineHeight: "28px",
      fontWeight: "600",
      letterSpacing: "0px",
    },
    h4: {
      fontSize: "16px",
      lineHeight: "24px",
      fontWeight: "600",
      letterSpacing: "0px",
    },
    h5: {
      fontSize: "14px",
      lineHeight: "20px",
      fontWeight: "600",
      letterSpacing: "0px",
    },
    h6: {
      fontSize: "12px",
      lineHeight: "16px",
      fontWeight: "600",
      letterSpacing: "0px",
    },
  },

  // Body text styles
  body: {
    // Regular body text
    base: {
      fontSize: "14px",
      lineHeight: "22px",
      fontWeight: "400",
      letterSpacing: "0px",
    },
    lg: {
      fontSize: "16px",
      lineHeight: "24px",
      fontWeight: "400",
      letterSpacing: "0px",
    },
    sm: {
      fontSize: "12px",
      lineHeight: "18px",
      fontWeight: "400",
      letterSpacing: "0px",
    },
  },

  // UI text styles
  ui: {
    button: {
      fontSize: "14px",
      lineHeight: "20px",
      fontWeight: "600",
      letterSpacing: "0px",
    },
    label: {
      fontSize: "14px",
      lineHeight: "20px",
      fontWeight: "500",
      letterSpacing: "0px",
    },
    caption: {
      fontSize: "12px",
      lineHeight: "16px",
      fontWeight: "400",
      letterSpacing: "0px",
    },
    small: {
      fontSize: "11px",
      lineHeight: "16px",
      fontWeight: "400",
      letterSpacing: "0.5px",
    },
  },
} as const;

/**
 * Font weights used throughout the design system
 */
export const fontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

/**
 * Font family stack
 * Uses system fonts for performance, falls back to sans-serif
 */
export const fontFamily = {
  sans: "system-ui, -apple-system, sans-serif",
  mono: '"Fira Code", "Courier New", monospace',
} as const;

export type Typography = typeof typography;
