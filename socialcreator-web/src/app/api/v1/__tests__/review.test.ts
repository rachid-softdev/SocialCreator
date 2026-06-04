/**
 * Integration tests for content review API routes
 *
 * Tests:
 * - POST submit-review — sets IN_REVIEW
 * - POST submit-review — non-EDITOR fails
 * - POST approve-review — sets APPROVED
 * - POST reject-review — sets REJECTED with comment
 * - Auto-approve for OWNER/ADMIN submitter
 */

import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit-redis", () => ({ withRateLimit: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock withApiMiddleware as a pass-through
vi.mock("@/lib/api-middleware", () => {
  const withApiMiddleware = (handler: (ctx: any, params?: any) => Promise<NextResponse>) => {
    return async (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
      const resolvedParams = context?.params ? await context.params : {};
      return handler(
        { userId: "user-abc-123", request, apiVersion: "v1", params: resolvedParams },
        resolvedParams,
      );
    };
  };
  return { withApiMiddleware };
});

// Mock team-access functions for dynamic imports
vi.mock("@/lib/middleware/team-access", () => ({
  withTeamAccess: vi.fn(),
  canSubmitForReview: vi.fn(),
  canReview: vi.fn(),
}));

// Mock notification service for dynamic imports
vi.mock("@/lib/services/notification-service", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
  broadcastNotification: vi.fn().mockResolvedValue(undefined),
}));

// Repository mocks
const mockRepos = {
  content: {
    findById: vi.fn(),
    update: vi.fn(),
  },
  profile: {
    findById: vi.fn(),
  },
  teamMember: {
    findByTeamId: vi.fn(),
    findByUserId: vi.fn(),
  },
};

vi.mock("@/lib/repositories", () => ({
  getRepositories: vi.fn(() => mockRepos),
}));

// ---------------------------------------------------------------------------
// Import routes
// ---------------------------------------------------------------------------

import { POST as ApproveReviewPOST } from "@/app/api/v1/content/[id]/approve-review/route";
import { POST as RejectReviewPOST } from "@/app/api/v1/content/[id]/reject-review/route";
import { POST as SubmitReviewPOST } from "@/app/api/v1/content/[id]/submit-review/route";
import { canReview, canSubmitForReview, withTeamAccess } from "@/lib/middleware/team-access";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(
  path: string,
  options?: { method?: string; body?: unknown; headers?: Record<string, string> },
): NextRequest {
  const url = `http://localhost:3000${path}`;
  const body = options?.body !== undefined ? JSON.stringify(options.body) : undefined;
  return new NextRequest(url, {
    method: options?.method ?? "GET",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body,
  });
}

function createParams(params: Record<string, string>): { params: Promise<Record<string, string>> } {
  return { params: Promise.resolve(params) };
}

const mockContent = {
  id: "content-1",
  profileId: "profile-1",
  textContent: "Test content for review",
  reviewStatus: "DRAFT",
};

const mockProfile = {
  id: "profile-1",
  userId: "user-abc-123",
  name: "Test Profile",
  teamId: null,
};

const mockTeamProfile = {
  id: "profile-2",
  userId: "other-user",
  name: "Team Profile",
  teamId: "team-1",
};

const mockContentInReview = {
  ...mockContent,
  reviewStatus: "IN_REVIEW",
};

const mockContentApproved = {
  ...mockContent,
  reviewStatus: "APPROVED",
  reviewedById: "user-abc-123",
  reviewedAt: new Date(),
};

