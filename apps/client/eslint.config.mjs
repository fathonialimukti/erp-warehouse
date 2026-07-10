import { config } from "@repo/eslint-config/react-internal";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    files: [
      "src/components/GlbCanvasViewer.tsx",
      "src/components/WarehouseModel.tsx",
      "src/components/WarehouseScene.tsx",
    ],
    rules: {
      "react/no-unknown-property": "off",
    },
  },
  {
    ignores: ["dist/**", "src-tauri/target/**"],
  },
];