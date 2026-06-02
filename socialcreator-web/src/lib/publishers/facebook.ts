/**
 * Facebook publisher via Meta Graph API
 */

import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { validateMediaUrl } from "@/lib/validate-url";
import type { PublishResult } from "./index";

export async function publishToFacebook(
  content: {
    textContent: string;
    mediaUrls: string[];
    hashtags: string[];
  },
  account: {
    accountId: string;
    accessToken: string;
  },
): Promise<PublishResult> {
  try {
    const message = `${content.textContent}\n\n${content.hashtags.map((t) => `#${t}`).join(" ")}`;
    const body: Record<string, string> = {
      message,
    };

    if (content.mediaUrls.length > 0) {
      const urlValidation = validateMediaUrl(content.mediaUrls[0]);
      if (!urlValidation.valid) {
        return { success: false, error: `Invalid media URL: ${urlValidation.error}` };
      }
      body.link = content.mediaUrls[0];
    }

    const response = await fetchWithTimeout(
      `https://graph.facebook.com/v18.0/${account.accountId}/feed?access_token=${encodeURIComponent(account.accessToken)}`,
      {
        method: "POST",
        timeout: 15000,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const data = await response.json();
    if (data.error) {
      if (data.error.code === 190) {
        throw new Error("Access token expired. Please reconnect your Facebook account.");
      }
      throw new Error(`Facebook API error: ${response.status}`);
    }

    return { success: true, postId: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
