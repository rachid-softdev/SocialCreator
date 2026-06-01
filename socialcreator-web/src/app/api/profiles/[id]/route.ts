import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { verifyProfileOwnership } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";

const updateProfileSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  brandVoice: z.string().max(500).optional(),
  contentBank: z.string().optional(),
  platforms: z
    .array(
      z.enum([
        "TIKTOK",
        "INSTAGRAM",
        "YOUTUBE",
        "FACEBOOK",
        "X",
        "LINKEDIN",
        "THREADS",
        "PINTEREST",
      ]),
    )
    .optional(),
  avatarUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const result = await verifyProfileOwnership(session.user.id, id);

    if (!result.valid) return result.error;

    return NextResponse.json({ profile: result.data });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const ownership = await verifyProfileOwnership(session.user.id, id);

    if (!ownership.valid) return ownership.error;

    const body = await request.json();
    const validationResult = updateProfileSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0].message },
        { status: 400 },
      );
    }

    const updateData = validationResult.data;

    const profile = await prisma.profile.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const ownership = await verifyProfileOwnership(session.user.id, id);

    if (!ownership.valid) return ownership.error;

    // Cascade delete - Prisma handles this via onDelete: Cascade
    // But we need to explicitly delete to trigger hooks if any
    await prisma.profile.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
