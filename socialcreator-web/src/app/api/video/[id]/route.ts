import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import { verifyVideoAssetOwnership } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const result = await verifyVideoAssetOwnership(session.user.id, id);
    if (!result.valid) return result.error;
    const videoAsset = result.data;

    return NextResponse.json({ videoAsset });
  } catch (error) {
    logger.error({ err: error }, "Error fetching video");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const result = await verifyVideoAssetOwnership(session.user.id, id);
    if (!result.valid) return result.error;

    // Delete video asset
    await prisma.videoAsset.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Error deleting video");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Force dynamic rendering
export const dynamic = "force-dynamic";
