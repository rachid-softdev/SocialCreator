// @vitest-environment jsdom
/**
 * Smoke tests for the Settings page (src/app/(main)/settings/page.tsx)
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
      count: vi.fn().mockResolvedValue(3),
    },
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/layout/breadcrumb", () => ({
  Breadcrumb: () => <div data-testid="breadcrumb" />,
}));

vi.mock("@/components/layout/page-header", () => ({
  PageHeader: () => <div data-testid="page-header" />,
}));

import SettingsPage from "../page";

describe("SettingsPage", () => {
  it("can be imported", () => {
    expect(SettingsPage).toBeDefined();
  });

  it("is an async function", () => {
    expect(SettingsPage.constructor.name).toBe("AsyncFunction");
  });
});
