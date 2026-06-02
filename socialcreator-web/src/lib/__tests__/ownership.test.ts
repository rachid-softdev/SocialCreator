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
  verifyConnectedAccountOwnership,
  verifyContentOwnership,
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
      const mockProfile = { id: "profile-1", userId, name: "Test" };

      vi.mocked(prisma.videoAsset.findUnique).mockResolvedValue(mockVideoAsset as any);
      vi.mocked(prisma.profile.findUnique).mockResolvedValue(mockProfile as any);

      const result = await verifyVideoAssetOwnership(userId, "video-1");

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toEqual(mockVideoAsset);
      }
    });

    it("should return valid=false when video asset not found", async () => {
      vi.mocked(prisma.videoAsset.findUnique).mockResolvedValue(null);

      const result = await verifyVideoAssetOwnership(userId, "video-nonexistent");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(404);
        const body = await result.error.json();
        expect(body.error).toContain("Video asset not found");
      }
    });

    it("should return valid=false when profile not found for video asset", async () => {
      vi.mocked(prisma.videoAsset.findUnique).mockResolvedValue({
        id: "video-2",
        profileId: "profile-nonexistent",
      } as any);
      vi.mocked(prisma.profile.findUnique).mockResolvedValue(null);

      const result = await verifyVideoAssetOwnership(userId, "video-2");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(404);
      }
    });

    it("should return valid=false when profile belongs to another user", async () => {
      vi.mocked(prisma.videoAsset.findUnique).mockResolvedValue({
        id: "video-3",
        profileId: "profile-other",
      } as any);
      vi.mocked(prisma.profile.findUnique).mockResolvedValue({
        id: "profile-other",
        userId: "user-other",
      } as any);

      const result = await verifyVideoAssetOwnership(userId, "video-3");

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
