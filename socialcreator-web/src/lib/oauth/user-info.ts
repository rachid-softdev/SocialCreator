/**
 * OAuth user info - retrieves user profile information from each platform
 */

import { fetchWithTimeout } from "@/lib/fetch-timeout";
import type { OAuthProvider } from "./providers";

export interface UserInfo {
  accountId: string;
  accountName: string;
  accountAvatarUrl: string | null;
}

/**
 * Get user info from a platform using an access token
 * Each platform has its own API endpoint and response format
 */
export async function getUserInfo(platform: OAuthProvider, accessToken: string): Promise<UserInfo> {
  const userInfoUrl = getUserInfoUrl(platform);
  const headers = getUserInfoHeaders(platform, accessToken);

  const response = await fetchWithTimeout(userInfoUrl, {
    headers,
    timeout: 8000, // User info: 8s timeout
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get user info from ${platform}: ${error}`);
  }

  const data = await response.json();
  return normalizeUserInfo(platform, data);
}

/**
 * Get the user info URL for a platform
 */
function getUserInfoUrl(platform: OAuthProvider): string {
  const urls: Record<OAuthProvider, string> = {
    INSTAGRAM: "https://graph.facebook.com/v18.0/me?fields=id,name,picture",
    TIKTOK: "https://open.tiktokapis.com/v2/user/info/",
    LINKEDIN: "https://api.linkedin.com/v2/userinfo",
    X: "https://api.twitter.com/2/users/me?user.fields=id,name,profile_image_url",
    YOUTUBE: "https://www.googleapis.com/youtube/v3/channels?mine=true&part=snippet",
    FACEBOOK: "https://graph.facebook.com/v18.0/me?fields=id,name,picture",
    PINTEREST: "https://api.pinterest.com/v5/user_account",
    THREADS: "https://graph.facebook.com/v18.0/me",
  };
  return urls[platform];
}

/**
 * Get the headers for user info request
 */
function getUserInfoHeaders(platform: OAuthProvider, accessToken: string): HeadersInit {
  // Most platforms use Bearer token in Authorization header
  const headers: HeadersInit = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };

  // Some platforms use different header formats
  if (platform === "LINKEDIN") {
    // LinkedIn uses Bearer token
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (platform === "TIKTOK") {
    // TikTok uses Bearer token
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (platform === "X") {
    // X uses Bearer token
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (platform === "PINTEREST") {
    // Pinterest uses Bearer token
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

/**
 * Normalize user info from different platform responses
 */
function normalizeUserInfo(platform: OAuthProvider, data: any): UserInfo {
  switch (platform) {
    case "INSTAGRAM":
    case "FACEBOOK":
      return {
        accountId: data.id,
        accountName: data.name,
        accountAvatarUrl: data.picture?.data?.url || data.picture || null,
      };

    case "TIKTOK":
      return {
        accountId: data.data?.user?.open_id || data.data?.user?.id,
        accountName: data.data?.user?.display_name || data.data?.user?.name,
        accountAvatarUrl: data.data?.user?.avatar_url || null,
      };

    case "LINKEDIN":
      return {
        accountId: data.sub,
        accountName: data.name,
        accountAvatarUrl: null,
      };

    case "X":
      return {
        accountId: data.data?.id,
        accountName: data.data?.name,
        accountAvatarUrl: data.data?.profile_image_url || null,
      };

    case "YOUTUBE": {
      const channel = data.items?.[0];
      return {
        accountId: channel?.id,
        accountName: channel?.snippet?.title,
        accountAvatarUrl: channel?.snippet?.thumbnails?.default?.url || null,
      };
    }

    case "PINTEREST":
      return {
        accountId: data.user?.id || data.id,
        accountName: `${data.user?.first_name} ${data.user?.last_name}` || data.user?.username,
        accountAvatarUrl: data.user?.profile_image || null,
      };

    case "THREADS":
      return {
        accountId: data.id,
        accountName: data.name || data.username,
        accountAvatarUrl: null,
      };

    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

/**
 * Get the Instagram account ID from Facebook token
 * Instagram requires fetching the Instagram business account linked to the Facebook page
 */
export async function getInstagramAccountId(accessToken: string): Promise<string | null> {
  try {
    // First get the user's Facebook pages
    const pagesResponse = await fetchWithTimeout(
      "https://graph.facebook.com/v18.0/me/accounts?fields=instagram_business_account",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 8000,
      },
    );

    if (!pagesResponse.ok) {
      return null;
    }

    const pagesData = await pagesResponse.json();
    const page = pagesData.data?.[0];

    if (!page?.instagram_business_account) {
      return null;
    }

    return page.instagram_business_account.id;
  } catch {
    return null;
  }
}
