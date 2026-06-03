import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

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
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    return NextResponse.json({ videoAsset });
  } catch (error) {
    logger.error({ err: error }, "Error fetching video");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

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
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Delete video asset
    await prisma.videoAsset.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Error deleting video");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Force dynamic rendering
export const dynamic = "force-dynamic";
