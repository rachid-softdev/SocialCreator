import { createClient } from "@deepgram/sdk";
import logger from "@/lib/logger";
import { EXTERNAL_TIMEOUTS } from "./timeouts";

const DEEPGRAM_TIMEOUT_MS = EXTERNAL_TIMEOUTS.DEEPGRAM_TRANSCRIPTION;

// Lazy initialization to prevent build-time errors
function getDeepgramClient() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPGRAM_API_KEY is not configured");
  }
  return createClient(apiKey);
}

function generateIdempotencyKey(): string {
  return `dg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function retryWithIdempotency<T>(
  fn: (idempotencyKey: string) => Promise<T>,
  maxRetries: number = 2,
  baseDelay: number = 1000,
): Promise<T> {
  let lastError: Error | null = null;
  const idempotencyKey = generateIdempotencyKey();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn(idempotencyKey);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = baseDelay * 2 ** (attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Max retries exceeded");
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

  const result: any = await retryWithIdempotency(
    async (idempotencyKey) => {
      return withTimeout(
        deepgram.transcription.preRecorded(
          { url: videoUrl },
          {
            punctuate: true,
            paragraphs: true,
            timestamps: true,
            model: "nova-2",
            language: "multi",
            "x-idempotency-key": idempotencyKey,
          } as any,
        ),
        DEEPGRAM_TIMEOUT_MS,
        "Deepgram.transcribeVideo",
      );
    },
    2,
    1000,
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

  const result: any = await retryWithIdempotency(
    async (idempotencyKey) => {
      return withTimeout(
        deepgram.transcription.preRecorded(
          { url: videoUrl },
          {
            punctuate: true,
            model: "nova-2",
            detect_language: true,
            "x-idempotency-key": idempotencyKey,
          } as any,
        ),
        DEEPGRAM_TIMEOUT_MS,
        "Deepgram.getTranscriptWithTimestamps",
      );
    },
    2,
    1000,
  );

  return {
    words: result.results?.channels[0]?.alternatives[0]?.words || [],
  };
}
