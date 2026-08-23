import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "dist/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "apps/web/public/**",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default config;
