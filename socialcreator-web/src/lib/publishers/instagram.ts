/**
 * Instagram publisher via Meta Graph API
 */

import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { validateMediaUrl } from "@/lib/validate-url";
import type { PublishResult } from "./index";

export async function publishToInstagram(
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
    const caption = `${content.textContent}\n\n${content.hashtags.map((t) => `#${t}`).join(" ")}`;

    if (content.mediaUrls.length > 0) {
      const urlValidation = validateMediaUrl(content.mediaUrls[0]);
      if (!urlValidation.valid) {
        return { success: false, error: `Invalid media URL: ${urlValidation.error}` };
      }

      // Upload image/video first
      const mediaResponse = await fetchWithTimeout(
        `https://graph.facebook.com/v18.0/${account.accountId}/media`,
        {
          method: "POST",
          timeout: 15000, // Meta API: 15s timeout
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${account.accessToken}`,
          },
          body: JSON.stringify({
            image_url: content.mediaUrls[0],
            caption,
          }),
        },
      );
      const mediaData = await mediaResponse.json();
      if (mediaData.error) {
        if (mediaData.error.code === 190) {
          throw new Error("Access token expired. Please reconnect your Instagram account.");
        }
        throw new Error(`Instagram API error: ${mediaResponse.status}`);
      }

      // Publish the container
      const containerResponse = await fetchWithTimeout(
        `https://graph.facebook.com/v18.0/${account.accountId}/media_publish`,
        {
          method: "POST",
          timeout: 15000,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${account.accessToken}`,
          },
          body: JSON.stringify({
            creation_id: mediaData.id,
          }),
        },
      );
      const publishData = await containerResponse.json();
      if (publishData.error) {
        if (publishData.error.code === 190) {
          throw new Error("Access token expired. Please reconnect your Instagram account.");
        }
        throw new Error(`Instagram API error: ${containerResponse.status}`);
      }

      return { success: true, postId: publishData.id };
    } else {
      // Text-only post via Pages API
      const response = await fetchWithTimeout(
        `https://graph.facebook.com/v18.0/${account.accountId}/feed`,
        {
          method: "POST",
          timeout: 15000,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${account.accessToken}`,
          },
          body: JSON.stringify({
            message: caption,
          }),
        },
      );
      const data = await response.json();
      if (data.error) {
        if (data.error.code === 190) {
          throw new Error("Access token expired. Please reconnect your Instagram account.");
        }
        throw new Error(`Instagram API error: ${response.status}`);
      }
      return { success: true, postId: data.id };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
