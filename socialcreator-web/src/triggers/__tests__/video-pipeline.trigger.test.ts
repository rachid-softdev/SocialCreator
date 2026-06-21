/**
 * Comprehensive tests for Video Pipeline Trigger
 *
 * Covers:
 * - runVideoPipelineJob() — full pipeline orchestration: transcribe, segment,
 *   clip, generate content; error handling at every stage; partial success;
 *   status updates on error
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (vi.hoisted ensures vars exist before vi.mock factory runs) ──────

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockTranscribeVideo = vi.hoisted(() => vi.fn());
vi.mock("@/lib/deepgram", () => ({
  transcribeVideo: mockTranscribeVideo,
}));

const mockGenerateContent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/llm", () => ({
  generateContent: mockGenerateContent,
}));

const mockCreateMuxClip = vi.hoisted(() => vi.fn());
vi.mock("@/lib/mux", () => ({
  createMuxClip: mockCreateMuxClip,
}));

vi.mock("@/lib/prompts", () => ({
  buildSystemPrompt: vi.fn((profile: { name: string }) => `System prompt for ${profile.name}`),
  buildGenerationPrompt: vi.fn(
    (data: { brief: string; platform: string }) =>
      `User prompt for ${data.platform}: ${data.brief}`,
  ),
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

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { runVideoPipelineJob } from "@/triggers/video-pipeline.trigger";

// ── Helpers ────────────────────────────────────────────────────────────────

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

function makeValidSegment(overrides: Record<string, unknown> = {}) {
  return {
    start: 0,
    end: 30,
    reason: "Strong opening hook",
    hook: "Did you know this?",
    ...overrides,
  };
}

const validPayload = {
  videoAssetId: "video-1",
  profileId: "profile-1",
  platforms: ["INSTAGRAM", "TIKTOK"],
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("runVideoPipelineJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Scenario: SUCCESS - full pipeline success
  it("should complete the full pipeline and return SUCCESS status", async () => {
    const videoAsset = makeMockVideoAsset();
    const profile = makeMockProfile();
    const segments = [makeValidSegment()];

    mockVideoAssetFindUnique.mockResolvedValue(videoAsset);
    mockTranscribeVideo.mockResolvedValue({
      transcript: "Hello world transcript",
      paragraphs: [],
    });
    mockVideoAssetUpdate.mockResolvedValue({});
    mockGenerateContent
      // First call: segment identification (returns result.segments)
      .mockResolvedValueOnce({ segments })
      // Subsequent calls: content generation for each segment × platform
      .mockResolvedValue({ textContent: "Generated post", hashtags: ["#test"] });
    mockCreateMuxClip.mockResolvedValue({ assetId: "clip-1", playbackId: "pb-1" });
    mockProfileFindUnique.mockResolvedValue(profile);
    mockGeneratedContentCreate.mockResolvedValue({});

    const result = await runVideoPipelineJob(validPayload);

    expect(result.status).toBe("SUCCESS");
    expect(result.transcript).toBe("Hello world transcript");
    expect(result.segments).toEqual(segments);
    expect(result.clipsCreated).toBe(1);
    expect(result.contentsGenerated).toBe(2);

    // Verify video asset was updated through all stages
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

  // Scenario: ERROR - video asset not found → throw
  it("should throw when video asset is not found", async () => {
    mockVideoAssetFindUnique.mockResolvedValue(null);

    await expect(runVideoPipelineJob(validPayload)).rejects.toThrow("Video asset not found");

    expect(mockTranscribeVideo).not.toHaveBeenCalled();
  });

  // Scenario: ERROR - transcription fails → throw
  it("should throw when transcription fails", async () => {
    mockVideoAssetFindUnique.mockResolvedValue(makeMockVideoAsset());
    mockTranscribeVideo.mockRejectedValue(new Error("Deepgram API error"));

    const logger = (await import("@/lib/logger")).default;

    await expect(runVideoPipelineJob(validPayload)).rejects.toThrow("Deepgram API error");

    // Verify status is updated to ERROR in global catch
    expect(mockVideoAssetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "video-1" },
        data: { status: "ERROR" },
      }),
    );
    expect(logger.error).toHaveBeenCalledWith({ err: expect.any(Error) }, "Video pipeline failed");
  });

  // Scenario: ERROR - invalid segment format from LLM (safeParse fails)
  it("should throw when LLM returns invalid segment format", async () => {
    const videoAsset = makeMockVideoAsset();
    const transcript = "Some transcript";

    mockVideoAssetFindUnique.mockResolvedValue(videoAsset);
    mockTranscribeVideo.mockResolvedValue({
      transcript,
      paragraphs: [],
    });
    mockVideoAssetUpdate.mockResolvedValue({});

    // Return segments with empty reason string (fails z.string().min(1))
    mockGenerateContent.mockResolvedValueOnce({
      segments: [{ start: 0, end: 30, reason: "", hook: "" }],
    });

    await expect(runVideoPipelineJob(validPayload)).rejects.toThrow(
      "Invalid segment format from LLM",
    );

    // Verify status is updated to ERROR
    expect(mockVideoAssetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "video-1" },
        data: { status: "ERROR" },
      }),
    );
  });

  // Scenario: SUCCESS - partial clip success (some clips fail)
  it("should continue when some clips fail and report partial count", async () => {
    const videoAsset = makeMockVideoAsset();
    const profile = makeMockProfile();
    const segments = [
      makeValidSegment({ start: 0, end: 30, reason: "Hook", hook: "Opening" }),
      makeValidSegment({ start: 30, end: 60, reason: "Middle", hook: "Mid point" }),
    ];

    mockVideoAssetFindUnique.mockResolvedValue(videoAsset);
    mockTranscribeVideo.mockResolvedValue({
      transcript: "Full transcript",
      paragraphs: [],
    });
    mockVideoAssetUpdate.mockResolvedValue({});
    mockGenerateContent
      .mockResolvedValueOnce({ segments })
      // Content generation for 2 segments × 2 platforms = 4 calls
      .mockResolvedValue({ textContent: "Post", hashtags: ["#tag"] });
    // First clip succeeds, second fails
    mockCreateMuxClip
      .mockResolvedValueOnce({ assetId: "clip-1", playbackId: "pb-1" })
      .mockRejectedValueOnce(new Error("Mux clip error"));
    mockProfileFindUnique.mockResolvedValue(profile);
    mockGeneratedContentCreate.mockResolvedValue({});

    const logger = (await import("@/lib/logger")).default;

    const result = await runVideoPipelineJob(validPayload);

    expect(result.clipsCreated).toBe(1);
    expect(result.status).toBe("SUCCESS");
    expect(logger.error).toHaveBeenCalledWith(
      { segment: segments[1], err: expect.any(Error) },
      "Failed to create clip",
    );
  });

  // Scenario: ERROR - profile not found → throw
  it("should throw when profile is not found", async () => {
    const videoAsset = makeMockVideoAsset();
    const segments = [makeValidSegment()];

    mockVideoAssetFindUnique.mockResolvedValue(videoAsset);
    mockTranscribeVideo.mockResolvedValue({
      transcript: "Transcript",
      paragraphs: [],
    });
    mockVideoAssetUpdate.mockResolvedValue({});
    mockGenerateContent.mockResolvedValueOnce({ segments });
    mockCreateMuxClip.mockResolvedValue({ assetId: "clip-1", playbackId: "pb-1" });
    mockProfileFindUnique.mockResolvedValue(null);

    await expect(runVideoPipelineJob(validPayload)).rejects.toThrow("Profile not found");

    expect(mockVideoAssetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "video-1" },
        data: { status: "ERROR" },
      }),
    );
  });

  // Scenario: SUCCESS - partial content generation (some platforms fail)
  it("should continue when some content generations fail and report partial count", async () => {
    const videoAsset = makeMockVideoAsset();
    const profile = makeMockProfile();
    const segments = [makeValidSegment()];

    mockVideoAssetFindUnique.mockResolvedValue(videoAsset);
    mockTranscribeVideo.mockResolvedValue({
      transcript: "Transcript",
      paragraphs: [],
    });
    mockVideoAssetUpdate.mockResolvedValue({});
    mockGenerateContent
      .mockResolvedValueOnce({ segments })
      // Content: 1 segment × 2 platforms
      .mockResolvedValueOnce({ textContent: "IG post", hashtags: ["#ig"] })
      .mockRejectedValueOnce(new Error("LLM rate limit"));
    mockCreateMuxClip.mockResolvedValue({ assetId: "clip-1", playbackId: "pb-1" });
    mockProfileFindUnique.mockResolvedValue(profile);
    // Only the first content generation succeeds → only one create
    mockGeneratedContentCreate.mockResolvedValue({ id: "gc-1" });

    const logger = (await import("@/lib/logger")).default;

    const result = await runVideoPipelineJob(validPayload);

    expect(result.contentsGenerated).toBe(1);
    expect(result.status).toBe("SUCCESS");
    expect(logger.error).toHaveBeenCalledWith(
      { segment: segments[0], platform: "TIKTOK", err: expect.any(Error) },
      "Failed to generate content",
    );
  });

  // Scenario: SUCCESS - multiple segments + platforms → correct count
  it("should correctly count all generated contents for multiple segments and platforms", async () => {
    const videoAsset = makeMockVideoAsset();
    const profile = makeMockProfile();
    const segments = [
      makeValidSegment({ start: 0, end: 30, reason: "Hook", hook: "Opening" }),
      makeValidSegment({ start: 30, end: 60, reason: "Insight", hook: "Key insight" }),
    ];
    const platforms = ["INSTAGRAM", "TIKTOK", "LINKEDIN"];

    mockVideoAssetFindUnique.mockResolvedValue(videoAsset);
    mockTranscribeVideo.mockResolvedValue({
      transcript: "Long transcript with insights",
      paragraphs: [],
    });
    mockVideoAssetUpdate.mockResolvedValue({});
    mockGenerateContent
      .mockResolvedValueOnce({ segments })
      // 2 segments × 3 platforms = 6 content generations
      .mockResolvedValue({ textContent: "Post", hashtags: ["#tag"] });
    mockCreateMuxClip.mockResolvedValue({ assetId: "clip", playbackId: "pb" });
    mockProfileFindUnique.mockResolvedValue(profile);
    mockGeneratedContentCreate.mockResolvedValue({ id: "gc" });

    const result = await runVideoPipelineJob({
      videoAssetId: "video-1",
      profileId: "profile-1",
      platforms,
    });

    expect(result.clipsCreated).toBe(2);
    expect(result.contentsGenerated).toBe(6); // 2 segments × 3 platforms
    expect(result.status).toBe("SUCCESS");
  });

  // Scenario: ERROR - status updated to ERROR in catch global
  it("should update video asset status to ERROR when pipeline fails globally", async () => {
    mockVideoAssetFindUnique.mockResolvedValue(makeMockVideoAsset());
    mockTranscribeVideo.mockRejectedValue(new Error("Unexpected failure"));

    await expect(runVideoPipelineJob(validPayload)).rejects.toThrow("Unexpected failure");

    expect(mockVideoAssetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "video-1" },
        data: { status: "ERROR" },
      }),
    );
  });

  // Scenario: SUCCESS - status SUCCESS at end of pipeline
  it("should return SUCCESS status when pipeline completes", async () => {
    const videoAsset = makeMockVideoAsset();
    const profile = makeMockProfile();
    const segments = [makeValidSegment()];

    mockVideoAssetFindUnique.mockResolvedValue(videoAsset);
    mockTranscribeVideo.mockResolvedValue({
      transcript: "Final transcript",
      paragraphs: [],
    });
    mockVideoAssetUpdate.mockResolvedValue({});
    mockGenerateContent
      .mockResolvedValueOnce({ segments })
      .mockResolvedValue({ textContent: "Final post", hashtags: ["#done"] });
    mockCreateMuxClip.mockResolvedValue({ assetId: "clip-1", playbackId: "pb-1" });
    mockProfileFindUnique.mockResolvedValue(profile);
    mockGeneratedContentCreate.mockResolvedValue({});

    const result = await runVideoPipelineJob(validPayload);

    expect(result.status).toBe("SUCCESS");
    expect(result.videoAssetId).toBe("video-1");
    expect(typeof result.transcript).toBe("string");
    expect(Array.isArray(result.segments)).toBe(true);
  });
});
