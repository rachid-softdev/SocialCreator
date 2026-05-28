import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getApiKeyPrefix, hashApiKey } from "@/app/api/mcp/auth";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
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
    const { name, expiresInDays } = body as { name: string; expiresInDays?: number };

    if (!name || typeof name !== "string" || name.length < 1 || name.length > 100) {
      return NextResponse.json(
        { error: "Name is required and must be between 1-100 characters" },
        { status: 400 },
      );
    }

    if (
      expiresInDays !== undefined &&
      (typeof expiresInDays !== "number" || expiresInDays < 1 || expiresInDays > 365)
    ) {
      return NextResponse.json(
        { error: "expiresInDays must be between 1 and 365" },
        { status: 400 },
      );
    }

    // Generate API key
    const rawKey = `sk_${crypto.randomBytes(32).toString("hex")}`;
    const keyHash = hashApiKey(rawKey);
    const prefix = getApiKeyPrefix(rawKey);

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: session.user.id,
        name,
        keyHash,
        prefix,
        expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : undefined,
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        expiresAt: true,
      },
    });

    // Return the full key only once
    return NextResponse.json({
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      expiresAt: apiKey.expiresAt,
      apiKey: rawKey, // Only visible now
    });
  } catch (error) {
    logger.error({ err: error }, "API key creation error");
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
}
