/**
 * Threads publisher via Meta Graph API
 *
 * TODO: Add media support (currently text-only).
 * Meta Threads API supports media containers via `/me/threads_media` endpoint.
 */

import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { EXTERNAL_TIMEOUTS } from "@/lib/infrastructure/timeouts";
import type { PublishInput, PublishOptions, PublishResult } from "./types";

export async function publishToThreads(
  input: PublishInput,
  options: PublishOptions,
): Promise<PublishResult> {
  const { textContent } = input;
  const { accountId, accessToken } = options;
  try {
    const response = await fetchWithTimeout(
      `https://graph.facebook.com/v18.0/${accountId}/threads`,
      {
        method: "POST",
        timeout: EXTERNAL_TIMEOUTS.PUBLISH_PLATFORM,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: textContent.slice(0, 500),
        }),
      },
    );
    const data = await response.json();
    if (data.error) {
      if (data.error.code === 190) {
        throw new Error("Access token expired. Please reconnect your Threads account.");
      }
      throw new Error(`Threads API error: ${response.status}`);
    }

    return { success: true, postId: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
