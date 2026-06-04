/**
 * Tests for the simple pino logger utility (src/lib/utils/logger.ts)
 * This is separate from the observability logger used by the application.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Capture the pino options passed to the constructor
const capturedOptions: any[] = [];

vi.mock("pino", () => {
  const mockPino = vi.fn((opts: any) => {
    capturedOptions.push(opts);
    return {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      fatal: vi.fn(),
      trace: vi.fn(),
      silent: vi.fn(),
      child: vi.fn(() => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      })),
      level: "info",
      levelVal: 30,
    };
  });
  (mockPino as any).stdTimeFunctions = { isoTime: "isoTime" };
  return { default: mockPino };
});

describe("logger (utils/logger.ts)", () => {
  beforeEach(() => {
    vi.resetModules();
    capturedOptions.length = 0;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should export a pino logger with standard methods", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "test-key");
    vi.stubEnv("LOG_LEVEL", "debug");
    vi.stubEnv("NODE_ENV", "test");

    const logger = (await import("../logger")).default;
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("should use LOG_LEVEL from environment", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "test-key");
    vi.stubEnv("LOG_LEVEL", "debug");
    vi.stubEnv("NODE_ENV", "test");

    await import("../logger");

    const opts = capturedOptions[capturedOptions.length - 1];
    expect(opts.level).toBe("debug");
  });

  it("should default to 'info' level when LOG_LEVEL is not set", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "test-key");

    // Must not set LOG_LEVEL so it falls back to "info"
    await import("../logger");

    // pino default is "info" when level not specified

    const opts = capturedOptions[capturedOptions.length - 1];
    // If LOG_LEVEL is not set, process.env.LOG_LEVEL is undefined
    // pino level defaults to "info" via the fallback in pino
    // But in the source code: level: process.env.LOG_LEVEL || "info"
    // We need to check if the source code has its own default
    if (process.env.LOG_LEVEL) {
      expect(opts.level).toBe(process.env.LOG_LEVEL);
    } else {
      // When LOG_LEVEL is not set at all, the source defaults to "info"
      expect(opts.level).toBe("info");
    }
  });

  it("should include pino-pretty transport in non-production", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "test-key");
    vi.stubEnv("NODE_ENV", "development");

    await import("../logger");

    const opts = capturedOptions[capturedOptions.length - 1];
    expect(opts.transport).toBeDefined();
    expect(opts.transport.target).toBe("pino-pretty");
  });

  it("should not include transport in production", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "test-key");
    vi.stubEnv("NODE_ENV", "production");

    await import("../logger");

    const opts = capturedOptions[capturedOptions.length - 1];
    expect(opts.transport).toBeUndefined();
  });

  it("should use isoTime timestamp function", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "test-key");
    vi.stubEnv("NODE_ENV", "test");

    await import("../logger");

    const opts = capturedOptions[capturedOptions.length - 1];
    expect(opts.timestamp).toBe("isoTime");
  });

  it("should have redact configuration passed to pino", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "test-key");
    vi.stubEnv("NODE_ENV", "test");

    await import("../logger");

    const opts = capturedOptions[capturedOptions.length - 1];
    expect(opts.redact).toBeDefined();
    expect(Array.isArray(opts.redact.paths)).toBe(true);
    expect(opts.redact.censor).toBe("[REDACTED]");
  });

  it("should include all required sensitive paths in redact config", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "test-key");
    vi.stubEnv("NODE_ENV", "test");

    await import("../logger");

    const opts = capturedOptions[capturedOptions.length - 1];
    const paths = opts.redact.paths;
    const sensitiveFields = [
      "userId",
      "*.userId",
      "user.id",
      "*.user.id",
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

  it("should have formatters for level label", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "test-key");
    vi.stubEnv("NODE_ENV", "test");

    await import("../logger");

    const opts = capturedOptions[capturedOptions.length - 1];
    expect(opts.formatters).toBeDefined();
    expect(opts.formatters.level).toBeDefined();
  });

  it("should import without error when ENCRYPTION_KEY is set", async () => {
    // ENCRYPTION_KEY is needed for the crypto module but NOT for the logger itself
    // However the top-level env check in crypto.ts will crash if not set
    vi.stubEnv("ENCRYPTION_KEY", "test-key");

    await expect(import("../logger")).resolves.toBeDefined();
  });
});
