/**
 * Pinterest publisher via Pinterest API v5
 * Supports creating pins, boards, and publishing
 */

import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { EXTERNAL_TIMEOUTS } from "@/lib/infrastructure/timeouts";
import logger from "@/lib/logger";
import { validateMediaUrl } from "@/lib/validate-url";
import type { PublishInput, PublishOptions, PublishResult } from "./types";

const PINTEREST_API_BASE = "https://api.pinterest.com/v5";

interface PinterestBoard {
  id: string;
  name: string;
}

interface PinterestPinOptions {
  title?: string;
  description?: string;
  link?: string;
  mediaSource?: {
    source_type: "image_url" | "image_upload";
    url?: string;
  };
}

/**
 * Get user's boards from Pinterest
 */
export async function getPinterestBoards(accessToken: string): Promise<PinterestBoard[]> {
  try {
    const response = await fetchWithTimeout(`${PINTEREST_API_BASE}/boards`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: EXTERNAL_TIMEOUTS.PUBLISH_PLATFORM,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch boards: ${response.status}`);
    }

    const data = await response.json();
    return data.items.map((board: { id: string; name: string }) => ({
      id: board.id,
      name: board.name,
    }));
  } catch (error) {
    logger.error({ err: error, platform: "pinterest" }, "Error fetching Pinterest boards");
    return [];
  }
}

/**
 * Publish a pin to Pinterest
 * Note: Requires board_id for the account - this is different from user ID
 */
export async function publishToPinterest(
  input: PublishInput,
  options: PublishOptions,
): Promise<PublishResult> {
  const { textContent, mediaUrls, hashtags } = input;
  const { accountId, accessToken } = options;
  // Pinterest requires an image for pins
  if (mediaUrls.length === 0) {
    return {
      success: false,
      error: "Pinterest requires an image for publishing. No media URLs provided.",
    };
  }

  const maxRetries = 3;
  const baseDelay = 1500;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const title = textContent.slice(0, 100);
      const description = `${textContent}\n\n${hashtags.map((t) => `#${t}`).join(" ")}`;

      const mediaUrl = mediaUrls[0];
      if (!mediaUrl) {
        return { success: false, error: "Invalid media URL: URL is required" };
      }
      const urlValidation = validateMediaUrl(mediaUrl);
      if (!urlValidation.valid) {
        return { success: false, error: `Invalid media URL: ${urlValidation.error}` };
      }

      // Create pin payload
      const pinOptions: PinterestPinOptions = {
        title: title,
        description: description,
        link: mediaUrl, // Link to the source
        mediaSource: {
          source_type: "image_url",
          url: mediaUrl,
        },
      };

      const response = await fetchWithTimeout(`${PINTEREST_API_BASE}/pins`, {
        method: "POST",
        timeout: EXTERNAL_TIMEOUTS.PUBLISH_PLATFORM,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          board_id: accountId,
          ...pinOptions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Handle specific error cases
        if (errorData.code === 5) {
          return {
            success: false,
            error: "Invalid board ID. Please reconnect your Pinterest account.",
          };
        }

        if (errorData.code === 2) {
          return {
            success: false,
            error: "Rate limit exceeded. Please try again later.",
          };
        }

        throw new Error(`Pinterest API error: ${response.status}`);
      }

      const pinData = await response.json();

      return {
        success: true,
        postId: pinData.id,
        postUrl: `https://pin.it/${pinData.id}`,
      };
    } catch (error) {
      logger.error({ err: error, attempt, platform: "pinterest" }, "Publish attempt failed");

      // Retry on network errors or 5xx status codes
      if (attempt < maxRetries && error instanceof Error) {
        const shouldRetry =
          error.message.includes("500") ||
          error.message.includes("503") ||
          error.message.includes("network") ||
          error.message.includes("ETIMEDOUT");

        if (shouldRetry) {
          await new Promise((resolve) => setTimeout(resolve, baseDelay * attempt));
          continue;
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown Pinterest publish error",
      };
    }
  }

  return {
    success: false,
    error: "Pinterest publish failed after multiple attempts",
  };
}

/**
 * Create a new board on Pinterest
 */
export async function createPinterestBoard(
  name: string,
  description: string,
  accessToken: string,
): Promise<{ success: boolean; boardId?: string; error?: string }> {
  try {
    const response = await fetchWithTimeout(`${PINTEREST_API_BASE}/boards`, {
      method: "POST",
      timeout: EXTERNAL_TIMEOUTS.PUBLISH_PLATFORM,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name,
        description: description,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to create board (${response.status})`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      boardId: data.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get user's Pinterest profile
 */
export async function getPinterestProfile(accessToken: string): Promise<{
  id: string;
  username: string;
  full_name: string;
  boards_count: number;
} | null> {
  try {
    const response = await fetchWithTimeout(`${PINTEREST_API_BASE}/user_account`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: EXTERNAL_TIMEOUTS.PUBLISH_PLATFORM,
    });

    if (!response.ok) return null;

    const data = await response.json();
    return {
      id: data.id,
      username: data.username,
      full_name: data.full_name || data.username,
      boards_count: data.boards_count || 0,
    };
  } catch {
    return null;
  }
}
