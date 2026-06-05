/**
 * Tests for PUT /api/v1/content/:id
 *
 * Verifies:
 * - 200 on successful update
 * - 400 when content ID is missing
 * - 400 on invalid body
 * - 404 when content not found
 * - 404 when not owned by user
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ───────────────────────────────────────────────

const { mockJson, mockContentRepo, mockProfileRepo } = vi.hoisted(() => ({
  mockJson: vi.fn(),
  mockContentRepo: { findById: vi.fn(), update: vi.fn() },
  mockProfileRepo: { findById: vi.fn() },
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
      async (request: unknown, context?: { params?: Record<string, string> }) => {
        const params = context?.params ?? {};
        return handler({ userId: "test-user-id", request }, params);
      },
  ),
}));

vi.mock("@/lib/api-errors", () => ({
  badRequest: vi.fn((msg: string) => ({ status: 400, error: msg })),
  notFound: vi.fn((resource?: string) => ({
    status: 404,
    error: `${resource ?? "Resource"} not found`,
  })),
}));

vi.mock("@/lib/repositories", () => ({
  getRepositories: vi.fn(() => ({
    content: mockContentRepo,
    profile: mockProfileRepo,
  })),
}));

// ── Imports (after mocks) ──────────────────────────────────────

import { badRequest, notFound } from "@/lib/api-errors";
import { PUT } from "../route";

// ── Helpers ─────────────────────────────────────────────────────

function makeMockContent(overrides: Record<string, unknown> = {}) {
  return {
    id: "content-1",
    profileId: "profile-1",
    platform: "X",
    textContent: "Original content",
    mediaUrls: [],
    hashtags: ["#original"],
    status: "DRAFT",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    publishedAt: null,
    scheduledPublishAt: null,
    runId: null,
    ...overrides,
  };
}

function makeMockProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "profile-1",
    userId: "test-user-id",
    name: "Test Profile",
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe("PUT /api/v1/content/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJson.mockReturnValue({ status: 200 });
  });

  describe("happy path", () => {
    it("should update textContent and hashtags", async () => {
      const content = makeMockContent();
      const profile = makeMockProfile();
      const updatedContent = {
        ...content,
        textContent: "Updated text",
        hashtags: ["#updated"],
      };

      mockContentRepo.findById.mockResolvedValue(content);
      mockProfileRepo.findById.mockResolvedValue(profile);
      mockContentRepo.update.mockResolvedValue(updatedContent);

      const request = {
        json: async () => ({ textContent: "Updated text", hashtags: ["#updated"] }),
      };

      await (PUT as unknown as (...args: any[]) => unknown)(request, {
        params: { id: "nonexistent" },
      });

      expect(notFound).toHaveBeenCalledWith("Content");
    });

    it("should return 404 when content profile is not owned by user", async () => {
      const content = makeMockContent({ profileId: "profile-other" });
      const profile = makeMockProfile({ userId: "different-user" });

      mockContentRepo.findById.mockResolvedValue(content);
      mockProfileRepo.findById.mockResolvedValue(profile);

      const request = { json: async () => ({ textContent: "test" }) };

      await (PUT as unknown as (...args: any[]) => unknown)(request, {
        params: { id: "content-1" },
      });

      expect(notFound).toHaveBeenCalledWith("Content");
    });
  });
});
