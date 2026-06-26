/**
 * Facebook publisher via Meta Graph API
 */

import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { EXTERNAL_TIMEOUTS } from "@/lib/infrastructure/timeouts";
import { validateMediaUrl } from "@/lib/validate-url";
import type { PublishInput, PublishOptions, PublishResult } from "./types";

export async function publishToFacebook(
  input: PublishInput,
  options: PublishOptions,
): Promise<PublishResult> {
  const { textContent, mediaUrls, hashtags } = input;
  const { accountId, accessToken } = options;
  try {
    const message = `${textContent}\n\n${hashtags.map((t) => `#${t}`).join(" ")}`;
    const body: Record<string, string> = {
      message,
    };

    if (mediaUrls.length > 0) {
      const url = mediaUrls[0];
      if (!url) {
        return { success: false, error: "Invalid media URL: URL is required" };
      }
      const urlValidation = validateMediaUrl(url);
      if (!urlValidation.valid) {
        return { success: false, error: `Invalid media URL: ${urlValidation.error}` };
      }
      body.link = url;
    }

    const response = await fetchWithTimeout(`https://graph.facebook.com/v18.0/${accountId}/feed`, {
      method: "POST",
      timeout: EXTERNAL_TIMEOUTS.PUBLISH_PLATFORM,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (data.error) {
      if (data.error.code === 190) {
        throw new Error("Access token expired. Please reconnect your Facebook account.");
      }
      throw new Error("Facebook API returned an error. Please check your post and try again.");
    }

    return { success: true, postId: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
