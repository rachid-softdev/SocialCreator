/**
 * Instagram publisher via Meta Graph API
 */

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
    const caption = `${content.textContent}\n\n${content.hashtags.map((t) => "#" + t).join(" ")}`;

    if (content.mediaUrls.length > 0) {
      // Upload image/video first
      const mediaResponse = await fetch(
        `https://graph.facebook.com/v18.0/${account.accountId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: content.mediaUrls[0],
            caption,
            access_token: account.accessToken,
          }),
        },
      );
      const mediaData = await mediaResponse.json();
      if (mediaData.error) throw new Error(mediaData.error.message);

      // Publish the container
      const containerResponse = await fetch(
        `https://graph.facebook.com/v18.0/${account.accountId}/media_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creation_id: mediaData.id,
            access_token: account.accessToken,
          }),
        },
      );
      const publishData = await containerResponse.json();
      if (publishData.error) throw new Error(publishData.error.message);

      return { success: true, postId: publishData.id };
    } else {
      // Text-only post via Pages API
      const response = await fetch(`https://graph.facebook.com/v18.0/${account.accountId}/feed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: caption,
          access_token: account.accessToken,
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return { success: true, postId: data.id };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
