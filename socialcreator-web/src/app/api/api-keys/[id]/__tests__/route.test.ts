/**
 * Route-level tests for DELETE /api/api-keys/[id]
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
  verifyApiKeyOwnership: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: {
      update: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { auth } from "@/lib/auth";
import { verifyApiKeyOwnership } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";
import { DELETE } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/api-keys/test-id", { method: "DELETE" });
}

function createParams(id: string = "test-id") {
  return { params: Promise.resolve({ id }) };
}

const mockApiKey = {
  id: "test-id",
  userId: "user-abc-123",
  name: "Test API Key",
  key: "sk-test-xxxxxxxx",
  revokedAt: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

// ---------------------------------------------------------------------------
// DELETE /api/api-keys/[id]
// ---------------------------------------------------------------------------

describe("DELETE /api/api-keys/[id]", () => {
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
    expect(verifyApiKeyOwnership).not.toHaveBeenCalled();
    expect(prisma.apiKey.update).not.toHaveBeenCalled();
  });

  it("returns 404 when API key does not exist", async () => {
    (verifyApiKeyOwnership as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: false,
      error: NextResponse.json({ error: "API key not found or access denied" }, { status: 404 }),
    });

    const res = await DELETE(createRequest(), createParams("nonexistent-id"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("API key not found or access denied");
    expect(prisma.apiKey.update).not.toHaveBeenCalled();
  });

  it("returns 404 when API key belongs to another user", async () => {
    (verifyApiKeyOwnership as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: false,
      error: NextResponse.json({ error: "API key not found or access denied" }, { status: 404 }),
    });

    const res = await DELETE(createRequest(), createParams("other-user-key"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("API key not found or access denied");
    expect(prisma.apiKey.update).not.toHaveBeenCalled();
  });

  it("returns 200 and revokes API key when authorized", async () => {
    (verifyApiKeyOwnership as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: true,
      data: mockApiKey,
    });
    (prisma.apiKey.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockApiKey,
      revokedAt: new Date(),
    });

    const res = await DELETE(createRequest(), createParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(verifyApiKeyOwnership).toHaveBeenCalledWith("user-abc-123", "test-id");
    expect(prisma.apiKey.update).toHaveBeenCalledWith({
      where: { id: "test-id" },
      data: expect.objectContaining({ revokedAt: expect.any(Date) }),
    });
  });

  it("handles invalid id gracefully - returns 404 from ownership check", async () => {
    (verifyApiKeyOwnership as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: false,
      error: NextResponse.json({ error: "API key not found or access denied" }, { status: 404 }),
    });

    const res = await DELETE(createRequest(), createParams("invalid-id"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("API key not found or access denied");
    expect(prisma.apiKey.update).not.toHaveBeenCalled();
  });
});
