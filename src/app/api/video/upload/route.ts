import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UTApi } from "uploadthing/server";
import { z } from "zod";

const uploadSchema = z.object({
  profileId: z.string(),
});

const utapi = new UTApi();

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = uploadSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0].message },
        { status: 400 }
      );
    }

    const { profileId } = validationResult.data;

    // Verify profile ownership
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
    });

    if (!profile || profile.userId !== session.user.id) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Generate upload URL via UploadThing
    const uploadResult = await utapi.uploadFilesFromRequest(request);
    
    // For multipart uploads, get the first file result
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
  } catch (error) {
    console.error("Error uploading video:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
