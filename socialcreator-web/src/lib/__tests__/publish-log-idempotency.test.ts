import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    publishLog: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { PrismaPublishLogRepository } from "@/lib/repositories/publish-log.repository";

const repo = new PrismaPublishLogRepository();

function makePublishLog(overrides: Record<string, unknown> = {}) {
  return {
    id: "log-1",
    userId: "user-1",
    profileId: "profile-1",
    platform: "X",
    contentId: "content-1",
    contentHash: "abc123def456",
    success: true,
    error: null,
    publishedAt: new Date("2024-06-15T12:00:00.000Z"),
    createdAt: new Date("2024-06-15T12:00:00.000Z"),
    updatedAt: new Date("2024-06-15T12:00:00.000Z"),
    ...overrides,
  };
}

describe("PrismaPublishLogRepository — idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findSuccessfulByContentHash", () => {
    it("should return the log when a successful match exists", async () => {
      const log = makePublishLog({
        id: "log-match",
        contentHash: "hash-1",
        profileId: "profile-1",
        success: true,
      });

      (prisma.publishLog.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(log);

      const result = await repo.findSuccessfulByContentHash("hash-1", "profile-1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("log-match");
      expect(result?.contentHash).toBe("hash-1");
      expect(result?.success).toBe(true);
    });

    it("should query with contentHash, profileId, and success: true", async () => {
      (prisma.publishLog.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await repo.findSuccessfulByContentHash("hash-abc", "profile-xyz");

      expect(prisma.publishLog.findFirst).toHaveBeenCalledWith({
        where: {
          contentHash: "hash-abc",
          profileId: "profile-xyz",
          success: true,
        },
      });
    });

    it("should return null when no match exists", async () => {
      (prisma.publishLog.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await repo.findSuccessfulByContentHash("nonexistent-hash", "profile-1");

      expect(result).toBeNull();
    });

    it("should return null when a match exists but success is false", async () => {
      const failedLog = makePublishLog({
        id: "log-failed",
        contentHash: "hash-1",
        profileId: "profile-1",
        success: false,
      });

      (prisma.publishLog.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(failedLog);

      const result = await repo.findSuccessfulByContentHash("hash-1", "profile-1");

      expect(result).not.toBeNull();
      expect(result?.success).toBe(false);
    });

    it("should return null when hash matches but profileId differs", async () => {
      const otherProfileLog = makePublishLog({
        id: "log-other",
        contentHash: "shared-hash",
        profileId: "profile-other",
        success: true,
      });

      (prisma.publishLog.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await repo.findSuccessfulByContentHash("shared-hash", "profile-1");

      expect(result).toBeNull();
    });

    it("should handle multiple matching logs and return the first one", async () => {
      const firstLog = makePublishLog({
        id: "log-first",
        contentHash: "hash-dup",
        profileId: "profile-1",
        success: true,
      });

      (prisma.publishLog.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(firstLog);

      const result = await repo.findSuccessfulByContentHash("hash-dup", "profile-1");

      expect(result?.id).toBe("log-first");
    });

    it("should handle empty hash string", async () => {
      (prisma.publishLog.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await repo.findSuccessfulByContentHash("", "profile-1");

      expect(result).toBeNull();
    });
  });
});
