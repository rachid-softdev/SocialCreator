/**
 * Facebook publisher via Meta Graph API
 */

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
    const message = `${content.textContent}\n\n${content.hashtags.map((t) => "#" + t).join(" ")}`;
    const body: Record<string, string> = {
      message,
      access_token: account.accessToken,
    };

    if (content.mediaUrls.length > 0) {
      body["link"] = content.mediaUrls[0];
    }

    const response = await fetch(`https://graph.facebook.com/v18.0/${account.accountId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    return { success: true, postId: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
