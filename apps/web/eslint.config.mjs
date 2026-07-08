import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import svelte from "eslint-plugin-svelte";
import { defineConfig, includeIgnoreFile } from "eslint/config";
import globals from "globals";
import path from "path";
import ts from "typescript-eslint";

const gitignorePath = path.resolve(import.meta.dirname, "../../.gitignore");

export default defineConfig(
  includeIgnoreFile(gitignorePath),
  // Config/build files aren't part of the app tsconfig — keep them out of type-aware linting.
  { ignores: ["*.config.{js,ts,mjs}", "*.config.*.{js,ts,mjs}"] },
  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs.recommended,
  eslintPluginPrettierRecommended,
  svelte.configs.prettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
      },
      sourceType: "commonjs",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
      // see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
      "no-undef": "off",
      eqeqeq: ["error", "always"],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prettier/prettier": ["error", { endOfLine: "auto" }],
      "svelte/no-inner-declarations": "off",
    },
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: [".svelte"],
        parser: ts.parser,
      },
    },
  },
  {
    files: ["**/*.{js,ts,mjs,cjs}"],
    plugins: { "@stylistic": stylistic },
    rules: {
      "@stylistic/padding-line-between-statements": [
        "warn",
        { blankLine: "always", prev: "*", next: "block-like" },
        { blankLine: "always", prev: "block-like", next: "*" },
      ],
      "@stylistic/lines-between-class-members": [
        "warn",
        "always",
        { exceptAfterSingleLine: true },
      ],
      "@stylistic/spaced-comment": ["warn", "always", { markers: ["/"] }],
      "@stylistic/no-multiple-empty-lines": [
        "warn",
        { max: 1, maxEOF: 0, maxBOF: 0 },
      ],
      "@stylistic/padded-blocks": ["warn", "never"],
      "@stylistic/multiline-comment-style": ["warn", "separate-lines"],
    },
  },
);
