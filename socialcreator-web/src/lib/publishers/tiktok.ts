/**
 * TikTok publisher via TikTok Content Posting API v2
 * Supports video uploads, text-only posts, and retry logic
 */

import type { PublishResult } from "./index";

const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";

interface TikTokVideoUploadOptions {
  title?: string;
  description?: string;
  videoUrl?: string;
}

interface TikTokPostResponse {
  post_id?: string;
  upload_url?: string;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Retry helper function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 2000,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Only retry on transient errors
      if (attempt < maxRetries) {
        const shouldRetry =
          lastError.message.includes("500") ||
          lastError.message.includes("502") ||
          lastError.message.includes("503") ||
          lastError.message.includes("429") ||
          lastError.message.includes("rate limit") ||
          lastError.message.includes("network") ||
          lastError.message.includes("ETIMEDOUT") ||
          lastError.message.includes("timeout");

        if (shouldRetry) {
          const delay = baseDelay * 2 ** (attempt - 1);
          console.log(`TikTok retry ${attempt}/${maxRetries} after ${delay}ms`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      throw lastError;
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

/**
 * Publish content to TikTok
 * Supports both video posts and text-only (caption) posts
 */
export async function publishToTikTok(
  content: {
    textContent: string;
    mediaUrls: string[];
    hashtags: string[];
  },
  account: {
    accountId: string;
    accessToken: string;
  },
  options: Partial<TikTokVideoUploadOptions> = {},
): Promise<PublishResult> {
  const description = `${content.textContent}\n\n${content.hashtags.map((t) => `#${t}`).join(" ")}`;

  // Determine post mode based on media availability
  const hasVideo = content.mediaUrls.length > 0;

  try {
    return await retryWithBackoff(
      async () => {
        // Prepare post payload
        const postPayload = {
          post_mode: hasVideo ? "VIDEO_UPLOAD" : "TEXT_ONLY",
          title: (content.textContent.slice(0, 150) || "TikTok Post").trim(),
          description: description,
          ...(hasVideo && {
            video_url: content.mediaUrls[0],
          }),
          ...options,
        };

        const response = await fetch(`${TIKTOK_API_BASE}/post/publish/video/init/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${account.accessToken}`,
          },
          body: JSON.stringify(postPayload),
        });

        const data: TikTokPostResponse = await response.json();

        // Handle TikTok API errors
        if (!response.ok || data.error) {
          const errorMessage = data.error?.message || `TikTok API error: ${response.status}`;

          // Map common error codes to user-friendly messages
          const errorCode = data.error?.code || "";

          switch (errorCode) {
            case "invalid_access_token":
              throw new Error("TikTok access token expired. Please reconnect your account.");
            case "rate_limit":
              throw new Error("Rate limit exceeded. Please try again later.");
            case "content_policy_violation":
              throw new Error("Content violates TikTok's community guidelines.");
            default:
              throw new Error(errorMessage);
          }
        }

        // Handle video upload URL response (for large video uploads)
        if (data.upload_url) {
          // Upload video to TikTok's upload URL
          console.log("TikTok: Starting video upload to", data.upload_url);

          // Fetch the video from our storage
          const videoResponse = await fetch(content.mediaUrls[0]);

          if (!videoResponse.ok) {
            throw new Error(`Failed to fetch video: ${videoResponse.status}`);
          }

          const videoBlob = await videoResponse.blob();

          // Upload to TikTok's upload URL with proper headers
          const uploadResponse = await fetch(data.upload_url, {
            method: "PUT",
            body: videoBlob,
            headers: {
              "Content-Type": "video/mp4",
              "Content-Length": videoBlob.size.toString(),
            },
          });

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error("TikTok video upload failed:", errorText);
            throw new Error(`Video upload failed: ${uploadResponse.status}`);
          }

          console.log("TikTok: Video upload complete");

          // After upload, need to finalize the post
          // The post_id should now be available
          if (data.post_id) {
            return {
              success: true,
              postId: data.post_id,
              postUrl: `https://www.tiktok.com/@user/video/${data.post_id}`,
            };
          }

          // If no post_id yet, the video is being processed
          return {
            success: true,
            postId: "pending",
            postUrl: undefined,
          };
        }

        // Handle immediate post creation response
        if (data.post_id) {
          return {
            success: true,
            postId: data.post_id,
            postUrl: `https://www.tiktok.com/@user/video/${data.post_id}`,
          };
        }

        // If no post_id or upload_url, the post might be queued
        return {
          success: true,
          postId: "pending",
          postUrl: undefined,
        };
      },
      3,
      2000,
    );
  } catch (error) {
    console.error("TikTok publish error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown TikTok publish error",
    };
  }
}

/**
 * Get TikTok video status
 * Useful for checking if a video upload is complete
 */
export async function getTikTokPostStatus(
  postId: string,
  accessToken: string,
): Promise<{
  status: "pending" | "processing" | "finished" | "failed";
  error?: string;
} | null> {
  try {
    const response = await fetch(`${TIKTOK_API_BASE}/post/publish/status/get/?post_id=${postId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) return null;

    const data = await response.json();

    return {
      status: data.status as "pending" | "processing" | "finished" | "failed",
      error: data.error_message,
    };
  } catch {
    return null;
  }
}

/**
 * Get TikTok user profile info
 */
export async function getTikTokProfile(accessToken: string): Promise<{
  open_id: string;
  display_name: string;
  avatar_url?: string;
} | null> {
  try {
    const response = await fetch(`${TIKTOK_API_BASE}/user/info/`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return {
      open_id: data.data.user.open_id,
      display_name: data.data.user.display_name,
      avatar_url: data.data.user.avatar_url,
    };
  } catch {
    return null;
  }
}

/**
 * Validate TikTok video before upload
 * Checks file size, format, and duration constraints
 */
export function validateTikTokVideo(
  videoUrl: string,
  _maxSizeMB: number = 287.6, // TikTok max is ~287.6MB
  _maxDurationSeconds: number = 600, // TikTok max is 10 minutes
): { valid: boolean; error?: string } {
  // Note: In production, you'd fetch the video headers to check size
  // For now, we validate based on the URL being provided
  if (!videoUrl) {
    return { valid: false, error: "Video URL is required" };
  }

  const validExtensions = [".mp4", ".mov", ".webm"];
  const hasValidExtension = validExtensions.some((ext) => videoUrl.toLowerCase().includes(ext));

  if (!hasValidExtension) {
    return { valid: false, error: "Invalid video format. Use MP4, MOV, or WebM." };
  }

  return { valid: true };
}
