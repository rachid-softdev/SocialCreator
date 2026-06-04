/**
 * Route-level tests for GET/DELETE /api/video/[id]
 *
 * Tests:
 * - Returns 401 when unauthenticated
 * - Returns 404 when resource doesn't exist
 * - Returns 404 when resource belongs to another user
 * - Returns 200/success when authorized
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
  verifyVideoAssetOwnership: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    videoAsset: {
      delete: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { auth } from "@/lib/auth";
import { verifyVideoAssetOwnership } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";
import { DELETE, GET } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(method: string = "GET"): NextRequest {
  return new NextRequest("http://localhost:3000/api/video/test-id", { method });
}

function createParams(id: string = "test-id") {
  return { params: Promise.resolve({ id }) };
}

const mockVideoAsset = {
  id: "test-id",
  profileId: "profile-abc-123",
  title: "Test Video",
  url: "https://example.com/video.mp4",
  mimeType: "video/mp4",
  fileSize: 1024,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

// ---------------------------------------------------------------------------
// GET /api/video/[id]
// ---------------------------------------------------------------------------

describe("GET /api/video/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-abc-123" },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await GET(createRequest(), createParams());
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
    expect(verifyVideoAssetOwnership).not.toHaveBeenCalled();
  });

  it("returns 404 when video asset does not exist", async () => {
    (verifyVideoAssetOwnership as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: false,
      error: NextResponse.json({ error: "Video not found or access denied" }, { status: 404 }),
    });

    const res = await GET(createRequest(), createParams("nonexistent-id"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Video not found or access denied");
  });

  it("returns 404 when video belongs to another user", async () => {
    (verifyVideoAssetOwnership as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: false,
      error: NextResponse.json({ error: "Video not found or access denied" }, { status: 404 }),
    });

    const res = await GET(createRequest(), createParams("other-user-video"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Video not found or access denied");
  });

  it("returns 200 with video when authorized", async () => {
    (verifyVideoAssetOwnership as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: true,
      data: mockVideoAsset,
    });

    const res = await GET(createRequest(), createParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.videoAsset).toEqual(mockVideoAsset);
    expect(verifyVideoAssetOwnership).toHaveBeenCalledWith("user-abc-123", "test-id");
  });

  it("handles invalid id gracefully - returns 404 from ownership check", async () => {
    (verifyVideoAssetOwnership as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: false,
      error: NextResponse.json({ error: "Video not found or access denied" }, { status: 404 }),
    });

    const res = await GET(createRequest(), createParams("invalid-id"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Video not found or access denied");
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/video/[id]
// ---------------------------------------------------------------------------

describe("DELETE /api/video/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-abc-123" },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await DELETE(createRequest("DELETE"), createParams());
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
    expect(verifyVideoAssetOwnership).not.toHaveBeenCalled();
    expect(prisma.videoAsset.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when video asset does not exist", async () => {
    (verifyVideoAssetOwnership as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: false,
      error: NextResponse.json({ error: "Video not found or access denied" }, { status: 404 }),
    });

    const res = await DELETE(createRequest("DELETE"), createParams("nonexistent-id"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Video not found or access denied");
    expect(prisma.videoAsset.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when video belongs to another user", async () => {
    (verifyVideoAssetOwnership as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: false,
      error: NextResponse.json({ error: "Video not found or access denied" }, { status: 404 }),
    });

    const res = await DELETE(createRequest("DELETE"), createParams("other-user-video"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Video not found or access denied");
    expect(prisma.videoAsset.delete).not.toHaveBeenCalled();
  });

  it("returns 200 and deletes video when authorized", async () => {
    (verifyVideoAssetOwnership as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: true,
      data: mockVideoAsset,
    });
    (prisma.videoAsset.delete as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockVideoAsset,
    );

    const res = await DELETE(createRequest("DELETE"), createParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(verifyVideoAssetOwnership).toHaveBeenCalledWith("user-abc-123", "test-id");
    expect(prisma.videoAsset.delete).toHaveBeenCalledWith({ where: { id: "test-id" } });
  });

  it("handles invalid id gracefully - returns 404 from ownership check", async () => {
    (verifyVideoAssetOwnership as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: false,
      error: NextResponse.json({ error: "Video not found or access denied" }, { status: 404 }),
    });

    const res = await DELETE(createRequest("DELETE"), createParams("invalid-id"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Video not found or access denied");
    expect(prisma.videoAsset.delete).not.toHaveBeenCalled();
  });
});
