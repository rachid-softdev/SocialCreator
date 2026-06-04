/**
 * DOM test setup for React component tests (jsdom environment only).
 * Provides jest-dom matchers and DOM polyfills.
 */
import "@testing-library/jest-dom/vitest";

// Polyfill ResizeObserver for recharts ResponsiveContainer
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
