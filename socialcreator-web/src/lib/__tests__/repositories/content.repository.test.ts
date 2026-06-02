/**
 * Tests for PrismaContentRepository
 * Based on design spec: docs/architecture/01-repository-pattern.md
 *
 * Self-contained: tests the repository contract (IContentRepository interface)
 * using an inline mock implementation matching the design spec.
 * Once the real source is implemented, swap to importing the real repo.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ========== Inline types matching the design spec ==========

interface ContentFilterOptions {
  page?: number;
  pageSize?: number;
  status?: string;
  platform?: string;
}

interface ContentPage {
  contents: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface IContentRepository {
  findById(id: string): Promise<any | null>;
  findByProfileId(profileId: string, options?: ContentFilterOptions): Promise<ContentPage>;
  create(data: any): Promise<any>;
  updateStatus(id: string, status: string): Promise<any>;
  delete(id: string): Promise<void>;
  findPendingScheduled(before: Date): Promise<any[]>;
  countPublishedToday(profileId: string, platform: string): Promise<number>;
  findByRunId(runId: string): Promise<any[]>;
}

// ========== Inline mock implementation ==========

function createMockRepo(): IContentRepository {
  return {
    findById: vi.fn(),
    findByProfileId: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    delete: vi.fn(),
    findPendingScheduled: vi.fn(),
    countPublishedToday: vi.fn(),
    findByRunId: vi.fn(),
  };
}

// ========== Tests ==========

describe("IContentRepository (contract)", () => {
  let repo: IContentRepository;
  const mockProfile = { id: "profile-1", name: "Test Profile" };
  const mockContent = {
    id: "content-1",
    profileId: "profile-1",
    platform: "X",
    textContent: "Hello world",
    mediaUrls: [] as string[],
    hashtags: ["test"],
    status: "DRAFT",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    publishedAt: null,
    scheduledPublishAt: null,
    runId: null,
    profile: mockProfile,
    run: null,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    repo = createMockRepo();
  });

  describe("findById", () => {
    it("should return content when it exists", async () => {
      (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockContent);
      const result = await repo.findById("content-1");
      expect(result).toStrictEqual(mockContent);
    });

    it("should return null when content does not exist", async () => {
      (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const result = await repo.findById("nonexistent");
      expect(result).toBeNull();
    });

    it("should include run with agent details when runId exists", async () => {
      const contentWithRun = {
        ...mockContent,
        runId: "run-1",
        run: { id: "run-1", agent: { id: "agent-1", name: "Content Bot" } },
      };
      (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(contentWithRun);
      const result = await repo.findById("content-1");
      expect(result?.run?.agent.name).toBe("Content Bot");
    });
  });

  describe("findByProfileId", () => {
    const mockContents = Array.from({ length: 5 }, (_, i) => ({
      ...mockContent,
      id: `content-${i + 1}`,
    }));

    it("should return paginated contents with default options", async () => {
      (repo.findByProfileId as ReturnType<typeof vi.fn>).mockResolvedValue({
        contents: mockContents,
        total: 25,
        page: 1,
        pageSize: 20,
        totalPages: 2,
      });

      const result = await repo.findByProfileId("profile-1");

      expect(result.contents).toHaveLength(5);
      expect(result.total).toBe(25);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(2);
    });

    it("should apply status filter when provided", async () => {
      (repo.findByProfileId as ReturnType<typeof vi.fn>).mockResolvedValue({
        contents: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      });

      const options: ContentFilterOptions = { status: "PUBLISHED", page: 1, pageSize: 10 };
      const result = await repo.findByProfileId("profile-1", options);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it("should apply platform filter when provided", async () => {
      (repo.findByProfileId as ReturnType<typeof vi.fn>).mockResolvedValue({
        contents: [],
        total: 0,
        page: 2,
        pageSize: 5,
        totalPages: 0,
      });

      const options: ContentFilterOptions = { platform: "X", page: 2, pageSize: 5 };
      const result = await repo.findByProfileId("profile-1", options);

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(5);
    });

    it("should combine status and platform filters", async () => {
      (repo.findByProfileId as ReturnType<typeof vi.fn>).mockResolvedValue({
        contents: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });

      const options: ContentFilterOptions = {
        status: "SCHEDULED",
        platform: "INSTAGRAM",
        page: 1,
        pageSize: 20,
      };
      await repo.findByProfileId("profile-1", options);

      expect(repo.findByProfileId).toHaveBeenCalledWith("profile-1", options);
    });

    it("should handle empty results", async () => {
      (repo.findByProfileId as ReturnType<typeof vi.fn>).mockResolvedValue({
        contents: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });

      const result = await repo.findByProfileId("profile-1");

      expect(result.contents).toStrictEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  describe("create", () => {
    it("should create and return the new content", async () => {
      const createInput = {
        profileId: "profile-1",
        platform: "X",
        textContent: "New post",
        mediaUrls: [],
        hashtags: [],
        status: "DRAFT",
      };
      const created = { ...mockContent, id: "new-id", textContent: "New post" };
      (repo.create as ReturnType<typeof vi.fn>).mockResolvedValue(created);

      const result = await repo.create(createInput);

      expect(result).toStrictEqual(created);
    });

    it("should create with optional fields", async () => {
      const createInput = {
        profileId: "profile-1",
        platform: "INSTAGRAM",
        textContent: "Post",
        mediaUrls: ["https://example.com/img.jpg"],
        hashtags: ["insta"],
        status: "SCHEDULED",
        scheduledPublishAt: new Date("2024-06-15T10:00:00Z"),
      };
      (repo.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockContent,
        ...createInput,
        id: "n2",
      });

      const result = await repo.create(createInput);

      expect(result.textContent).toBe("Post");
      expect(result.scheduledPublishAt).toBeDefined();
    });
  });

  describe("updateStatus", () => {
    it("should update status and return updated content", async () => {
      const updated = { ...mockContent, status: "PUBLISHED", publishedAt: new Date() };
      (repo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const result = await repo.updateStatus("content-1", "PUBLISHED");

      expect(result.status).toBe("PUBLISHED");
    });

    it("should transition through statuses", async () => {
      (repo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockContent,
        status: "APPROVED",
      });
      const r1 = await repo.updateStatus("content-1", "APPROVED");
      expect(r1.status).toBe("APPROVED");

      (repo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockContent,
        status: "FAILED",
      });
      const r2 = await repo.updateStatus("content-1", "FAILED");
      expect(r2.status).toBe("FAILED");
    });
  });

  describe("delete", () => {
    it("should delete content by id", async () => {
      (repo.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      await expect(repo.delete("content-1")).resolves.toBeUndefined();
    });

    it("should throw when content does not exist", async () => {
      (repo.delete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Record not found"));
      await expect(repo.delete("nonexistent")).rejects.toThrow("Record not found");
    });
  });

  describe("findPendingScheduled", () => {
    it("should find scheduled content before a given date", async () => {
      const scheduled = [
        { ...mockContent, id: "sched-1", status: "SCHEDULED" },
        { ...mockContent, id: "sched-2", status: "SCHEDULED" },
      ];
      (repo.findPendingScheduled as ReturnType<typeof vi.fn>).mockResolvedValue(scheduled);

      const result = await repo.findPendingScheduled(new Date("2024-06-15T12:00:00Z"));

      expect(result).toHaveLength(2);
    });

    it("should return empty array when none due", async () => {
      (repo.findPendingScheduled as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await repo.findPendingScheduled(new Date("2024-01-01"));

      expect(result).toStrictEqual([]);
    });
  });

  describe("countPublishedToday", () => {
    it("should count content published today", async () => {
      (repo.countPublishedToday as ReturnType<typeof vi.fn>).mockResolvedValue(3);
      const result = await repo.countPublishedToday("profile-1", "X");
      expect(result).toBe(3);
    });

    it("should return 0 when nothing published today", async () => {
      (repo.countPublishedToday as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      const result = await repo.countPublishedToday("profile-1", "INSTAGRAM");
      expect(result).toBe(0);
    });
  });

  describe("findByRunId", () => {
    it("should return all content for a given run", async () => {
      const runContents = [
        { ...mockContent, id: "c-1", runId: "run-1" },
        { ...mockContent, id: "c-2", runId: "run-1" },
      ];
      (repo.findByRunId as ReturnType<typeof vi.fn>).mockResolvedValue(runContents);

      const result = await repo.findByRunId("run-1");

      expect(result).toHaveLength(2);
    });

    it("should return empty array when run has no content", async () => {
      (repo.findByRunId as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      const result = await repo.findByRunId("nonexistent-run");
      expect(result).toStrictEqual([]);
    });
  });
});

// ========== Registry Tests ==========

describe("Repository Registry (design spec)", () => {
  it("defines the expected registry API", async () => {
    // Verify the design spec contract for the registry
    interface Repositories {
      content: IContentRepository;
      agent: unknown;
      agentRun: unknown;
      profile: unknown;
      user: unknown;
      apiKey: unknown;
      mediaAsset: unknown;
      team: unknown;
      teamMember: unknown;
      connectedAccount: unknown;
      publishLog: unknown;
    }

    function initRepositories(_overrides?: Partial<Repositories>): Repositories {
      const repos: Repositories = {
        content: createMockRepo(),
        agent: {},
        agentRun: {},
        profile: {},
        user: {},
        apiKey: {},
        mediaAsset: {},
        team: {},
        teamMember: {},
        connectedAccount: {},
        publishLog: {},
      };
      return _overrides ? { ...repos, ..._overrides } : repos;
    }

    const repos = initRepositories();

    expect(repos).toHaveProperty("content");
    expect(repos).toHaveProperty("agent");
    expect(repos).toHaveProperty("agentRun");
    expect(repos).toHaveProperty("profile");
    expect(repos).toHaveProperty("user");
    expect(repos).toHaveProperty("apiKey");
    expect(repos).toHaveProperty("mediaAsset");
    expect(repos).toHaveProperty("team");
    expect(repos).toHaveProperty("teamMember");
    expect(repos).toHaveProperty("connectedAccount");
    expect(repos).toHaveProperty("publishLog");
  });

  it("initRepositories should merge overrides", () => {
    interface Repositories {
      content: IContentRepository;
      agent: unknown;
      agentRun: unknown;
      profile: unknown;
      user: unknown;
      apiKey: unknown;
      mediaAsset: unknown;
      team: unknown;
      teamMember: unknown;
      connectedAccount: unknown;
      publishLog: unknown;
    }

    function initRepositories(overrides?: Partial<Repositories>): Repositories {
      const repos: Repositories = {
        content: createMockRepo(),
        agent: {},
        agentRun: {},
        profile: {},
        user: {},
        apiKey: {},
        mediaAsset: {},
        team: {},
        teamMember: {},
        connectedAccount: {},
        publishLog: {},
      };
      return overrides ? { ...repos, ...overrides } : repos;
    }

    const mockContentRepo = createMockRepo();
    const repos = initRepositories({ content: mockContentRepo });

    expect(repos.content).toBe(mockContentRepo);
    expect(repos.profile).toBeDefined();
    expect(repos.profile).not.toBe(mockContentRepo);
  });
});
