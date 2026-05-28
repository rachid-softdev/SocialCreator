import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    // Build query - get all videos for user's profiles
    const profileIds = await prisma.profile.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    });

    const pids = profileIds.map((p) => p.id);

    // Validate profileId ownership if provided
    if (profileId && !pids.includes(profileId)) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const videos = await prisma.videoAsset.findMany({
      where: {
        profileId: profileId ? profileId : { in: pids },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ videos });
  } catch (error) {
    logger.error({ err: error }, "Error fetching videos");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Force dynamic rendering
export const dynamic = "force-dynamic";
