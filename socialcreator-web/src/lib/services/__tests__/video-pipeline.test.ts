/**
 * Tests for Video Pipeline service
 *
 * Covers:
 * - identifySegments() — LLM segment identification with valid/invalid responses
 * - runVideoPipeline() — full pipeline orchestration: transcribe, segment,
 *   clip, generate content; error handling at every stage
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────

const mockTranscribeVideo = vi.hoisted(() => vi.fn());
vi.mock("@/lib/deepgram", () => ({
  transcribeVideo: mockTranscribeVideo,
}));

const mockGenerateContent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/llm", () => ({
  generateContent: mockGenerateContent,
}));

const mockCreateMuxClip = vi.hoisted(() => vi.fn());
const mockGetMuxStreamUrl = vi.hoisted(() => vi.fn());
const mockGetMuxThumbnailUrl = vi.hoisted(() => vi.fn());
vi.mock("@/lib/mux", () => ({
  createMuxClip: mockCreateMuxClip,
  getMuxStreamUrl: mockGetMuxStreamUrl,
  getMuxThumbnailUrl: mockGetMuxThumbnailUrl,
}));

const mockVideoAssetFindUnique = vi.hoisted(() => vi.fn());
const mockVideoAssetUpdate = vi.hoisted(() => vi.fn());
const mockProfileFindUnique = vi.hoisted(() => vi.fn());
const mockGeneratedContentCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    videoAsset: {
      findUnique: mockVideoAssetFindUnique,
      update: mockVideoAssetUpdate,
    },
    profile: {
      findUnique: mockProfileFindUnique,
    },
    generatedContent: {
      create: mockGeneratedContentCreate,
    },
  },
}));

vi.mock("@/lib/prompts", () => ({
  buildSystemPrompt: vi.fn((profile: { name: string }) => `System prompt for ${profile.name}`),
  buildGenerationPrompt: vi.fn(
    (data: { brief: string; platform: string }) =>
      `User prompt for ${data.platform}: ${data.brief}`,
  ),
}));

// ── Imports (after mocks) ──────────────────────────────────────

import { identifySegments, runVideoPipeline } from "../video-pipeline";

// ── Helpers ──────────────────────────────────────────────────────

function makeValidSegment(overrides: Record<string, unknown> = {}) {
  return {
    start: 0,
    end: 30,
    reason: "Strong opening hook",
    hook: "Did you know this?",
    ...overrides,
  };
}

function makeMockVideoAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: "video-1",
    uploadUrl: "https://example.com/video.mp4",
    transcript: null,
    status: "UPLOADED",
    segments: null,
    ...overrides,
  };
}

function makeMockProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "profile-1",
    name: "Test Profile",
    brandVoice: "Professional yet approachable",
    contentBank: null,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────

describe("Video Pipeline service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMuxStreamUrl.mockImplementation((pb: string) => `https://stream.mux.com/${pb}.m3u8`);
    mockGetMuxThumbnailUrl.mockImplementation(
      (pb: string, _start: number) => `https://image.mux.com/${pb}/thumbnail.jpg`,
    );
  });

  // ================================================================
  // identifySegments
  // ================================================================

  describe("identifySegments", () => {
    it("should return parsed segments when LLM returns valid response", async () => {
      const segments = [makeValidSegment()];
      mockGenerateContent.mockResolvedValue({ segments });

      const result = await identifySegments("Sample transcript");

      expect(result).toEqual(segments);
      expect(mockGenerateContent).toHaveBeenCalledWith(
        "Tu es un expert en création de contenu viral pour les réseaux sociaux.",
        expect.stringContaining("Sample transcript"),
      );
    });

    it("should return multiple segments when LLM returns array", async () => {
      const segments = [
        makeValidSegment({ start: 0, end: 30, reason: "Intro", hook: "Opening" }),
        makeValidSegment({ start: 30, end: 60, reason: "Key point", hook: "Main insight" }),
        makeValidSegment({ start: 60, end: 90, reason: "Conclusion", hook: "Final take" }),
      ];
      mockGenerateContent.mockResolvedValue({ segments });

      const result = await identifySegments("Long transcript with multiple highlights");

      expect(result).toHaveLength(3);
      expect(result[0]!.start).toBe(0);
      expect(result[1]!.start).toBe(30);
      expect(result[2]!.start).toBe(60);
    });

    it("should throw when LLM returns invalid segment (empty reason)", async () => {
      mockGenerateContent.mockResolvedValue({
        segments: [{ start: 0, end: 30, reason: "", hook: "Test" }],
      });

      await expect(identifySegments("Transcript")).rejects.toThrow(
        "Failed to parse LLM segment response",
      );
    });

    it("should throw when LLM returns non-array segments", async () => {
      mockGenerateContent.mockResolvedValue({ segments: { start: 0, end: 30 } });

      await expect(identifySegments("Transcript")).rejects.toThrow(
        "Failed to parse LLM segment response",
      );
    });

    it("should throw when LLM returns empty segments array", async () => {
      mockGenerateContent.mockResolvedValue({ segments: [] });

      await expect(identifySegments("Transcript")).rejects.toThrow(
        "Failed to parse LLM segment response",
      );
    });

    it("should throw when LLM returns segments with negative start", async () => {
      mockGenerateContent.mockResolvedValue({
        segments: [{ start: -1, end: 30, reason: "Reason", hook: "Hook" }],
      });

      await expect(identifySegments("Transcript")).rejects.toThrow(
        "Failed to parse LLM segment response",
      );
    });
  });

  // ================================================================
  // runVideoPipeline
  // ================================================================

  describe("runVideoPipeline", () => {
    const defaultProfileId = "profile-1";
    const defaultPlatforms = ["INSTAGRAM", "TIKTOK"] as const;

    const validPayload = {
      videoAssetId: "video-1",
      profileId: defaultProfileId,
      targetPlatforms: defaultPlatforms,
    };

    it("should complete the full pipeline successfully", async () => {
      const videoAsset = makeMockVideoAsset();
      const profile = makeMockProfile();
      const segments = [makeValidSegment()];

      mockVideoAssetFindUnique.mockResolvedValue(videoAsset);
      mockTranscribeVideo.mockResolvedValue({
        transcript: "Hello world transcript",
        paragraphs: [],
      });
      mockVideoAssetUpdate.mockResolvedValue({});
      mockGenerateContent.mockResolvedValueOnce({ segments }).mockResolvedValue({
        textContent: "Generated post",
        hashtags: ["#test"],
      });
      mockCreateMuxClip.mockResolvedValue({ assetId: "clip-1", playbackId: "pb-1" });
      mockProfileFindUnique.mockResolvedValue(profile);
      mockGeneratedContentCreate.mockResolvedValue({ id: "gc-1" });

      const result = await runVideoPipeline(
        validPayload.videoAssetId,
        validPayload.profileId,
        validPayload.targetPlatforms as any,
      );

      // Check result structure
      expect(result.transcript).toBe("Hello world transcript");
      expect(result.segments).toEqual(segments);
      expect(result.clips).toHaveLength(1);
      expect(result.contents).toHaveLength(2); // 1 segment × 2 platforms

      // Verify clip result
      expect(result.clips[0]!.segment).toEqual(segments[0]);
      expect(result.clips[0]!.assetId).toBe("clip-1");
      expect(result.clips[0]!.playbackId).toBe("pb-1");
      expect(result.clips[0]!.streamUrl).toContain("stream.mux.com");
      expect(result.clips[0]!.thumbnailUrl).toContain("image.mux.com");

      // Verify content results
      expect(result.contents[0]!.platform).toBe("INSTAGRAM");
      expect(result.contents[0]!.textContent).toBe("Generated post");

      // Verify pipeline steps
      expect(mockVideoAssetUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "video-1" },
          data: expect.objectContaining({ status: "TRANSCRIBED" }),
        }),
      );
      expect(mockVideoAssetUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "video-1" },
          data: expect.objectContaining({ status: "SEGMENTS_IDENTIFIED" }),
        }),
      );
      expect(mockVideoAssetUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "video-1" },
          data: expect.objectContaining({ status: "CLIPS_CREATED" }),
        }),
      );
    });

    it("should throw when video asset is not found", async () => {
      mockVideoAssetFindUnique.mockResolvedValue(null);

      await expect(
        runVideoPipeline("nonexistent", defaultProfileId, ["INSTAGRAM"] as any),
      ).rejects.toThrow("Video asset not found");

      expect(mockTranscribeVideo).not.toHaveBeenCalled();
    });

    it("should throw when transcription fails", async () => {
      mockVideoAssetFindUnique.mockResolvedValue(makeMockVideoAsset());
      mockTranscribeVideo.mockRejectedValue(new Error("Deepgram API error"));

      await expect(
        runVideoPipeline("video-1", defaultProfileId, ["INSTAGRAM"] as any),
      ).rejects.toThrow("Deepgram API error");
    });

    it("should create Mux clips and generate content for multiple segments", async () => {
      const videoAsset = makeMockVideoAsset();
      const profile = makeMockProfile();
      const segments = [
        makeValidSegment({ start: 0, end: 30, reason: "Intro", hook: "Opening" }),
        makeValidSegment({ start: 30, end: 60, reason: "Body", hook: "Mid point" }),
      ];

      mockVideoAssetFindUnique.mockResolvedValue(videoAsset);
      mockTranscribeVideo.mockResolvedValue({
        transcript: "Full transcript with multiple segments",
        paragraphs: [],
      });
      mockVideoAssetUpdate.mockResolvedValue({});
      mockGenerateContent
        .mockResolvedValueOnce({ segments })
        .mockResolvedValue({ textContent: "Post", hashtags: ["#tag"] });
      mockCreateMuxClip
        .mockResolvedValueOnce({ assetId: "clip-1", playbackId: "pb-1" })
        .mockResolvedValueOnce({ assetId: "clip-2", playbackId: "pb-2" });
      mockProfileFindUnique.mockResolvedValue(profile);
      mockGeneratedContentCreate.mockResolvedValue({ id: "gc" });

      const result = await runVideoPipeline("video-1", defaultProfileId, [
        "INSTAGRAM",
        "LINKEDIN",
      ] as any);

      expect(result.clips).toHaveLength(2);
      expect(result.contents).toHaveLength(4); // 2 segments × 2 platforms
      expect(mockCreateMuxClip).toHaveBeenCalledTimes(2);
    });

    it("should generate content for each clip × platform combination", async () => {
      const videoAsset = makeMockVideoAsset();
      const profile = makeMockProfile();
      const segment = makeValidSegment();

      mockVideoAssetFindUnique.mockResolvedValue(videoAsset);
      mockTranscribeVideo.mockResolvedValue({
        transcript: "Transcript",
        paragraphs: [],
      });
      mockVideoAssetUpdate.mockResolvedValue({});
      mockGenerateContent
        .mockResolvedValueOnce({ segments: [segment] })
        .mockResolvedValueOnce({ textContent: "IG post", hashtags: ["#ig"] })
        .mockResolvedValueOnce({ textContent: "TT post", hashtags: ["#tt"] });
      mockCreateMuxClip.mockResolvedValue({ assetId: "clip-1", playbackId: "pb-1" });
      mockProfileFindUnique.mockResolvedValue(profile);
      mockGeneratedContentCreate.mockResolvedValue({ id: "gc" });

      const result = await runVideoPipeline("video-1", defaultProfileId, [
        "INSTAGRAM",
        "TIKTOK",
      ] as any);

      expect(result.contents).toHaveLength(2);
      expect(result.contents[0]!.platform).toBe("INSTAGRAM");
      expect(result.contents[1]!.platform).toBe("TIKTOK");
    });

    it("should persist generated content to the database", async () => {
      const videoAsset = makeMockVideoAsset();
      const profile = makeMockProfile();
      const segment = makeValidSegment();

      mockVideoAssetFindUnique.mockResolvedValue(videoAsset);
      mockTranscribeVideo.mockResolvedValue({ transcript: "Transcript", paragraphs: [] });
      mockVideoAssetUpdate.mockResolvedValue({});
      mockGenerateContent
        .mockResolvedValueOnce({ segments: [segment] })
        .mockResolvedValue({ textContent: "Post content", hashtags: ["#test"] });
      mockCreateMuxClip.mockResolvedValue({ assetId: "clip-1", playbackId: "pb-1" });
      mockProfileFindUnique.mockResolvedValue(profile);
      mockGeneratedContentCreate.mockResolvedValue({ id: "gc-id" });

      await runVideoPipeline("video-1", defaultProfileId, ["INSTAGRAM"] as any);

      expect(mockGeneratedContentCreate).toHaveBeenCalledTimes(1);
      expect(mockGeneratedContentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            profileId: "profile-1",
            platform: "INSTAGRAM",
            status: "DRAFT",
            mediaUrls: [],
          }),
        }),
      );
    });

    it("should throw when profile is not found", async () => {
      const videoAsset = makeMockVideoAsset();
      const segments = [makeValidSegment()];

      mockVideoAssetFindUnique.mockResolvedValue(videoAsset);
      mockTranscribeVideo.mockResolvedValue({ transcript: "Transcript", paragraphs: [] });
      mockVideoAssetUpdate.mockResolvedValue({});
      mockGenerateContent.mockResolvedValueOnce({ segments });
      mockCreateMuxClip.mockResolvedValue({ assetId: "clip-1", playbackId: "pb-1" });
      mockProfileFindUnique.mockResolvedValue(null);

      await expect(
        runVideoPipeline("video-1", "nonexistent-profile", ["INSTAGRAM"] as any),
      ).rejects.toThrow("Profile not found");

      expect(mockGeneratedContentCreate).not.toHaveBeenCalled();
    });

    it("should set stream URL and thumbnail URL on each clip", async () => {
      const videoAsset = makeMockVideoAsset();
      const profile = makeMockProfile();
      const segments = [makeValidSegment()];

      mockVideoAssetFindUnique.mockResolvedValue(videoAsset);
      mockTranscribeVideo.mockResolvedValue({ transcript: "X", paragraphs: [] });
      mockVideoAssetUpdate.mockResolvedValue({});
      mockGenerateContent.mockResolvedValueOnce({ segments }).mockResolvedValue({
        textContent: "Post",
        hashtags: [],
      });
      mockCreateMuxClip.mockResolvedValue({ assetId: "clip-a", playbackId: "pb-a" });
      mockProfileFindUnique.mockResolvedValue(profile);
      mockGeneratedContentCreate.mockResolvedValue({ id: "gc" });

      const result = await runVideoPipeline("video-1", defaultProfileId, ["X"] as any);

      expect(result.clips[0]!.streamUrl).toBe("https://stream.mux.com/pb-a.m3u8");
      expect(result.clips[0]!.thumbnailUrl).toBe("https://image.mux.com/pb-a/thumbnail.jpg");
    });

    it("should handle empty target platforms array", async () => {
      const videoAsset = makeMockVideoAsset();
      const profile = makeMockProfile();
      const segments = [makeValidSegment()];

      mockVideoAssetFindUnique.mockResolvedValue(videoAsset);
      mockTranscribeVideo.mockResolvedValue({ transcript: "X", paragraphs: [] });
      mockVideoAssetUpdate.mockResolvedValue({});
      mockGenerateContent.mockResolvedValueOnce({ segments });
      mockCreateMuxClip.mockResolvedValue({ assetId: "clip-1", playbackId: "pb-1" });
      mockProfileFindUnique.mockResolvedValue(profile);

      const result = await runVideoPipeline("video-1", defaultProfileId, [] as any);

      expect(result.clips).toHaveLength(1);
      expect(result.contents).toHaveLength(0); // No platforms = no content
      expect(mockGeneratedContentCreate).not.toHaveBeenCalled();
    });
  });
});
