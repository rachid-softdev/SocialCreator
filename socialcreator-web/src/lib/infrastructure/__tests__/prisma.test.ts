/**
 * Tests for Prisma client singleton (Infrastructure)
 *
 * Focuses on:
 * - Singleton creation and caching
 * - Timeout extension application
 * - GlobalThis caching in non-production
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Track extension argument outside mock system so clearAllMocks doesn't affect it
const captureExtendArg = vi.hoisted(() => ({ value: null as unknown }));

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(() => ({
    $extends: vi.fn((arg: unknown) => {
      captureExtendArg.value = arg;
    }),
  })),
}));

// Import after mocks — module-level code runs here (constructor + $extends call)
import { prisma } from "../prisma";

describe("Prisma client singleton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports a PrismaClient instance", () => {
    expect(prisma).toBeDefined();
    expect(typeof prisma).toBe("object");
  });

  it("applies the query timeout $extends configuration", () => {
    expect(captureExtendArg.value).not.toBeNull();
    const extension = captureExtendArg.value as Record<string, unknown>;
    expect(extension).toHaveProperty("query");
    const query = extension.query as Record<string, unknown>;
    expect(query).toHaveProperty("$allModels");
    const allModels = query.$allModels as Record<string, unknown>;
    expect(allModels).toHaveProperty("$allOperations");
  });

  it("stores the instance on globalThis in non-production environment", () => {
    const global = globalThis as { prisma?: unknown };
    expect(global.prisma).toBe(prisma);
  });
});
