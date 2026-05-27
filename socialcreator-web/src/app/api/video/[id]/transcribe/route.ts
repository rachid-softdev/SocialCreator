import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { transcribeVideo } from "@/lib/deepgram";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get video asset and verify ownership
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

    // Update status to TRANSCRIBING
    await prisma.videoAsset.update({
      where: { id },
      data: { status: "TRANSCRIBING" },
    });

    // Transcribe via Deepgram
    const { transcript } = await transcribeVideo(videoAsset.uploadUrl);

    // Update asset with transcript
    await prisma.videoAsset.update({
      where: { id },
      data: {
        transcript,
        status: "TRANSCRIBED",
      },
    });

    return NextResponse.json({ transcript });
  } catch (error) {
    console.error("Error transcribing video:", error);

    // Update status to ERROR
    await prisma.videoAsset.update({
      where: { id },
      data: { status: "ERROR" },
    });

    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}

// Force dynamic rendering to prevent build-time API calls
export const dynamic = "force-dynamic";
