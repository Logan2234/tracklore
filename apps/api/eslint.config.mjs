import js from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import { defineConfig, includeIgnoreFile } from "eslint/config";
import globals from "globals";
import path from "path";
import ts from "typescript-eslint";

const gitignorePath = path.resolve(import.meta.dirname, "../../.gitignore");

export default defineConfig(
  includeIgnoreFile(gitignorePath),
  // Config/build files aren't part of the app tsconfig — keep them out of type-aware linting.
  { ignores: ["*.config.{js,ts}", "*.config.*.{js,ts}"] },
  js.configs.recommended,
  ts.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
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
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
);
