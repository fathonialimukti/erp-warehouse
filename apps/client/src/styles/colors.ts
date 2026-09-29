/**
 * ERP Design System - Color Palette
 * Professional/Corporate theme with blue-based colors
 */

export const colors = {
  // Primary colors - Blue palette
  primary: {
    50: "#EBF2FF",
    100: "#D0DFFE",
    200: "#A1BFFD",
    300: "#729EFC",
    400: "#437EFB",
    500: "#0B5FFA", // Primary action color
    600: "#0850D6",
    700: "#0642B0",
    800: "#05338A",
    900: "#032566",
  },

  // Secondary colors - Darker blue for emphasis
  secondary: {
    50: "#E8F1FF",
    100: "#CCDAFF",
    200: "#99B5FF",
    300: "#6690FF",
    400: "#336BFF",
    500: "#0046CC", // Secondary color
    600: "#0038A3",
    700: "#002A7A",
    800: "#001C52",
    900: "#000D29",
  },

  // Neutral grays
  neutral: {
    0: "#FFFFFF",
    50: "#F9FAFB",
    100: "#F3F4F6",
    200: "#E5E7EB",
    300: "#D1D5DB",
    400: "#9CA3AF",
    500: "#6B7280",
    600: "#4B5563", // Default text color
    700: "#374151",
    800: "#1F2937",
    900: "#111827",
  },

  // Status colors
  success: "#10B981",
  successLight: "#D1FAE5",
  error: "#EF4444",
  errorLight: "#FEE2E2",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  info: "#3B82F6",
  infoLight: "#DBEAFE",

  // Semantic aliases
  text: {
    primary: "#111827",
    secondary: "#6B7280",
    tertiary: "#9CA3AF",
    inverse: "#FFFFFF",
  },
  background: {
    primary: "#FFFFFF",
    secondary: "#F9FAFB",
    tertiary: "#F3F4F6",
    dark: "#111827",
  },
  border: "#E5E7EB",
  focus: "#0B5FFA",
  hover: "#F3F4F6",
  active: "#E5E7EB",
} as const;

export type Colors = typeof colors;
