/**
 * Tests for ownership verification functions
 * Covers all 6 ownership validators: profile, agent, content, connected account,
 * video asset, and agent run.
 *
 * Pattern: mock prisma, control what findUnique/findFirst returns,
 * verify correct status and error messages.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma before importing
vi.mock("@/lib/prisma", () => ({
  prisma: {
    profile: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    agent: {
      findUnique: vi.fn(),
    },
    generatedContent: {
      findUnique: vi.fn(),
    },
    connectedAccount: {
      findUnique: vi.fn(),
    },
    videoAsset: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    mediaAsset: {
      findFirst: vi.fn(),
    },
    apiKey: {
      findFirst: vi.fn(),
    },
    agentRun: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
    $extends: vi.fn(),
  },
}));

import {
  verifyAgentOwnership,
  verifyAgentRunOwnership,
  verifyApiKeyOwnership,
  verifyConnectedAccountOwnership,
  verifyContentOwnership,
  verifyMediaAssetOwnership,
  verifyProfileOwnership,
  verifyVideoAssetOwnership,
} from "@/lib/middleware/ownership";
import { prisma } from "@/lib/prisma";

describe("Ownership Verification", () => {
  const userId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Profile Ownership
  // ============================================

  describe("verifyProfileOwnership", () => {
    it("should return valid=true when profile belongs to user", async () => {
      const mockProfile = { id: "profile-1", userId, name: "Test" };
      vi.mocked(prisma.profile.findFirst).mockResolvedValue(mockProfile as any);

      const result = await verifyProfileOwnership(userId, "profile-1");

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toEqual(mockProfile);
      }
      expect(prisma.profile.findFirst).toHaveBeenCalledWith({
        where: { id: "profile-1", userId },
      });
    });

    it("should return valid=false with 404 when profile not found", async () => {
      vi.mocked(prisma.profile.findFirst).mockResolvedValue(null);

      const result = await verifyProfileOwnership(userId, "profile-nonexistent");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(404);
        const body = await result.error.json();
        expect(body.error).toContain("Profile not found");
      }
    });

    it("should return valid=false when profile belongs to another user", async () => {
      vi.mocked(prisma.profile.findFirst).mockResolvedValue(null);

      const result = await verifyProfileOwnership(userId, "profile-other");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(404);
      }
    });
  });

  // ============================================
  // Agent Ownership
  // ============================================

  describe("verifyAgentOwnership", () => {
    it("should return valid=true when agent belongs to user", async () => {
      const mockAgent = {
        id: "agent-1",
        profile: { userId, id: "profile-1", name: "Test" },
      };
      vi.mocked(prisma.agent.findUnique).mockResolvedValue(mockAgent as any);

      const result = await verifyAgentOwnership(userId, "agent-1");

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toEqual(mockAgent);
      }
      expect(prisma.agent.findUnique).toHaveBeenCalledWith({
        where: { id: "agent-1" },
        include: { profile: true },
      });
    });

    it("should return valid=false when agent not found", async () => {
      vi.mocked(prisma.agent.findUnique).mockResolvedValue(null);

      const result = await verifyAgentOwnership(userId, "agent-nonexistent");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(404);
        const body = await result.error.json();
        expect(body.error).toContain("Agent not found");
      }
    });

    it("should return valid=false when agent belongs to another user", async () => {
      const mockAgent = {
        id: "agent-2",
        profile: { userId: "user-other", id: "profile-2", name: "Other" },
      };
      vi.mocked(prisma.agent.findUnique).mockResolvedValue(mockAgent as any);

      const result = await verifyAgentOwnership(userId, "agent-2");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(404);
      }
    });
  });

  // ============================================
  // Content Ownership
  // ============================================

  describe("verifyContentOwnership", () => {
    it("should return valid=true when content belongs to user", async () => {
      const mockContent = {
        id: "content-1",
        profile: { userId, id: "profile-1" },
        textContent: "Hello",
      };
      vi.mocked(prisma.generatedContent.findUnique).mockResolvedValue(mockContent as any);

      const result = await verifyContentOwnership(userId, "content-1");

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toEqual(mockContent);
      }
    });

    it("should return valid=false with 404 when content not found", async () => {
      vi.mocked(prisma.generatedContent.findUnique).mockResolvedValue(null);

      const result = await verifyContentOwnership(userId, "content-nonexistent");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(404);
        const body = await result.error.json();
        expect(body.error).toContain("Content not found");
      }
    });

    it("should return valid=false when content belongs to another user", async () => {
      const mockContent = {
        id: "content-2",
        profile: { userId: "user-other", id: "profile-2" },
      };
      vi.mocked(prisma.generatedContent.findUnique).mockResolvedValue(mockContent as any);

      const result = await verifyContentOwnership(userId, "content-2");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(404);
        const body = await result.error.json();
        expect(body.error).toContain("access denied");
      }
    });
  });

  // ============================================
  // Connected Account Ownership
  // ============================================

  describe("verifyConnectedAccountOwnership", () => {
    it("should return valid=true when account belongs to user", async () => {
      const mockAccount = {
        id: "acct-1",
        profile: { userId, id: "profile-1" },
        platform: "INSTAGRAM",
      };
      vi.mocked(prisma.connectedAccount.findUnique).mockResolvedValue(mockAccount as any);

      const result = await verifyConnectedAccountOwnership(userId, "acct-1");

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toEqual(mockAccount);
      }
    });

    it("should return valid=false with 404 when account not found", async () => {
      vi.mocked(prisma.connectedAccount.findUnique).mockResolvedValue(null);

      const result = await verifyConnectedAccountOwnership(userId, "acct-nonexistent");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(404);
        const body = await result.error.json();
        expect(body.error).toContain("Connected account not found");
      }
    });

    it("should return valid=false when account belongs to another user", async () => {
      const mockAccount = {
        id: "acct-2",
        profile: { userId: "user-other", id: "profile-2" },
      };
      vi.mocked(prisma.connectedAccount.findUnique).mockResolvedValue(mockAccount as any);

      const result = await verifyConnectedAccountOwnership(userId, "acct-2");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(404);
      }
    });
  });

  // ============================================
  // Video Asset Ownership
  // ============================================

  describe("verifyVideoAssetOwnership", () => {
    it("should return valid=true when video asset profile belongs to user", async () => {
      const mockVideoAsset = { id: "video-1", profileId: "profile-1" };

      vi.mocked(prisma.videoAsset.findFirst).mockResolvedValue(mockVideoAsset as any);

      const result = await verifyVideoAssetOwnership(userId, "video-1");

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toEqual(mockVideoAsset);
      }
      expect(prisma.videoAsset.findFirst).toHaveBeenCalledWith({
        where: { id: "video-1", profile: { userId } },
      });
    });

    it("should return valid=false when video asset not found or access denied", async () => {
      vi.mocked(prisma.videoAsset.findFirst).mockResolvedValue(null);

      const result = await verifyVideoAssetOwnership(userId, "video-nonexistent");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(404);
        const body = await result.error.json();
        expect(body.error).toContain("not found or access denied");
      }
    });

    it("should return valid=false when video asset belongs to another user", async () => {
      // findFirst with profile.userId filter returns null when profile doesn't match
      vi.mocked(prisma.videoAsset.findFirst).mockResolvedValue(null);

      const result = await verifyVideoAssetOwnership(userId, "video-other");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(404);
        const body = await result.error.json();
        expect(body.error).toContain("access denied");
      }
    });
  });

  // ============================================
  // Media Asset Ownership
  // ============================================

  describe("verifyMediaAssetOwnership", () => {
    it("should return valid when media asset belongs to user's profile", async () => {
      const mockMediaAsset = {
        id: "media-1",
        profileId: "profile-1",
        type: "IMAGE",
        url: "https://example.com/img.jpg",
      };
      vi.mocked(prisma.mediaAsset.findFirst).mockResolvedValue(mockMediaAsset as any);

      const result = await verifyMediaAssetOwnership(userId, "media-1");

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toEqual(mockMediaAsset);
      }
      expect(prisma.mediaAsset.findFirst).toHaveBeenCalledWith({
        where: { id: "media-1", profile: { userId } },
      });
    });

    it("should return invalid when media asset does not exist", async () => {
      vi.mocked(prisma.mediaAsset.findFirst).mockResolvedValue(null);

      const result = await verifyMediaAssetOwnership(userId, "media-nonexistent");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(404);
        const body = await result.error.json();
        expect(body.error).toContain("Media asset not found");
      }
    });

    it("should return invalid when media asset belongs to another user", async () => {
      // findFirst with profile.userId filter returns null when profile doesn't match
      vi.mocked(prisma.mediaAsset.findFirst).mockResolvedValue(null);

      const result = await verifyMediaAssetOwnership(userId, "media-other");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(404);
        const body = await result.error.json();
        expect(body.error).toContain("access denied");
      }
    });
  });

  // ============================================
  // API Key Ownership
  // ============================================

  describe("verifyApiKeyOwnership", () => {
    it("should return valid when api key belongs to user and not revoked", async () => {
      const mockApiKey = {
        id: "key-1",
        userId,
        name: "Production Key",
        keyHash: "abc123",
        prefix: "sc_live_",
        revokedAt: null,
      };
      vi.mocked(prisma.apiKey.findFirst).mockResolvedValue(mockApiKey as any);

      const result = await verifyApiKeyOwnership(userId, "key-1");

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toEqual(mockApiKey);
      }
      expect(prisma.apiKey.findFirst).toHaveBeenCalledWith({
        where: { id: "key-1", userId, revokedAt: null },
      });
    });

    it("should return invalid when api key does not exist", async () => {
      vi.mocked(prisma.apiKey.findFirst).mockResolvedValue(null);

      const result = await verifyApiKeyOwnership(userId, "key-nonexistent");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(404);
        const body = await result.error.json();
        expect(body.error).toContain("API key not found");
      }
    });

    it("should return invalid when api key belongs to another user", async () => {
      // findFirst with userId filter returns null for different user
      vi.mocked(prisma.apiKey.findFirst).mockResolvedValue(null);

      const result = await verifyApiKeyOwnership(userId, "key-other-user");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(404);
        const body = await result.error.json();
        expect(body.error).toContain("access denied");
      }
    });

    it("should return invalid when api key is revoked", async () => {
      // findFirst with revokedAt: null filter returns null for revoked keys
      vi.mocked(prisma.apiKey.findFirst).mockResolvedValue(null);

      const result = await verifyApiKeyOwnership(userId, "key-revoked");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(404);
        const body = await result.error.json();
        expect(body.error).toContain("access denied");
      }
    });
  });

  // ============================================
  // Agent Run Ownership
  // ============================================

  describe("verifyAgentRunOwnership", () => {
    it("should return valid=true when agent run belongs to user", async () => {
      const mockRun = {
        id: "run-1",
        agent: {
          profile: { userId, id: "profile-1" },
        },
        status: "SUCCESS",
      };
      vi.mocked(prisma.agentRun.findUnique).mockResolvedValue(mockRun as any);

      const result = await verifyAgentRunOwnership(userId, "run-1");

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toEqual(mockRun);
      }
    });

    it("should return valid=false when run not found", async () => {
      vi.mocked(prisma.agentRun.findUnique).mockResolvedValue(null);

      const result = await verifyAgentRunOwnership(userId, "run-nonexistent");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(404);
        const body = await result.error.json();
        expect(body.error).toContain("Agent run not found");
      }
    });

    it("should return valid=false when run belongs to another user", async () => {
      const mockRun = {
        id: "run-2",
        agent: {
          profile: { userId: "user-other", id: "profile-other" },
        },
      };
      vi.mocked(prisma.agentRun.findUnique).mockResolvedValue(mockRun as any);

      const result = await verifyAgentRunOwnership(userId, "run-2");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(404);
        const body = await result.error.json();
        expect(body.error).toContain("access denied");
      }
    });
  });
});
