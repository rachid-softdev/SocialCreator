/**
 * Route-level tests for DELETE /api/media/[id]
 *
 * Tests:
 * - Returns 401 when unauthenticated
 * - Returns 404 when resource doesn't exist
 * - Returns 404 when resource belongs to another user
 * - Returns success when authorized
 * - Handles invalid ID gracefully
 */

import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/ownership", () => ({
  verifyMediaAssetOwnership: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    mediaAsset: {
      delete: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { auth } from "@/lib/auth";
import { verifyMediaAssetOwnership } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";
import { DELETE } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/media/test-id", { method: "DELETE" });
}

function createParams(id: string = "test-id") {
  return { params: Promise.resolve({ id }) };
}

const mockMediaAsset = {
  id: "test-id",
  profileId: "profile-abc-123",
  url: "https://example.com/media.jpg",
  mimeType: "image/jpeg",
  fileSize: 2048,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

// ---------------------------------------------------------------------------
// DELETE /api/media/[id]
// ---------------------------------------------------------------------------

describe("DELETE /api/media/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-abc-123" },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await DELETE(createRequest(), createParams());
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
    expect(verifyMediaAssetOwnership).not.toHaveBeenCalled();
    expect(prisma.mediaAsset.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when media asset does not exist", async () => {
    (verifyMediaAssetOwnership as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: false,
      error: NextResponse.json(
        { error: "Media asset not found or access denied" },
        { status: 404 },
      ),
    });

    const res = await DELETE(createRequest(), createParams("nonexistent-id"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Media asset not found or access denied");
    expect(prisma.mediaAsset.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when media asset belongs to another user", async () => {
    (verifyMediaAssetOwnership as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: false,
      error: NextResponse.json(
        { error: "Media asset not found or access denied" },
        { status: 404 },
      ),
    });

    const res = await DELETE(createRequest(), createParams("other-user-media"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Media asset not found or access denied");
    expect(prisma.mediaAsset.delete).not.toHaveBeenCalled();
  });

  it("returns 200 and deletes media asset when authorized", async () => {
    (verifyMediaAssetOwnership as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: true,
      data: mockMediaAsset,
    });
    (prisma.mediaAsset.delete as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockMediaAsset,
    );

    const res = await DELETE(createRequest(), createParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(verifyMediaAssetOwnership).toHaveBeenCalledWith("user-abc-123", "test-id");
    expect(prisma.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: "test-id" } });
  });

  it("handles invalid id gracefully - returns 404 from ownership check", async () => {
    (verifyMediaAssetOwnership as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: false,
      error: NextResponse.json(
        { error: "Media asset not found or access denied" },
        { status: 404 },
      ),
    });

    const res = await DELETE(createRequest(), createParams("invalid-id"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Media asset not found or access denied");
    expect(prisma.mediaAsset.delete).not.toHaveBeenCalled();
  });
});
