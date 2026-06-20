/**
 * Tests for API middleware
 *
 * Covers: body size limit, auth, rate limiting, handler execution,
 * response headers, metrics recording, and error handling.
 */

import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock variables — referenced in both vi.mock factories and test body
// ---------------------------------------------------------------------------

const { mockAuth, mockWithRateLimit, mockGetOrCreateRequestId } = vi.hoisted(() => ({
  mockAuth: vi.fn().mockResolvedValue({ user: { id: "user-123" } }),
  mockWithRateLimit: vi.fn().mockResolvedValue(null),
  mockGetOrCreateRequestId: vi.fn().mockReturnValue("req-123"),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

vi.mock("@/lib/rate-limit-redis", () => ({ withRateLimit: mockWithRateLimit }));

vi.mock("@/lib/observability", () => ({
  createRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
  })),
  runWithContext: vi.fn((_ctx: unknown, fn: () => unknown) => fn()),
}));

vi.mock("@/lib/request-id", () => ({
  getOrCreateRequestId: mockGetOrCreateRequestId,
  REQUEST_ID_HEADER: "x-request-id",
}));

vi.mock("@/lib/utils/metrics", () => ({
  httpRequestDuration: { observe: vi.fn() },
  httpRequestTotal: { inc: vi.fn() },
}));

vi.mock("@/lib/api-errors", () => ({
  errorResponse: vi.fn(
    (status: number, code: string, message: string) =>
      ({
        status,
        json: () => Promise.resolve({ error: message, code }),
      }) as unknown as NextResponse,
  ),
  unauthorized: vi.fn(
    () =>
      ({
        status: 401,
        json: () => Promise.resolve({ error: "Unauthorized", code: "UNAUTHORIZED" }),
      }) as unknown as NextResponse,
  ),
}));

