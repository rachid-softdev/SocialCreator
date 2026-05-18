import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createProfileSchema } from "@socialcreator/types";
import { checkProfileQuota } from "@/lib/quota-guard";

// checkProfileQuota imported from quota-guard

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const profiles = await prisma.profile.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            agents: true,
            generatedContents: true,
            connectedAccounts: true,
          },
        },
      },
    });

    return NextResponse.json(
      { profiles },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    console.error("Error fetching profiles:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validationResult = createProfileSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0].message },
        { status: 400 }
      );
    }

    const hasQuota = await checkProfileQuota(session.user.id);
    if (!hasQuota) {
      return NextResponse.json(
        { error: "Profile limit reached. Upgrade to create more profiles." },
        { status: 403 }
      );
    }

    const { name, brandVoice, contentBank, platforms } = validationResult.data;

    const profile = await prisma.profile.create({
      data: {
        userId: session.user.id,
        name,
        brandVoice: brandVoice || "",
        contentBank: contentBank || null,
        platforms: platforms || [],
      },
    });

    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    console.error("Error creating profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}