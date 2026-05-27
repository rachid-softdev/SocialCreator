// Video Pipeline Trigger Job
// This job orchestrates the complete video processing pipeline:
// 1. Transcription via Deepgram
// 2. Segment identification via Claude
// 3. Clip creation via Mux
// 4. Content generation via Claude

import { client } from "@/lib/trigger";

// Mock triggerHttpPayload - will be replaced with actual implementation
const triggerHttpPayload = (config: any) => config;

import { z } from "zod";
import { transcribeVideo } from "@/lib/deepgram";
import { generateContent } from "@/lib/llm";
import { createMuxClip, getMuxStreamUrl, getMuxThumbnailUrl } from "@/lib/mux";
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

export const videoPipelineJob = client.defineJob({
  id: "video-pipeline",
  name: "Video Pipeline",
  version: "0.1.0",
  trigger: triggerHttpPayload({
    schema: z.object({
      videoAssetId: z.string(),
      profileId: z.string(),
      platforms: z.array(z.string()),
    }),
  }),
  output: z.object({
    videoAssetId: z.string(),
    transcript: z.string(),
    segments: z.array(
      z.object({
        start: z.number(),
        end: z.number(),
        reason: z.string(),
        hook: z.string(),
      }),
    ),
    clipsCreated: z.number(),
    contentsGenerated: z.number(),
    status: z.enum(["SUCCESS", "PARTIAL", "FAILED"]),
  }),
  retries: {
    maxAttempts: 3,
    backoff: {
      type: "exponential",
      seconds: [10, 30, 60],
    },
  },
  run: async (payload: any, io: any) => {
    const { videoAssetId, profileId, platforms } = payload;

    await io.logger.info("Starting video pipeline", { videoAssetId, profileId });

    try {
      // 1. Get video asset
      const videoAsset = await prisma.videoAsset.findUnique({
        where: { id: videoAssetId },
      });

      if (!videoAsset) {
        throw new Error("Video asset not found");
      }

      await io.logger.info("Video asset found", { uploadUrl: videoAsset.uploadUrl });

      // 2. Transcribe via Deepgram
      await io.logger.info("Transcribing video...");
      const { transcript } = await transcribeVideo(videoAsset.uploadUrl);

      await prisma.videoAsset.update({
        where: { id: videoAssetId },
        data: { transcript, status: "TRANSCRIBED" },
      });

      await io.logger.info("Transcription complete");

      // 3. Identify segments via Claude
      await io.logger.info("Identifying segments...");
      const result = await generateContent(
        "Tu es un expert en création de contenu viral pour les réseaux sociaux.",
        `${SEGMENT_PROMPT}\n\nTranscript:\n${transcript}`,
      );

      const segments = (result as any).segments as Array<{
        start: number;
        end: number;
        reason: string;
        hook: string;
      }>;

      await prisma.videoAsset.update({
        where: { id: videoAssetId },
        data: { segments: segments as any, status: "SEGMENTS_IDENTIFIED" },
      });

      await io.logger.info("Segments identified", { count: segments.length });

      // 4. Create Mux clips for each segment
      await io.logger.info("Creating Mux clips...");
      let clipsCreated = 0;

      for (const segment of segments) {
        try {
          await createMuxClip(videoAsset.uploadUrl, segment.start, segment.end);
          clipsCreated++;
        } catch (error) {
          await io.logger.error("Failed to create clip", { segment, error });
        }
      }

      await prisma.videoAsset.update({
        where: { id: videoAssetId },
        data: { status: "CLIPS_CREATED" },
      });

      await io.logger.info("Clips created", { count: clipsCreated });

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
      await io.logger.info("Generating content...");
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
            await io.logger.error("Failed to generate content", { segment, platform, error });
          }
        }
      }

      await io.logger.info("Content generation complete", { count: contentsGenerated });

      return {
        videoAssetId,
        transcript,
        segments,
        clipsCreated,
        contentsGenerated,
        status: "SUCCESS" as const,
      };
    } catch (error) {
      await io.logger.error("Video pipeline failed", { error });

      await prisma.videoAsset.update({
        where: { id: videoAssetId },
        data: { status: "ERROR" },
      });

      throw error;
    }
  },
});
