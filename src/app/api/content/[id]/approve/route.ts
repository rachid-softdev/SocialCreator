import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getContentOr404(id: string, userId: string) {
  const content = await prisma.generatedContent.findFirst({
    where: { id, profile: { userId } },
  });
  return content;
}

// POST /api/content/[id]/approve
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const content = await getContentOr404(id, session.user.id);

    if (!content) {
      return NextResponse.json(
        { error: "Content not found" },
        { status: 404 }
      );
    }

    if (content.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft content can be approved" },
        { status: 400 }
      );
    }

    const updatedContent = await prisma.generatedContent.update({
      where: { id },
      data: { status: "APPROVED" },
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

    return NextResponse.json({ content: updatedContent });
  } catch (error) {
    console.error("Error approving content:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
