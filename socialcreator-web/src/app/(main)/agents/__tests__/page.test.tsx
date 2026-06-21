// @vitest-environment jsdom
/**
 * Smoke tests for the Agents page (src/app/(main)/agents/page.tsx)
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
    agent: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    profile: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    agentRun: {
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

vi.mock("@/components/agent/all-agents-client", () => ({
  AllAgentsClient: () => <div data-testid="all-agents-client" />,
}));

vi.mock("@/components/layout/breadcrumb", () => ({
  Breadcrumb: () => <div data-testid="breadcrumb" />,
}));

vi.mock("@/components/layout/page-header", () => ({
  PageHeader: () => <div data-testid="page-header" />,
}));

import AllAgentsPage from "../page";

describe("AllAgentsPage", () => {
  it("can be imported", () => {
    expect(AllAgentsPage).toBeDefined();
  });

  it("is an async function", () => {
    expect(AllAgentsPage.constructor.name).toBe("AsyncFunction");
  });
});
