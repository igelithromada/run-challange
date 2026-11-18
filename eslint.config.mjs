import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
    },
  },
  {
    files: ["tests/**/*.cjs"],
    // The isolated VM tests inject their own CommonJS module object.
    rules: { "@next/next/no-assign-module-variable": "off" },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "coverage/**",
  ]),
]);
