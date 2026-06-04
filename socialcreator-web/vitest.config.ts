import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    globals: true,
    // Default: node for utility/service tests
    environment: "node",
    // Route component tests to jsdom
    environmentMatchGlobs: [["src/components/**/*.test.{tsx,ts}", "jsdom"]],
    setupFiles: ["./vitest.setup.ts", "./vitest.dom-setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/*.spec.ts", "src/**/*.spec.tsx"],
    exclude: ["node_modules", "dist", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules",
        "dist",
        ".next",
        "**/*.d.ts",
        "**/*.config.ts",
        "**/__tests__/**",
        "**/__mocks__/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
