import Mux from "@mux/mux-node";

// Lazy initialization to prevent build-time errors
function getMuxClient() {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) {
    throw new Error("MUX_TOKEN_ID or MUX_TOKEN_SECRET is not configured");
  }
  return new Mux({ tokenId, tokenSecret });
}

export interface MuxClipResult {
  assetId: string;
  playbackId: string;
}

export interface MuxAssetResult {
  status: string;
  playbackId?: string;
  duration?: number;
}

export async function createMuxClip(
  inputUrl: string,
  startTime: number,
  endTime: number
): Promise<MuxClipResult> {
  const mux = getMuxClient();
  const asset = await mux.video.assets.create({
    input: [
      {
        url: inputUrl,
        start_time: startTime,
        end_time: endTime,
      },
    ],
    playback_policy: ["public"],
    mp4_support: "capped-1080p",
  });

  const playbackId = asset.playback_ids?.[0]?.id;
  if (!playbackId) throw new Error("No playback ID returned from Mux");

  return { assetId: asset.id!, playbackId };
}

export async function getMuxAsset(assetId: string): Promise<MuxAssetResult> {
  const mux = getMuxClient();
  const asset = await mux.video.assets.retrieve(assetId);
  return {
    status: asset.status,
    playbackId: asset.playback_ids?.[0]?.id,
    duration: asset.duration,
  };
}

export function getMuxStreamUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

export function getMuxThumbnailUrl(playbackId: string, time?: number): string {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg${time ? `?time=${time}` : ""}`;
}

export async function deleteMuxAsset(assetId: string): Promise<void> {
  const mux = getMuxClient();
  await mux.video.assets.delete(assetId);
}
