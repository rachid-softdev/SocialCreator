import { analyticsIngestSchema } from "@socialcreator/types";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = analyticsIngestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { platform, profileId, date, impressions, engagements, clicks, followers } = parsed.data;

    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId: session.user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const analytics = await prisma.analytics.upsert({
      where: {
        profileId_date_platform: {
          profileId,
          date,
          platform,
        },
      },
      update: { impressions, engagements, clicks, followers },
      create: {
        profileId,
        platform,
        date,
        impressions,
        engagements,
        clicks,
        followers,
      },
    });

    return NextResponse.json(analytics, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, "Analytics ingest error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
