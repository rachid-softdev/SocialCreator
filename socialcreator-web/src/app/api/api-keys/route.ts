import crypto from "crypto";
import { NextResponse } from "next/server";
import { getApiKeyPrefix, hashApiKey } from "@/app/api/mcp/auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKeys = await prisma.apiKey.findMany({
    where: {
      userId: session.user.id,
    },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsed: true,
      createdAt: true,
      revokedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ keys: apiKeys });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name } = body as { name: string };

    if (!name || typeof name !== "string" || name.length < 1 || name.length > 100) {
      return NextResponse.json(
        { error: "Name is required and must be between 1-100 characters" },
        { status: 400 },
      );
    }

    // Generate API key
    const rawKey = "sk_" + crypto.randomBytes(32).toString("hex");
    const keyHash = hashApiKey(rawKey);
    const prefix = getApiKeyPrefix(rawKey);

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: session.user.id,
        name,
        keyHash,
        prefix,
      },
      select: {
        id: true,
        name: true,
        prefix: true,
      },
    });

    // Return the full key only once
    return NextResponse.json({
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      apiKey: rawKey, // Only visible now
    });
  } catch (error) {
    console.error("API key creation error:", error);
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
}
