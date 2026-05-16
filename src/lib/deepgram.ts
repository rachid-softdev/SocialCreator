import { createClient } from "@deepgram/sdk";

// Lazy initialization to prevent build-time errors
function getDeepgramClient() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPGRAM_API_KEY is not configured");
  }
  return createClient(apiKey);
}

export interface TranscriptResult {
  transcript: string;
  paragraphs: Array<{
    words: Array<{ word: string; start: number; end: number }>;
  }>;
}

export async function transcribeVideo(videoUrl: string): Promise<TranscriptResult> {
  const deepgram = getDeepgramClient();
  const result = await deepgram.transcription.preRecorded(
    { url: videoUrl },
    {
      punctuate: true,
      paragraphs: true,
      timestamps: true,
      model: "nova-2",
      language: "multi",
    }
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
  const result = await deepgram.transcription.preRecorded(
    { url: videoUrl },
    {
      punctuate: true,
      model: "nova-2",
      detect_language: true,
    }
  );

  return {
    words: result.results?.channels[0]?.alternatives[0]?.words || [],
  };
}
