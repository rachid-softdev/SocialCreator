import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/rate-limit-redis";

const rejectContentSchema = z.object({
  reason: z.string().max(500).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getContentOr404(id: string, userId: string) {
  const content = await prisma.generatedContent.findFirst({
    where: { id, profile: { userId } },
  });
  return content;
}

// POST /api/content/[id]/reject
export async function POST(request: Request, { params }: RouteParams) {
  try {
    // Rate limit check
    const rateLimitResponse = await withRateLimit(request, {});
    if (rateLimitResponse) return rateLimitResponse;

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const content = await getContentOr404(id, session.user.id);

    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    if (content.status !== "DRAFT") {
      return NextResponse.json({ error: "Only draft content can be rejected" }, { status: 400 });
    }

    const body = await request.json();
    const validationResult = rejectContentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0].message },
        { status: 400 },
      );
    }

    const { reason } = validationResult.data;

    // Store rejection reason in config field if needed
    // For now, we just update the status and rejectedAt
    const updatedContent = await prisma.generatedContent.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
      },
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

    return NextResponse.json({
      content: updatedContent,
      reason: reason || null,
    });
  } catch (error) {
    console.error("Error rejecting content:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
