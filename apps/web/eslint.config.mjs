import svelte from "eslint-plugin-svelte";
import { defineConfig } from "eslint/config";
import ts from "typescript-eslint";
import { baseConfig } from "../../eslint.config.base.mjs";

export default defineConfig(
  // The service worker is compiled in SvelteKit's own worker context, which the
  // typed-lint projectService can't resolve; it is type-checked by svelte-check.
  { ignores: ["src/service-worker.ts"] },
  ...baseConfig(import.meta.dirname, { browser: true }),
  svelte.configs.recommended,
  svelte.configs.prettier,
  {
    rules: {
      // Crashes on plain .ts top-level declarations in this eslint-plugin-svelte
      // version (wraps core no-inner-declarations, chokes on a null upper scope).
      // https://github.com/sveltejs/eslint-plugin-svelte/issues/726
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
);
