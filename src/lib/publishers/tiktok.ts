/**
 * TikTok publisher via TikTok Content Posting API v2
 */

import { PublishResult } from "./index";

export async function publishToTikTok(
  content: {
    textContent: string;
    mediaUrls: string[];
    hashtags: string[];
  },
  account: {
    accountId: string;
    accessToken: string;
  }
): Promise<PublishResult> {
  try {
    const description = `${content.textContent}\n\n${content.hashtags.map((t) => "#" + t).join(" ")}`;

    const response = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${account.accessToken}`,
      },
      body: JSON.stringify({
        post_mode: content.mediaUrls.length > 0 ? "VIDEO_UPLOAD" : "TEXT_ONLY",
        title: content.textContent.slice(0, 150),
        description,
        video_url: content.mediaUrls[0] || undefined,
      }),
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    return {
      success: true,
      postId: data.post_id,
      postUrl: data.post_id ? `https://www.tiktok.com/@user/video/${data.post_id}` : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
