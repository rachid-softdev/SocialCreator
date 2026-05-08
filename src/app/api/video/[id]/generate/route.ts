import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateContent } from "@/lib/llm";
import { buildSystemPrompt, buildGenerationPrompt } from "@/lib/prompts";
import { Platform } from "@prisma/client";
import { z } from "zod";

const generateSchema = z.object({
  platforms: z.array(z.enum([
    "TIKTOK",
    "INSTAGRAM",
    "YOUTUBE",
    "FACEBOOK",
    "X",
    "LINKEDIN",
    "THREADS",
    "PINTEREST",
  ])),
  clipSegments: z.array(
    z.object({
      start: z.number(),
      end: z.number(),
      reason: z.string(),
      hook: z.string(),
    })
  ).optional(),
});

interface GeneratedContent {
  platform: Platform;
  textContent: string;
  hashtags: string[];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get video asset and verify ownership
    const videoAsset = await prisma.videoAsset.findUnique({
      where: { id },
      include: {
        profile: true,
      },
    });

    if (!videoAsset) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (videoAsset.profile.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const validationResult = generateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0].message },
        { status: 400 }
      );
    }

    const { platforms, clipSegments } = validationResult.data;

    // Get segments from asset or use provided ones
    const segments = clipSegments || (videoAsset.segments as Array<{
      start: number;
      end: number;
      reason: string;
      hook: string;
    }>) || [];

    if (segments.length === 0) {
      return NextResponse.json(
        { error: "No segments available. Identify segments first." },
        { status: 400 }
      );
    }

    // Build prompts
    const systemPrompt = buildSystemPrompt({
      name: videoAsset.profile.name,
      brandVoice: videoAsset.profile.brandVoice,
      contentBank: videoAsset.profile.contentBank,
    });

    // Generate content for each segment + platform
    const contents: GeneratedContent[] = [];

    for (const segment of segments) {
      for (const platform of platforms) {
        const userPrompt = buildGenerationPrompt(
          `${segment.hook}\n\nContexte: ${segment.reason}`,
          platform
        );

        const result = await generateContent(systemPrompt, userPrompt);

        // Store in database
        await prisma.generatedContent.create({
          data: {
            profileId: videoAsset.profileId,
            platform,
            textContent: result.textContent,
            hashtags: result.hashtags || [],
            mediaUrls: [],
            status: "DRAFT",
          },
        });

        contents.push({
          platform,
          textContent: result.textContent,
          hashtags: result.hashtags || [],
        });
      }
    }

    return NextResponse.json({ contents });
  } catch (error) {
    console.error("Error generating content:", error);
    return NextResponse.json(
      { error: "Content generation failed" },
      { status: 500 }
    );
  }
}
