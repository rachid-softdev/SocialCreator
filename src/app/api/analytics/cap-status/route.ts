/**
 * GET /api/analytics/cap-status
 * Get cap status for all platforms of a profile
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProfileCapStatus } from "@/lib/publish-guard";

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json(
        { error: "Missing profileId" },
        { status: 400 }
      );
    }

    // Verify user owns this profile
    const profile = await import("@/lib/prisma").then((m) =>
      m.prisma.profile.findFirst({
        where: { id: profileId, userId: session.user?.id },
      })
    );

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const capStatus = await getProfileCapStatus(profileId);

    return NextResponse.json(capStatus);
  } catch (error) {
    console.error("Error getting cap status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
