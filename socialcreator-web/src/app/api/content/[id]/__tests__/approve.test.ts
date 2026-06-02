import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies used by approve and reject routes
// These routes do NOT use withApiMiddleware; they directly call auth() and withRateLimit
// ---------------------------------------------------------------------------
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit-redis", () => ({ withRateLimit: vi.fn() }));
vi.mock("@/lib/sanitize", () => ({
  // Plain function (not vi.fn()) so vi.clearAllMocks() doesn't wipe the implementation
  isValidUuid: (id: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id),
}));

// Mock Prisma delegate methods used by approve and reject
vi.mock("@/lib/prisma", () => ({
  prisma: {
    generatedContent: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/rate-limit-redis";
import { POST as approvePost } from "../approve/route";
import { POST as rejectPost } from "../reject/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VALID_CONTENT_ID = "123e4567-e89b-12d3-a456-426614174000";
const VALID_PROFILE_ID = "223e4567-e89b-12d3-a456-426614174000";

function createRequest(body: unknown) {
  return new NextRequest(`http://localhost:3000/api/content/${VALID_CONTENT_ID}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createRejectRequest(body: unknown) {
  return new NextRequest(`http://localhost:3000/api/content/${VALID_CONTENT_ID}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function resolveParams(id = VALID_CONTENT_ID) {
  return { params: Promise.resolve({ id }) };
}

const mockDraftContent = {
  id: VALID_CONTENT_ID,
  profileId: VALID_PROFILE_ID,
  status: "DRAFT",
  textContent: "Draft post",
  platform: "X",
  hashtags: ["#test"],
  mediaUrls: [],
  scheduledPublishAt: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockApprovedContent = {
  ...mockDraftContent,
  status: "APPROVED",
};

const mockRejectedContent = {
  ...mockDraftContent,
  status: "REJECTED",
  rejectedAt: new Date(),
};

// =========================================================================
// POST /api/content/[id]/approve
// =========================================================================
describe("POST /api/content/[id]/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-abc-123" },
    });
    (withRateLimit as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  describe("authentication", () => {
    it("should return 401 when not authenticated", async () => {
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await approvePost(createRequest({ status: "APPROVED" }), resolveParams());
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("input validation", () => {
    it("should return 400 for invalid content ID", async () => {
      const res = await approvePost(
        createRequest({ status: "APPROVED" }),
        { params: Promise.resolve({ id: "not-a-uuid" }) },
      );
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("Invalid content ID");
    });

    it("should return 400 for invalid request body (missing status)", async () => {
      const res = await approvePost(createRequest({}), resolveParams());
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBeTruthy();
    });

    it("should return 400 for invalid status value", async () => {
      const res = await approvePost(createRequest({ status: "PUBLISHED" }), resolveParams());
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBeTruthy();
    });
  });

  describe("ownership and status guards", () => {
    it("should return 404 when content is not found", async () => {
      (prisma.generatedContent.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      const res = await approvePost(createRequest({ status: "APPROVED" }), resolveParams());
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toContain("Content not found");
    });

    it("should return 400 when content is not in DRAFT status", async () => {
      (prisma.generatedContent.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockDraftContent,
        status: "APPROVED",
      });

      const res = await approvePost(createRequest({ status: "APPROVED" }), resolveParams());
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("Only draft content can be approved");
    });
  });

  describe("successful approval", () => {
    it("should return 200 and update status to APPROVED", async () => {
      (prisma.generatedContent.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockDraftContent,
      );
      (prisma.generatedContent.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockApprovedContent,
      );

      const res = await approvePost(createRequest({ status: "APPROVED" }), resolveParams());
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.content.status).toBe("APPROVED");
      expect(prisma.generatedContent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: VALID_CONTENT_ID },
          data: { status: "APPROVED" },
        }),
      );
    });
  });

  describe("error handling", () => {
    it("should return 500 when Prisma update throws", async () => {
      (prisma.generatedContent.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockDraftContent,
      );
      (prisma.generatedContent.update as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      const res = await approvePost(createRequest({ status: "APPROVED" }), resolveParams());
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });
});

// =========================================================================
// POST /api/content/[id]/reject
// =========================================================================
describe("POST /api/content/[id]/reject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-abc-123" },
    });
    (withRateLimit as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  describe("authentication", () => {
    it("should return 401 when not authenticated", async () => {
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await rejectPost(createRejectRequest({}), resolveParams());
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("ownership and status guards", () => {
    it("should return 404 when content is not found", async () => {
      (prisma.generatedContent.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      const res = await rejectPost(createRejectRequest({}), resolveParams());
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toContain("Content not found");
    });

    it("should return 400 when content is not in DRAFT status", async () => {
      (prisma.generatedContent.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockDraftContent,
        status: "PUBLISHED",
      });

      const res = await rejectPost(createRejectRequest({}), resolveParams());
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("Only draft content can be rejected");
    });
  });

  describe("successful rejection", () => {
    it("should return 200 and update status to REJECTED without reason", async () => {
      (prisma.generatedContent.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockDraftContent,
      );
      (prisma.generatedContent.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockRejectedContent,
      );

      const res = await rejectPost(createRejectRequest({}), resolveParams());
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.content.status).toBe("REJECTED");
      expect(data.reason).toBeNull();
      expect(prisma.generatedContent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: VALID_CONTENT_ID },
          data: expect.objectContaining({ status: "REJECTED" }),
        }),
      );
    });

    it("should return 200 with rejection reason when provided", async () => {
      (prisma.generatedContent.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockDraftContent,
      );
      (prisma.generatedContent.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockRejectedContent,
      );

      const res = await rejectPost(
        createRejectRequest({ reason: "Needs more visuals" }),
        resolveParams(),
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.content.status).toBe("REJECTED");
      expect(data.reason).toBe("Needs more visuals");
    });
  });

  describe("input validation", () => {
    it("should return 400 when reason exceeds max length", async () => {
      (prisma.generatedContent.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockDraftContent,
      );

      const res = await rejectPost(
        createRejectRequest({ reason: "x".repeat(501) }),
        resolveParams(),
      );
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBeTruthy();
    });
  });

  describe("error handling", () => {
    it("should return 500 when Prisma update throws", async () => {
      (prisma.generatedContent.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockDraftContent,
      );
      (prisma.generatedContent.update as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      const res = await rejectPost(createRejectRequest({}), resolveParams());
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });
});
