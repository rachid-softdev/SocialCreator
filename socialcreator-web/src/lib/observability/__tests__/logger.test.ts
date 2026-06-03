/**
 * Tests for observability logger configuration (Sprint 8: Observability)
 *
 * Verifies createLogger, createRequestLogger, getLogger, redact config,
 * and transport modes (dev vs production).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Shared mutable state for assertions (module-level so mock factories can reference)
const capturedPinoOptions: any[] = [];
const capturedChildBindings: any[] = [];
const mockGetRequestId = vi.fn();

// Mock pino to capture constructor options and child logger bindings
vi.mock("pino", () => {
  const mockChild = vi.fn<any, any>((bindings: any) => {
    capturedChildBindings.push(bindings);
    return {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      child: mockChild,
    };
  });

  const mockPino = Object.assign(
    vi.fn((opts: any) => {
      capturedPinoOptions.push(opts);
      return {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        child: mockChild,
      };
    }),
    { stdTimeFunctions: { isoTime: "isoTime" as const } },
  );
  return { default: mockPino };
});

// Mock request-context so we can control getRequestId behavior
vi.mock("../request-context", () => ({
  getRequestId: mockGetRequestId,
  getRequestContext: vi.fn(),
  runWithContext: vi.fn(),
  requestContextStorage: {},
}));

describe("observability/logger", () => {
  beforeEach(() => {
    vi.resetModules();
    capturedPinoOptions.length = 0;
    capturedChildBindings.length = 0;
    mockGetRequestId.mockReset();
    // Default: outside request context
    mockGetRequestId.mockReturnValue("no-request-id");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("createLogger", () => {
    it("returns a child logger with component binding", async () => {
      const { createLogger } = await import("../logger");
      const logger = createLogger("test-component");

      expect(logger).toBeDefined();
      expect(capturedChildBindings).toContainEqual({
        component: "test-component",
      });
    });
  });

  describe("createRequestLogger", () => {
    it("returns a child logger with requestId, method, path bound", async () => {
      const { createRequestLogger } = await import("../logger");
      const ctx = { requestId: "req-123", method: "GET", path: "/api/test" };
      const logger = createRequestLogger(ctx);

      expect(logger).toBeDefined();
      expect(capturedChildBindings).toContainEqual({
        requestId: "req-123",
        method: "GET",
        path: "/api/test",
        userId: undefined,
      });
    });

    it("includes userId when provided", async () => {
      const { createRequestLogger } = await import("../logger");
      createRequestLogger({
        requestId: "req-456",
        userId: "user-789",
      });

      expect(capturedChildBindings).toContainEqual({
        requestId: "req-456",
        method: undefined,
        path: undefined,
        userId: "user-789",
      });
    });
  });

  describe("getLogger", () => {
    it("returns root logger outside request context", async () => {
      mockGetRequestId.mockReturnValue("no-request-id");
      const { getLogger } = await import("../logger");
      const logger = getLogger();

      expect(logger).toBeDefined();
      // Outside context, no child should be created — root logger returned
      expect(capturedChildBindings).toHaveLength(0);
    });

    it("returns child logger with requestId inside request context", async () => {
      mockGetRequestId.mockReturnValue("test-request-id");
      const { getLogger } = await import("../logger");
      const logger = getLogger();

      expect(logger).toBeDefined();
      expect(capturedChildBindings).toContainEqual({
        requestId: "test-request-id",
      });
    });

    it("returns child logger with component and requestId inside context", async () => {
      mockGetRequestId.mockReturnValue("req-789");
      const { getLogger } = await import("../logger");
      const logger = getLogger("stripe");

      expect(logger).toBeDefined();
      expect(capturedChildBindings).toContainEqual({
        component: "stripe",
        requestId: "req-789",
      });
    });

    it("returns child logger with component only outside context", async () => {
      mockGetRequestId.mockReturnValue("no-request-id");
      const { getLogger } = await import("../logger");
      const logger = getLogger("stripe");

      expect(logger).toBeDefined();
      expect(capturedChildBindings).toContainEqual({
        component: "stripe",
      });
    });
  });

  describe("redact configuration", () => {
    it("should include accessToken in redact paths", async () => {
      await import("../logger");
      const opts = capturedPinoOptions[capturedPinoOptions.length - 1];

      expect(opts.redact.paths).toContain("accessToken");
      expect(opts.redact.paths).toContain("*.accessToken");
    });

    it("should have censor set to [REDACTED]", async () => {
      await import("../logger");
      const opts = capturedPinoOptions[capturedPinoOptions.length - 1];

      expect(opts.redact.censor).toBe("[REDACTED]");
    });

    it("should include all required sensitive paths", async () => {
      await import("../logger");
      const opts = capturedPinoOptions[capturedPinoOptions.length - 1];

      const sensitiveFields = [
        "userId",
        "*.userId",
        "accessToken",
        "*.accessToken",
        "refreshToken",
        "*.refreshToken",
        "token",
        "*.token",
        "secret",
        "*.secret",
        "password",
        "*.password",
        "email",
        "*.email",
        "authorization",
        "*.authorization",
        "cookie",
        "*.cookie",
        "apiKey",
        "*.apiKey",
        "ip",
        "*.ip",
      ];

      for (const field of sensitiveFields) {
        expect(opts.redact.paths).toContain(field);
      }
    });
  });

  describe("transport configuration", () => {
    it("uses pino-pretty transport in development mode", async () => {
      vi.stubEnv("NODE_ENV", "development");
      await import("../logger");
      const opts = capturedPinoOptions[capturedPinoOptions.length - 1];

      expect(opts.transport).toBeDefined();
      expect(opts.transport.target).toBe("pino-pretty");
    });

    it("does not use pino-pretty transport in production mode", async () => {
      vi.stubEnv("NODE_ENV", "production");
      await import("../logger");
      const opts = capturedPinoOptions[capturedPinoOptions.length - 1];

      expect(opts.transport).toBeUndefined();
    });
  });
});
