import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/content?profileId=xxx&status=DRAFT&page=1
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const status = searchParams.get("status");
    const platform = searchParams.get("platform");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    // Build where clause
    const whereClause: Record<string, unknown> = {
      profile: { userId: session.user.id },
    };

    if (profileId) {
      whereClause.profileId = profileId;
    }

    if (status) {
      whereClause.status = status;
    }

    if (platform) {
      whereClause.platform = platform;
    }

    const [contents, total] = await Promise.all([
      prisma.generatedContent.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          profile: {
            select: { id: true, name: true },
          },
          run: {
            select: {
              id: true,
              agent: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
      prisma.generatedContent.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      contents,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching content:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
