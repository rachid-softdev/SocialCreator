// @vitest-environment jsdom
/**
 * Smoke tests for the Dashboard page (src/app/(main)/dashboard/page.tsx)
 *
 * Verifies:
 * - The page can be imported cleanly
 * - The component function exists
 */

import { describe, expect, it, vi } from "vitest";
import DashboardPage from "../page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Mock auth to return a session
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "test-user-id", name: "Test User", email: "test@example.com" },
  }),
}));

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    profile: {
      count: vi.fn().mockResolvedValue(1),
    },
    agent: {
      count: vi.fn().mockResolvedValue(2),
    },
    generatedContent: {
      count: vi.fn().mockResolvedValue(5),
      findMany: vi.fn().mockResolvedValue([]),
    },
    agentRun: {
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

// Mock child components
vi.mock("@/components/dashboard/active-agents", () => ({
  ActiveAgents: () => <div data-testid="active-agents" />,
}));

vi.mock("@/components/dashboard/dashboard-stats", () => ({
  DashboardStats: () => <div data-testid="dashboard-stats" />,
}));

vi.mock("@/components/dashboard/quick-actions", () => ({
  QuickActions: () => <div data-testid="quick-actions" />,
}));

vi.mock("@/components/dashboard/recent-content", () => ({
  RecentContent: () => <div data-testid="recent-content" />,
}));

vi.mock("@/components/dashboard/stats-grid", () => ({
  StatsGrid: () => <div data-testid="stats-grid" />,
}));

vi.mock("@/components/layout/breadcrumb", () => ({
  Breadcrumb: () => <div data-testid="breadcrumb" />,
}));

vi.mock("@/components/layout/page-header", () => ({
  PageHeader: () => <div data-testid="page-header" />,
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("DashboardPage", () => {
  it("can be imported", () => {
    expect(DashboardPage).toBeDefined();
  });

  it("is an async function", () => {
    expect(DashboardPage.constructor.name).toBe("AsyncFunction");
  });
});
