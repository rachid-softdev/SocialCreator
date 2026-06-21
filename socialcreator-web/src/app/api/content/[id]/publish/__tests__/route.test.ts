import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock variables (needed before vi.mock factories)
// ---------------------------------------------------------------------------
const mockGetPublisher = vi.hoisted(() => vi.fn());
const mockGetValidAccessToken = vi.hoisted(() => vi.fn());

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    generatedContent: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    connectedAccount: {
      findUnique: vi.fn(),
    },
    publishLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/publish-guard", () => ({
  canPublish: vi.fn(),
  recordPublish: vi.fn(),
}));

vi.mock("@/lib/publishers", () => ({
  getPublisher: mockGetPublisher,
}));

vi.mock("@/lib/tokens", () => ({
  getValidAccessToken: mockGetValidAccessToken,
}));

vi.mock("@socialcreator/utils", () => ({
  hashContent: vi.fn(() => "hashed_content"),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canPublish, recordPublish } from "@/lib/publish-guard";
import { POST } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createRequest() {
  return new NextRequest("http://localhost:3000/api/content/content-123/publish", {
    method: "POST",
  });
}

function createParams(contentId = "content-123") {
  return { params: Promise.resolve({ id: contentId }) };
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const mockContent = {
  id: "content-123",
  profileId: "profile-abc-123",
  platform: "X",
  status: "APPROVED",
  textContent: "Test post",
  mediaUrls: [],
  hashtags: ["#test"],
  postId: null,
  publishedAt: null,
  profile: {
    id: "profile-abc-123",
    name: "My Profile",
  },
};

const mockConnectedAccount = {
  id: "ca-123",
  profileId: "profile-abc-123",
  platform: "X",
  accountId: "acct_123",
  accessToken: "encrypted_token",
  refreshToken: "encrypted_refresh",
  isActive: true,
};

const mockPublisher = {
  publish: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/content/[id]/publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-abc-123" },
    });
    (prisma.generatedContent.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockContent,
    );
    (canPublish as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      canPublish: true,
      count: 0,
      max: 4,
    });
    (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockConnectedAccount,
    );
    mockGetValidAccessToken.mockResolvedValue("valid_access_token");
    mockGetPublisher.mockReturnValue(mockPublisher);
    mockPublisher.publish.mockResolvedValue({
      success: true,
      postId: "post_123",
      postUrl: "https://x.com/user/status/123",
    });
    (prisma.publishLog.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.generatedContent.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  // -- Auth ---

  it("should return 401 when unauthenticated", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await POST(createRequest(), createParams());
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  // -- Content not found ---

  it("should return 404 when content is not found", async () => {
    (prisma.generatedContent.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      null,
    );

    const res = await POST(createRequest(), createParams());
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Content not found");
  });

  // -- Already published (idempotent) ---

  it("should return 200 with alreadyPublished=true when content is already PUBLISHED", async () => {
    (prisma.generatedContent.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockContent,
      status: "PUBLISHED",
      postId: "existing_post",
      publishedAt: new Date("2024-01-01T12:00:00Z"),
    });

    const res = await POST(createRequest(), createParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.alreadyPublished).toBe(true);
    expect(data.postId).toBe("existing_post");
    expect(data.publishedAt).toBe("2024-01-01T12:00:00.000Z");
  });

  // -- Status not APPROVED ---

  it("should return 400 when content status is not APPROVED", async () => {
    (prisma.generatedContent.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockContent,
      status: "DRAFT",
    });

    const res = await POST(createRequest(), createParams());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("must be APPROVED");
  });

  // -- Daily cap reached ---

  it("should return 429 when daily cap is reached", async () => {
    (canPublish as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      canPublish: false,
      reason: "Daily publish limit reached (max 4)",
    });

    const res = await POST(createRequest(), createParams());
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toBe("Daily publish limit reached (max 4)");
  });

  // -- No active connected account ---

  it("should return 400 when no active connected account exists", async () => {
    (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      null,
    );

    const res = await POST(createRequest(), createParams());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("No active connected account");
  });

  it("should return 400 when connected account is not active", async () => {
    (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockConnectedAccount,
      isActive: false,
    });

    const res = await POST(createRequest(), createParams());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("No active connected account");
  });

  // -- Valid access token fails ---

  it("should return 400 when getValidAccessToken returns null", async () => {
    mockGetValidAccessToken.mockResolvedValue(null);

    const res = await POST(createRequest(), createParams());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Failed to get valid access token");
  });

  // -- Publish fails (publisher returns error) ---

  it("should return 422 when publish fails", async () => {
    mockPublisher.publish.mockResolvedValue({
      success: false,
      error: "Rate limited by platform",
    });
    (prisma.generatedContent.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const res = await POST(createRequest(), createParams());
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Rate limited by platform");
    // Should have marked content as FAILED
    expect(prisma.generatedContent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "content-123" },
        data: { status: "FAILED" },
      }),
    );
  });

  // -- Success ---

  it("should return 200 and publish content successfully", async () => {
    const res = await POST(createRequest(), createParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.postId).toBe("post_123");
    expect(data.postUrl).toBe("https://x.com/user/status/123");

    // Verify publish was called with correct params
    expect(mockPublisher.publish).toHaveBeenCalledWith(
      {
        textContent: "Test post",
        mediaUrls: [],
        hashtags: ["#test"],
      },
      {
        accountId: "acct_123",
        accessToken: "valid_access_token",
        refreshToken: "encrypted_refresh",
      },
    );

    // Verify PublishLog was created
    expect(prisma.publishLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-abc-123",
          profileId: "profile-abc-123",
          platform: "X",
          contentId: "content-123",
          success: true,
        }),
      }),
    );

    // Verify content was updated to PUBLISHED
    expect(prisma.generatedContent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "content-123" },
        data: expect.objectContaining({
          status: "PUBLISHED",
          postId: "post_123",
        }),
      }),
    );

    // Verify cap was recorded
    expect(recordPublish).toHaveBeenCalledWith("profile-abc-123", "X");
  });

  it("should publish content with no refresh token gracefully", async () => {
    (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockConnectedAccount,
      refreshToken: null,
    });
    mockPublisher.publish.mockResolvedValue({
      success: true,
      postId: "post_456",
      postUrl: null,
    });

    const res = await POST(createRequest(), createParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.postId).toBe("post_456");
  });
});
