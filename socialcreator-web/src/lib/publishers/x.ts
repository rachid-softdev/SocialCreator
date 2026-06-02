/**
 * X (Twitter) publisher via Twitter API v2
 *
 * TODO: Add media upload support (currently text-only).
 * Media upload requires Twitter API v1.1 media/upload endpoint with multipart/form-data.
 */

import { fetchWithTimeout } from "@/lib/fetch-timeout";
import logger from "@/lib/logger";
import type { PublishInput, PublishOptions, PublishResult } from "./types";

export async function publishToX(
  input: PublishInput,
  options: PublishOptions,
): Promise<PublishResult> {
  const { textContent, mediaUrls } = input;
  const { accessToken } = options;
  try {
    // Media upload via X API v1.1 requires multipart/form-data.
    // Skipping media upload for now; posting text-only tweet.
    if (mediaUrls.length > 0) {
      logger.warn(
        "[X Publisher] Media upload not supported in current implementation. Posting text-only tweet.",
      );
    }

    const tweet: Record<string, unknown> = {
      text: textContent.slice(0, 280),
    };

    const response = await fetchWithTimeout("https://api.twitter.com/2/tweets", {
      method: "POST",
      timeout: 15000, // X API: 15s timeout
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tweet),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage =
        data.detail || data.title || data.errors?.[0]?.message || `X API error: ${response.status}`;
      throw new Error(errorMessage);
    }

    // X API v2 returns { data: { id: string } } on success
    if (!data.data?.id) {
      throw new Error("Unexpected response format from X API");
    }

    return {
      success: true,
      postId: data.data.id,
      postUrl: `https://twitter.com/i/status/${data.data.id}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
