import { createProfileSchema } from "@socialcreator/types";
import { NextResponse } from "next/server";
import { withApiMiddleware } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { checkProfileQuota } from "@/lib/quota-guard";

// checkProfileQuota imported from quota-guard

export const GET = withApiMiddleware(async ({ userId }) => {
  const profiles = await prisma.profile.findMany({
    where: { userId },
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
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    },
  );
});

export const POST = withApiMiddleware(async ({ userId, request }) => {
  const body = await request.json();
  const validationResult = createProfileSchema.safeParse(body);

  if (!validationResult.success) {
    return NextResponse.json({ error: validationResult.error.errors[0]!.message }, { status: 400 });
  }

  const hasQuota = await checkProfileQuota(userId);
  if (!hasQuota) {
    return NextResponse.json(
      { error: "Profile limit reached. Upgrade to create more profiles." },
      { status: 403 },
    );
  }

  const { name, brandVoice, contentBank, platforms } = validationResult.data;

  const profile = await prisma.profile.create({
    data: {
      userId,
      name,
      brandVoice: brandVoice || "",
      contentBank: contentBank || null,
      platforms: platforms || [],
    },
  });

  return NextResponse.json({ profile }, { status: 201 });
});
