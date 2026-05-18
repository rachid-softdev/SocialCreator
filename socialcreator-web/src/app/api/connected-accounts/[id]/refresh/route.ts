/**
 * API Route: Refresh Token
 * POST /api/connected-accounts/[id]/refresh
 * Refreshes the access token for a connected account
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getValidAccessToken,
  updateAccountToken,
} from "@/lib/tokens";
import {
  refreshAccessToken,
  OAuthProvider,
} from "@/lib/oauth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/connected-accounts/[id]/refresh
 * Refreshes the access token
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify account ownership
    const account = await prisma.connectedAccount.findUnique({
      where: { id },
      include: {
        profile: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Connected account not found" },
        { status: 404 }
      );
    }

    if (account.profile.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Get the current refresh token
    const { decryptToken } = await import("@/lib/crypto");

    if (!account.refreshToken) {
      return NextResponse.json(
        { error: "No refresh token available" },
        { status: 400 }
      );
    }

    const refreshToken = decryptToken(account.refreshToken);

    // Refresh the token
    const newTokens = await refreshAccessToken(
      account.platform as OAuthProvider,
      refreshToken
    );

    // Update the account with new tokens
    await updateAccountToken(
      id,
      newTokens.access_token,
      newTokens.refresh_token,
      newTokens.expires_in
    );

    return NextResponse.json({
      success: true,
      expiresAt: newTokens.expires_in
        ? new Date(Date.now() + newTokens.expires_in * 1000).toISOString()
        : null,
    });
  } catch (error) {
    console.error("Error refreshing token:", error);
    return NextResponse.json(
      { error: "Failed to refresh token" },
      { status: 500 }
    );
  }
}