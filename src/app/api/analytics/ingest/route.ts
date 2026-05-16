import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyticsIngestSchema } from "@/lib/validations";

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
        { status: 400 }
      );
    }

    const { platform, profileId, date, impressions, engagements, clicks, followers } =
      parsed.data;

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
    console.error("Analytics ingest error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
