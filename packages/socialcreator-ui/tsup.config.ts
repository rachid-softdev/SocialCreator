import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const srcDir = resolve(__dirname, "src");

/**
 * Auto-discover all top-level .ts/.tsx files + hooks as entry points.
 * This generates individual output files for each component,
 * enabling subpath exports like `@socialcreator/ui/button`.
 */
function discoverEntries(dir: string, prefix = ""): Record<string, string> {
  const entries: Record<string, string> = {};
  const items = readdirSync(dir);

  for (const item of items) {
    const fullPath = resolve(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Recursively handle subdirectories (e.g. hooks/)
      Object.assign(entries, discoverEntries(fullPath, `${prefix}${item}/`));
    } else if (item.endsWith(".ts") || item.endsWith(".tsx")) {
      const name = item.replace(/\.(ts|tsx)$/, "");
      entries[`${prefix}${name}`] = fullPath;
    }
  }

  return entries;
}

export default defineConfig({
  entry: discoverEntries(srcDir),
  format: ["esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom", "next"],
});
