/**
 * Tests for deepgram.ts — Deepgram speech-to-text client (Infrastructure)
 *
 * Focuses on:
 * - Lazy initialization: errors when DEEPGRAM_API_KEY missing
 * - transcribeVideo: calls preRecorded with correct params, parses response
 * - getTranscriptWithTimestamps: calls preRecorded, extracts words
 * - withTimeout helper: rejects when the API call times out
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPreRecorded = vi.hoisted(() => vi.fn());
const mockCreateClient = vi.hoisted(() =>
  vi.fn(() => ({
    transcription: { preRecorded: mockPreRecorded },
  })),
);
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@deepgram/sdk", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/logger", () => ({
  default: mockLogger,
}));

// Mock timeouts so the timeout test can advance fake timers through
// both withTimeout windows + retry delay without waiting 60s
const MOCK_SHORT_TIMEOUT = vi.hoisted(() => 50);
vi.mock("../timeouts", () => ({
  EXTERNAL_TIMEOUTS: {
    DEEPGRAM_TRANSCRIPTION: MOCK_SHORT_TIMEOUT,
  },
}));

import { getTranscriptWithTimestamps, transcribeVideo } from "../deepgram";

describe("Deepgram speech-to-text", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEEPGRAM_API_KEY = "test-dg-key";
  });

  afterEach(() => {
    delete process.env.DEEPGRAM_API_KEY;
  });

  // ============================================
  // Initialization — missing API key
  // ============================================

  describe("initialization", () => {
    it("throws when DEEPGRAM_API_KEY is not configured", async () => {
      delete process.env.DEEPGRAM_API_KEY;
      await expect(transcribeVideo("https://example.com/video.mp4")).rejects.toThrow(
        "DEEPGRAM_API_KEY is not configured",
      );
    });

    it("lazily creates the Deepgram client on first call", async () => {
      mockPreRecorded.mockResolvedValue({
        results: {
          channels: [{ alternatives: [{ transcript: "Hello world", words: [] }] }],
          paragraphs: { paragraphs: [] },
        },
      });

      await transcribeVideo("https://example.com/video.mp4");

      expect(mockCreateClient).toHaveBeenCalledWith("test-dg-key");
    });
  });

  // ============================================
  // transcribeVideo
  // ============================================

  describe("transcribeVideo", () => {
    const sampleResponse = {
      results: {
        channels: [
          {
            alternatives: [
              {
                transcript: "Hello, this is a test transcription.",
                words: [
                  { word: "Hello", start: 0.1, end: 0.3 },
                  { word: "this", start: 0.4, end: 0.5 },
                ],
              },
            ],
          },
        ],
        paragraphs: {
          paragraphs: [
            {
              words: [
                { word: "Hello", start: 0.1, end: 0.3 },
                { word: "this", start: 0.4, end: 0.5 },
              ],
            },
          ],
        },
      },
    };

    it("returns transcript and paragraphs from Deepgram response", async () => {
      mockPreRecorded.mockResolvedValue(sampleResponse);

      const result = await transcribeVideo("https://example.com/video.mp4");

      expect(result.transcript).toBe("Hello, this is a test transcription.");
      expect(result.paragraphs).toHaveLength(1);
      expect(result.paragraphs[0]!.words[0]!.word).toBe("Hello");
    });

    it("calls preRecorded with correct URL and transcription options", async () => {
      mockPreRecorded.mockResolvedValue(sampleResponse);

      await transcribeVideo("https://example.com/video.mp4");

      expect(mockPreRecorded).toHaveBeenCalledWith(
        { url: "https://example.com/video.mp4" },
        expect.objectContaining({
          punctuate: true,
          paragraphs: true,
          timestamps: true,
          model: "nova-2",
          language: "multi",
          "x-idempotency-key": expect.stringMatching(/^dg_/),
        }),
      );
    });

    it("returns empty transcript when response has no channels", async () => {
      mockPreRecorded.mockResolvedValue({ results: { channels: [] } });

      const result = await transcribeVideo("https://example.com/video.mp4");

      expect(result.transcript).toBe("");
      expect(result.paragraphs).toEqual([]);
    });

    it("returns empty transcript and paragraphs when results is null", async () => {
      mockPreRecorded.mockResolvedValue({ results: null });

      const result = await transcribeVideo("https://example.com/video.mp4");

      expect(result.transcript).toBe("");
      expect(result.paragraphs).toEqual([]);
    });

    it("passes a unique idempotency key prefixed with dg_ to Deepgram", async () => {
      mockPreRecorded.mockResolvedValue(sampleResponse);

      await transcribeVideo("https://example.com/video.mp4");

      const options = mockPreRecorded.mock.calls[0][1];
      expect(options).toHaveProperty("x-idempotency-key");
      expect(options["x-idempotency-key"]).toMatch(/^dg_/);
    });
  });

  // ============================================
  // Retry behavior
  // ============================================

  describe("retry behavior", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("throws the last error after all retries are exhausted", async () => {
      vi.useFakeTimers();

      const testError = new Error("Deepgram service unavailable");
      mockPreRecorded.mockRejectedValue(testError);

      const promise = transcribeVideo("https://example.com/video.mp4");

      // Attach rejection handler before advancing timers
      const caught = promise.then(
        () => {
          throw new Error("Expected rejection but got resolution");
        },
        (e: unknown) => e,
      );

      // Advance past the retry delay (1000ms for first attempt → 1 retry)
      await vi.advanceTimersByTimeAsync(1001);

      const error = await caught;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Deepgram service unavailable");
      // Called twice: initial attempt + 1 retry (maxRetries=2)
      expect(mockPreRecorded).toHaveBeenCalledTimes(2);
    });

    it("reuses the same idempotency key across retry attempts", async () => {
      vi.useFakeTimers();

      mockPreRecorded.mockRejectedValue(new Error("temporary failure"));

      const promise = transcribeVideo("https://example.com/video.mp4");

      // Attach rejection handler before advancing timers
      const caught = promise.then(
        () => {
          throw new Error("Expected rejection but got resolution");
        },
        (e: unknown) => e,
      );

      await vi.advanceTimersByTimeAsync(1001);

      const error = await caught;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("temporary failure");

      // The same idempotency key is used across retries (idempotency guarantee)
      const key1 = mockPreRecorded.mock.calls[0][1]["x-idempotency-key"];
      const key2 = mockPreRecorded.mock.calls[1][1]["x-idempotency-key"];
      expect(key1).toMatch(/^dg_/);
      expect(key2).toMatch(/^dg_/);
      expect(key1).toBe(key2);
    });
  });

  // ============================================
  // getTranscriptWithTimestamps
  // ============================================

  describe("getTranscriptWithTimestamps", () => {
    const sampleResponse = {
      results: {
        channels: [
          {
            alternatives: [
              {
                words: [
                  { word: "Hello", start: 0.1, end: 0.3 },
                  { word: "world", start: 0.4, end: 0.6 },
                ],
              },
            ],
          },
        ],
      },
    };

    it("returns words with timestamps", async () => {
      mockPreRecorded.mockResolvedValue(sampleResponse);

      const result = await getTranscriptWithTimestamps("https://example.com/video.mp4");

      expect(result.words).toHaveLength(2);
      expect(result.words[0]!.word).toBe("Hello");
      expect(result.words[0]!.start).toBe(0.1);
      expect(result.words[1]!.end).toBe(0.6);
    });

    it("calls preRecorded with detect_language option", async () => {
      mockPreRecorded.mockResolvedValue(sampleResponse);

      await getTranscriptWithTimestamps("https://example.com/video.mp4");

      expect(mockPreRecorded).toHaveBeenCalledWith(
        { url: "https://example.com/video.mp4" },
        expect.objectContaining({
          punctuate: true,
          model: "nova-2",
          detect_language: true,
          "x-idempotency-key": expect.stringMatching(/^dg_/),
        }),
      );
    });

    it("returns empty words array when no alternatives exist", async () => {
      mockPreRecorded.mockResolvedValue({ results: { channels: [{ alternatives: [] }] } });

      const result = await getTranscriptWithTimestamps("https://example.com/video.mp4");

      expect(result.words).toEqual([]);
    });
  });

  // ============================================
  // Timeout behavior
  // ============================================

  describe("timeout behavior", () => {
    it("rejects when the API call does not resolve within the timeout window", async () => {
      vi.useFakeTimers();

      // Never-resolving promise — the withTimeout helper will race it
      mockPreRecorded.mockReturnValue(new Promise<never>(() => {}));

      const promise = transcribeVideo("https://example.com/video.mp4");

      // Attach rejection handler synchronously BEFORE advancing time so Node.js
      // does not emit an UnhandledPromiseRejectionWarning
      const caught = promise.then(
        () => {
          throw new Error("Expected rejection but got resolution");
        },
        (e: unknown) => e, // swallow — we inspect below
      );

      // Advance past both timeout windows (50ms each) + retry delay (1000ms)
      // to let the retry loop exhaust and the final timeout error propagate
      await vi.advanceTimersByTimeAsync(1200);

      // Retrieve the error that was caught
      const error = await caught;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/request timed out after 50ms/);

      // Verify a timeout warning was logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ timeoutMs: 50, service: "Deepgram.transcribeVideo" }),
        expect.stringContaining("timed out"),
      );

      // Called twice: initial attempt + 1 retry (maxRetries=2)
      expect(mockPreRecorded).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });
});
