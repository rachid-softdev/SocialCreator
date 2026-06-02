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

  it("should reject requests with body larger than 100KB", async () => {
    const handler = vi.fn();
    const wrapped = withApiMiddleware(handler);
    const largeBody = "x".repeat(100_001);
    const request = new NextRequest("http://localhost:3000/api/test", {
      method: "POST",
      headers: { "content-length": String(largeBody.length) },
      body: largeBody,
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

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: expect.any(String),
        method: "GET",
        path: "/api/test",
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
        requestId: expect.any(String),
        err: expect.any(Error),
      }),
      "API request failed",
    );
  });
});
