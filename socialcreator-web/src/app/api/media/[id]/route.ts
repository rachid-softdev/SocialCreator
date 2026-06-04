/**
 * DELETE /api/media/[id] - Delete a media asset
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import { verifyMediaAssetOwnership } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE /api/media/[id]
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify user owns this media
    const result = await verifyMediaAssetOwnership(session.user.id, id);
    if (!result.valid) return result.error;

    await prisma.mediaAsset.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Error deleting media");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
