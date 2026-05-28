/**
 * OAuth Callback Route
 * Handles OAuth callbacks for each platform
 * GET /api/connected-accounts/callback/[platform]?code=xxx&state=yyy
 */

import type { Platform } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  exchangeCodeForToken,
  getRedirectUri,
  getUserInfo,
  type OAuthProvider,
  parseState,
} from "@/lib/oauth";
import { prisma } from "@/lib/prisma";
import { createConnectedAccount, updateConnectedAccount } from "@/lib/tokens";

interface RouteParams {
  params: Promise<{ platform: string }>;
}

/**
 * GET /api/connected-accounts/callback/[platform]
 * Handles the OAuth callback, exchanges code for tokens, creates ConnectedAccount
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { platform } = await params;
    const { searchParams } = new URL(request.url);

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Handle OAuth errors
    if (error) {
      console.error("OAuth error:", error, errorDescription);
      return NextResponse.redirect(
        new URL(
          `/profiles?error=oauth_error&message=${encodeURIComponent(errorDescription || error)}`,
        ),
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL("/profiles?error=missing_params"));
    }

    // Parse and validate the state parameter (CSRF protection)
    const stateData = parseState(state);
    if (!stateData) {
      return NextResponse.redirect(new URL("/profiles?error=invalid_state"));
    }

    const { profileId } = stateData;
    const platformUpper = platform.toUpperCase() as Platform;

    // Verify the profile exists
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      return NextResponse.redirect(new URL("/profiles?error=profile_not_found"));
    }

    // SECURITY: Verify the authenticated user owns this profile
    // Even if the encrypted state were somehow compromised, this prevents
    // an attacker from connecting their social account to another user's profile.
    const session = await auth();
    if (!session?.user?.id || profile.userId !== session.user.id) {
      return NextResponse.redirect(new URL("/profiles?error=access_denied"));
    }

    // Get the redirect URI for this platform
    const redirectUri = getRedirectUri(platformUpper as OAuthProvider);

    // Exchange code for tokens
    let tokenResponse;
    try {
      tokenResponse = await exchangeCodeForToken(
        platformUpper as OAuthProvider,
        code,
        redirectUri,
        state,
      );
    } catch (tokenError) {
      console.error("Token exchange error:", tokenError);
      return NextResponse.redirect(
        new URL(`/profiles/${profileId}/accounts?error=token_exchange_failed`),
      );
    }

    // Get user info from the platform
    let userInfo;
    try {
      userInfo = await getUserInfo(platformUpper as OAuthProvider, tokenResponse.access_token);
    } catch (userInfoError) {
      console.error("User info error:", userInfoError);
      // Continue with available info, use fallback values
      userInfo = {
        accountId: "unknown",
        accountName: "Unknown Account",
        accountAvatarUrl: null,
      };
    }

    // Check if account already exists (update) or create new
    const existingAccount = await prisma.connectedAccount.findUnique({
      where: {
        profileId_platform: {
          profileId,
          platform: platformUpper,
        },
      },
    });

    if (existingAccount) {
      // Update existing account with new tokens
      await updateConnectedAccount(existingAccount.id, tokenResponse, userInfo);
    } else {
      // Create new connected account
      await createConnectedAccount(profileId, platformUpper, tokenResponse, userInfo);
    }

    // Redirect to the accounts page with success
    return NextResponse.redirect(new URL(`/profiles/${profileId}/accounts?connected=success`));
  } catch (error) {
    console.error("OAuth callback error:", error);
    // Try to extract profileId from state for redirect
    try {
      const { searchParams } = new URL(request.url);
      const state = searchParams.get("state");
      if (state) {
        const stateData = parseState(state);
        if (stateData?.profileId) {
          return NextResponse.redirect(
            new URL(`/profiles/${stateData.profileId}/accounts?error=callback_failed`),
          );
        }
      }
    } catch {
      // Ignore parsing errors
    }

    return NextResponse.redirect(new URL("/profiles?error=callback_failed"));
  }
}
