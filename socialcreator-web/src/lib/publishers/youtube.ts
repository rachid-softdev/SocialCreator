/**
 * YouTube publisher via YouTube Data API v3 + Resumable Upload
 * Supports uploading videos and creating Shorts
 *
 * Required scopes: youtube.upload, youtube.force-ssl
 */

import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { EXTERNAL_TIMEOUTS } from "@/lib/infrastructure/timeouts";
import logger from "@/lib/logger";
import { validateMediaUrl } from "@/lib/validate-url";
import type { PublishInput, PublishOptions, PublishResult } from "./types";

const YOUTUBE_UPLOAD_URL = "https://upload.youtube.com/upload/gateway";
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

interface YouTubeUploadOptions {
  videoUrl: string;
  title: string;
  description: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus?: "public" | "private" | "unlisted";
  isShort?: boolean;
}

/**
 * Publish content to YouTube
 * Note: Requires video content - YouTube doesn't support text-only posts
 */
export async function publishToYouTube(
  input: PublishInput,
  options: PublishOptions,
  uploadOptions: Partial<YouTubeUploadOptions> = {},
): Promise<PublishResult> {
  const { textContent, mediaUrls, hashtags } = input;
  const { accessToken } = options;
  // YouTube requires video content
  if (mediaUrls.length === 0) {
    return {
      success: false,
      error: "YouTube requires video content. No media URLs provided.",
    };
  }

  const maxRetries = 3;
  const baseDelay = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const videoTitle = (textContent.slice(0, 100) || "Untitled Video").trim();
      const description = `${textContent}\n\n${hashtags.map((t) => `#${t}`).join(" ")}`;
      const tags = hashtags.slice(0, 15);

      // Step 1: Initiate resumable upload
      const initResponse = await fetchWithTimeout(
        `${YOUTUBE_UPLOAD_URL}?uploadType=resumable&part=snippet,status`,
        {
          method: "POST",
          timeout: EXTERNAL_TIMEOUTS.PUBLISH_PLATFORM,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "X-Upload-Content-Length": "0", // Will be updated
            "X-Upload-Content-Type": "video/mp4",
          },
          body: JSON.stringify({
            snippet: {
              title: videoTitle,
              description: description,
              tags: tags,
              categoryId: uploadOptions.categoryId || "22", // People & Blogs
            },
            status: {
              privacyStatus: uploadOptions.privacyStatus || "public",
              selfDeclaredMadeForKids: false,
            },
          }),
        },
      );

      if (!initResponse.ok) {
        const errorData = await initResponse.json();
        if (errorData.error?.code === 401 || errorData.error?.code === 403) {
          throw new Error("YouTube authentication expired. Please reconnect your account.");
        }
        if (
          errorData.error?.code === 400 &&
          errorData.error?.errors?.[0]?.reason === "quotaExceeded"
        ) {
          throw new Error("YouTube upload quota exceeded. Please try again later.");
        }
        throw new Error(`YouTube API error: ${initResponse.status}`);
      }

      // Get the upload URL from Location header
      const uploadUrl = initResponse.headers.get("Location");
      if (!uploadUrl) {
        throw new Error("No upload URL returned from YouTube");
      }

      // Step 2: Upload the video file
      // Note: In production, you'd implement chunked upload for large files
      // For this implementation, we'll do a simple upload
      const mediaUrl = mediaUrls[0];
      const urlValidation = validateMediaUrl(mediaUrl);
      if (!urlValidation.valid) {
        throw new Error(`Invalid video URL: ${urlValidation.error}`);
      }
      const videoResponse = await fetchWithTimeout(mediaUrl, {
        timeout: EXTERNAL_TIMEOUTS.PUBLISH_PLATFORM,
      });
      if (!videoResponse.ok) {
        throw new Error(`Failed to fetch video: ${videoResponse.status}`);
      }

      const videoBlob = await videoResponse.blob();

      // Upload to YouTube
      const uploadResponse = await fetchWithTimeout(uploadUrl, {
        method: "PUT",
        timeout: EXTERNAL_TIMEOUTS.PUBLISH_PLATFORM,
        headers: {
          "Content-Length": videoBlob.size.toString(),
          "Content-Type": "video/mp4",
        },
        body: videoBlob,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        if (errorData.error?.code === 401 || errorData.error?.code === 403) {
          throw new Error("YouTube authentication expired. Please reconnect your account.");
        }
        throw new Error(`YouTube upload error: ${uploadResponse.status}`);
      }

      const videoData = await uploadResponse.json();

      return {
        success: true,
        postId: videoData.id,
        postUrl: `https://youtu.be/${videoData.id}`,
      };
    } catch (error) {
      logger.error({ err: error, attempt, platform: "youtube" }, "Upload attempt failed");

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
        error: error instanceof Error ? error.message : "Unknown YouTube upload error",
      };
    }
  }

  return {
    success: false,
    error: "YouTube upload failed after multiple attempts",
  };
}

/**
 * Create a YouTube Community Post (text-only)
 * Note: Requires channel account and additional API setup
 */
export async function postToYouTubeCommunity(
  _content: {
    textContent: string;
    mediaUrls?: string[];
  },
  _account: {
    accountId: string;
    accessToken: string;
  },
): Promise<PublishResult> {
  // YouTube Community posts require a different API
  // This is a stub - would need to use YouTube Partner API
  return {
    success: false,
    error: "Community posts require additional YouTube API setup. Use video upload instead.",
  };
}

/**
 * Get video details from YouTube
 */
export async function getYouTubeVideoDetails(
  videoId: string,
  accessToken: string,
): Promise<{
  id: string;
  title: string;
  status: string;
  privacyStatus: string;
} | null> {
  try {
    const response = await fetchWithTimeout(
      `${YOUTUBE_API_BASE}/videos?part=snippet,status&id=${videoId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: EXTERNAL_TIMEOUTS.PUBLISH_PLATFORM,
      },
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.items || data.items.length === 0) return null;

    const video = data.items[0];
    return {
      id: video.id,
      title: video.snippet.title,
      status: video.status.uploadStatus,
      privacyStatus: video.status.privacyStatus,
    };
  } catch {
    return null;
  }
}