const mockContentRejected = {
  ...mockContent,
  reviewStatus: "REJECTED",
  reviewedById: "user-abc-123",
  reviewedAt: new Date(),
  reviewComment: "Needs improvement",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/v1/content/[id]/submit-review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should set IN_REVIEW for team EDITOR (not owner)", async () => {
    mockRepos.content.findById.mockResolvedValue(mockContent);
    mockRepos.profile.findById.mockResolvedValue(mockTeamProfile);
    vi.mocked(withTeamAccess).mockResolvedValue({
      teamId: "team-1",
      userId: "user-abc-123",
      role: "EDITOR",
    });
    vi.mocked(canSubmitForReview).mockReturnValue(true);
    vi.mocked(canReview).mockReturnValue(false);
    mockRepos.teamMember.findByTeamId.mockResolvedValue([
      { userId: "user-abc-123", role: "EDITOR" },
    ]);
    mockRepos.content.update.mockResolvedValue(mockContentInReview);

    const res = await SubmitReviewPOST(
      createRequest("/api/v1/content/content-1/submit-review", { method: "POST" }),
      createParams({ id: "content-1" }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.content.reviewStatus).toBe("IN_REVIEW");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("X-API-Version")).toBe("v1");
  });

  it("should auto-approve when profile owner submits", async () => {
    mockRepos.content.findById.mockResolvedValue(mockContent);
    mockRepos.profile.findById.mockResolvedValue(mockProfile);
    mockRepos.content.update.mockResolvedValue(mockContentApproved);

    const res = await SubmitReviewPOST(
      createRequest("/api/v1/content/content-1/submit-review", { method: "POST" }),
      createParams({ id: "content-1" }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.content.reviewStatus).toBe("APPROVED");
  });

  it("should auto-approve when ADMIN/OWNER role user submits", async () => {
    mockRepos.content.findById.mockResolvedValue(mockContent);
    mockRepos.profile.findById.mockResolvedValue(mockTeamProfile);
    vi.mocked(withTeamAccess).mockResolvedValue({
      teamId: "team-1",
      userId: "user-abc-123",
      role: "ADMIN",
    });
    vi.mocked(canSubmitForReview).mockReturnValue(true);
    vi.mocked(canReview).mockReturnValue(true);
    mockRepos.teamMember.findByTeamId.mockResolvedValue([
      { userId: "user-abc-123", role: "ADMIN" },
    ]);
    mockRepos.content.update.mockResolvedValue(mockContentApproved);

    const res = await SubmitReviewPOST(
      createRequest("/api/v1/content/content-1/submit-review", { method: "POST" }),
      createParams({ id: "content-1" }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.content.reviewStatus).toBe("APPROVED");
  });

  it("should return 404 when content not found", async () => {
    mockRepos.content.findById.mockResolvedValue(null);

    const res = await SubmitReviewPOST(
      createRequest("/api/v1/content/content-1/submit-review", { method: "POST" }),
      createParams({ id: "content-1" }),
    );

    expect(res.status).toBe(404);
  });

  it("should return 403 when non-EDITOR tries to submit from team", async () => {
    mockRepos.content.findById.mockResolvedValue(mockContent);
    mockRepos.profile.findById.mockResolvedValue(mockTeamProfile);

    // Mock team access to return forbidden
    vi.mocked(withTeamAccess).mockResolvedValue(
      NextResponse.json({ error: "You are not a member of this team" }, { status: 403 }) as any,
    );

    const res = await SubmitReviewPOST(
      createRequest("/api/v1/content/content-1/submit-review", { method: "POST" }),
      createParams({ id: "content-1" }),
    );

    expect(res.status).toBe(403);
  });

  it("should return 400 when content ID is missing", async () => {
    const res = await SubmitReviewPOST(
      createRequest("/api/v1/content//submit-review", { method: "POST" }),
      createParams({ id: "" }),
    );

    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/content/[id]/approve-review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should set APPROVED when profile owner approves", async () => {
    mockRepos.content.findById.mockResolvedValue(mockContentInReview);
    mockRepos.profile.findById.mockResolvedValue(mockProfile);
    mockRepos.content.update.mockResolvedValue(mockContentApproved);

    const res = await ApproveReviewPOST(
      createRequest("/api/v1/content/content-1/approve-review", { method: "POST" }),
      createParams({ id: "content-1" }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.content.reviewStatus).toBe("APPROVED");
    expect(mockRepos.content.update).toHaveBeenCalledWith(
      "content-1",
      expect.objectContaining({ reviewStatus: "APPROVED" }),
    );
  });

  it("should set APPROVED when team ADMIN approves", async () => {
    mockRepos.content.findById.mockResolvedValue(mockContentInReview);
    mockRepos.profile.findById.mockResolvedValue(mockTeamProfile);
    mockRepos.teamMember.findByTeamId.mockResolvedValue([
      { userId: "user-abc-123", role: "ADMIN" },
    ]);
    mockRepos.content.update.mockResolvedValue(mockContentApproved);

    const res = await ApproveReviewPOST(
      createRequest("/api/v1/content/content-1/approve-review", { method: "POST" }),
      createParams({ id: "content-1" }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.content.reviewStatus).toBe("APPROVED");
  });

  it("should return 401 when unauthorized user tries to approve", async () => {
    mockRepos.content.findById.mockResolvedValue(mockContentInReview);
    // Profile belongs to other user without team
    mockRepos.profile.findById.mockResolvedValue({
      ...mockProfile,
      userId: "other-user",
      teamId: null,
    });

    const res = await ApproveReviewPOST(
      createRequest("/api/v1/content/content-1/approve-review", { method: "POST" }),
      createParams({ id: "content-1" }),
    );

    expect(res.status).toBe(401);
  });

  it("should return 400 when content is not IN_REVIEW", async () => {
    mockRepos.content.findById.mockResolvedValue(mockContent); // status is DRAFT
    mockRepos.profile.findById.mockResolvedValue(mockProfile);

    const res = await ApproveReviewPOST(
      createRequest("/api/v1/content/content-1/approve-review", { method: "POST" }),
      createParams({ id: "content-1" }),
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("not in review");
  });

  it("should return 404 when content not found", async () => {
    mockRepos.content.findById.mockResolvedValue(null);

    const res = await ApproveReviewPOST(
      createRequest("/api/v1/content/unknown/approve-review", { method: "POST" }),
      createParams({ id: "unknown" }),
    );

    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/content/[id]/reject-review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should set REJECTED with comment", async () => {
    mockRepos.content.findById.mockResolvedValue(mockContentInReview);
    mockRepos.profile.findById.mockResolvedValue(mockProfile);
    mockRepos.content.update.mockResolvedValue(mockContentRejected);

    const res = await RejectReviewPOST(
      createRequest("/api/v1/content/content-1/reject-review", {
        method: "POST",
        body: { comment: "Needs improvement" },
      }),
      createParams({ id: "content-1" }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.content.reviewStatus).toBe("REJECTED");
    expect(data.content.reviewComment).toBe("Needs improvement");
  });

  it("should return 400 when comment is missing", async () => {
    mockRepos.content.findById.mockResolvedValue(mockContentInReview);
    mockRepos.profile.findById.mockResolvedValue(mockProfile);

    const res = await RejectReviewPOST(
      createRequest("/api/v1/content/content-1/reject-review", {
        method: "POST",
        body: {},
      }),
      createParams({ id: "content-1" }),
    );

    expect(res.status).toBe(400);
  });

  it("should return 400 when content is not IN_REVIEW", async () => {
    mockRepos.content.findById.mockResolvedValue(mockContent);
    mockRepos.profile.findById.mockResolvedValue(mockProfile);

    const res = await RejectReviewPOST(
      createRequest("/api/v1/content/content-1/reject-review", {
        method: "POST",
        body: { comment: "Bad" },
      }),
      createParams({ id: "content-1" }),
    );

    expect(res.status).toBe(400);
  });

  it("should return 401 when unauthorized user tries to reject", async () => {
    mockRepos.content.findById.mockResolvedValue(mockContentInReview);
    mockRepos.profile.findById.mockResolvedValue({
      ...mockProfile,
      userId: "other-user",
      teamId: null,
    });

    const res = await RejectReviewPOST(
      createRequest("/api/v1/content/content-1/reject-review", {
        method: "POST",
        body: { comment: "Needs work" },
      }),
      createParams({ id: "content-1" }),
    );

    expect(res.status).toBe(401);
  });

  it("should return 404 when content not found", async () => {
    mockRepos.content.findById.mockResolvedValue(null);

    const res = await RejectReviewPOST(
      createRequest("/api/v1/content/unknown/reject-review", {
        method: "POST",
        body: { comment: "Bad" },
      }),
      createParams({ id: "unknown" }),
    );

    expect(res.status).toBe(404);
  });
});
