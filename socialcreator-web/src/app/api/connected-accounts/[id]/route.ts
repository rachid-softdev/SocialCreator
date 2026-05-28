/**
 * API route: Connected Account by ID
 * GET /api/connected-accounts/[id] - Get a specific connected account
 * DELETE /api/connected-accounts/[id] - Disconnect and remove a connected account
 */

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { decryptToken } from "@/lib/crypto";
import { revokeToken } from "@/lib/oauth/revoke";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/connected-accounts/[id]
 * Returns a single connected account (tokens masked)
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const account = await prisma.connectedAccount.findUnique({
      where: { id },
      include: {
        profile: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Connected account not found" }, { status: 404 });
    }

    // Verify ownership
    if (account.profile.userId !== session.user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Return account without tokens
    return NextResponse.json({
      id: account.id,
      platform: account.platform,
      accountId: account.accountId,
      accountName: account.accountName,
      accountAvatarUrl: account.accountAvatarUrl,
      isActive: account.isActive,
      expiresAt: account.expiresAt?.toISOString() || null,
      createdAt: account.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Error fetching connected account:", error);
    return NextResponse.json({ error: "Failed to fetch connected account" }, { status: 500 });
  }
}

/**
 * DELETE /api/connected-accounts/[id]
 * Disconnects and removes a connected account
 * Optionally revokes the token on the platform
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const account = await prisma.connectedAccount.findUnique({
      where: { id },
      include: {
        profile: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Connected account not found" }, { status: 404 });
    }

    // Verify ownership
    if (account.profile.userId !== session.user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Try to revoke the token on the platform (best effort)
    // If this fails, we still delete the account from our database
    let tokenRevoked = false;
    try {
      const accessToken = decryptToken(account.accessToken);
      tokenRevoked = await revokeToken(account.platform as any, accessToken);
    } catch (error) {
      console.warn("Failed to revoke token on platform:", error);
      // Continue with deletion even if revocation fails
    }

    // Delete the connected account
    await prisma.connectedAccount.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      tokenRevoked,
    });
  } catch (error) {
    console.error("Error deleting connected account:", error);
    return NextResponse.json({ error: "Failed to delete connected account" }, { status: 500 });
  }
}
