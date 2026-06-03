/**
 * API route: Connected Accounts CRUD
 * GET /api/connected-accounts - List all connected accounts for a profile
 * POST /api/connected-accounts - Initiate OAuth flow for a new account
 */

import type { Platform } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import { buildAuthUrl } from "@/lib/oauth/auth-url";
import { prisma } from "@/lib/prisma";
import { connectAccountSchema } from "@/lib/validations";

interface ConnectedAccountResponse {
  id: string;
  platform: Platform;
  accountId: string;
  accountName: string;
  accountAvatarUrl: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

/**
 * GET /api/connected-accounts?profileId=xxx
 * Returns list of connected accounts for the specified profile
 * Tokens are masked (not returned)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json({ error: "profileId is required" }, { status: 400 });
    }

    // Verify profile ownership
    const profile = await prisma.profile.findFirst({
      where: {
        id: profileId,
        userId: session.user.id,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found or access denied" }, { status: 404 });
    }

    // Get connected accounts
    const accounts = await prisma.connectedAccount.findMany({
      where: {
        profileId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Mask sensitive data - don't return tokens
    const response: ConnectedAccountResponse[] = accounts.map((account) => ({
      id: account.id,
      platform: account.platform,
      accountId: account.accountId,
      accountName: account.accountName,
      accountAvatarUrl: account.accountAvatarUrl,
      isActive: account.isActive,
      expiresAt: account.expiresAt?.toISOString() || null,
      createdAt: account.createdAt.toISOString(),
    }));

    return NextResponse.json(response);
  } catch (error) {
    logger.error({ err: error }, "Error fetching connected accounts");
    return NextResponse.json({ error: "Failed to fetch connected accounts" }, { status: 500 });
  }
}

/**
 * POST /api/connected-accounts
 * Body: { profileId: string, platform: Platform }
 * Returns: { redirectUrl: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = connectAccountSchema.pick({ platform: true, profileId: true }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: `Invalid request: ${parsed.error.errors.map((e) => e.message).join(", ")}` },
        { status: 400 },
      );
    }
    const { profileId, platform } = parsed.data;

    // Verify profile ownership
    const profile = await prisma.profile.findFirst({
      where: {
        id: profileId,
        userId: session.user.id,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found or access denied" }, { status: 404 });
    }

    // Check if account is already connected
    const existingAccount = await prisma.connectedAccount.findUnique({
      where: {
        profileId_platform: {
          profileId,
          platform,
        },
      },
    });

    if (existingAccount) {
      return NextResponse.json(
        { error: "This platform is already connected to this profile" },
        { status: 409 },
      );
    }

    // Build the OAuth authorization URL
    const redirectUrl = buildAuthUrl(platform, profileId);

    return NextResponse.json({ redirectUrl });
  } catch (error) {
    logger.error({ err: error }, "Error initiating OAuth flow");
    return NextResponse.json({ error: "Failed to initiate OAuth flow" }, { status: 500 });
  }
}
