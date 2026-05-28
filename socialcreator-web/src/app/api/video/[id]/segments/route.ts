import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateContent } from "@/lib/llm";
import { prisma } from "@/lib/prisma";

const SEGMENT_PROMPT = `Voici le transcript d'une vidéo.
Identifie 3 à 5 segments de 30-90 secondes qui constituent les moments les plus impactants pour les réseaux sociaux.
Chaque segment doit avoir un "hook" fort — un moment où l'attention du viewer est captée.
Réponds EXACTEMENT en JSON avec ce format:
[
  { "start": number, "end": number, "reason": "pourquoi ce segment est impactant", "hook": "le hook des premières secondes" }
]
Ne réponds que le JSON, rien d'autre.`;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get video asset
    const videoAsset = await prisma.videoAsset.findUnique({
      where: { id },
    });

    if (!videoAsset) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Verify ownership through profile
    const profile = await prisma.profile.findFirst({
      where: { id: videoAsset.profileId, userId: session.user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!videoAsset.transcript) {
      return NextResponse.json(
        { error: "Transcript not available. Run transcription first." },
        { status: 400 },
      );
    }

    // Identify segments via Claude
    const result = await generateContent(
      "Tu es un expert en création de contenu viral pour les réseaux sociaux.",
      `${SEGMENT_PROMPT}\n\nTranscript:\n${videoAsset.transcript}`,
    );

    // Parse segments from the response (which is in textContent as JSON)
    let segments: Array<{
      start: number;
      end: number;
      reason: string;
      hook: string;
    }> = [];

    try {
      // The response should be an array in textContent
      const parsed = JSON.parse(result.textContent);
      if (Array.isArray(parsed)) {
        segments = parsed;
      }
    } catch (parseError) {
      console.error("Failed to parse segments:", parseError);
      return NextResponse.json(
        { error: "Failed to parse segments from AI response" },
        { status: 500 },
      );
    }

    // Update asset with segments
    await prisma.videoAsset.update({
      where: { id },
      data: {
        segments: segments as any,
        status: "SEGMENTS_IDENTIFIED",
      },
    });

    return NextResponse.json({ segments });
  } catch (error) {
    console.error("Error identifying segments:", error);
    return NextResponse.json({ error: "Segment identification failed" }, { status: 500 });
  }
}

// Force dynamic rendering
export const dynamic = "force-dynamic";
