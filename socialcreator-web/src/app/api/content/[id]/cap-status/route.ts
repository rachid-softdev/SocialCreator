/**
 * GET /api/content/[id]/cap-status
 * Get the current cap status for a profile/platform
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkDailyCap } from "@/lib/publish-guard";
import { Platform } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/content/[id]/cap-status?profileId=xxx&platform=xxx
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const platform = searchParams.get("platform") as Platform;

    if (!profileId || !platform) {
      return NextResponse.json(
        { error: "Missing profileId or platform" },
        { status: 400 }
      );
    }

    // Verify user owns this profile
    const profile = await import("@/lib/prisma").then((m) =>
      m.prisma.profile.findFirst({
        where: { id: profileId, userId: session.user!.id },
      })
    );

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const capStatus = await checkDailyCap(profileId, platform);

    return NextResponse.json(capStatus);
  } catch (error) {
    console.error("Error getting cap status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
