// @vitest-environment jsdom
/**
 * Smoke tests for the Analytics page (src/app/(main)/analytics/page.tsx)
 *
 * Verifies:
 * - The page can be imported cleanly
 * - The component function exists
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "test-user-id" },
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    profile: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    publishLog: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    generatedContent: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("@/lib/publish-guard", () => ({
  getProfileCapStatus: vi.fn().mockResolvedValue({ canPublish: true }),
}));

vi.mock("../analytics-dashboard", () => ({
  default: () => <div data-testid="analytics-dashboard" />,
}));

vi.mock("@/components/layout/page-header", () => ({
  PageHeader: () => <div data-testid="page-header" />,
}));

import AnalyticsPage from "../page";

describe("AnalyticsPage", () => {
  it("can be imported", () => {
    expect(AnalyticsPage).toBeDefined();
  });

  it("is an async function", () => {
    expect(AnalyticsPage.constructor.name).toBe("AsyncFunction");
  });
});
