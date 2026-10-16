import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ["apps/api/**/*.ts", "scripts/**/*.ts", "tests/**/*.ts"] })),
  { settings: { next: { rootDir: ["apps/admin/", "apps/website/"] }, react: { version: "19.3.1" } } },
  globalIgnores(["**/.next/**", "**/dist/**", "**/.local/**", "**/next-env.d.ts"]),
]);
