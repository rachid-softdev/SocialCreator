import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (!body.accepted) {
      return NextResponse.json({ error: "Terms must be accepted" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        cguAccepted: true,
        cguAcceptedAt: new Date(),
      },
    });

    const profileCount = await prisma.profile.count({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ success: true, hasProfile: profileCount > 0 });
  } catch (error) {
    console.error("Error accepting CGU:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
