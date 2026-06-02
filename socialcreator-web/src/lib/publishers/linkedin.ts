/**
 * LinkedIn publisher via LinkedIn REST API (/rest/posts)
 *
 * Uses the new `/rest/posts` endpoint as the deprecated `/v2/ugcPosts` endpoint
 * has been removed.
 */

import { fetchWithTimeout } from "@/lib/fetch-timeout";
import type { PublishInput, PublishOptions, PublishResult } from "./types";

export async function publishToLinkedIn(
  input: PublishInput,
  options: PublishOptions,
): Promise<PublishResult> {
  const { textContent, hashtags } = input;
  const { accountId, accessToken } = options;
  try {
    const postData = {
      author: `urn:li:person:${accountId}`,
      commentary: `${textContent}\n\n${hashtags.map((t) => `#${t}`).join(" ")}`,
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
        Authorization: `Bearer ${accessToken}`,
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
