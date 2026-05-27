import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock the auth module before importing
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { requireAdmin, AuthError } from "../require-admin";
import { auth } from "@/lib/auth";

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when no session exists", () => {
    it("should throw AuthError with status 401 when session is null", async () => {
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(requireAdmin()).rejects.toThrow(AuthError);
      await expect(requireAdmin()).rejects.toMatchObject({ status: 401, message: "Non authentifié" });
    });

    it("should throw AuthError with status 401 when session has no user id", async () => {
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { email: "test@test.com" } });

      await expect(requireAdmin()).rejects.toThrow(AuthError);
      await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
    });

    it("should throw AuthError with status 401 when session has no user at all", async () => {
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await expect(requireAdmin()).rejects.toThrow(AuthError);
      await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
    });
  });

  describe("when user is not admin", () => {
    it("should throw AuthError with status 403 when role is USER", async () => {
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com", role: "USER", roles: ["USER"] },
      });

      await expect(requireAdmin()).rejects.toThrow(AuthError);
      await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
    });

    it("should throw AuthError with status 403 when roles array is empty", async () => {
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com", role: "USER", roles: [] },
      });

      await expect(requireAdmin()).rejects.toThrow(AuthError);
      await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
    });

    it("should throw AuthError with status 403 when roles is undefined", async () => {
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      await expect(requireAdmin()).rejects.toThrow(AuthError);
      await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
    });
  });

  describe("when user is admin", () => {
    it("should return id and email when role is ADMIN", async () => {
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: "admin-1", email: "admin@test.com", role: "ADMIN", roles: ["ADMIN"] },
      });

      const result = await requireAdmin();
      expect(result).toEqual({ id: "admin-1", email: "admin@test.com" });
    });

    it("should return id and email when roles array includes ADMIN", async () => {
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: "admin-2", email: "admin2@test.com", role: "USER", roles: ["USER", "ADMIN"] },
      });

      const result = await requireAdmin();
      expect(result).toEqual({ id: "admin-2", email: "admin2@test.com" });
    });

    it("should handle missing email gracefully", async () => {
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: "admin-3", role: "ADMIN", roles: ["ADMIN"] },
      });

      const result = await requireAdmin();
      expect(result).toEqual({ id: "admin-3", email: "" });
    });
  });
});

describe("AuthError", () => {
  it("should create error with message and status", () => {
    const error = new AuthError("Test error", 418);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Test error");
    expect(error.status).toBe(418);
  });
});
