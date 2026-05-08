/**
 * Pinterest publisher via Pinterest API v5
 */

import { PublishResult } from "./index";

export async function publishToPinterest(
  content: {
    textContent: string;
    mediaUrls: string[];
    hashtags: string[];
  },
  account: {
    accountId: string;
    accessToken: string;
  }
): Promise<PublishResult> {
  try {
    if (content.mediaUrls.length > 0) {
      // Create pin with image
      const response = await fetch("https://api.pinterest.com/v5/pins", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          board_id: account.accountId,
          link: content.mediaUrls[0],
          title: content.textContent.slice(0, 100),
          description: content.textContent,
        }),
      });
      const data = await response.json();
      if (data.error || data.message) {
        throw new Error(data.message || data.error);
      }

      return { success: true, postId: data.id };
    } else {
      // Pinterest requires an image
      return {
        success: false,
        error: "Pinterest requires an image for publishing",
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
