/**
 * Tests for GET /api/v1/queue/status
 *
 * Verifies:
 * - Happy path: returns queue status counts
 * - Uses getQueueStatus() for in-memory queue data
 * - Returns Cache-Control: no-store
 * - Returns X-API-Version header
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockJson } = vi.hoisted(() => ({
  mockJson: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: mockJson,
  },
}));

vi.mock("@/lib/job-queue", () => ({
  getQueueStatus: vi.fn(() => ({
    queued: 0,
    running: 1,
    completed: 5,
    failed: 0,
    total: 6,
  })),
}));

vi.mock("@/lib/middleware/api-middleware", () => ({
  withApiMiddleware: vi.fn(
    (handler: (ctx: { userId: string; request: any }) => unknown) => async (request: unknown) => {
      return handler({ userId: "test-user-id", request });
    },
  ),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { GET } from "../status/route";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/v1/queue/status", () => {
  let mockHeaders: { set: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders = { set: vi.fn() };
    mockJson.mockImplementation(() => ({
      status: 200,
      statusText: "OK",
      headers: mockHeaders,
    }));
  });

  describe("happy path", () => {
    it("should return queue status counts", async () => {
      const request = { url: "http://localhost/api/v1/queue/status" };
      const response = await (GET as unknown as (...args: any[]) => unknown)(request);

      // First arg should be the status data
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          queued: expect.any(Number),
          running: expect.any(Number),
          completed: expect.any(Number),
          failed: expect.any(Number),
          total: expect.any(Number),
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Cache-Control": "no-store",
          }),
        }),
      );

      // addVersionHeaders should have been called to set the API version
      expect(mockHeaders.set).toHaveBeenCalledWith("X-API-Version", "v1");

      expect((response as any).status).toBe(200);
    });

    it("should return valid status shape", async () => {
      const request = { url: "http://localhost/api/v1/queue/status" };
      await (GET as unknown as (...args: any[]) => unknown)(request);

      const statusArg = mockJson.mock.calls[0][0] as Record<string, unknown>;
      expect(statusArg).toHaveProperty("queued");
      expect(statusArg).toHaveProperty("running");
      expect(statusArg).toHaveProperty("completed");
      expect(statusArg).toHaveProperty("failed");
      expect(statusArg).toHaveProperty("total");

      // All values should be non-negative integers
      expect(statusArg.queued).toBeGreaterThanOrEqual(0);
      expect(statusArg.running).toBeGreaterThanOrEqual(0);
      expect(statusArg.completed).toBeGreaterThanOrEqual(0);
      expect(statusArg.failed).toBeGreaterThanOrEqual(0);
      expect(statusArg.total).toBeGreaterThanOrEqual(0);
    });
  });
});
