import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    // Build query
    const where: { profile: { userId: string }; profileId?: string } = {
      profile: { userId: session.user.id },
    };

    if (profileId) {
      where.profileId = profileId;
    }

    const videos = await prisma.videoAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        profile: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ videos });
  } catch (error) {
    console.error("Error fetching videos:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
