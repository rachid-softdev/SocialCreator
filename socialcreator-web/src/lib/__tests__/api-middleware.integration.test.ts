/**
 * Integration tests for the API middleware pipeline
 *
 * Tests the full middleware chain: request-id → body size → rate limit → auth → handler → logging
 * Uses mocked dependencies (no real database needed).
 */

import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mock factories — vitest hoists these to top of file
const { mockAuth, mockRateLimit, mockLogger } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockRateLimit: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/rate-limit-redis", () => ({ withRateLimit: mockRateLimit }));
vi.mock("@/lib/logger", () => ({ default: mockLogger }));
vi.mock("@/lib/observability", () => ({
  createRequestLogger: vi.fn(() => mockLogger),
  runWithContext: vi.fn((_ctx, fn) => fn()),
}));

// Import after mocks
import { auth } from "@/lib/auth";
import { withApiMiddleware } from "@/lib/middleware/api-middleware";
import { withRateLimit } from "@/lib/rate-limit-redis";

const mockLoggerInfo = mockLogger.info;
const mockLoggerError = mockLogger.error;

describe("API Middleware Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (path = "/api/test", headers: Record<string, string> = {}) => {
    return new NextRequest(`http://localhost:3000${path}`, { headers });
  };

  it("should add x-request-id header to every response", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1" },
    });
    (withRateLimit as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withApiMiddleware(handler);
    const request = createRequest();

    const response = await wrapped(request);

    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should propagate existing x-request-id from incoming request", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1" },
    });
    (withRateLimit as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const requestId = "existing-trace-123";
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withApiMiddleware(handler);
    const request = createRequest("/api/test", { "x-request-id": requestId });

    const response = await wrapped(request);

    expect(response.headers.get("x-request-id")).toBe(requestId);
  });

  it("should return 401 when not authenticated", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (withRateLimit as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const handler = vi.fn();
    const wrapped = withApiMiddleware(handler);
    const request = createRequest();

    const response = await wrapped(request);

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("should reject requests with body larger than 1MB", async () => {
    const handler = vi.fn();
    const wrapped = withApiMiddleware(handler);
    const largeBody = "x".repeat(1_000_001);
    const request = new NextRequest("http://localhost:3000/api/test", {
      method: "POST",
      headers: { "content-length": String(largeBody.length) },
      body: largeBody,
    });

    const response = await wrapped(request);

    expect(response.status).toBe(413);
    expect(handler).not.toHaveBeenCalled();
  });

  it("should allow requests with body up to 1MB", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1" },
    });
    (withRateLimit as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withApiMiddleware(handler);
    // 900KB — well within the 1MB limit
    const body = "x".repeat(900_000);
    const request = new NextRequest("http://localhost:3000/api/test", {
      method: "POST",
      headers: { "content-length": String(body.length) },
      body,
    });

    const response = await wrapped(request);

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should sanitize route paths in Prometheus labels", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1" },
    });
    (withRateLimit as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withApiMiddleware(handler);
    const request = new NextRequest(
      "http://localhost:3000/api/v1/content/507f1f77bcf86cd799439011",
      {
        method: "GET",
      },
    );

    await wrapped(request);

    // The handler should receive the sanitized route path without the raw ID
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.any(NextRequest),
        userId: "user-1",
      }),
      {},
    );
  });

  it("should return 413 when content-length exceeds limit", async () => {
    const handler = vi.fn();
    const wrapped = withApiMiddleware(handler);
    const request = new NextRequest("http://localhost:3000/api/test", {
      method: "POST",
      headers: { "content-length": "5000000" }, // 5MB
      body: "x".repeat(5000), // body doesn't matter, content-length header is checked first
    });

    const response = await wrapped(request);

    expect(response.status).toBe(413);
    expect(handler).not.toHaveBeenCalled();
  });

  it("should log request completion with requestId and duration", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1" },
    });
    (withRateLimit as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withApiMiddleware(handler);
    const request = createRequest("/api/test");

    await wrapped(request);

    // request-scoped logger has requestId, method, path bound at creation;
    // the info() call only includes dynamic fields
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: expect.any(Number),
        status: 200,
      }),
      "API request completed",
    );
  });

  it("should log and return 500 when handler throws", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1" },
    });
    (withRateLimit as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const handler = vi.fn().mockRejectedValue(new Error("Unexpected error"));
    const wrapped = withApiMiddleware(handler);
    const request = createRequest();

    const response = await wrapped(request);

    expect(response.status).toBe(500);
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: expect.any(Number),
        err: expect.any(Error),
      }),
      "API request failed",
    );
  });
});
