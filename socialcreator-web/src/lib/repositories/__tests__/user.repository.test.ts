/**
 * Tests for PrismaUserRepository
 *
 * Verifies:
 * - findById(id) — success, null, rejection
 * - findByEmail(email) — success, null on missing, rejection
 * - create(data) — success with all fields, null defaults for optional, rejection
 * - update(id, data) — success, partial update, rejection
 * - updateCguAcceptance(id) — sets cguAccepted=true + cguAcceptedAt Date, rejection
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock prisma ─────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { PrismaUserRepository } from "@/lib/repositories/user.repository";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeMockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    image: "https://example.com/avatar.png",
    password: "hashed-password",
    cguAccepted: false,
    cguAcceptedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

// ── Repository Instance ─────────────────────────────────────────────────────

const repo = new PrismaUserRepository();

// ── Tests ───────────────────────────────────────────────────────────────────

describe("PrismaUserRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findById", () => {
    it("returns user when found", async () => {
      const mockUser = makeMockUser({ id: "user-1" });
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const result = await repo.findById("user-1");

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: "user-1" } });
    });

    it("returns null when not found", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null as any);

      const result = await repo.findById("nonexistent");

      expect(result).toBeNull();
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("DB error"));

      await expect(repo.findById("1")).rejects.toThrow("DB error");
    });
  });

  describe("findByEmail", () => {
    it("returns user when found", async () => {
      const mockUser = makeMockUser({ email: "test@example.com" });
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const result = await repo.findByEmail("test@example.com");

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "test@example.com" } });
    });

    it("returns null when email does not exist", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null as any);

      const result = await repo.findByEmail("missing@example.com");

      expect(result).toBeNull();
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("DB error"));

      await expect(repo.findByEmail("test@example.com")).rejects.toThrow("DB error");
    });
  });

  describe("create", () => {
    it("creates a user with all fields", async () => {
      const input = {
        email: "new@example.com",
        name: "New User",
        image: "https://example.com/avatar.png",
        password: "plain-password",
      };
      const mockUser = makeMockUser({
        id: "user-new",
        email: input.email,
        name: input.name,
        image: input.image,
        password: input.password,
      });
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser as any);

      const result = await repo.create(input);

      expect(result).toEqual(mockUser);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: input.email,
          name: input.name,
          image: input.image,
          password: input.password,
        },
      });
    });

    it("defaults optional fields to null when not provided", async () => {
      const input = { email: "minimal@example.com" };
      const mockUser = makeMockUser({
        id: "user-min",
        email: input.email,
        name: null,
        image: null,
        password: null,
      });
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser as any);

      const result = await repo.create(input);

      expect(result).toEqual(mockUser);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: input.email,
          name: null,
          image: null,
          password: null,
        },
      });
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.user.create).mockRejectedValue(new Error("DB error"));

      await expect(repo.create({ email: "fail@example.com" })).rejects.toThrow("DB error");
    });
  });

  describe("update", () => {
    it("updates user with all fields", async () => {
      const updateData = { name: "Updated Name", email: "updated@example.com" };
      const updatedUser = makeMockUser({
        id: "user-1",
        name: "Updated Name",
        email: "updated@example.com",
      });
      vi.mocked(prisma.user.update).mockResolvedValue(updatedUser as any);

      const result = await repo.update("user-1", updateData);

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: updateData,
      });
    });

    it("performs partial update with single field", async () => {
      const updateData = { name: "Just Name" };
      const updatedUser = makeMockUser({ id: "user-1", name: "Just Name" });
      vi.mocked(prisma.user.update).mockResolvedValue(updatedUser as any);

      const result = await repo.update("user-1", updateData);

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { name: "Just Name" },
      });
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.user.update).mockRejectedValue(new Error("DB error"));

      await expect(repo.update("user-1", { name: "Fail" })).rejects.toThrow("DB error");
    });
  });

  describe("updateCguAcceptance", () => {
    it("sets cguAccepted to true and cguAcceptedAt to current date", async () => {
      const before = new Date();
      const updatedUser = makeMockUser({
        id: "user-1",
        cguAccepted: true,
        cguAcceptedAt: new Date(),
      });
      vi.mocked(prisma.user.update).mockResolvedValue(updatedUser as any);

      const result = await repo.updateCguAcceptance("user-1");

      expect(result.cguAccepted).toBe(true);
      expect(result.cguAcceptedAt).toBeInstanceOf(Date);

      const callArgs = vi.mocked(prisma.user.update).mock.calls[0]![0];
      expect(callArgs.where).toEqual({ id: "user-1" });
      expect(callArgs.data.cguAccepted).toBe(true);
      expect(callArgs.data.cguAcceptedAt).toBeInstanceOf(Date);
      const calledAt = new Date((callArgs as any).data.cguAcceptedAt);
      expect(calledAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.user.update).mockRejectedValue(new Error("DB error"));

      await expect(repo.updateCguAcceptance("user-1")).rejects.toThrow("DB error");
    });
  });
});
