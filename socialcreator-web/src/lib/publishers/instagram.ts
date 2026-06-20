/**
 * Instagram publisher via Meta Graph API
 */

import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { EXTERNAL_TIMEOUTS } from "@/lib/infrastructure/timeouts";
import { validateMediaUrl } from "@/lib/validate-url";
import type { PublishInput, PublishOptions, PublishResult } from "./types";

export async function publishToInstagram(
  input: PublishInput,
  options: PublishOptions,
): Promise<PublishResult> {
  const { textContent, mediaUrls, hashtags } = input;
  const { accountId, accessToken } = options;
  try {
    const caption = `${textContent}\n\n${hashtags.map((t) => `#${t}`).join(" ")}`;

    if (mediaUrls.length > 0) {
      const urlValidation = validateMediaUrl(mediaUrls[0]);
      if (!urlValidation.valid) {
        return { success: false, error: `Invalid media URL: ${urlValidation.error}` };
      }

      // Upload image/video first
      const mediaResponse = await fetchWithTimeout(
        `https://graph.facebook.com/v18.0/${accountId}/media`,
        {
          method: "POST",
          timeout: EXTERNAL_TIMEOUTS.PUBLISH_PLATFORM,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            image_url: mediaUrls[0],
            caption,
          }),
        },
      );
      const mediaData = await mediaResponse.json();
      if (mediaData.error) {
        if (mediaData.error.code === 190) {
          throw new Error("Access token expired. Please reconnect your Instagram account.");
        }
        throw new Error("Instagram API returned an error. Please check your media and try again.");
      }

      // Publish the container
      const containerResponse = await fetchWithTimeout(
        `https://graph.facebook.com/v18.0/${accountId}/media_publish`,
        {
          method: "POST",
          timeout: EXTERNAL_TIMEOUTS.PUBLISH_PLATFORM,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
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
        throw new Error("Instagram API returned an error during publish. Please try again.");
      }

      return { success: true, postId: publishData.id };
    } else {
      // Text-only post via Pages API
      const response = await fetchWithTimeout(
        `https://graph.facebook.com/v18.0/${accountId}/feed`,
        {
          method: "POST",
          timeout: EXTERNAL_TIMEOUTS.PUBLISH_PLATFORM,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
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
        throw new Error("Instagram API returned an error. Please check your post and try again.");
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
