/**
 * Tests for logger configuration
 * - Verify redact config exists and is well-formed
 * - Verify logger is a pino instance with standard methods
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Store captured options at module level so tests can assert on them
const capturedOptions: any[] = [];

// Mock pino at module level (vi.mock is hoisted)
// Everything must be defined INSIDE the factory due to hoisting
vi.mock("pino", () => {
  const mockPino = vi.fn((opts: any) => {
    capturedOptions.push(opts);
    return {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() })),
      level: "silent",
    };
  });
  mockPino.stdTimeFunctions = { isoTime: "isoTime" };
  return { default: mockPino };
});

describe("Logger", () => {
  beforeEach(() => {
    vi.resetModules();
    capturedOptions.length = 0; // Clear between tests
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should export a pino logger with standard methods", async () => {
    vi.stubEnv("LOG_LEVEL", "silent");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ENCRYPTION_KEY", "test-key-for-logger-test");

    const logger = (await import("../logger")).default;
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("should have redact configuration passed to pino", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ENCRYPTION_KEY", "test-key-for-logger-test");

    await import("../logger");

    const opts = capturedOptions[capturedOptions.length - 1];
    expect(opts).toBeDefined();
    expect(opts.redact).toBeDefined();
    expect(Array.isArray(opts.redact.paths)).toBe(true);
    expect(opts.redact.censor).toBe("[REDACTED]");
  });

  it("should include all required sensitive paths in redact config", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ENCRYPTION_KEY", "test-key-for-logger-test");

    await import("../logger");

    const opts = capturedOptions[capturedOptions.length - 1];
    const paths = opts.redact.paths;
    const sensitiveFields = [
      "accessToken",
      "*.accessToken",
      "refreshToken",
      "*.refreshToken",
      "token",
      "*.token",
      "secret",
      "*.secret",
      "email",
      "*.email",
      "password",
      "*.password",
      "ip",
      "*.ip",
    ];

    for (const field of sensitiveFields) {
      expect(paths).toContain(field);
    }
  });
});
