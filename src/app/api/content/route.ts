import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { contentFilterSchema } from "@/lib/validations";
import { isValidUuid } from "@/lib/sanitize";

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

    // Extract raw values
    const rawFilters = {
      profileId: searchParams.get("profileId"),
      status: searchParams.get("status"),
      platform: searchParams.get("platform"),
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
    };

    // Validate filters with Zod
    const validation = contentFilterSchema.safeParse(rawFilters);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { profileId, status, platform, page, pageSize } = validation.data;

    // Validate profileId if provided
    if (profileId && !isValidUuid(profileId)) {
      return NextResponse.json(
        { error: "Invalid profile ID" },
        { status: 400 }
      );
    }

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
