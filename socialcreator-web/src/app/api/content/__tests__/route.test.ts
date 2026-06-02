import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock middleware dependencies (withApiMiddleware chain)
// ---------------------------------------------------------------------------
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit-redis", () => ({ withRateLimit: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock Prisma delegate methods used by the content route
vi.mock("@/lib/prisma", () => ({
  prisma: {
    generatedContent: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/rate-limit-redis";
import { GET } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createGetRequest(url?: string) {
  // URLSearchParams.get() returns null for missing keys → patched above to undefined
  return new NextRequest(url ?? "http://localhost:3000/api/content");
}

// ---------------------------------------------------------------------------
// Fix URLSearchParams null vs undefined for Zod compatibility
// URLSearchParams.get() returns `null` for missing keys, but Zod's
// `.optional()` and `.default()` only accept `undefined`. The route handler
// builds rawFilters from searchParams without converting null→undefined,
// which causes schema validation to fail for optional params not present in
// the URL. We patch once at the describe level to align behaviors.
// ---------------------------------------------------------------------------
const _origGet = URLSearchParams.prototype.get;
vi.spyOn(URLSearchParams.prototype, "get").mockImplementation(function (
  this: URLSearchParams,
  key: string,
) {
  const result = _origGet.call(this, key);
  return result === null ? undefined : result;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("GET /api/content", () => {
  const mockContent = {
    id: "content-1",
    profileId: "profile-abc-123",
    status: "DRAFT",
    textContent: "Test post content",
    platform: "X",
    hashtags: ["#test"],
    mediaUrls: [],
    scheduledPublishAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    profile: { id: "profile-abc-123", name: "My Brand" },
    run: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-abc-123" },
    });
    (withRateLimit as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it("should return 401 when unauthenticated", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await GET(createGetRequest());
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 200 with paginated content", async () => {
    (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockContent,
    ]);
    (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    const res = await GET(createGetRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.contents).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(20);
    expect(data.totalPages).toBe(1);
  });

  it("should return empty state when no content exists", async () => {
    (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const res = await GET(createGetRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.contents).toEqual([]);
    expect(data.total).toBe(0);
    expect(data.totalPages).toBe(0);
  });

  it("should filter by profileId query param", async () => {
    const validProfileUuid = "223e4567-e89b-12d3-a456-426614174000";
    (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...mockContent, profileId: validProfileUuid },
    ]);
    (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    const res = await GET(
      createGetRequest(`http://localhost:3000/api/content?profileId=${validProfileUuid}`),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.contents).toHaveLength(1);
    expect(prisma.generatedContent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ profileId: validProfileUuid }),
      }),
    );
  });

  it("should filter by status query param", async () => {
    (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockContent,
    ]);
    (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    const res = await GET(createGetRequest("http://localhost:3000/api/content?status=DRAFT"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.contents).toHaveLength(1);
    expect(prisma.generatedContent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "DRAFT" }),
      }),
    );
  });

  it("should handle pagination params (page & pageSize)", async () => {
    (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(50);

    const res = await GET(createGetRequest("http://localhost:3000/api/content?page=2&pageSize=10"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.page).toBe(2);
    expect(data.pageSize).toBe(10);
    expect(data.totalPages).toBe(5);
    expect(prisma.generatedContent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      }),
    );
  });

  it("should reject invalid pagination params", async () => {
    const res = await GET(
      createGetRequest("http://localhost:3000/api/content?page=0&pageSize=200"),
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeTruthy();
    // Handler should not have been called
    expect(prisma.generatedContent.findMany).not.toHaveBeenCalled();
  });

  it("should reject invalid UUID profileId", async () => {
    const res = await GET(
      createGetRequest("http://localhost:3000/api/content?profileId=not-a-uuid"),
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Invalid profile ID");
  });

  it("should reject invalid status value", async () => {
    const res = await GET(
      createGetRequest("http://localhost:3000/api/content?status=INVALID_STATUS"),
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeTruthy();
  });
});
