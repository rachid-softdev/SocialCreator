import { createClient } from "@deepgram/sdk";

const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);

export interface TranscriptResult {
  transcript: string;
  paragraphs: Array<{
    words: Array<{ word: string; start: number; end: number }>;
  }>;
}

export async function transcribeVideo(videoUrl: string): Promise<TranscriptResult> {
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
