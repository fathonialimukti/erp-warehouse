import { config } from "@repo/eslint-config/react-internal";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    rules: {
      // `any` appears deliberately at serialization/AI boundaries; real type
      // safety is enforced by `tsc --noEmit` with strict + exactOptionalPropertyTypes.
      "@typescript-eslint/no-explicit-any": "off",
      // TypeScript props are checked at compile time; runtime prop-types are redundant.
      "react/prop-types": "off",
      // Advisory-only; caught in code review instead.
      "react-hooks/exhaustive-deps": "off",
      // React Three Fiber JSX uses three.js props (position, args, material…)
      // that this rule cannot know about.
      "react/no-unknown-property": "off",
    },
  },
  {
    ignores: ["dist/**", "src-tauri/target/**"],
  },
];
