/**
 * LinkedIn publisher via LinkedIn API v2
 */

import type { PublishResult } from "./index";

export async function publishToLinkedIn(
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
    const postData = {
      author: `urn:li:person:${account.accountId}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugcShares": {
          raw: `${content.textContent}\n\n${content.hashtags.map((t) => "#" + t).join(" ")}`,
        },
      },
      visibility: { "com.linkedin.ugcShares.VisibilityMemberNetwork": "" },
    };

    const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(postData),
    });
    const data = await response.json();
    if (data.error || data.message) {
      throw new Error(data.message || data.error);
    }

    return { success: true, postId: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
