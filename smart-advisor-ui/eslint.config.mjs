import nextPlugin from "@next/eslint-plugin-next";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      ".next/",
      "public/",
      "src/",
      "data/",
      "*.config.*",
      "vitest.config.*",
      "playwright.config.*",
      "scripts/**",
      "tests/**",
      "next-env.d.ts",
      "analyze_courses.js",
      "curriculum-data/**/*.js",
    ],
  },
  ...tseslint.configs.recommended.map((cfg) => ({
    ...cfg,
    rules: {
      ...cfg.rules,
      "sonarjs/cognitive-complexity": "off",
      "sonarjs/prefer-top-level-await": "off",
      "sonarjs/no-impure-terms": "off",
      "sonarjs/no-variable-declaration": "off",
      "sonarjs/no-namespace": "off",
      "sonarjs/no-commented-code": "off",
      "sonarjs/no-useless-catch": "off",
      "sonarjs/reduced-test-scope": "off",
    },
  })),
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooksPlugin.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "off",
      "sonarjs/cognitive-complexity": "off",
      "sonarjs/prefer-top-level-await": "off",
      "sonarjs/no-impure-terms": "off",
      "sonarjs/no-variable-declaration": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-compiler/react-compiler": "off",
    },
  }
);
