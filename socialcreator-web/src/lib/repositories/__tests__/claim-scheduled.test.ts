import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    generatedContent: {
      updateManyAndReturn: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { PrismaContentRepository } from "@/lib/repositories/content.repository";

const repo = new PrismaContentRepository();

function makeGeneratedContent(overrides: Record<string, unknown> = {}) {
  return {
    id: "content-1",
    profileId: "profile-1",
    platform: "X",
    textContent: "Test post",
    mediaUrls: [] as string[],
    hashtags: ["test"] as string[],
    status: "SCHEDULED",
    scheduledPublishAt: new Date("2024-06-15T10:00:00.000Z"),
    createdAt: new Date("2024-06-10T00:00:00.000Z"),
    updatedAt: new Date("2024-06-10T00:00:00.000Z"),
    publishedAt: null,
    scheduledTimezone: null,
    postId: null,
    runId: null,
    rejectedAt: null,
    profile: { id: "profile-1", name: "Test Profile" },
    ...overrides,
  };
}

describe("PrismaContentRepository — claimScheduled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should claim SCHEDULED content with past scheduledPublishAt", async () => {
    const now = new Date("2024-06-15T12:00:00.000Z");
    const dueContent = [
      makeGeneratedContent({ id: "c-1", scheduledPublishAt: new Date("2024-06-15T09:00:00.000Z") }),
      makeGeneratedContent({ id: "c-2", scheduledPublishAt: new Date("2024-06-15T10:00:00.000Z") }),
    ];

    (
      prisma.generatedContent.updateManyAndReturn as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue(dueContent);

    const result = await repo.claimScheduled(now);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("c-1");
    expect(result[1].id).toBe("c-2");
  });

  it("should query with status SCHEDULED and scheduledPublishAt <= before date", async () => {
    const before = new Date("2024-06-15T12:00:00.000Z");

    (
      prisma.generatedContent.updateManyAndReturn as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);

    await repo.claimScheduled(before);

    expect(prisma.generatedContent.updateManyAndReturn).toHaveBeenCalledWith({
      where: {
        status: "SCHEDULED",
        scheduledPublishAt: { lte: before },
      },
      data: { status: "PUBLISHING" },
    });
  });

  it("should return empty array when no SCHEDULED content is due", async () => {
    const now = new Date("2024-06-15T12:00:00.000Z");

    (
      prisma.generatedContent.updateManyAndReturn as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);

    const result = await repo.claimScheduled(now);

    expect(result).toStrictEqual([]);
  });

  it("should not claim FUTURE SCHEDULED content", async () => {
    const now = new Date("2024-06-15T08:00:00.000Z");

    (
      prisma.generatedContent.updateManyAndReturn as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);

    const result = await repo.claimScheduled(now);

    expect(result).toStrictEqual([]);
    expect(prisma.generatedContent.updateManyAndReturn).toHaveBeenCalledWith({
      where: {
        status: "SCHEDULED",
        scheduledPublishAt: { lte: now },
      },
      data: { status: "PUBLISHING" },
    });
  });

  it("should update status to PUBLISHING on claimed content", async () => {
    const before = new Date("2024-06-15T12:00:00.000Z");
    const claimed = [makeGeneratedContent({ id: "c-1", status: "PUBLISHING" })];

    (
      prisma.generatedContent.updateManyAndReturn as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue(claimed);

    const result = await repo.claimScheduled(before);

    expect(result[0].status).toBe("PUBLISHING");
  });

  it("should not claim content that is not SCHEDULED", async () => {
    const before = new Date("2024-06-15T12:00:00.000Z");
    const nonScheduled = [
      makeGeneratedContent({ id: "draft", status: "DRAFT" }),
      makeGeneratedContent({ id: "approved", status: "APPROVED" }),
      makeGeneratedContent({ id: "published", status: "PUBLISHED" }),
    ];

    (
      prisma.generatedContent.updateManyAndReturn as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);

    const result = await repo.claimScheduled(before);

    expect(result).toStrictEqual([]);
  });

  it("should handle content with exact scheduledPublishAt match (lte)", async () => {
    const exactTime = new Date("2024-06-15T10:00:00.000Z");
    const exactMatch = makeGeneratedContent({
      id: "c-exact",
      scheduledPublishAt: exactTime,
    });

    (
      prisma.generatedContent.updateManyAndReturn as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue([exactMatch]);

    const result = await repo.claimScheduled(exactTime);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c-exact");
  });

  it("should claim multiple items in a batch", async () => {
    const now = new Date("2024-06-15T12:00:00.000Z");
    const batch = Array.from({ length: 10 }, (_, i) =>
      makeGeneratedContent({
        id: `batch-${i}`,
        scheduledPublishAt: new Date(`2024-06-15T0${Math.floor(i / 6)}:${(i % 6) * 10}:00.000Z`),
        status: "PUBLISHING",
      }),
    );

    (
      prisma.generatedContent.updateManyAndReturn as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue(batch);

    const result = await repo.claimScheduled(now);

    expect(result).toHaveLength(10);
    for (const item of result) {
      expect(item.status).toBe("PUBLISHING");
    }
  });
});
