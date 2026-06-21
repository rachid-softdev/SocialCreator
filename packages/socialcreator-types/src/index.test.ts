import { describe, expect, expectTypeOf, it } from "vitest";
import type { AgentType, ContentStatus, Platform } from "./index";
import {
  AGENT_TYPES,
  agentIdSchema,
  analyticsFilterSchema,
  analyticsIngestSchema,
  apiKeyIdSchema,
  approveContentSchema,
  CONTENT_STATUS,
  connectAccountSchema,
  contentFilterSchema,
  contentIdSchema,
  createAgentSchema,
  createApiKeySchema,
  createProfileSchema,
  generateClipsSchema,
  mcpCreateAgentSchema,
  mcpGetAgentSchema,
  mcpGetRunStatusSchema,
  mcpListAgentsSchema,
  mcpRunAgentSchema,
  PLATFORMS,
  platformSchema,
  platformsArraySchema,
  profileIdSchema,
  publishContentSchema,
  refreshAccountSchema,
  rejectContentSchema,
  runAgentSchema,
  transcribeVideoSchema,
  updateAgentSchema,
  updateProfileSchema,
  videoIdSchema,
  videoUploadSchema,
} from "./index";

describe("@socialcreator/types - constants", () => {
  it("PLATFORMS should contain 8 platforms", () => {
    expect(PLATFORMS).toHaveLength(8);
    expect(PLATFORMS).toContain("TIKTOK");
    expect(PLATFORMS).toContain("INSTAGRAM");
    expect(PLATFORMS).toContain("YOUTUBE");
    expect(PLATFORMS).toContain("FACEBOOK");
    expect(PLATFORMS).toContain("X");
    expect(PLATFORMS).toContain("LINKEDIN");
    expect(PLATFORMS).toContain("THREADS");
    expect(PLATFORMS).toContain("PINTEREST");
  });

  it("CONTENT_STATUS should contain 6 statuses", () => {
    expect(CONTENT_STATUS).toHaveLength(6);
    expect(CONTENT_STATUS).toContain("DRAFT");
    expect(CONTENT_STATUS).toContain("APPROVED");
    expect(CONTENT_STATUS).toContain("PUBLISHED");
    expect(CONTENT_STATUS).toContain("REJECTED");
    expect(CONTENT_STATUS).toContain("FAILED");
    expect(CONTENT_STATUS).toContain("SCHEDULED");
  });

  it("AGENT_TYPES should contain 3 types", () => {
    expect(AGENT_TYPES).toHaveLength(3);
    expect(AGENT_TYPES).toContain("TEXT_POST");
    expect(AGENT_TYPES).toContain("VIDEO_CLIP");
    expect(AGENT_TYPES).toContain("CROSS_POST");
  });
});

describe("@socialcreator/types - type exports", () => {
  it("should export Platform as a union of platform strings", () => {
    expectTypeOf<Platform>().toEqualTypeOf<
      "TIKTOK" | "INSTAGRAM" | "YOUTUBE" | "FACEBOOK" | "X" | "LINKEDIN" | "THREADS" | "PINTEREST"
    >();
  });

  it("should export ContentStatus as a union of status strings", () => {
    expectTypeOf<ContentStatus>().toEqualTypeOf<
      "DRAFT" | "APPROVED" | "PUBLISHED" | "REJECTED" | "FAILED" | "SCHEDULED"
    >();
  });

  it("should export AgentType as a union of agent type strings", () => {
    expectTypeOf<AgentType>().toEqualTypeOf<"TEXT_POST" | "VIDEO_CLIP" | "CROSS_POST">();
  });
});

