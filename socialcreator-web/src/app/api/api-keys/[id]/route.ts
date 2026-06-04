import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import { verifyApiKeyOwnership } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const result = await verifyApiKeyOwnership(session.user.id, id);
    if (!result.valid) return result.error;

    // Revoke the key
    await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Error revoking API key");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
