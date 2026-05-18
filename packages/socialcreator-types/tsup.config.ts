import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    agent: "src/agent.ts",
    profile: "src/profile.ts",
    blog: "src/blog.ts",
  },
  format: ["esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["@prisma/client", "zod"],
});