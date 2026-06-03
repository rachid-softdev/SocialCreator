import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ cguAccepted: null }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { cguAccepted: true },
    });

    return NextResponse.json({
      cguAccepted: user?.cguAccepted ?? false,
    });
  } catch (error) {
    logger.error({ err: error }, "Error checking CGU status");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
