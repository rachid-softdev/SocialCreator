/**
 * OAuth Redirect URL Route
 * Returns the OAuth authorization URL for a specific platform and profile
 * GET /api/connected-accounts/redirect/[platform]?profileId=xxx
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildAuthUrl } from "@/lib/oauth/auth-url";
import { Platform } from "@prisma/client";

interface RouteParams {
  params: Promise<{ platform: string }>;
}

/**
 * GET /api/connected-accounts/redirect/[platform]?profileId=xxx
 * Returns the OAuth authorization URL for the client to redirect to
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const { platform } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId is required" },
        { status: 400 }
      );
    }

    // Verify profile ownership
    const profile = await prisma.profile.findFirst({
      where: {
        id: profileId,
        userId: session.user.id,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found or access denied" },
        { status: 404 }
      );
    }

    // Validate platform
    const platformUpper = platform.toUpperCase();
    const supportedPlatforms: Platform[] = [
      "INSTAGRAM",
      "TIKTOK",
      "LINKEDIN",
      "X",
      "YOUTUBE",
      "FACEBOOK",
      "PINTEREST",
      "THREADS",
    ];

    if (!supportedPlatforms.includes(platformUpper as Platform)) {
      return NextResponse.json(
        { error: "Unsupported platform" },
        { status: 400 }
      );
    }

    // Check if account is already connected
    const existingAccount = await prisma.connectedAccount.findUnique({
      where: {
        profileId_platform: {
          profileId,
          platform: platformUpper as Platform,
        },
      },
    });

    if (existingAccount) {
      return NextResponse.json(
        { error: "This platform is already connected to this profile" },
        { status: 409 }
      );
    }

    // Build and return the OAuth URL
    const redirectUrl = buildAuthUrl(platformUpper as any, profileId);

    return NextResponse.json({ redirectUrl });
  } catch (error) {
    console.error("Error generating OAuth redirect URL:", error);
    return NextResponse.json(
      { error: "Failed to generate OAuth URL" },
      { status: 500 }
    );
  }
}