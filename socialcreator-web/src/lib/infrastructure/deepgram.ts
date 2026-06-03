import { createClient } from "@deepgram/sdk";
import logger from "@/lib/logger";

const DEEPGRAM_TIMEOUT_MS = 30_000; // 30 seconds

// Lazy initialization to prevent build-time errors
function getDeepgramClient() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPGRAM_API_KEY is not configured");
  }
  return createClient(apiKey);
}

/**
 * Helper: race a promise against an AbortController timeout.
 * Logs a warning if the timeout fires.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
    logger.warn(
      { timeoutMs: ms, service: label },
      `[Timeout] ${label} request timed out after ${ms}ms`,
    );
  }, ms);

  try {
    // We can't directly abort the Deepgram SDK call, but we can race the promise
    const result = await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new Error(`${label} request timed out after ${ms}ms`));
        });
      }),
    ]);
    return result;
  } finally {
    clearTimeout(timer);
  }
}

export interface TranscriptResult {
  transcript: string;
  paragraphs: Array<{
    words: Array<{ word: string; start: number; end: number }>;
  }>;
}

export async function transcribeVideo(videoUrl: string): Promise<TranscriptResult> {
  const deepgram = getDeepgramClient();
  // Note: No retry on preRecorded — it's a non-idempotent write operation.
  // Retrying could create duplicate transcription jobs with duplicate billing.
  const result: any = await withTimeout(
    deepgram.transcription.preRecorded(
      { url: videoUrl },
      {
        punctuate: true,
        paragraphs: true,
        timestamps: true,
        model: "nova-2",
        language: "multi",
      },
    ),
    DEEPGRAM_TIMEOUT_MS,
    "Deepgram.transcribeVideo",
  );

  return {
    transcript: result.results?.channels[0]?.alternatives[0]?.transcript || "",
    paragraphs: result.results?.paragraphs?.paragraphs || [],
  };
}

export async function getTranscriptWithTimestamps(videoUrl: string): Promise<{
  words: Array<{ word: string; start: number; end: number }>;
}> {
  const deepgram = getDeepgramClient();
  // Note: No retry on preRecorded — non-idempotent write (see transcribeVideo).
  const result: any = await withTimeout(
    deepgram.transcription.preRecorded(
      { url: videoUrl },
      {
        punctuate: true,
        model: "nova-2",
        detect_language: true,
      },
    ),
    DEEPGRAM_TIMEOUT_MS,
    "Deepgram.getTranscriptWithTimestamps",
  );

  return {
    words: result.results?.channels[0]?.alternatives[0]?.words || [],
  };
}
