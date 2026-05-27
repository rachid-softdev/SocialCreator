import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export interface McpAuthResult {
  userId: string;
  apiKeyId: string;
}

/**
 * Authenticates MCP request using Bearer token
 * Token is SHA-256 hash of the API key
 */
export async function authenticateMcpRequest(): Promise<McpAuthResult | null> {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  if (!token) {
    return null;
  }

  // Try to find the API key by hash
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      keyHash: token,
      revokedAt: null,
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!apiKey) {
    return null;
  }

  // Update lastUsed timestamp
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsed: new Date() },
  });

  return {
    userId: apiKey.userId,
    apiKeyId: apiKey.id,
  };
}

/**
 * Hash API key using SHA-256
 */
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Generate preview prefix for API key display
 */
export function getApiKeyPrefix(key: string): string {
  return key.slice(0, 8) + "...";
}
