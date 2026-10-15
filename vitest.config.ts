import { defineConfig } from "vitest/config";
export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "./tests/frontend-environment.ts",
    include: ["src/**/*.test.tsx"],
    restoreMocks: true,
  },
});
