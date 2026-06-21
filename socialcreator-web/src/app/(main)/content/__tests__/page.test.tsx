// @vitest-environment jsdom
/**
 * Smoke tests for the Content page (src/app/(main)/content/page.tsx)
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
    generatedContent: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("../content-page-client", () => ({
  ContentPageClient: () => <div data-testid="content-page-client" />,
}));

// Import after mocks
import ContentPage from "../page";

describe("ContentPage", () => {
  it("can be imported", () => {
    expect(ContentPage).toBeDefined();
  });

  it("is an async function", () => {
    expect(ContentPage.constructor.name).toBe("AsyncFunction");
  });
});
