import { defineConfig } from "eslint/config";
import { baseConfig } from "../../eslint.config.base.mjs";

export default defineConfig(
  ...baseConfig(import.meta.dirname),
  // Plain CJS jest setup scripts, not part of the app tsconfig (no allowJs) —
  // same rationale as the *.config.* exclusion in the shared base.
  { ignores: ["test/e2e-env.js", "test/global-setup.js"] },
);
