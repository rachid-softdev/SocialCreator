/**
 * Shared fixture data for React component tests.
 * Provides type-safe mock data matching component prop interfaces.
 */

import type { AgentType, GeneratedContentWithRelations } from "@socialcreator/types/agent";

// ── Content ─────────────────────────────────────────────────────────────

/**
 * Create a complete GeneratedContentWithRelations fixture.
 * All required Prisma fields are included with sensible defaults.
 * Pass overrides to customize specific fields.
 */
export function createContent(
  overrides: Partial<GeneratedContentWithRelations> = {},
): GeneratedContentWithRelations {
  return {
    id: "content-1",
    profileId: "profile-1",
    textContent: "This is a draft post for testing purposes with some hashtags.",
    platform: "X" as GeneratedContentWithRelations["platform"],
    status: "DRAFT" as GeneratedContentWithRelations["status"],
    createdAt: new Date("2025-06-01T10:00:00Z"),
    updatedAt: new Date("2025-06-01T10:00:00Z"),
    hashtags: ["test", "social", "marketing"],
    mediaUrls: [],
    reviewStatus: "NONE" as GeneratedContentWithRelations["reviewStatus"],
    runId: null,
    publishedAt: null,
    rejectedAt: null,
    reviewedById: null,
    reviewedAt: null,
    reviewComment: null,
    postId: null,
    scheduledPublishAt: null,
    scheduledTimezone: null,
    profile: undefined,
    run: undefined,
    ...overrides,
  };
}

export interface MockContentItem {
  id: string;
  textContent: string;
  platform: string;
  status: "DRAFT" | "APPROVED" | "REJECTED" | "SCHEDULED" | "PUBLISHED" | "FAILED";
  createdAt: Date;
  hashtags: string[];
  scheduledPublishAt?: Date;
  run?: {
    agent: { name: string };
  };
}

export const mockContentDraft: MockContentItem = {
  id: "content-1",
  textContent: "This is a draft post for testing purposes with some hashtags.",
  platform: "X",
  status: "DRAFT",
  createdAt: new Date("2025-06-01T10:00:00Z"),
  hashtags: ["test", "social", "marketing"],
};

export const mockContentApproved: MockContentItem = {
  ...mockContentDraft,
  id: "content-2",
  status: "APPROVED",
};

export const mockContentScheduled: MockContentItem = {
  ...mockContentDraft,
  id: "content-3",
  status: "SCHEDULED",
  scheduledPublishAt: new Date("2025-06-15T14:00:00Z"),
};

export const mockContentList: MockContentItem[] = [
  mockContentDraft,
  mockContentApproved,
  mockContentScheduled,
];

// ── Agent ───────────────────────────────────────────────────────────────

export interface MockAgentStats {
  totalRuns: number;
  successRate: number;
}

export interface MockAgentRun {
  id: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
  createdAt: Date;
  completedAt?: Date;
}

export interface MockAgentWithStats {
  id: string;
  name: string;
  type: AgentType;
  isActive: boolean;
  platform: string;
  platforms: string[];
  stats: MockAgentStats;
  runs: MockAgentRun[];
  profile: { id: string; name: string };
}

export const mockAgent: MockAgentWithStats = {
  id: "agent-1",
  name: "Test Agent",
  type: "TEXT_POST" as AgentType,
  isActive: true,
  platform: "X",
  platforms: ["X", "LINKEDIN"],
  stats: { totalRuns: 42, successRate: 95 },
  runs: [
    {
      id: "run-1",
      status: "SUCCESS",
      createdAt: new Date("2025-06-01T10:00:00Z"),
    },
    {
      id: "run-2",
      status: "FAILED",
      createdAt: new Date("2025-06-02T10:00:00Z"),
    },
  ],
  profile: { id: "profile-1", name: "Main Profile" },
};

export const mockAgentList: MockAgentWithStats[] = [mockAgent];

// ── Connected Account ───────────────────────────────────────────────────

export interface MockConnectedAccount {
  id: string;
  platform: string;
  accountName: string;
  accountId: string;
  avatarUrl?: string;
  expiresAt?: Date;
  isActive: boolean;
}

export const mockAccount: MockConnectedAccount = {
  id: "acct-1",
  platform: "X",
  accountName: "Test User",
  accountId: "12345",
  avatarUrl: "https://example.com/avatar.png",
  expiresAt: new Date("2025-12-31T23:59:59Z"),
  isActive: true,
};

export const mockAccountExpired: MockConnectedAccount = {
  ...mockAccount,
  id: "acct-2",
  expiresAt: new Date("2024-01-01T00:00:00Z"),
  isActive: false,
};

// ── Billing ─────────────────────────────────────────────────────────────

export interface MockBillingData {
  plan: "FREE" | "PRO" | "BUSINESS" | "ENTERPRISE";
  status: "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED";
  renewalDate?: Date;
  cancelAtPeriodEnd: boolean;
}

export const mockBillingActive: MockBillingData = {
  plan: "PRO",
  status: "ACTIVE",
  renewalDate: new Date("2025-07-01T00:00:00Z"),
  cancelAtPeriodEnd: false,
};

export const mockBillingCanceled: MockBillingData = {
  plan: "PRO",
  status: "ACTIVE",
  renewalDate: new Date("2025-07-01T00:00:00Z"),
  cancelAtPeriodEnd: true,
};

// ── Dashboard ───────────────────────────────────────────────────────────

export interface MockDashboardStats {
  stats: {
    profiles: number;
    totalContents: number;
    totalPublished: number;
    todayPublishes: number;
  };
  recentActivity: Array<{ type: string; message: string; timestamp: Date }>;
}

export const mockDashboardData: MockDashboardStats = {
  stats: { profiles: 3, totalContents: 25, totalPublished: 18, todayPublishes: 2 },
  recentActivity: [{ type: "publish", message: "Published to X", timestamp: new Date() }],
};

// ── Agent Run ───────────────────────────────────────────────────────────

export interface MockRunDetail {
  id: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";
  createdAt: Date;
  completedAt?: Date;
  result?: unknown;
  error?: string;
  agent: { id: string; name: string; type: AgentType };
  log: Array<{ level: string; message: string; timestamp: Date }>;
}

export const mockRunSuccess: MockRunDetail = {
  id: "run-1",
  status: "SUCCESS",
  createdAt: new Date("2025-06-01T10:00:00Z"),
  completedAt: new Date("2025-06-01T10:05:00Z"),
  result: { content: "Generated content here" },
  agent: { id: "agent-1", name: "Test Agent", type: "TEXT_POST" as AgentType },
  log: [{ level: "info", message: "Run completed", timestamp: new Date("2025-06-01T10:05:00Z") }],
};

export const mockRunFailed: MockRunDetail = {
  ...mockRunSuccess,
  id: "run-2",
  status: "FAILED",
  error: "LLM API error: timeout",
};

// ── Platform data ───────────────────────────────────────────────────────

export const PLATFORM_DISPLAY: Record<string, string> = {
  X: "X (Twitter)",
  LINKEDIN: "LinkedIn",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  THREADS: "Threads",
  PINTEREST: "Pinterest",
};
