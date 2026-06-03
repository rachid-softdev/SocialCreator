/**
 * GET /api/content/[id]/cap-status
 * Get the current cap status for a profile/platform
 */

import type { Platform } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import { peekDailyCap } from "@/lib/publish-guard";

// GET /api/content/[id]/cap-status?profileId=xxx&platform=xxx
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const platform = searchParams.get("platform") as Platform;

    if (!profileId || !platform) {
      return NextResponse.json({ error: "Missing profileId or platform" }, { status: 400 });
    }

    // Verify user owns this profile
    const profile = await import("@/lib/prisma").then((m) =>
      m.prisma.profile.findFirst({
        where: { id: profileId, userId: session.user?.id },
      }),
    );

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const capStatus = await peekDailyCap(profileId, platform);

    return NextResponse.json(capStatus);
  } catch (error) {
    logger.error({ err: error }, "Error getting cap status");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
