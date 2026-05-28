/**
 * Video Pipeline worker
 * Orchestrates the complete video processing pipeline:
 * 1. Transcription via Deepgram
 * 2. Segment identification via Claude
 * 3. Clip creation via Mux
 * 4. Content generation via Claude
 */

import { z } from "zod";
import { transcribeVideo } from "@/lib/deepgram";
import { generateContent } from "@/lib/llm";
import logger from "@/lib/logger";
import { createMuxClip } from "@/lib/mux";
import { prisma } from "@/lib/prisma";
import { buildGenerationPrompt, buildSystemPrompt } from "@/lib/prompts";

const SEGMENT_PROMPT = `Voici le transcript d'une vidéo.
Identifie 3 à 5 segments de 30-90 secondes qui constituent les moments les plus impactants pour les réseaux sociaux.
Chaque segment doit avoir un "hook" fort — un moment où l'attention du viewer est captée.
Réponds EXACTEMENT en JSON avec ce format:
[
  { "start": number, "end": number, "reason": "pourquoi ce segment est impactant", "hook": "le hook des premières secondes" }
]
Ne réponds que le JSON, rien d'autre.`;

const PipelinePayloadSchema = z.object({
  videoAssetId: z.string(),
  profileId: z.string(),
  platforms: z.array(z.string()),
});

interface SegmentResult {
  start: number;
  end: number;
  reason: string;
  hook: string;
}

/**
 * Run the video pipeline for a given payload
 */
export async function runVideoPipelineJob(payload: z.infer<typeof PipelinePayloadSchema>): Promise<{
  videoAssetId: string;
  transcript: string;
  segments: SegmentResult[];
  clipsCreated: number;
  contentsGenerated: number;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
}> {
  const { videoAssetId, profileId, platforms } = payload;

  logger.info({ videoAssetId, profileId }, "Starting video pipeline");

  try {
    // 1. Get video asset
    const videoAsset = await prisma.videoAsset.findUnique({
      where: { id: videoAssetId },
    });

    if (!videoAsset) {
      throw new Error("Video asset not found");
    }

    logger.info("Video asset found");

    // 2. Transcribe via Deepgram
    logger.info("Transcribing video...");
    const { transcript } = await transcribeVideo(videoAsset.uploadUrl);

    await prisma.videoAsset.update({
      where: { id: videoAssetId },
      data: { transcript, status: "TRANSCRIBED" },
    });

    logger.info("Transcription complete");

    // 3. Identify segments via Claude
    logger.info("Identifying segments...");
    const result = await generateContent(
      "Tu es un expert en création de contenu viral pour les réseaux sociaux.",
      `${SEGMENT_PROMPT}\n\nTranscript:\n${transcript}`,
    );

    const segments = (result as any).segments as SegmentResult[];

    await prisma.videoAsset.update({
      where: { id: videoAssetId },
      data: { segments: segments as any, status: "SEGMENTS_IDENTIFIED" },
    });

    logger.info({ count: segments.length }, "Segments identified");

    // 4. Create Mux clips for each segment
    logger.info("Creating Mux clips...");
    let clipsCreated = 0;

    for (const segment of segments) {
      try {
        await createMuxClip(videoAsset.uploadUrl, segment.start, segment.end);
        clipsCreated++;
      } catch (error) {
        logger.error({ segment, err: error }, "Failed to create clip");
      }
    }

    await prisma.videoAsset.update({
      where: { id: videoAssetId },
      data: { status: "CLIPS_CREATED" },
    });

    logger.info({ count: clipsCreated }, "Clips created");

    // 5. Get profile for content generation
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      throw new Error("Profile not found");
    }

    const systemPrompt = buildSystemPrompt({
      name: profile.name,
      brandVoice: profile.brandVoice,
      contentBank: profile.contentBank,
    });

    // 6. Generate content for each segment + platform
    logger.info("Generating content...");
    let contentsGenerated = 0;

    for (const segment of segments) {
      for (const platform of platforms) {
        try {
          const userPrompt = buildGenerationPrompt({
            brief: `${segment.hook}\n\nContexte: ${segment.reason}`,
            platform: platform as any,
          });

          const contentResult = await generateContent(systemPrompt, userPrompt);

          await prisma.generatedContent.create({
            data: {
              profileId,
              platform: platform as Parameters<typeof buildSystemPrompt>[0] extends never
                ? never
                : Parameters<typeof buildGenerationPrompt>[0]["platform"],
              textContent: contentResult.textContent,
              hashtags: contentResult.hashtags || [],
              mediaUrls: [],
              status: "DRAFT",
            },
          });

          contentsGenerated++;
        } catch (error) {
          logger.error({ segment, platform, err: error }, "Failed to generate content");
        }
      }
    }

    logger.info({ count: contentsGenerated }, "Content generation complete");

    return {
      videoAssetId,
      transcript,
      segments,
      clipsCreated,
      contentsGenerated,
      status: "SUCCESS" as const,
    };
  } catch (error) {
    logger.error({ err: error }, "Video pipeline failed");

    await prisma.videoAsset.update({
      where: { id: videoAssetId },
      data: { status: "ERROR" },
    });

    throw error;
  }
}
