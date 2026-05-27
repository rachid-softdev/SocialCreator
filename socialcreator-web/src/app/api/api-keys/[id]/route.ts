import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify ownership
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id,
      userId: session.user.id,
      revokedAt: null,
    },
  });

  if (!apiKey) {
    return NextResponse.json({ error: "API key not found or already revoked" }, { status: 404 });
  }

  // Revoke the key
  await prisma.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
