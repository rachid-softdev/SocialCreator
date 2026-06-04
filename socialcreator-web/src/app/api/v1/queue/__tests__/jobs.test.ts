/**
 * Tests for GET /api/v1/queue/jobs
 *
 * Verifies:
 * - Happy path: returns list of jobs from getJobs()
 * - Supports optional type query filter
 * - Supports optional status query filter
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

vi.mock("@/lib/middleware/api-middleware", () => ({
  withApiMiddleware: vi.fn(
    (handler: (ctx: { userId: string; request: any }) => unknown) => async (request: unknown) => {
      return handler({ userId: "test-user-id", request });
    },
  ),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { GET } from "../jobs/route";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/v1/queue/jobs", () => {
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
    it("should return a list of jobs", async () => {
      const request = { url: "http://localhost/api/v1/queue/jobs" };
      const response = await (GET as unknown as (...args: any[]) => unknown)(request);

      // Should return an array
      expect(mockJson).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Cache-Control": "no-store",
          }),
        }),
      );

      // addVersionHeaders should have been called to set the API version
      expect(mockHeaders.set).toHaveBeenCalledWith("X-API-Version", "v1");

      expect((response as any).status).toBe(200);
    }, 15000);

    it("should return jobs with the expected shape", async () => {
      const request = { url: "http://localhost/api/v1/queue/jobs" };
      await (GET as unknown as (...args: any[]) => unknown)(request);

      const jobsArg = mockJson.mock.calls[0][0] as Array<Record<string, unknown>>;

      // Should always be an array
      expect(Array.isArray(jobsArg)).toBe(true);

      // Each job should have required fields
      for (const job of jobsArg) {
        expect(job).toHaveProperty("id");
        expect(job).toHaveProperty("type");
        expect(job).toHaveProperty("status");
        expect(job).toHaveProperty("priority");
        expect(job).toHaveProperty("attempts");
        expect(job).toHaveProperty("maxAttempts");
        expect(job).toHaveProperty("createdAt");
        expect(typeof job.id).toBe("string");
        expect(typeof job.type).toBe("string");
        expect(typeof job.status).toBe("string");
      }
    });
  });

  describe("filtering", () => {
    it("should accept type query filter", async () => {
      const request = { url: "http://localhost/api/v1/queue/jobs?type=publish" };
      await (GET as unknown as (...args: any[]) => unknown)(request);

      const jobsArg = mockJson.mock.calls[0][0] as Array<Record<string, unknown>>;
      for (const job of jobsArg) {
        expect(job.type).toBe("publish");
      }
    });

    it("should accept status query filter", async () => {
      const request = { url: "http://localhost/api/v1/queue/jobs?status=failed" };
      await (GET as unknown as (...args: any[]) => unknown)(request);

      const jobsArg = mockJson.mock.calls[0][0] as Array<Record<string, unknown>>;
      for (const job of jobsArg) {
        expect(job.status).toBe("failed");
      }
    });

    it("should accept both type and status filters", async () => {
      const request = {
        url: "http://localhost/api/v1/queue/jobs?type=publish&status=completed",
      };
      await (GET as unknown as (...args: any[]) => unknown)(request);

      const jobsArg = mockJson.mock.calls[0][0] as Array<Record<string, unknown>>;
      for (const job of jobsArg) {
        expect(job.type).toBe("publish");
        expect(job.status).toBe("completed");
      }
    });
  });
});
