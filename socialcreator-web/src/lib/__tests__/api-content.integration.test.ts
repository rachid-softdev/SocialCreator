/**
 * Integration tests for content route handlers
 *
 * Tests the content API route handlers (GET, PATCH, DELETE /api/content/[id],
 * POST /api/content/[id]/approve) with mocked dependencies.
 * No real database is used.
 */

import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mock factories
const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    generatedContent: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    profile: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/rate-limit-redis", () => ({
  withRateLimit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/sanitize", () => ({
  isValidUuid: vi.fn().mockReturnValue(true),
}));

// Import after mocks
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/rate-limit-redis";
import { isValidUuid } from "@/lib/sanitize";

const validSession = { user: { id: "user-123" } };
const mockContent = {
  id: "content-1",
  profileId: "profile-1",
  textContent: "Hello world",
  hashtags: ["#test"],
  status: "DRAFT",
  platform: "INSTAGRAM",
  profile: { id: "profile-1", userId: "user-123", name: "Test Profile" },
  run: null,
};

describe("Content API Routes (Integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(validSession);
  });

  const createRequest = (
    path = "/api/content/content-1",
    options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
  ) => {
    const { method = "GET", body, headers = {} } = options;
    return new NextRequest(`http://localhost:3000${path}`, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  // ============================================
  // GET /api/content/[id]
  // ============================================

  describe("GET /api/content/[id]", () => {
    it("should return content when authorized", async () => {
      vi.mocked(prisma.generatedContent.findUnique).mockResolvedValue(mockContent as any);

      const { GET } = await import("@/app/api/content/[id]/route");
      const request = createRequest();
      const response = await GET(request, { params: Promise.resolve({ id: "content-1" }) });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.content).toBeDefined();
      expect(body.content.id).toBe("content-1");
      expect(prisma.generatedContent.findUnique).toHaveBeenCalledWith({
        where: { id: "content-1" },
        include: { profile: true },
      });
    });

    it("should return 401 when not authenticated", async () => {
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { GET } = await import("@/app/api/content/[id]/route");
      const request = createRequest();
      const response = await GET(request, { params: Promise.resolve({ id: "content-1" }) });

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toContain("Unauthorized");
    });

    it("should return 404 when content belongs to another user", async () => {
      // Content exists but belongs to a different user
      vi.mocked(prisma.generatedContent.findUnique).mockResolvedValue({
        ...mockContent,
        profile: { id: "profile-2", userId: "user-other" },
      } as any);

      const { GET } = await import("@/app/api/content/[id]/route");
      const request = createRequest();
      const response = await GET(request, { params: Promise.resolve({ id: "content-other" }) });

      expect(response.status).toBe(404);
    });

    it("should return 500 when prisma throws", async () => {
      vi.mocked(prisma.generatedContent.findUnique).mockRejectedValue(
        new Error("Database connection failed"),
      );

      const { GET } = await import("@/app/api/content/[id]/route");
      const request = createRequest();
      const response = await GET(request, { params: Promise.resolve({ id: "content-1" }) });

      expect(response.status).toBe(500);
    });
  });

  // ============================================
  // PATCH /api/content/[id]
  // ============================================

  describe("PATCH /api/content/[id]", () => {
    it("should update content text successfully", async () => {
      vi.mocked(prisma.generatedContent.findUnique).mockResolvedValue(mockContent as any);
      const updatedContent = {
        ...mockContent,
        textContent: "Updated text",
      };
      vi.mocked(prisma.generatedContent.update).mockResolvedValue(updatedContent as any);

      const { PATCH } = await import("@/app/api/content/[id]/route");
      const request = createRequest("/api/content/content-1", {
        method: "PATCH",
        body: { textContent: "Updated text" },
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: "content-1" }) });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.content.textContent).toBe("Updated text");
    });

    it("should return 400 for invalid body", async () => {
      vi.mocked(prisma.generatedContent.findUnique).mockResolvedValue(mockContent as any);

      const { PATCH } = await import("@/app/api/content/[id]/route");
      const request = createRequest("/api/content/content-1", {
        method: "PATCH",
        body: { textContent: "" }, // empty string fails min(1) validation
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: "content-1" }) });

      expect(response.status).toBe(400);
    });

    it("should return 404 when content not found", async () => {
      vi.mocked(prisma.generatedContent.findUnique).mockResolvedValue(null);

      const { PATCH } = await import("@/app/api/content/[id]/route");
      const request = createRequest("/api/content/content-nonexistent", {
        method: "PATCH",
        body: { textContent: "Updated text" },
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: "content-nonexistent" }),
      });

      expect(response.status).toBe(404);
    });
  });

  // ============================================
  // DELETE /api/content/[id]
  // ============================================

  describe("DELETE /api/content/[id]", () => {
    it("should delete content when authorized", async () => {
      vi.mocked(prisma.generatedContent.findUnique).mockResolvedValue(mockContent as any);
      vi.mocked(prisma.generatedContent.delete).mockResolvedValue({} as any);

      const { DELETE } = await import("@/app/api/content/[id]/route");
      const request = createRequest("/api/content/content-1", { method: "DELETE" });
      const response = await DELETE(request, { params: Promise.resolve({ id: "content-1" }) });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(prisma.generatedContent.delete).toHaveBeenCalledWith({
        where: { id: "content-1" },
      });
    });

    it("should return 404 when content belongs to another user", async () => {
      vi.mocked(prisma.generatedContent.findUnique).mockResolvedValue({
        ...mockContent,
        profile: { id: "profile-2", userId: "user-other" },
      } as any);

      const { DELETE } = await import("@/app/api/content/[id]/route");
      const request = createRequest("/api/content/content-other", { method: "DELETE" });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: "content-other" }),
      });

      expect(response.status).toBe(404);
    });
  });

  // ============================================
  // POST /api/content/[id]/approve
  // ============================================

  describe("POST /api/content/[id]/approve", () => {
    it("should approve draft content", async () => {
      vi.mocked(isValidUuid).mockReturnValue(true);
      vi.mocked(prisma.generatedContent.findFirst).mockResolvedValue(mockContent as any);
      const approvedContent = {
        ...mockContent,
        status: "APPROVED",
        profile: { id: "profile-1", name: "Test" },
        run: null,
      };
      vi.mocked(prisma.generatedContent.update).mockResolvedValue(approvedContent as any);

      const { POST } = await import("@/app/api/content/[id]/approve/route");
      const request = createRequest("/api/content/content-1/approve", {
        method: "POST",
        body: { status: "APPROVED" },
      });
      const response = await POST(request, { params: Promise.resolve({ id: "content-1" }) });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.content.status).toBe("APPROVED");
      expect(prisma.generatedContent.update).toHaveBeenCalledWith({
        where: { id: "content-1" },
        data: { status: "APPROVED" },
        include: expect.any(Object),
      });
    });

    it("should return 400 when content is not in DRAFT status", async () => {
      vi.mocked(isValidUuid).mockReturnValue(true);
      vi.mocked(prisma.generatedContent.findFirst).mockResolvedValue({
        ...mockContent,
        status: "PUBLISHED",
      } as any);

      const { POST } = await import("@/app/api/content/[id]/approve/route");
      const request = createRequest("/api/content/content-1/approve", {
        method: "POST",
        body: { status: "APPROVED" },
      });
      const response = await POST(request, { params: Promise.resolve({ id: "content-1" }) });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Only draft content can be approved");
    });

    it("should return 400 for invalid content ID (UUID)", async () => {
      vi.mocked(isValidUuid).mockReturnValue(false);

      const { POST } = await import("@/app/api/content/[id]/approve/route");
      const request = createRequest("/api/content/invalid/approve", {
        method: "POST",
        body: {},
      });
      const response = await POST(request, { params: Promise.resolve({ id: "invalid" }) });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Invalid content ID");
    });

    it("should return 404 when content not found for user", async () => {
      vi.mocked(isValidUuid).mockReturnValue(true);
      vi.mocked(prisma.generatedContent.findFirst).mockResolvedValue(null);

      const { POST } = await import("@/app/api/content/[id]/approve/route");
      const request = createRequest("/api/content/content-nonexistent/approve", {
        method: "POST",
        body: { status: "APPROVED" },
      });
      const response = await POST(request, {
        params: Promise.resolve({ id: "content-nonexistent" }),
      });

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toContain("Content not found");
    });
  });
});
