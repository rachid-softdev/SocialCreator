/**
 * Threads publisher via Meta Graph API
 */

import type { PublishResult } from "./index";

export async function publishToThreads(
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
    const response = await fetch(`https://graph.facebook.com/v18.0/${account.accountId}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: content.textContent.slice(0, 500),
        access_token: account.accessToken,
      }),
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
