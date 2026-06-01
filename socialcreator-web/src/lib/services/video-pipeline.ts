import type { Platform } from "@prisma/client";
import { z } from "zod";
import { transcribeVideo } from "@/lib/deepgram";
import { generateContent } from "@/lib/llm";
import { createMuxClip, getMuxStreamUrl, getMuxThumbnailUrl } from "@/lib/mux";
import { prisma } from "@/lib/prisma";
import { buildGenerationPrompt, buildSystemPrompt } from "@/lib/prompts";

const SEGMENT_PROMPT = `Voici le transcript d'une vidéo avec timestamps.
Identifie 3 à 5 segments de 30-90 secondes qui constituent les moments les plus impactants pour les réseaux sociaux.
Chaque segment doit avoir un "hook" fort — un moment où l'attention du viewer est captée.
Réponds EXACTEMENT en JSON avec ce format:
[
  { "start": number, "end": number, "reason": "pourquoi ce segment est impactant", "hook": "le hook des premières secondes" }
]
Ne réponds que le JSON, rien d'autre.`;

export interface Segment {
  start: number;
  end: number;
  reason: string;
  hook: string;
}

export interface ClipResult {
  segment: Segment;
  assetId: string;
  playbackId: string;
  streamUrl: string;
  thumbnailUrl: string;
}

export interface ContentResult {
  platform: Platform;
  textContent: string;
  hashtags: string[];
}

export interface VideoPipelineResult {
  transcript: string;
  segments: Segment[];
  clips: ClipResult[];
  contents: ContentResult[];
}

const SegmentSchema = z.object({
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  reason: z.string().min(1),
  hook: z.string().min(1),
});

export async function identifySegments(transcript: string): Promise<Segment[]> {
  const result = await generateContent(
    "Tu es un expert en création de contenu viral pour les réseaux sociaux.",
    `${SEGMENT_PROMPT}\n\nTranscript:\n${transcript}`,
  );

  const segments = SegmentSchema.array()
    .min(1)
    .safeParse((result as any).segments);
  if (!segments.success) {
    throw new Error(
      `Failed to parse LLM segment response: ${segments.error.message}. ` +
        `Raw: ${JSON.stringify(result).slice(0, 200)}`,
    );
  }

  return segments.data;
}

export async function runVideoPipeline(
  videoAssetId: string,
  profileId: string,
  targetPlatforms: Platform[],
): Promise<VideoPipelineResult> {
  // 1. Get video asset
  const videoAsset = await prisma.videoAsset.findUnique({
    where: { id: videoAssetId },
  });
  if (!videoAsset) throw new Error("Video asset not found");

  // 2. Transcribe via Deepgram
  const { transcript } = await transcribeVideo(videoAsset.uploadUrl);

  // 3. Update asset with transcript
  await prisma.videoAsset.update({
    where: { id: videoAssetId },
    data: { transcript, status: "TRANSCRIBED" },
  });

  // 4. Identify segments via Claude
  const segments = await identifySegments(transcript);

  // 5. Update asset with segments
  await prisma.videoAsset.update({
    where: { id: videoAssetId },
    data: { segments: segments as any, status: "SEGMENTS_IDENTIFIED" },
  });

  // 6. Create Mux clips for each segment
  const clips: ClipResult[] = [];
  for (const segment of segments) {
    const { assetId, playbackId } = await createMuxClip(
      videoAsset.uploadUrl,
      segment.start,
      segment.end,
    );
    clips.push({
      segment,
      assetId,
      playbackId,
      streamUrl: getMuxStreamUrl(playbackId),
      thumbnailUrl: getMuxThumbnailUrl(playbackId, segment.start),
    });
  }

  // 7. Update asset status
  await prisma.videoAsset.update({
    where: { id: videoAssetId },
    data: { status: "CLIPS_CREATED" },
  });

  // 8. Generate content for each clip + platform
  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  if (!profile) throw new Error("Profile not found");

  const systemPrompt = buildSystemPrompt({
    name: profile.name,
    brandVoice: profile.brandVoice,
    contentBank: profile.contentBank,
  });

  const contents: ContentResult[] = [];
  for (const clip of clips) {
    for (const platform of targetPlatforms) {
      const userPrompt = buildGenerationPrompt({
        brief: `${clip.segment.hook}\n\nContexte: ${clip.segment.reason}`,
        platform,
      });
      const result = await generateContent(systemPrompt, userPrompt);
      contents.push({
        platform,
        textContent: result.textContent,
        hashtags: result.hashtags || [],
      });
    }
  }

  // Persist generated content to the database (mirrors agent-runner.ts pattern)
  for (const content of contents) {
    await prisma.generatedContent.create({
      data: {
        profileId,
        platform: content.platform,
        textContent: content.textContent,
        hashtags: content.hashtags,
        mediaUrls: [],
        status: "DRAFT",
      },
    });
  }

  return { transcript, segments, clips, contents };
}
