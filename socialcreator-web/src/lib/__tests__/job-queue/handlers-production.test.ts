/**
 * Tests for production job queue handlers
 *
 * Verifies:
 * - publish handler uses repositories instead of direct prisma
 * - SSRF validation in publish handler (mediaUrls)
 * - Content-not-found error path
 * - agent-run handler uses repositories
 * - content-generate handler uses repositories
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies BEFORE importing the module under test
vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockGetRepositories = vi.fn();
vi.mock("@/lib/repositories", () => ({
  getRepositories: () => mockGetRepositories(),
}));

vi.mock("@/lib/publishers", () => ({
  publishContent: vi.fn(),
}));

vi.mock("@/lib/tokens", () => ({
  getValidAccessToken: vi.fn(),
}));

vi.mock("@/lib/services/agent", () => ({
  triggerAgentRun: vi.fn(),
}));

let validateMediaUrlMock = vi.fn();
let validateMediaUrlWithDnsMock = vi.fn();
vi.mock("@/lib/validate-url", () => ({
  validateMediaUrl: (...args: unknown[]) => validateMediaUrlMock(...args),
  validateMediaUrlWithDns: (...args: unknown[]) => validateMediaUrlWithDnsMock(...args),
}));

vi.mock("@/lib/content/generator", () => ({
  generateAndSaveContent: vi.fn(),
}));

// Import the module under test (this registers handlers)
import { getJobHandler } from "@/lib/job-queue/handlers";
import logger from "@/lib/logger";
import { publishContent } from "@/lib/publishers";
import { triggerAgentRun } from "@/lib/services/agent";
import { getValidAccessToken } from "@/lib/tokens";

describe("Production Job Handlers", () => {
  // Shared mock data
  const mockContent = {
    id: "content-1",
    profileId: "profile-1",
    platform: "X",
    textContent: "Hello world",
    mediaUrls: ["https://cdn.example.com/img.jpg"],
    hashtags: ["#test"],
    status: "DRAFT",
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
    scheduledPublishAt: null,
    runId: null,
  };

  const mockConnectedAccount = {
    id: "ca-1",
    profileId: "profile-1",
    platform: "X",
    accessToken: "plaintext-access-token",
    refreshToken: "plaintext-refresh-token",
    accountId: "ext-123",
    accountName: "Test Account",
    isActive: true,
    expiresAt: new Date("2025-12-31"),
  };

  const mockAgent = {
    id: "agent-1",
    profileId: "profile-1",
    name: "Test Agent",
    type: "TEXT_POST",
    platforms: ["X"],
    isActive: true,
    config: {},
    profile: { id: "profile-1", userId: "user-1" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    validateMediaUrlMock = vi.fn().mockReturnValue({ valid: true });
    validateMediaUrlWithDnsMock = vi.fn().mockResolvedValue({ valid: true });

    // publishContent returns success by default
    (publishContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      postId: "post-123",
    });

    // Default mock repositories
    mockGetRepositories.mockReturnValue({
      content: {
        findById: vi.fn(),
        findByProfileId: vi.fn(),
        create: vi.fn(),
        updateStatus: vi.fn(),
        delete: vi.fn(),
      },
      connectedAccount: {
        findByProfileAndPlatform: vi.fn(),
      },
      profile: {
        findById: vi.fn(),
      },
      agent: {
        findById: vi.fn(),
      },
      agentRun: {
        findByAgentId: vi.fn(),
      },
      publishLog: {
        countPublishedToday: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
      },
    });
  });

  describe("publish handler", () => {
    it("should use repositories for data access", async () => {
      const repos = mockGetRepositories();
      repos.content.findById.mockResolvedValue(mockContent);
      repos.connectedAccount.findByProfileAndPlatform.mockResolvedValue(mockConnectedAccount);
      (getValidAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue("valid-access-token");

      const handler = getJobHandler("publish");
      expect(handler).toBeDefined();

      await handler?.({
        contentId: "content-1",
        profileId: "profile-1",
        platform: "X",
        userId: "user-1",
      });

      // Should use contentRepo.findById, not direct prisma
      expect(repos.content.findById).toHaveBeenCalledWith("content-1");
      expect(repos.connectedAccount.findByProfileAndPlatform).toHaveBeenCalledWith(
        "profile-1",
        "X",
      );
    });

    it("should validate media URLs (SSRF protection)", async () => {
      const repos = mockGetRepositories();
      repos.content.findById.mockResolvedValue(mockContent);
      repos.connectedAccount.findByProfileAndPlatform.mockResolvedValue(mockConnectedAccount);
      (getValidAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue("valid-access-token");

      const handler = getJobHandler("publish");

      await handler?.({
        contentId: "content-1",
        profileId: "profile-1",
        platform: "X",
        userId: "user-1",
      });

      // Should validate each media URL with DNS resolution
      expect(validateMediaUrlWithDnsMock).toHaveBeenCalledWith("https://cdn.example.com/img.jpg");
    });

    it("should fail content and return when SSRF validation blocks URL", async () => {
      const repos = mockGetRepositories();
      const mediaWithPrivateUrl = {
        ...mockContent,
        mediaUrls: ["https://10.0.0.1/evil.jpg"],
      };
      repos.content.findById.mockResolvedValue(mediaWithPrivateUrl);
      validateMediaUrlWithDnsMock.mockResolvedValue({
        valid: false,
        error: "Private IP addresses are not allowed",
      });

      const handler = getJobHandler("publish");

      await handler?.({
        contentId: "content-1",
        profileId: "profile-1",
        platform: "X",
        userId: "user-1",
      });

      // Should mark content as FAILED
      expect(repos.content.updateStatus).toHaveBeenCalledWith("content-1", "FAILED");
      // Should log a warning
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          contentId: "content-1",
          url: "https://10.0.0.1/evil.jpg",
        }),
        expect.stringContaining("SSRF blocked"),
      );
      // Should NOT attempt to publish
      expect(publishContent).not.toHaveBeenCalled();
    });

    it("should throw when content is not found", async () => {
      const repos = mockGetRepositories();
      repos.content.findById.mockResolvedValue(null);

      const handler = getJobHandler("publish");

      await expect(
        handler?.({
          contentId: "nonexistent",
          profileId: "profile-1",
          platform: "X",
          userId: "user-1",
        }),
      ).rejects.toThrow("Content not found");
    });

    it("should throw when no active connected account found", async () => {
      const repos = mockGetRepositories();
      repos.content.findById.mockResolvedValue(mockContent);
      repos.connectedAccount.findByProfileAndPlatform.mockResolvedValue(null);

      const handler = getJobHandler("publish");

      await expect(
        handler?.({
          contentId: "content-1",
          profileId: "profile-1",
          platform: "X",
          userId: "user-1",
        }),
      ).rejects.toThrow("No active connected account found");
    });

    it("should throw when failed to get access token", async () => {
      const repos = mockGetRepositories();
      repos.content.findById.mockResolvedValue(mockContent);
      repos.connectedAccount.findByProfileAndPlatform.mockResolvedValue(mockConnectedAccount);
      (getValidAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const handler = getJobHandler("publish");

      await expect(
        handler?.({
          contentId: "content-1",
          profileId: "profile-1",
          platform: "X",
          userId: "user-1",
        }),
      ).rejects.toThrow("Failed to get access token");
    });

    it("should publish content successfully", async () => {
      const repos = mockGetRepositories();
      repos.content.findById.mockResolvedValue(mockContent);
      repos.connectedAccount.findByProfileAndPlatform.mockResolvedValue(mockConnectedAccount);
      (getValidAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue("valid-access-token");

      const handler = getJobHandler("publish");

      await handler?.({
        contentId: "content-1",
        profileId: "profile-1",
        platform: "X",
        userId: "user-1",
      });

      expect(publishContent).toHaveBeenCalledWith(
        "X",
        {
          textContent: mockContent.textContent,
          mediaUrls: mockContent.mediaUrls,
          hashtags: mockContent.hashtags,
        },
        {
          accountId: mockConnectedAccount.accountId,
          accessToken: "valid-access-token",
          refreshToken: mockConnectedAccount.refreshToken ?? undefined,
        },
      );
    });
  });

  describe("agent-run handler", () => {
    it("should use repositories for agent lookup", async () => {
      const repos = mockGetRepositories();
      repos.agent.findById.mockResolvedValue(mockAgent);

      const handler = getJobHandler("agent-run");
      expect(handler).toBeDefined();

      await handler?.({
        agentId: "agent-1",
        runId: "run-1",
        userId: "user-1",
      });

      expect(repos.agent.findById).toHaveBeenCalledWith("agent-1");
      expect(triggerAgentRun).toHaveBeenCalledWith({
        runId: "run-1",
        agentId: "agent-1",
      });
    });

    it("should throw when agent is not found", async () => {
      const repos = mockGetRepositories();
      repos.agent.findById.mockResolvedValue(null);

      const handler = getJobHandler("agent-run");

      await expect(
        handler?.({
          agentId: "nonexistent",
          runId: "run-1",
          userId: "user-1",
        }),
      ).rejects.toThrow("Agent not found");
    });
  });

  describe("content-generate handler", () => {
    it("should call generateAndSaveContent with correct payload", async () => {
      const { generateAndSaveContent } = await import("@/lib/content/generator");
      (generateAndSaveContent as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: "new-content-1",
          platform: "X",
          textContent: "Generated content",
          hashtags: [],
          status: "DRAFT",
        },
      ]);

      const handler = getJobHandler("content-generate");
      expect(handler).toBeDefined();

      await handler?.({
        userId: "user-1",
        profileId: "profile-1",
        platform: "X",
        brief: "test brief",
        agentId: "agent-1",
        keywords: ["ai"],
        brandVoice: "Professional",
        count: 2,
      });

      expect(generateAndSaveContent).toHaveBeenCalledWith({
        profileId: "profile-1",
        platform: "X",
        brief: "test brief",
        keywords: ["ai"],
        brandVoice: "Professional",
        count: 2,
      });
    });
  });

  describe("handler registry integration", () => {
    it("should have all four built-in handler types registered", () => {
      expect(getJobHandler("agent-run")).toBeDefined();
      expect(getJobHandler("content-generate")).toBeDefined();
      expect(getJobHandler("publish")).toBeDefined();
      expect(getJobHandler("video-process")).toBeDefined();
    });
  });
});
