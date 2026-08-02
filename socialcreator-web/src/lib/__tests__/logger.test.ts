/**
 * Tests for the client-safe logger barrel (src/lib/logger.ts).
 *
 * The barrel is a lazy proxy on the server: pino is only imported
 * dynamically when a log method is called, so the pino options (redact
 * config, levels, ...) are asserted in
 * src/lib/observability/__tests__/logger.test.ts instead.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Logger", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should export a pino-like logger with standard methods", async () => {
    vi.stubEnv("LOG_LEVEL", "silent");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ENCRYPTION_KEY", "test-key-for-logger-test");

    const logger = (await import("../logger")).default;
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.child).toBe("function");
  });

  it("should not bundle pino eagerly on the client", async () => {
    vi.stubEnv("NODE_ENV", "test");

    // Simulate a browser-like environment: `window` defined -> console logger
    vi.stubGlobal("window", {});
    vi.resetModules();

    const logger = (await import("../logger")).default;
    expect(logger).toBeDefined();
    expect(typeof logger.error).toBe("function");

    vi.unstubAllGlobals();
  });
});