describe("@socialcreator/types - zod schemas", () => {
  describe("createProfileSchema", () => {
    it("should accept valid profile data", () => {
      const result = createProfileSchema.safeParse({
        name: "My Brand",
        brandVoice: "Professional",
        contentBank: "Topics about tech",
        platforms: ["X", "LINKEDIN"],
      });
      expect(result.success).toBe(true);
    });

    it("should reject name shorter than 2 characters", () => {
      const result = createProfileSchema.safeParse({ name: "A" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("name");
      }
    });

    it("should reject name longer than 100 characters", () => {
      const result = createProfileSchema.safeParse({ name: "x".repeat(101) });
      expect(result.success).toBe(false);
    });

    it("should trim the name", () => {
      const result = createProfileSchema.safeParse({ name: "  My Brand  " });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("My Brand");
      }
    });

    it("should accept minimal profile with just a name", () => {
      const result = createProfileSchema.safeParse({ name: "Test" });
      expect(result.success).toBe(true);
    });

    it("should set default platforms to empty array", () => {
      const result = createProfileSchema.safeParse({ name: "Test" });
      if (result.success) {
        expect(result.data.platforms).toEqual([]);
      }
    });

    it("should reject invalid platform", () => {
      const result = createProfileSchema.safeParse({
        name: "Test",
        platforms: ["INVALID_PLATFORM"],
      });
      expect(result.success).toBe(false);
    });

    it("should accept empty avatar URL", () => {
      const result = createProfileSchema.safeParse({
        name: "Test",
        avatarUrl: "",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid avatar URL", () => {
      const result = createProfileSchema.safeParse({
        name: "Test",
        avatarUrl: "not-a-url",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateProfileSchema", () => {
    it("should accept partial profile updates", () => {
      expect(updateProfileSchema.safeParse({ name: "New Name" }).success).toBe(true);
      expect(updateProfileSchema.safeParse({ brandVoice: "New voice" }).success).toBe(true);
      expect(updateProfileSchema.safeParse({}).success).toBe(true);
    });

    it("should inherit validation from createProfileSchema", () => {
      const result = updateProfileSchema.safeParse({ name: "A" });
      expect(result.success).toBe(false);
    });
  });

  describe("profileIdSchema", () => {
    it("should accept valid profile ID", () => {
      expect(profileIdSchema.safeParse({ profileId: "abc123" }).success).toBe(true);
    });

    it("should reject empty profile ID", () => {
      expect(profileIdSchema.safeParse({ profileId: "" }).success).toBe(false);
    });
  });

  describe("createAgentSchema", () => {
    it("should accept valid agent data", () => {
      const result = createAgentSchema.safeParse({
        profileId: "profile-1",
        name: "My Agent",
        type: "TEXT_POST",
        platforms: ["X"],
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid agent type", () => {
      const result = createAgentSchema.safeParse({
        profileId: "profile-1",
        name: "My Agent",
        type: "INVALID_TYPE",
        platforms: ["X"],
      });
      expect(result.success).toBe(false);
    });

    it("should require at least one platform", () => {
      const result = createAgentSchema.safeParse({
        profileId: "profile-1",
        name: "My Agent",
        type: "TEXT_POST",
        platforms: [],
      });
      expect(result.success).toBe(false);
    });

    it("should accept optional scheduleCron", () => {
      const result = createAgentSchema.safeParse({
        profileId: "profile-1",
        name: "My Agent",
        type: "TEXT_POST",
        platforms: ["X"],
        scheduleCron: "0 9 * * 1", // Every Monday at 9:00
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid cron expression", () => {
      const result = createAgentSchema.safeParse({
        profileId: "profile-1",
        name: "My Agent",
        type: "TEXT_POST",
        platforms: ["X"],
        scheduleCron: "invalid-cron",
      });
      expect(result.success).toBe(false);
    });

    it("should accept empty string scheduleCron", () => {
      const result = createAgentSchema.safeParse({
        profileId: "profile-1",
        name: "My Agent",
        type: "TEXT_POST",
        platforms: ["X"],
        scheduleCron: "",
      });
      expect(result.success).toBe(true);
    });

    it("should validate maxPerDay range", () => {
      expect(
        createAgentSchema.safeParse({
          profileId: "p1",
          name: "Agent",
          type: "TEXT_POST",
          platforms: ["X"],
          maxPerDay: 0,
        }).success,
      ).toBe(false);
      expect(
        createAgentSchema.safeParse({
          profileId: "p1",
          name: "Agent",
          type: "TEXT_POST",
          platforms: ["X"],
          maxPerDay: 9,
        }).success,
      ).toBe(false);
    });
  });

  describe("contentFilterSchema", () => {
    it("should apply default pagination", () => {
      const result = contentFilterSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(20);
      }
    });

    it("should accept valid status filter", () => {
      expect(contentFilterSchema.safeParse({ status: "DRAFT" }).success).toBe(true);
      expect(contentFilterSchema.safeParse({ status: "PUBLISHED" }).success).toBe(true);
    });

    it("should reject invalid status", () => {
      expect(contentFilterSchema.safeParse({ status: "INVALID" }).success).toBe(false);
    });

    it("should coerce page from string", () => {
      const result = contentFilterSchema.safeParse({ page: "3" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(3);
      }
    });
  });

  describe("videoUploadSchema", () => {
    it("should accept valid video upload data", () => {
      const result = videoUploadSchema.safeParse({
        profileId: "p1",
        fileName: "video.mp4",
        fileSize: 1024,
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid file extension", () => {
      expect(
        videoUploadSchema.safeParse({
          profileId: "p1",
          fileName: "doc.pdf",
          fileSize: 1024,
        }).success,
      ).toBe(false);
    });

    it("should reject file size over 500MB", () => {
      expect(
        videoUploadSchema.safeParse({
          profileId: "p1",
          fileName: "video.mp4",
          fileSize: 524288001,
        }).success,
      ).toBe(false);
    });
  });

  describe("analyticsIngestSchema", () => {
    it("should accept valid analytics data", () => {
      const result = analyticsIngestSchema.safeParse({
        platform: "X",
        profileId: "p1",
        date: "2025-06-01",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date).toBeInstanceOf(Date);
        expect(result.data.impressions).toBe(0);
        expect(result.data.engagements).toBe(0);
      }
    });
  });

  describe("mcp schemas", () => {
    it("mcpListAgentsSchema should accept optional profile_id", () => {
      expect(mcpListAgentsSchema.safeParse({}).success).toBe(true);
      expect(mcpListAgentsSchema.safeParse({ profile_id: "p1" }).success).toBe(true);
    });

    it("mcpCreateAgentSchema should accept valid data", () => {
      const result = mcpCreateAgentSchema.safeParse({
        profile_id: "p1",
        name: "Agent",
        type: "TEXT_POST",
        platforms: ["X"],
      });
      expect(result.success).toBe(true);
    });
  });
});
