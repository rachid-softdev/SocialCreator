/**
 * LinkedIn publisher via LinkedIn REST API (/rest/posts)
 *
 * Uses the new `/rest/posts` endpoint as the deprecated `/v2/ugcPosts` endpoint
 * has been removed.
 */

import { fetchWithTimeout } from "@/lib/fetch-timeout";
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
      commentary: `${content.textContent}\n\n${content.hashtags.map((t) => `#${t}`).join(" ")}`,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };

    const response = await fetchWithTimeout("https://api.linkedin.com/rest/posts", {
      method: "POST",
      timeout: 15000,
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "Content-Type": "application/json",
        "LinkedIn-Version": "202402",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(postData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${response.status}`);
    }

    return { success: true, postId: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
