import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The whole app fetches data with the standard pre-Suspense idiom —
      // useEffect(() => { load() }, [...]) where load() is an async
      // function that eventually calls setState. This rule (new in the
      // react-hooks version bundled with Next 16) wants that migrated to
      // Suspense + use(), which is correct for new code but would mean
      // rewriting every page's data-fetching in one pass — tracked
      // separately as a real migration (React Query/SWR), not a lint fix.
      // Downgraded to warn so real regressions still surface without
      // treating this app-wide idiom as a hard build error.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
