/**
 * X (Twitter) publisher via Twitter API v2
 */

import type { PublishResult } from "./index";

export async function publishToX(
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
    const tweet: Record<string, unknown> = {
      text: content.textContent.slice(0, 280),
    };

    if (content.mediaUrls.length > 0) {
      // Upload media first via v1.1 media upload
      const mediaResponse = await fetch("https://upload.twitter.com/1.1/media/upload.json", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `media_url=${encodeURIComponent(content.mediaUrls[0])}`,
      });
      const mediaData = await mediaResponse.json();
      if (mediaData.media_id_string) {
        tweet["media"] = { media_ids: [mediaData.media_id_string] };
      }
    }

    const response = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tweet),
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    return {
      success: true,
      postId: data.id,
      postUrl: data.id ? `https://twitter.com/i/status/${data.id}` : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
