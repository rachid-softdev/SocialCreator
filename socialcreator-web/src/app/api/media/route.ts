/**
 * API routes for Media Library
 *
 * GET    /api/media?profileId=xxx - List media assets for a profile
 * POST   /api/media - Upload a new media asset
 * DELETE /api/media/[id] - Delete a media asset
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const uploadMediaSchema = z.object({
  profileId: z.string().uuid(),
  type: z.enum(["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"]),
  url: z.string().url(),
  filename: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  duration: z.number().optional(),
});

// GET /api/media
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const type = searchParams.get("type");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId is required" },
        { status: 400 }
      );
    }

    // Verify user owns this profile
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId: session.user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const whereClause: Record<string, unknown> = { profileId };

    if (type) {
      whereClause.type = type;
    }

    const [media, total] = await Promise.all([
      prisma.mediaAsset.findMany({
        where: whereClause,
        orderBy: { uploadedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.mediaAsset.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      media,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching media:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/media
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = uploadMediaSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { profileId, type, url, filename, mimeType, size, width, height, duration } =
      validation.data;

    // Verify user owns this profile
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId: session.user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const media = await prisma.mediaAsset.create({
      data: {
        profileId,
        type,
        url,
        filename,
        mimeType,
        size,
        width,
        height,
        duration,
      },
    });

    return NextResponse.json({ media }, { status: 201 });
  } catch (error) {
    console.error("Error uploading media:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}