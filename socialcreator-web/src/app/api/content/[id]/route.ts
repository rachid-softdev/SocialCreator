import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import { verifyContentOwnership } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";

const updateContentSchema = z.object({
  textContent: z.string().min(1).max(10000).optional(),
  hashtags: z.array(z.string()).optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  status: z.enum(["DRAFT", "APPROVED", "PUBLISHED", "FAILED", "REJECTED", "SCHEDULED"]).optional(),
  scheduledPublishAt: z.string().datetime().optional(),
  scheduledTimezone: z.string().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/content/[id]
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const result = await verifyContentOwnership(session.user.id, id);

    if (!result.valid) return result.error;

    return NextResponse.json({ content: result.data });
  } catch (error) {
    logger.error({ err: error }, "Error fetching content");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/content/[id]
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const ownership = await verifyContentOwnership(session.user.id, id);

    if (!ownership.valid) return ownership.error;

    const body = await request.json();
    const validationResult = updateContentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0].message },
        { status: 400 },
      );
    }

    const updateData = validationResult.data;

    const content = await prisma.generatedContent.update({
      where: { id },
      data: updateData,
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
    });

    return NextResponse.json({ content });
  } catch (error) {
    logger.error({ err: error }, "Error updating content");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/content/[id]
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const ownership = await verifyContentOwnership(session.user.id, id);

    if (!ownership.valid) return ownership.error;

    await prisma.generatedContent.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Error deleting content");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
