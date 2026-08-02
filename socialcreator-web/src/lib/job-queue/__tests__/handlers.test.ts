/**
 * Tests for job queue handlers, focusing on:
 * - Atomic claim (PUBLISHING status) to prevent concurrent publishes
 * - Idempotency check (content hash dedup)
 * - Daily cap enforcement
 * - SSRF media URL validation
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublishPayload } from "../types";

// ── Mocks ────────────────────────────────────────────────────

const mockFindById = vi.fn();
const mockUpdateStatus = vi.fn();
const mockUpdateMany = vi.fn();
const mockFindSuccessfulByContentHash = vi.fn();
const mockCountPublishedToday = vi.fn();
const mockFindByProfileAndPlatform = vi.fn();
const mockGetValidAccessToken = vi.fn();
const mockValidateMediaUrlWithDns = vi.fn();
const mockPublishContent = vi.fn();
const mockCreatePublishLog = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    generatedContent: {
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
  },
}));

vi.mock("@/lib/repositories", () => ({
  getRepositories: () => ({
    content: {
      findById: mockFindById,
      updateStatus: mockUpdateStatus,
    },
    connectedAccount: {
      findByProfileAndPlatform: mockFindByProfileAndPlatform,
    },
    profile: {
      findById: vi.fn().mockResolvedValue({ id: "profile-1", userId: "user-1" }),
    },
    publishLog: {
      findSuccessfulByContentHash: mockFindSuccessfulByContentHash,
      countPublishedToday: mockCountPublishedToday,
      create: mockCreatePublishLog,
    },
  }),
}));

vi.mock("@/lib/publishers", () => ({
  publishContent: (...args: unknown[]) => mockPublishContent(...args),
}));

vi.mock("@/lib/tokens", () => ({
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
}));

vi.mock("@/lib/validate-url", () => ({
  validateMediaUrlWithDns: (...args: unknown[]) => mockValidateMediaUrlWithDns(...args),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Helper ───────────────────────────────────────────────────

function makePayload(overrides: Partial<PublishPayload> = {}): PublishPayload {
  return {
    contentId: "content-1",
    profileId: "profile-1",
    platform: "instagram" as any,
    userId: "user-1",
    contentHash: "hash-abc-123",
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────

describe("Publish Handler — Atomic Claim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should proceed when atomic claim succeeds (status transitions to PUBLISHING)", async () => {
    // Arrange: content exists, claim succeeds (1 row affected)
    mockFindById.mockResolvedValue({
      id: "content-1",
      profileId: "profile-1",
      textContent: "Hello world",
      mediaUrls: [],
      hashtags: [],
      status: "APPROVED",
    });
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindSuccessfulByContentHash.mockResolvedValue(null);
    mockCountPublishedToday.mockResolvedValue(5);
    mockFindByProfileAndPlatform.mockResolvedValue({
      id: "acct-1",
      accountId: "fb-page-1",
      isActive: true,
      refreshToken: "rt-1",
    });
    mockGetValidAccessToken.mockResolvedValue("valid-token");
    mockPublishContent.mockResolvedValue({ success: true, postId: "post-123" });

    // Import the handler dynamically so mocks are in place
    const { getJobHandler } = await import("../handlers");
    const handler = getJobHandler("publish");

    await handler!(makePayload());

    // Assert: atomic claim was called with correct where/data
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "content-1", status: { in: ["APPROVED", "SCHEDULED"] } },
      data: { status: "PUBLISHING" },
    });
    // Publish proceeded
    expect(mockPublishContent).toHaveBeenCalledTimes(1);
    expect(mockUpdateStatus).toHaveBeenCalledWith("content-1", "PUBLISHED");
    expect(mockCreatePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({
        contentId: "content-1",
        success: true,
      }),
    );
  });

  it("should skip when another worker already claimed the content (0 rows affected)", async () => {
    mockFindById.mockResolvedValue({
      id: "content-1",
      profileId: "profile-1",
      textContent: "Hello",
      mediaUrls: [],
      hashtags: [],
      status: "PUBLISHING",
    });
    // 0 rows affected — status is already PUBLISHING (another worker)
    mockUpdateMany.mockResolvedValue({ count: 0 });

    const { getJobHandler } = await import("../handlers");
    const handler = getJobHandler("publish");

    await handler!(makePayload());

    // Should skip — no publishing attempted
    expect(mockPublishContent).not.toHaveBeenCalled();
    expect(mockUpdateStatus).not.toHaveBeenCalled();
  });

  it("should skip when content is already published (status = PUBLISHED)", async () => {
    mockFindById.mockResolvedValue({
      id: "content-1",
      profileId: "profile-1",
      textContent: "Hello",
      mediaUrls: [],
      hashtags: [],
      status: "PUBLISHED",
    });
    // Already PUBLISHED — claim fails with 0 rows
    mockUpdateMany.mockResolvedValue({ count: 0 });

    const { getJobHandler } = await import("../handlers");
    const handler = getJobHandler("publish");

    await handler!(makePayload());

    expect(mockPublishContent).not.toHaveBeenCalled();
  });

  it("should skip when idempotency check finds existing published content", async () => {
    mockFindById.mockResolvedValue({
      id: "content-1",
      profileId: "profile-1",
      textContent: "Hello",
      mediaUrls: [],
      hashtags: [],
      status: "APPROVED",
    });
    // Claim succeeds
    mockUpdateMany.mockResolvedValue({ count: 1 });
    // But already published
    mockFindSuccessfulByContentHash.mockResolvedValue({
      id: "log-1",
      contentHash: "hash-abc-123",
    });

    const { getJobHandler } = await import("../handlers");
    const handler = getJobHandler("publish");

    await handler!(makePayload());

    // Should mark as PUBLISHED and skip publishing
    expect(mockUpdateStatus).toHaveBeenCalledWith("content-1", "PUBLISHED");
    expect(mockPublishContent).not.toHaveBeenCalled();
  });

  it("should release PUBLISHING lock when daily cap is reached", async () => {
    mockFindById.mockResolvedValue({
      id: "content-1",
      profileId: "profile-1",
      textContent: "Hello",
      mediaUrls: [],
      hashtags: [],
      status: "APPROVED",
    });
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindSuccessfulByContentHash.mockResolvedValue(null);
    // Daily cap at 50/50
    mockCountPublishedToday.mockResolvedValue(50);

    const { getJobHandler } = await import("../handlers");
    const handler = getJobHandler("publish");

    await handler!(makePayload());

    // Should release the lock: status back to APPROVED for retry
    expect(mockUpdateStatus).toHaveBeenCalledWith("content-1", "APPROVED");
    expect(mockPublishContent).not.toHaveBeenCalled();
  });

  it("should reject publish when SSRF validation fails on a media URL", async () => {
    mockFindById.mockResolvedValue({
      id: "content-1",
      profileId: "profile-1",
      textContent: "Hello",
      mediaUrls: ["https://evil.internal-network.com/malware"],
      hashtags: [],
      status: "APPROVED",
    });
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindSuccessfulByContentHash.mockResolvedValue(null);
    mockCountPublishedToday.mockResolvedValue(5);
    mockValidateMediaUrlWithDns.mockResolvedValue({
      valid: false,
      error: "URL resolves to a private IP range",
    });

    const { getJobHandler } = await import("../handlers");
    const handler = getJobHandler("publish");

    await handler!(makePayload());

    // Should set status to FAILED
    expect(mockUpdateStatus).toHaveBeenCalledWith("content-1", "FAILED");
    expect(mockPublishContent).not.toHaveBeenCalled();
  });

  it("should set content to FAILED when connected account is inactive", async () => {
    mockFindById.mockResolvedValue({
      id: "content-1",
      profileId: "profile-1",
      textContent: "Hello",
      mediaUrls: [],
      hashtags: [],
      status: "APPROVED",
    });
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindSuccessfulByContentHash.mockResolvedValue(null);
    mockCountPublishedToday.mockResolvedValue(5);
    // No active connected account
    mockFindByProfileAndPlatform.mockResolvedValue({
      id: "acct-1",
      accountId: "fb-page-1",
      isActive: false,
    });

    const { getJobHandler } = await import("../handlers");
    const handler = getJobHandler("publish");

    await expect(handler!(makePayload())).rejects.toThrow("No active connected account found");
    expect(mockUpdateStatus).toHaveBeenCalledWith("content-1", "FAILED");
    expect(mockPublishContent).not.toHaveBeenCalled();
  });

  it("should create a failed PublishLog when publishing fails", async () => {
    mockFindById.mockResolvedValue({
      id: "content-1",
      profileId: "profile-1",
      textContent: "Hello",
      mediaUrls: ["https://example.com/img.jpg"],
      hashtags: [],
      status: "APPROVED",
    });
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindSuccessfulByContentHash.mockResolvedValue(null);
    mockCountPublishedToday.mockResolvedValue(5);
    mockValidateMediaUrlWithDns.mockResolvedValue({ valid: true });
    mockFindByProfileAndPlatform.mockResolvedValue({
      id: "acct-1",
      accountId: "fb-page-1",
      isActive: true,
      refreshToken: "rt-1",
    });
    mockGetValidAccessToken.mockResolvedValue("valid-token");
    mockPublishContent.mockResolvedValue({
      success: false,
      error: "Instagram API rate limit exceeded",
    });

    const { getJobHandler } = await import("../handlers");
    const handler = getJobHandler("publish");

    await handler!(makePayload());

    expect(mockUpdateStatus).toHaveBeenCalledWith("content-1", "FAILED");
    expect(mockCreatePublishLog).toHaveBeenCalledWith(
      expect.objectContaining({
        contentId: "content-1",
        success: false,
        error: "Instagram API rate limit exceeded",
      }),
    );
  });
});
