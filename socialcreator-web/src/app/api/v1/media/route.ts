/**
 * API v1 /media route
 * Uses repository pattern instead of direct Prisma calls
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, notFound } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { validateRequestUrls } from "@/lib/middleware/ssrf-middleware";
import { getRepositories } from "@/lib/repositories";

const createMediaSchema = z.object({
  profileId: z.string().min(1),
  type: z.enum(["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"]),
  url: z.string().url(),
  filename: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration: z.number().positive().optional(),
});

// GET /api/v1/media?profileId=xxx&type=IMAGE
export const GET = withApiMiddleware(async ({ userId, request }) => {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profileId");
  const type = searchParams.get("type") as any;

  if (!profileId) {
    return badRequest("profileId is required");
  }

  // Verify profile ownership
  const { profile: profileRepo } = getRepositories();
  const profile = await profileRepo.findById(profileId);
  if (!profile || profile.userId !== userId) {
    return notFound("Profile");
  }

  const { mediaAsset: mediaRepo } = getRepositories();
  const assets = await mediaRepo.findByProfileId(profileId, type || undefined);

  return NextResponse.json(
    { assets },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});

// POST /api/v1/media
export const POST = withApiMiddleware(async ({ userId, request }) => {
  const body = await request.json();

  // SSRF validation
  const ssrfError = await validateRequestUrls(body);
  if (ssrfError) return ssrfError;

  const validationResult = createMediaSchema.safeParse(body);
  if (!validationResult.success) {
    return badRequest(validationResult.error.errors[0].message);
  }

  const { profile: profileRepo } = getRepositories();
  const profile = await profileRepo.findById(validationResult.data.profileId);
  if (!profile || profile.userId !== userId) {
    return notFound("Profile");
  }

  const { mediaAsset: mediaRepo } = getRepositories();
  const asset = await mediaRepo.create({
    profileId: validationResult.data.profileId,
    type: validationResult.data.type,
    url: validationResult.data.url,
    filename: validationResult.data.filename,
    mimeType: validationResult.data.mimeType,
    size: validationResult.data.size,
    width: validationResult.data.width,
    height: validationResult.data.height,
    duration: validationResult.data.duration,
  });

  return NextResponse.json(
    { asset },
    {
      status: 201,
      headers: { "X-API-Version": "v1" },
    },
  );
});
