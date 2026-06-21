// @vitest-environment jsdom
/**
 * Smoke tests for the Profiles page (src/app/(main)/profiles/page.tsx)
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

vi.mock("@/components/profile/profile-card", () => ({
  ProfileCard: () => <div data-testid="profile-card" />,
}));

import ProfilesPage from "../page";

describe("ProfilesPage", () => {
  it("can be imported", () => {
    expect(ProfilesPage).toBeDefined();
  });

  it("is an async function", () => {
    expect(ProfilesPage.constructor.name).toBe("AsyncFunction");
  });
});
