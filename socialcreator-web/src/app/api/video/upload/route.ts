import { NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";
import { z } from "zod";
import { withApiMiddleware } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";

const uploadSchema = z.object({
  profileId: z.string(),
  videoUrl: z.string().url(),
});

const utapi = new UTApi();

export const POST = withApiMiddleware(async ({ userId, request }) => {
  const body = await request.json();
  const validationResult = uploadSchema.safeParse(body);

  if (!validationResult.success) {
    return NextResponse.json({ error: validationResult.error.errors[0].message }, { status: 400 });
  }

  const { profileId, videoUrl } = validationResult.data;

  // Verify profile ownership
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
  });

  if (!profile || profile.userId !== userId) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Upload video from URL via UploadThing
  const uploadResult = await utapi.uploadFilesFromUrl(videoUrl);

  // Get the file result
  const fileResult = Array.isArray(uploadResult) ? uploadResult[0] : uploadResult;

  // Create video asset in database
  const videoAsset = await prisma.videoAsset.create({
    data: {
      profileId,
      uploadUrl: fileResult.url,
      status: "UPLOADED",
    },
  });

  return NextResponse.json({
    uploadUrl: fileResult.url,
    videoAssetId: videoAsset.id,
  });
});

// Force dynamic rendering
export const dynamic = "force-dynamic";
