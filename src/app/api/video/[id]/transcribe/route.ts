import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { transcribeVideo } from "@/lib/deepgram";

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
        profile: {
          select: { userId: true },
        },
      },
    });

    if (!videoAsset) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (videoAsset.profile.userId !== session.user.id) {
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

    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 500 }
    );
  }
}
