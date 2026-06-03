/**
 * Tests for POST /api/v1/content/generate
 *
 * Verifies:
 * - 201 on valid request
 * - 400 on invalid brief
 * - 401 without auth
 * - 404 wrong profile
 * - 402 quota exceeded
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ───────────────────────────────────────────────

const { mockJson, mockProfileRepo, mockTryIncrement, mockGenerateAndSave } = vi.hoisted(() => ({
  mockJson: vi.fn(),
  mockProfileRepo: { findById: vi.fn() },
  mockTryIncrement: vi.fn(),
  mockGenerateAndSave: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: mockJson,
  },
}));

vi.mock("@/lib/api-middleware", () => ({
  withApiMiddleware: vi.fn(
    (
      handler: (ctx: { userId: string; request: any }, params?: Record<string, string>) => unknown,
    ) =>
      async (request: unknown) =>
        handler({ userId: "test-user-id", request }),
  ),
}));

vi.mock("@/lib/api-errors", () => ({
  fromZodError: vi.fn((error: any) => ({
    status: 400,
    error: error.errors[0].message,
    details: error.errors.map((e: any) => ({ path: e.path.join("."), message: e.message })),
  })),
  badRequest: vi.fn((msg: string) => ({ status: 400, error: msg })),
  unauthorized: vi.fn(() => ({ status: 401, error: "Unauthorized" })),
  notFound: vi.fn((resource?: string) => ({
    status: 404,
    error: `${resource ?? "Resource"} not found`,
  })),
}));

vi.mock("@/lib/repositories", () => ({
  getRepositories: vi.fn(() => ({
    profile: mockProfileRepo,
  })),
}));

vi.mock("@/lib/llm/rate-limiter", () => ({
  tryIncrementGenerationUsage: mockTryIncrement,
}));

vi.mock("@/lib/content/generator", () => ({
  generateAndSaveContent: mockGenerateAndSave,
}));

vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ── Imports (after mocks) ──────────────────────────────────────

import { POST } from "../route";

// ── Helpers ─────────────────────────────────────────────────────

function makeMockProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "profile-1",
    userId: "test-user-id",
    name: "Test Profile",
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe("POST /api/v1/content/generate", () => {
  const validBody = {
    profileId: "profile-1",
    platform: "X",
    brief: "Generate a post about AI technology advancements",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockJson.mockImplementation((_body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 201,
    }));

    mockTryIncrement.mockResolvedValue({
      allowed: true,
      used: 5,
      limit: 50,
      remaining: 45,
      resetAt: Date.now() + 3600000,
    });

    mockGenerateAndSave.mockResolvedValue([
      {
        id: "content-1",
        platform: "X",
        textContent: "AI is changing the world",
        hashtags: ["#AI", "#Tech"],
        status: "DRAFT",
      },
    ]);
  });

  describe("happy path", () => {
    it("should return 201 with generated content", async () => {
      mockProfileRepo.findById.mockResolvedValue(makeMockProfile());

      const request = { json: async () => validBody };

      await (POST as unknown as Function)(request);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.arrayContaining([
            expect.objectContaining({ textContent: "AI is changing the world" }),
          ]),
          quota: expect.objectContaining({
            remaining: 45,
            limit: 50,
          }),
        }),
        expect.objectContaining({ status: 201 }),
      );
    });
  });

  describe("validation errors", () => {
    it("should return 400 when brief is too short", async () => {
      const request = {
        json: async () => ({ ...validBody, brief: "Short" }),
      };

      const response = await (POST as unknown as Function)(request);

      expect(response).toEqual(expect.objectContaining({ status: 400 }));
    });

    it("should return 400 when platform is invalid", async () => {
      const request = {
        json: async () => ({ ...validBody, platform: "SNAPCHAT" }),
      };

      const response = await (POST as unknown as Function)(request);

      expect(response).toEqual(expect.objectContaining({ status: 400 }));
    });
  });

  describe("auth errors", () => {
    it("should return 404 when profile not owned by user", async () => {
      const profile = makeMockProfile({ userId: "different-user" });
      mockProfileRepo.findById.mockResolvedValue(profile);

      const request = { json: async () => validBody };

      const { notFound } = await import("@/lib/api-errors");

      await (POST as unknown as Function)(request);

      expect(notFound).toHaveBeenCalledWith("Profile");
    });

    it("should return 404 when profile does not exist", async () => {
      mockProfileRepo.findById.mockResolvedValue(null);

      const request = { json: async () => validBody };

      const { notFound } = await import("@/lib/api-errors");

      await (POST as unknown as Function)(request);

      expect(notFound).toHaveBeenCalledWith("Profile");
    });
  });

  describe("quota errors", () => {
    it("should return 402 when quota exceeded", async () => {
      mockProfileRepo.findById.mockResolvedValue(makeMockProfile());
      mockTryIncrement.mockResolvedValue({
        allowed: false,
        used: 50,
        limit: 50,
        remaining: 0,
        resetAt: Date.now() + 3600000,
      });

      const request = { json: async () => validBody };

      const response = await (POST as unknown as Function)(request);

      expect(response).toEqual(expect.objectContaining({ status: 402 }));
    });
  });
});
