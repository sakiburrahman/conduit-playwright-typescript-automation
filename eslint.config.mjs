import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import jsdoc from "eslint-plugin-jsdoc";
import tseslint from "typescript-eslint";
import playwrightPlugin from "eslint-plugin-playwright";
import importPlugin from "eslint-plugin-import";
import prettierPlugin from "eslint-plugin-prettier";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "node_modules",
      "test-results",
      "playwright-report",
      "allure-results",
      "allure-report",
      "ortoni-report",
      "har-recordings",
      "logs",
      "coverage",
      "*.config.js",
      "*.config.mjs",
      "*.config.ts",
    ],
  },

  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    files: ["**/*.ts"],

    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: ["./tsconfig.json"],
        tsconfigRootDir: dirname(fileURLToPath(import.meta.url)),
      },
      globals: {
        browser: "readonly",
        node: "readonly",
      },
    },

    plugins: {
      "@typescript-eslint": tseslint.plugin,
      jsdoc: jsdoc,
      playwright: playwrightPlugin,
      import: importPlugin,
      prettier: prettierPlugin,
    },

    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/restrict-template-expressions": "warn",
      "@typescript-eslint/restrict-plus-operands": "warn",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "warn",
      "@typescript-eslint/prefer-optional-chain": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/consistent-type-definitions": ["warn", "interface"],
      "@typescript-eslint/consistent-type-exports": [
        "warn",
        { fixMixedExportsWithInlineTypeSpecifier: true },
      ],

      "playwright/expect-expect": "error",
      "playwright/missing-playwright-await": "error",
      "playwright/no-skipped-test": "error",
      "playwright/no-focused-test": "error",
      "playwright/prefer-web-first-assertions": "error",
      "playwright/no-wait-for-timeout": "warn",
      "playwright/prefer-locator": "warn",
      "playwright/no-standalone-expect": "error",
      "playwright/no-page-pause": "error",
      "playwright/no-force-option": "warn",
      "playwright/require-top-level-describe": "off",
      "playwright/valid-expect": "error",
      "playwright/valid-describe-callback": "error",

      "import/order": [
        "warn",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
            "type",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import/no-unresolved": "error",
      "import/newline-after-import": "warn",
      "import/no-duplicates": "warn",
      "import/no-unused-modules": "off",

      "jsdoc/check-alignment": "warn",
      "jsdoc/check-param-names": "warn",
      "jsdoc/check-tag-names": "warn",
      "jsdoc/check-types": "warn",
      "jsdoc/require-param": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/require-jsdoc": "off",

      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "error",
      "no-alert": "warn",
      "prefer-const": "error",
      "no-var": "error",
      "object-shorthand": "warn",
      "prefer-arrow-callback": "warn",
      "prefer-template": "warn",

      "prettier/prettier": "error",
    },

    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
        node: {
          paths: ["."],
          extensions: [".js", ".ts", ".json"],
        },
      },
    },
  },
);