vi.mock("@/lib/api-version", () => ({
  resolveApiVersion: vi.fn(() => ({ version: "v1" })),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { withApiMiddleware } from "@/lib/middleware/api-middleware";
import { httpRequestDuration, httpRequestTotal } from "@/lib/utils/metrics";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(
  path = "/api/test",
  init?: RequestInit & { headers?: Record<string, string> },
): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, init);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("API Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default mock behaviour
    mockAuth.mockResolvedValue({ user: { id: "user-123" } });
    mockWithRateLimit.mockResolvedValue(null);
    mockGetOrCreateRequestId.mockReturnValue("req-123");
  });

  // -----------------------------------------------------------------------
  // Body size limit
  // -----------------------------------------------------------------------

  describe("body size limit", () => {
    it("should allow request with Content-Length within limit (500KB)", async () => {
      const handler = vi.fn().mockResolvedValue(new NextResponse("ok", { status: 200 }));
      const wrapped = withApiMiddleware(handler);
      const request = createRequest("/api/test", {
        method: "POST",
        headers: { "content-length": String(500_000) },
        body: "x".repeat(500_000),
      });

      const response = await wrapped(request);

      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should reject request with Content-Length exceeding limit (2MB)", async () => {
      const handler = vi.fn();
      const wrapped = withApiMiddleware(handler);
      const request = createRequest("/api/test", {
        method: "POST",
        headers: { "content-length": String(2_000_000) },
        body: "x".repeat(100), // actual body size is irrelevant — header checked first
      });

      const response = await wrapped(request);

      expect(response.status).toBe(413);
      const body = await response.json();
      expect(body.code).toBe("LIMIT_REACHED");
      expect(body.error).toContain("too large");
      expect(handler).not.toHaveBeenCalled();
    });

    it("should allow request with no Content-Length header", async () => {
      const handler = vi.fn().mockResolvedValue(new NextResponse("ok", { status: 200 }));
      const wrapped = withApiMiddleware(handler);
      const request = createRequest("/api/test", {
        method: "POST",
        body: "some body content",
        // No content-length header — middleware defaults to 0
      });

      const response = await wrapped(request);

      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should allow request with Content-Length exactly at limit (1,000,000 bytes)", async () => {
      const handler = vi.fn().mockResolvedValue(new NextResponse("ok", { status: 200 }));
      const wrapped = withApiMiddleware(handler);
      const request = createRequest("/api/test", {
        method: "POST",
        headers: { "content-length": String(1_000_000) },
        body: "x".repeat(1_000_000),
      });

      const response = await wrapped(request);

      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should reject request with Content-Length at limit + 1 (1,000,001 bytes)", async () => {
      const handler = vi.fn();
      const wrapped = withApiMiddleware(handler);
      const request = createRequest("/api/test", {
        method: "POST",
        headers: { "content-length": String(1_000_001) },
        body: "x".repeat(1_000_001),
      });

      const response = await wrapped(request);

      expect(response.status).toBe(413);
      const body = await response.json();
      expect(body.code).toBe("LIMIT_REACHED");
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Auth
  // -----------------------------------------------------------------------

  describe("auth", () => {
    it("should call handler with userId when authenticated", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-123" } });
      const handler = vi.fn().mockResolvedValue(new NextResponse("ok", { status: 200 }));
      const wrapped = withApiMiddleware(handler);
      const request = createRequest("/api/test");

      await wrapped(request);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-123" }), {});
    });

    it("should return 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const handler = vi.fn();
      const wrapped = withApiMiddleware(handler);
      const request = createRequest("/api/test");

      const response = await wrapped(request);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.code).toBe("UNAUTHORIZED");
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Rate limiting
  // -----------------------------------------------------------------------

  describe("rate limiting", () => {
    it("should call handler when rate limit not exceeded", async () => {
      mockWithRateLimit.mockResolvedValue(null);
      const handler = vi.fn().mockResolvedValue(new NextResponse("ok", { status: 200 }));
      const wrapped = withApiMiddleware(handler);
      const request = createRequest("/api/test");

      const response = await wrapped(request);

      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should return rate limit response when limit exceeded", async () => {
      const rateLimitResponse = new NextResponse("Rate limited", {
        status: 429,
      });
      mockWithRateLimit.mockResolvedValue(rateLimitResponse);
      const handler = vi.fn();
      const wrapped = withApiMiddleware(handler);
      const request = createRequest("/api/test");

      const response = await wrapped(request);

      expect(response.status).toBe(429);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Handler execution
  // -----------------------------------------------------------------------

  describe("handler execution", () => {
    it("should add REQUEST_ID_HEADER to successful response", async () => {
      const handler = vi.fn().mockResolvedValue(new NextResponse("ok", { status: 200 }));
      const wrapped = withApiMiddleware(handler);
      const request = createRequest("/api/test");

      const response = await wrapped(request);

      expect(response.headers.get("x-request-id")).toBe("req-123");
    });

    it("should return 500 when handler throws", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("handler error"));
      const wrapped = withApiMiddleware(handler);
      const request = createRequest("/api/test");

      const response = await wrapped(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.code).toBe("INTERNAL_ERROR");
    });
  });

  // -----------------------------------------------------------------------
  // Metrics
  // -----------------------------------------------------------------------

  describe("metrics", () => {
    it("should record httpRequestTotal and httpRequestDuration on success", async () => {
      const handler = vi.fn().mockResolvedValue(new NextResponse("ok", { status: 200 }));
      const wrapped = withApiMiddleware(handler);
      const request = createRequest("/api/test", { method: "GET" });

      await wrapped(request);

      expect(httpRequestDuration.observe).toHaveBeenCalledWith(
        { method: "GET", route: "/api/test", status: 200 },
        expect.any(Number),
      );
      expect(httpRequestTotal.inc).toHaveBeenCalledWith({
        method: "GET",
        route: "/api/test",
        status: 200,
      });
    });

    it("should record metrics with status 500 when handler throws", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("handler error"));
      const wrapped = withApiMiddleware(handler);
      const request = createRequest("/api/test", { method: "POST" });

      await wrapped(request);

      expect(httpRequestDuration.observe).toHaveBeenCalledWith(
        { method: "POST", route: "/api/test", status: 500 },
        expect.any(Number),
      );
      expect(httpRequestTotal.inc).toHaveBeenCalledWith({
        method: "POST",
        route: "/api/test",
        status: 500,
      });
    });
  });
});
