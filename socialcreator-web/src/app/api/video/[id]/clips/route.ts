import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createMuxClip, getMuxStreamUrl, getMuxThumbnailUrl } from "@/lib/mux";
import { prisma } from "@/lib/prisma";

const clipsSchema = z.object({
  segments: z.array(
    z.object({
      start: z.number(),
      end: z.number(),
      reason: z.string().optional(),
      hook: z.string().optional(),
    }),
  ),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get video asset
    const videoAsset = await prisma.videoAsset.findUnique({
      where: { id },
    });

    if (!videoAsset) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Verify ownership through profile
    const profile = await prisma.profile.findFirst({
      where: { id: videoAsset.profileId, userId: session.user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const validationResult = clipsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0].message },
        { status: 400 },
      );
    }

    const { segments } = validationResult.data;

    // Create Mux clips for each segment
    const clips = [];
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
        duration: segment.end - segment.start,
      });
    }

    // Update asset status
    await prisma.videoAsset.update({
      where: { id },
      data: { status: "CLIPS_CREATED" },
    });

    return NextResponse.json({ clips });
  } catch (error) {
    console.error("Error creating clips:", error);
    return NextResponse.json({ error: "Clip creation failed" }, { status: 500 });
  }
}

// Force dynamic rendering
export const dynamic = "force-dynamic";
